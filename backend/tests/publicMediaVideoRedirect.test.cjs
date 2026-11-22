'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.STORAGE_DRIVER = 'vercel-blob';
process.env.BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || 'vercel_blob_rw_teststore12345_secretvalue';

const app = require('../app');
const Teacher = require('../models/Teacher');
const storage = require('../services/objectStorage');

test('GET /api/uploads/public redirects verified teacher videos to signed CDN URL with no-store and blocks private files', async (t) => {
  const origExists = Teacher.exists;
  const origTempUrl = storage.createTemporaryReadUrl;
  const origDriver = storage.getDriver;
  const origValidRef = storage.isVercelBlobReference;

  const sampleVideoRef = 'https://teststore12345.private.blob.vercel-storage.com/uploads/teacher-public/owner1/recitation.mp4';
  const signedVideoUrl = 'https://teststore12345.private.blob.vercel-storage.com/uploads/teacher-public/owner1/recitation.mp4?signed=1';

  Teacher.exists = async () => ({ _id: '507f1f77bcf86cd799439011' });
  storage.getDriver = () => 'vercel-blob';
  storage.isVercelBlobReference = () => true;
  storage.createTemporaryReadUrl = async () => ({ url: signedVideoUrl, expiresAt: Date.now() + 60000 });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Teacher.exists = origExists;
    storage.createTemporaryReadUrl = origTempUrl;
    storage.getDriver = origDriver;
    storage.isVercelBlobReference = origValidRef;
  });

  const getHeadless = (reqPath) =>
    new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${reqPath}`, (res) => {
        res.resume();
        resolve({ status: res.statusCode, headers: res.headers });
      }).on('error', reject);
    });

  // 1. Public verified teacher MP4 video -> 302 redirect with Cache-Control: no-store
  const videoRes = await getHeadless(`/api/uploads/public?ref=${encodeURIComponent(sampleVideoRef)}`);
  assert.equal(videoRes.status, 302);
  assert.equal(videoRes.headers.location, signedVideoUrl);
  assert.equal(videoRes.headers['cache-control'], 'no-store');

  // 2. Private teacher document (e.g. Ijazah certificate PDF) MUST remain 403 forbidden
  const privateDocRef = 'https://teststore12345.private.blob.vercel-storage.com/uploads/teacher-private/owner1/ijazah.pdf';
  const privateRes = await getHeadless(`/api/uploads/public?ref=${encodeURIComponent(privateDocRef)}`);
  assert.equal(privateRes.status, 403);
});
