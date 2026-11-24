'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');

process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = 't03-test-access-secret-1234567890-abcdef';
process.env.JWT_REFRESH_SECRET = 't03-test-refresh-secret-1234567890-abcdef';
delete process.env.MONGODB_URI;
delete process.env.MONGODB_URL;

const app = require('../app');
const Teacher = require('../models/Teacher');
const objectStorage = require('../services/objectStorage');

function requestRaw(server, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method: 'GET',
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString('utf8'));
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, buffer: buf });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function matchesMongoCandidate(storedValue, candidateList) {
  return candidateList.some((candidate) => (
    candidate instanceof RegExp
      ? candidate.test(String(storedValue || ''))
      : String(storedValue || '') === String(candidate)
  ));
}

test('public media proxy resolves teacher photos even when stored under a different API_PUBLIC_URL origin, and fails closed otherwise', async () => {
  const prevDriver = process.env.FILE_STORAGE_DRIVER;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevApiPublic = process.env.API_PUBLIC_URL;

  const storeId = 'store99abc';
  const rawBlobUrl = `https://${storeId}.private.blob.vercel-storage.com/uploads/teacher-public/user123/1700000000-uuid-avatar.jpg`;
  const oldSavedProxy = `https://legacy-api.vercel.app/api/uploads/public?ref=${encodeURIComponent(rawBlobUrl)}`;

  const originals = {
    teacherExists: Teacher.exists,
    getPrivateObject: objectStorage.getPrivateObject,
  };

  process.env.BLOB_READ_WRITE_TOKEN = `vercel_blob_rw_${storeId}_secret`;
  process.env.API_PUBLIC_URL = 'https://api.wahywanamaa.com';
  delete process.env.FILE_STORAGE_DRIVER;

  let storedTeachers = [
    { status: 'approved', isVerified: true, media: { profilePhoto: oldSavedProxy } },
  ];

  Teacher.exists = async (query) => {
    const orClauses = query?.$or || [];
    const matched = storedTeachers.some((doc) => {
      if (query.status && doc.status !== query.status) return false;
      if (query.isVerified !== undefined && doc.isVerified !== query.isVerified) return false;
      return orClauses.some((clause) => {
        const [fieldPath, cond] = Object.entries(clause)[0] || [];
        const key = fieldPath.replace('media.', '');
        const list = cond?.$in || [];
        return matchesMongoCandidate(doc.media?.[key], list);
      });
    });
    return matched ? { _id: '507f1f77bcf86cd799439055' } : null;
  };

  objectStorage.getPrivateObject = async () => ({
    statusCode: 200,
    blob: { contentType: 'image/jpeg', etag: '"img-etag-1"' },
    stream: Readable.from([Buffer.from([0xff, 0xd8, 0xff, 0xe0])]),
  });

  const server = app.listen(0);
  try {
    // 1. Approved teacher photo stored with an old API_PUBLIC_URL still resolves
    const okRes = await requestRaw(
      server,
      `/api/uploads/public?ref=${encodeURIComponent(rawBlobUrl)}`
    );
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers['content-type'], 'image/jpeg');
    assert.match(String(okRes.headers['cache-control'] || ''), /max-age=86400/);

    // 2. Unapproved teacher media fails closed with 404
    storedTeachers = [
      { status: 'pending', isVerified: false, media: { profilePhoto: oldSavedProxy } },
    ];
    const unapprovedRes = await requestRaw(
      server,
      `/api/uploads/public?ref=${encodeURIComponent(rawBlobUrl)}`
    );
    assert.equal(unapprovedRes.status, 404);

    // 3. Unowned/private purpose paths are rejected with 403
    const privateRes = await requestRaw(
      server,
      `/api/uploads/public?ref=${encodeURIComponent(`https://${storeId}.private.blob.vercel-storage.com/uploads/payment-proof/u1/receipt.png`)}`
    );
    assert.equal(privateRes.status, 403);
  } finally {
    Teacher.exists = originals.teacherExists;
    objectStorage.getPrivateObject = originals.getPrivateObject;
    if (prevDriver === undefined) delete process.env.FILE_STORAGE_DRIVER; else process.env.FILE_STORAGE_DRIVER = prevDriver;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
    if (prevApiPublic === undefined) delete process.env.API_PUBLIC_URL; else process.env.API_PUBLIC_URL = prevApiPublic;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('public GET /api/teachers and GET /api/teachers/:id strip sensitive fields, return video URLs for marketplace, and return 404 on invalid IDs', async () => {
  const originals = {
    teacherFind: Teacher.find,
    teacherFindOne: Teacher.findOne,
    teacherCount: Teacher.countDocuments,
  };

  const sampleDoc = {
    _id: '507f1f77bcf86cd799439088',
    status: 'approved',
    isVerified: true,
    user: { _id: '507f1f77bcf86cd799439011', name: 'الشيخ عبد الرحمن', bio: 'حافظ ومجاز بالقراءات' },
    personalInfo: { fullName: 'الشيخ عبد الرحمن', phone: '+2010000000', country: 'مصر', city: 'القاهرة', gender: 'male' },
    academicInfo: { university: 'الأزهر', faculty: 'القرآن الكريم', specialization: 'التجويد', qualification: 'إجازة' },
    quranInfo: { memorizedParts: 30, numberOfIjazat: 2, teachingExperience: 8, specializations: ['tajweed', 'ijaza'] },
    media: {
      profilePhoto: '/api/uploads/public?ref=https%3A%2F%2Fstore.private.blob.vercel-storage.com%2Fuploads%2Fteacher-public%2Fu1%2Fp.jpg',
      introductionVideo: '/api/uploads/public?ref=https%3A%2F%2Fstore.private.blob.vercel-storage.com%2Fuploads%2Fteacher-public%2Fu1%2Fintro.mp4',
      recitationVideo: '/api/uploads/public?ref=https%3A%2F%2Fstore.private.blob.vercel-storage.com%2Fuploads%2Fteacher-public%2Fu1%2Frec.mp4',
    },
    documents: { idCardFront: 'private/secret-id.jpg' },
    earnings: { totalEarned: 9999 },
    reviewNotes: [{ note: 'internal note' }],
    rating: { average: 4.9, count: 14 },
  };

  Teacher.find = () => {
    const chain = {
      select: () => chain,
      populate: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => [structuredClone(sampleDoc)],
    };
    return chain;
  };
  Teacher.countDocuments = async () => 1;
  Teacher.findOne = () => {
    const chain = {
      select: () => chain,
      populate: () => chain,
      lean: async () => structuredClone(sampleDoc),
    };
    return chain;
  };

  const server = app.listen(0);
  try {
    const listRes = await requestRaw(server, '/api/teachers');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.teachers.length, 1);
    const listed = listRes.body.teachers[0];
    assert.equal(listed.documents, undefined);
    assert.equal(listed.earnings, undefined);
    assert.equal(listed.personalInfo.phone, undefined);
    assert.ok(listed.media.profilePhoto);
    assert.ok(listed.media.introductionVideo);
    assert.ok(listed.media.recitationVideo);

    const detailRes = await requestRaw(server, '/api/teachers/507f1f77bcf86cd799439088');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.documents, undefined);
    assert.equal(detailRes.body.reviewNotes, undefined);
    assert.equal(detailRes.body.personalInfo.phone, undefined);
    assert.equal(detailRes.body.user.name, 'الشيخ عبد الرحمن');

    const invalidRes = await requestRaw(server, '/api/teachers/not-a-valid-object-id');
    assert.equal(invalidRes.status, 404);
  } finally {
    Teacher.find = originals.teacherFind;
    Teacher.findOne = originals.teacherFindOne;
    Teacher.countDocuments = originals.teacherCount;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('frontend teacherPublicImage and teacherPublicVideo preserve /api/uploads/public proxy for Vercel Blob teacher media instead of stripping to 404 /uploads/teacher-public/*', async () => {
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  const mediaModuleUrl = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'lib', 'teacherMedia.js')).href;
  const { teacherPublicImage, teacherPublicVideo, teacherPublicAudio } = await import(mediaModuleUrl);

  const blobPhoto = 'https://aq8k9adykv45hcpa.private.blob.vercel-storage.com/uploads/teacher-public/teacher-phone-201225787858-phone.wahywanamaa.local/photo.jpg';
  const proxiedPhoto = `https://api.wahywanamaa.com/api/uploads/public?ref=${encodeURIComponent(blobPhoto)}`;

  const blobVideo = 'https://aq8k9adykv45hcpa.private.blob.vercel-storage.com/uploads/teacher-public/teacher-phone-201225787858-phone.wahywanamaa.local/recitation.mp4';
  const proxiedVideo = `https://api.wahywanamaa.com/api/uploads/public?ref=${encodeURIComponent(blobVideo)}`;

  const blobAudio = 'https://aq8k9adykv45hcpa.private.blob.vercel-storage.com/uploads/teacher-public/teacher-phone-201225787858-phone.wahywanamaa.local/sample.mp3';
  const proxiedAudio = `https://api.wahywanamaa.com/api/uploads/public?ref=${encodeURIComponent(blobAudio)}`;

  // 1. Proxied and raw Vercel Blob teacher videos MUST resolve to same-origin /api/uploads/public?ref=... (NOT /uploads/teacher-public/...)
  assert.equal(teacherPublicVideo(proxiedVideo), `/api/uploads/public?ref=${encodeURIComponent(blobVideo)}`);
  assert.equal(teacherPublicVideo(blobVideo), `/api/uploads/public?ref=${encodeURIComponent(blobVideo)}`);

  // 2. Proxied and raw Vercel Blob teacher photos MUST resolve to same-origin /api/uploads/public?ref=... (NOT /uploads/teacher-public/...)
  assert.equal(teacherPublicImage(proxiedPhoto), `/api/uploads/public?ref=${encodeURIComponent(blobPhoto)}`);
  assert.equal(teacherPublicImage(blobPhoto), `/api/uploads/public?ref=${encodeURIComponent(blobPhoto)}`);

  // 3. Audio clips resolve cleanly to /api/uploads/public?ref=...
  assert.equal(typeof teacherPublicAudio, 'function');
  assert.equal(teacherPublicAudio(proxiedAudio), `/api/uploads/public?ref=${encodeURIComponent(blobAudio)}`);

  // 4. Private KYC or paid course-media blob paths must NEVER be turned into public URLs
  const privateDoc = 'https://aq8k9adykv45hcpa.private.blob.vercel-storage.com/uploads/teacher-private/u1/id.jpg';
  const paidCourseVideo = 'https://aq8k9adykv45hcpa.private.blob.vercel-storage.com/uploads/course-media/c1/lesson.mp4';
  assert.equal(teacherPublicImage(privateDoc), '/default-teacher.png');
  assert.equal(teacherPublicVideo(privateDoc), '');
  assert.equal(teacherPublicVideo(paidCourseVideo), '');
  assert.equal(teacherPublicImage(paidCourseVideo), '/default-teacher.png');

  // 5. Local relative E2E / legacy paths continue working
  assert.equal(teacherPublicVideo('/e2e-recitation.mp4'), '/e2e-recitation.mp4');
  assert.equal(teacherPublicVideo('/uploads/teachers/public/legacy.mp4'), '/uploads/teachers/public/legacy.mp4');
});
