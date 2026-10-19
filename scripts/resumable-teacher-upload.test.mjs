import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadResumableParts, isTransientUploadError } from '../src/lib/resumableTeacherUpload.mjs';

function harness({ failOnce = false } = {}) {
  const parts = [], completed = [], starts = [];
  let failed = false;
  const client = {
    create: async (pathname) => {
      starts.push(pathname);
      return { key: 'private-key', uploadId: 'upload-123' };
    },
    uploadPart: async (_pathname, blob, opts) => {
      parts.push(opts.partNumber);
      if (failOnce && opts.partNumber === 2 && !failed) {
        failed = true;
        throw new TypeError('Failed to fetch');
      }
      opts.onUploadProgress?.({ loaded: blob.size, total: blob.size, percentage: 100 });
      return { partNumber: opts.partNumber, etag: 'etag-' + opts.partNumber };
    },
    complete: async (pathname, uploaded, opts) => {
      completed.push(uploaded);
      assert.equal(opts.key, 'private-key');
      return { pathname, url: 'https://example.test/video.mp4' };
    },
  };
  return { client, starts, parts, completed };
}

test('retains confirmed parts after network interruption, then sends only missing parts', async () => {
  const file = new Blob(['abcdefghijkl'], { type: 'video/mp4' });
  const sessions = new WeakMap();
  const x = harness({ failOnce: true });
  const opts = {
    scope: 'user/teacher-public',
    sessions,
    pathname: 'uploads/teacher-public/user/original.mp4',
    getToken: async () => 'scoped-client-token',
    client: x.client,
    partSize: 5,
    concurrency: 1,
    maxAttempts: 1,
  };
  await assert.rejects(uploadResumableParts(file, opts), /Failed to fetch/);
  const events = [];
  const uploaded = await uploadResumableParts(file, {
    ...opts,
    pathname: 'uploads/teacher-public/user/new-random-name.mp4',
    onUploadProgress: (event) => events.push(event),
  });
  assert.equal(uploaded.pathname, opts.pathname);
  assert.deepEqual(x.starts, [opts.pathname]);
  assert.deepEqual(x.parts, [1, 2, 2, 3]);
  assert.deepEqual(x.completed[0].map((item) => item.partNumber), [1, 2, 3]);
  assert.ok(events[0].loaded >= 5);
  assert.equal(events.at(-1).percentage, 100);
});

test('deduplicates a finished file only through the caller cache, not stale partial sessions', async () => {
  const file = new Blob(['abcdefghijkl'], { type: 'video/mp4' });
  const x = harness();
  const sessions = new WeakMap();
  const opts = {
    scope: 'one',
    pathname: 'uploads/teacher-public/user/file.mp4',
    sessions,
    getToken: async () => 'token',
    client: x.client,
    concurrency: 1,
    partSize: 5,
  };
  await uploadResumableParts(file, opts);
  await uploadResumableParts(file, { ...opts, scope: 'another-user' });
  assert.equal(x.starts.length, 2);
  assert.deepEqual(x.parts, [1, 2, 3, 1, 2, 3]);
});

test('reports meaningful progress and does not show 100% before provider completion', async () => {
  const events = [], states = [];
  const x = harness();
  const file = new Blob(['abcdefghijkl'], { type: 'video/mp4' });
  await uploadResumableParts(file, {
    scope: 'test', pathname: 'uploads/teacher-public/one/video.mp4',
    sessions: new WeakMap(), getToken: async () => 'token',
    client: x.client, partSize: 5, concurrency: 1,
    onUploadProgress: e => events.push(e),
    onUploadState: s => states.push(s),
  });
  assert.ok(events.some(p => p.percentage > 0 && p.percentage < 100));
  assert.equal(events.at(-1).percentage, 100);
  assert.ok(states.includes('finalizing'));
});

test('does not retry permanently rejected authorization', async () => {
  const file = new Blob(['abcdef'], { type: 'video/mp4' });
  const x = harness();
  x.client.uploadPart = async () => { throw new Error('Upload authorization rejected (403)'); };
  await assert.rejects(uploadResumableParts(file, {
    scope: 'test', pathname: 'uploads/teacher-public/one/video.mp4',
    sessions: new WeakMap(), getToken: async () => 'token',
    client: x.client, partSize: 5, concurrency: 1,
  }), /403/);
});

test('identifies network errors without retrying client validation failures', () => {
  assert.equal(isTransientUploadError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientUploadError(new Error('Network timeout')), true);
  assert.equal(isTransientUploadError(new Error('Upload authorization rejected (403)')), false);
});
