'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.STORAGE_DRIVER = 'vercel-blob';
process.env.BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || 'vercel_blob_rw_teststore12345_secretvalue';

const app = require('../app');
const Teacher = require('../models/Teacher');
const storage = require('../services/objectStorage');

function requestRange(port, reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('GET /api/uploads/public streams verified teacher videos via same-origin bounded HTTP 206 Range (no cross-origin Blob 302 CORP block) and blocks private files', async (t) => {
  const origExists = Teacher.exists;
  const origInspect = storage.inspectPrivateMedia;
  const origGetPrivate = storage.getPrivateObject;
  const origDriver = storage.getDriver;
  const origValidRef = storage.isVercelBlobReference;

  const totalVideoSize = 5 * 1024 * 1024; // 5 MiB (> 4.5 MB Vercel serverless limit)
  const sampleVideoRef = 'https://teststore12345.private.blob.vercel-storage.com/uploads/teacher-public/owner1/recitation.mp4';

  Teacher.exists = async () => ({ _id: '507f1f77bcf86cd799439011' });
  storage.getDriver = () => 'vercel-blob';
  storage.isVercelBlobReference = () => true;
  storage.inspectPrivateMedia = async () => ({
    contentType: 'video/mp4',
    sizeBytes: totalVideoSize,
  });
  storage.getPrivateObject = async (_ref, opts = {}) => {
    const rangeHeader = String(opts?.headers?.Range || '');
    const match = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader);
    assert.ok(match, `Expected bounded Range header from server, got: ${rangeHeader}`);
    const start = Number(match[1]);
    const end = Number(match[2]);
    const length = end - start + 1;
    assert.ok(length <= 2 * 1024 * 1024, `Chunk length ${length} must stay <= 2 MiB`);

    // Simulate real @vercel/blob get(): statusCode is ALWAYS 200 even when upstream returned 206!
    return {
      statusCode: 200,
      headers: {
        get: (name) => (String(name).toLowerCase() === 'content-range' ? `bytes ${start}-${end}/${totalVideoSize}` : null),
      },
      blob: {
        contentType: 'video/mp4',
        etag: '"video-etag-1"',
      },
      stream: Readable.from([Buffer.alloc(length, 0x11)]),
    };
  };

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Teacher.exists = origExists;
    storage.inspectPrivateMedia = origInspect;
    storage.getPrivateObject = origGetPrivate;
    storage.getDriver = origDriver;
    storage.isVercelBlobReference = origValidRef;
  });

  // 1. Browser / ExoPlayer open-ended Range: bytes=0- -> bounded 2 MiB HTTP 206 Partial Content (same-origin, no 302)
  const videoRes = await requestRange(
    port,
    `/api/uploads/public?ref=${encodeURIComponent(sampleVideoRef)}`,
    { Range: 'bytes=0-' }
  );
  assert.equal(videoRes.status, 206);
  assert.equal(videoRes.headers.location, undefined, 'Must not 302-redirect video to *.private.blob.vercel-storage.com');
  assert.equal(videoRes.headers['content-type'], 'video/mp4');
  assert.equal(videoRes.headers['content-range'], `bytes 0-${2 * 1024 * 1024 - 1}/${totalVideoSize}`);
  assert.equal(videoRes.headers['content-length'], String(2 * 1024 * 1024));
  assert.equal(videoRes.headers['cache-control'], 'no-store');
  assert.equal(videoRes.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.equal(videoRes.buffer.length, 2 * 1024 * 1024);

  // 2. iOS Safari / AVPlayer 2-byte probe (Range: bytes=0-1) -> exact 2-byte HTTP 206
  const safariProbe = await requestRange(
    port,
    `/api/uploads/public?ref=${encodeURIComponent(sampleVideoRef)}`,
    { Range: 'bytes=0-1' }
  );
  assert.equal(safariProbe.status, 206);
  assert.equal(safariProbe.headers['content-range'], `bytes 0-1/${totalVideoSize}`);
  assert.equal(safariProbe.headers['content-length'], '2');
  assert.equal(safariProbe.buffer.length, 2);

  // 3. Unbounded initial probe (no Range header) on a 5 MiB video -> still clamped to 2 MiB HTTP 206 (never crashes serverless!)
  const noRangeProbe = await requestRange(
    port,
    `/api/uploads/public?ref=${encodeURIComponent(sampleVideoRef)}`
  );
  assert.equal(noRangeProbe.status, 206);
  assert.equal(noRangeProbe.headers['content-range'], `bytes 0-${2 * 1024 * 1024 - 1}/${totalVideoSize}`);
  assert.equal(noRangeProbe.buffer.length, 2 * 1024 * 1024);

  // 4. Out-of-bounds Range -> 416 Range Not Satisfiable with Content-Range: bytes */total
  const invalidRange = await requestRange(
    port,
    `/api/uploads/public?ref=${encodeURIComponent(sampleVideoRef)}`,
    { Range: `bytes=${totalVideoSize + 100}-` }
  );
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers['content-range'], `bytes */${totalVideoSize}`);

  // 5. Private teacher document (e.g. Ijazah certificate PDF) MUST remain 403 forbidden
  const privateDocRef = 'https://teststore12345.private.blob.vercel-storage.com/uploads/teacher-private/owner1/ijazah.pdf';
  const privateRes = await requestRange(port, `/api/uploads/public?ref=${encodeURIComponent(privateDocRef)}`);
  assert.equal(privateRes.status, 403);
});
