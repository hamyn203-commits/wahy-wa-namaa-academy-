'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateUploadMetadata,
  normalizeContentType,
} = require('../config/uploadPolicy');
const storage = require('../services/objectStorage');

test('upload policy accepts a valid teacher-private PDF', () => {
  const result = validateUploadMetadata({
    purpose: 'teacher-private',
    role: 'teacher-registration',
    filename: 'graduation-certificate.pdf',
    contentType: 'application/pdf',
    size: 2 * 1024 * 1024,
  });

  assert.equal(result.contentType, 'application/pdf');
  assert.equal(result.extension, '.pdf');
});

test('upload policy normalizes content type parameters and case', () => {
  assert.equal(
    normalizeContentType(' Image/JPEG ; charset=binary '),
    'image/jpeg'
  );

  const result = validateUploadMetadata({
    purpose: 'teacher-public',
    role: 'teacher',
    filename: 'profile.JPEG',
    contentType: 'IMAGE/JPEG',
    size: 200_000,
  });

  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.extension, '.jpeg');
});

test('upload policy rejects extension and MIME spoofing', () => {
  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-public',
      role: 'teacher',
      filename: 'avatar.html',
      contentType: 'image/jpeg',
      size: 100_000,
    }),
    /File extension does not match content type/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-private',
      role: 'teacher',
      filename: 'identity.jpg',
      contentType: 'application/pdf',
      size: 100_000,
    }),
    /File extension does not match content type/
  );
});

test('upload policy enforces role, purpose, type and maximum size', () => {
  assert.throws(
    () => validateUploadMetadata({
      purpose: 'course-media',
      role: 'student',
      filename: 'lesson.mp4',
      contentType: 'video/mp4',
      size: 1_000_000,
    }),
    /Not allowed for this upload purpose/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-private',
      role: 'teacher',
      filename: 'archive.zip',
      contentType: 'application/zip',
      size: 50_000,
    }),
    /File type is not allowed/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-private',
      role: 'teacher',
      filename: 'identity.pdf',
      contentType: 'application/pdf',
      size: 26 * 1024 * 1024,
    }),
    /Invalid file size/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'unknown-purpose',
      role: 'admin',
      filename: 'file.pdf',
      contentType: 'application/pdf',
      size: 100,
    }),
    /Unsupported upload purpose/
  );
});

test('object references reject unsafe paths and enforce owner prefix', () => {
  assert.equal(
    storage.isSafeObjectPath('uploads/teacher-private/user-1/id.pdf'),
    true
  );
  assert.equal(
    storage.isSafeObjectPath('uploads/teacher-private/user-1/../user-2/id.pdf'),
    false
  );
  assert.equal(
    storage.isSafeObjectPath('uploads/teacher-private/user-1//id.pdf'),
    false
  );
  assert.equal(
    storage.isSafeObjectPath('uploads\\teacher-private\\user-1\\id.pdf'),
    false
  );

  assert.equal(
    storage.referenceMatches(
      'uploads/teacher-private/user-1/id.pdf',
      'teacher-private',
      'user-1'
    ),
    true
  );
  assert.equal(
    storage.referenceMatches(
      'uploads/teacher-private/user-2/id.pdf',
      'teacher-private',
      'user-1'
    ),
    false
  );
});

test('Vercel Blob references require HTTPS and the expected host suffix', () => {
  assert.equal(
    storage.isVercelBlobReference('https://store.private.blob.vercel-storage.com/uploads/file.pdf'),
    true
  );
  assert.equal(
    storage.isVercelBlobReference('http://store.private.blob.vercel-storage.com/uploads/file.pdf'),
    false
  );
  assert.equal(
    storage.isVercelBlobReference('https://blob.vercel-storage.com.evil.example/uploads/file.pdf'),
    false
  );
});


test('teacher public video allows 100 MB and rejects anything larger', () => {
  const allowed = validateUploadMetadata({
    purpose: 'teacher-public',
    role: 'teacher-registration',
    filename: 'recitation.mp4',
    contentType: 'video/mp4',
    size: 100 * 1024 * 1024,
  });

  assert.equal(allowed.size, 100 * 1024 * 1024);

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-public',
      role: 'teacher-registration',
      filename: 'recitation.mp4',
      contentType: 'video/mp4',
      size: (100 * 1024 * 1024) + 1,
    }),
    /Invalid file size/
  );
});

test('teacher JPEG uploads accept JFIF extension', () => {
  const result = validateUploadMetadata({
    purpose: 'teacher-public',
    role: 'teacher-registration',
    filename: 'profile.jfif',
    contentType: 'image/jpeg',
    size: 500_000,
  });

  assert.equal(result.extension, '.jfif');
});


test('teacher camera uploads accept iPhone QuickTime MOV within the 100 MB cap', () => {
  const result = validateUploadMetadata({
    purpose: 'teacher-public',
    role: 'teacher-registration',
    filename: 'camera-video.mov',
    contentType: 'video/quicktime',
    size: 80 * 1024 * 1024,
  });

  assert.equal(result.extension, '.mov');
  assert.equal(result.contentType, 'video/quicktime');

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-public',
      role: 'teacher-registration',
      filename: 'camera-video.mov',
      contentType: 'video/quicktime',
      size: (100 * 1024 * 1024) + 1,
    }),
    /Invalid file size/
  );
});


test('session chat voice notes are private student/teacher uploads capped at 10 MB', () => {
  const allowed = validateUploadMetadata({
    purpose: 'session-chat-audio',
    role: 'student',
    filename: 'voice.webm',
    contentType: 'audio/webm',
    size: 10 * 1024 * 1024,
  });

  assert.equal(allowed.size, 10 * 1024 * 1024);

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'session-chat-audio',
      role: 'teacher',
      filename: 'voice.webm',
      contentType: 'audio/webm',
      size: (10 * 1024 * 1024) + 1,
    }),
    /Invalid file size/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'session-chat-audio',
      role: 'admin',
      filename: 'voice.webm',
      contentType: 'audio/webm',
      size: 1_000,
    }),
    /Not allowed/
  );
});


test('homework submissions allow PDF, images (JPEG, PNG, WebP) and audio files', () => {
  const pdfResult = validateUploadMetadata({
    purpose: 'homework',
    role: 'student',
    filename: 'worksheet.pdf',
    contentType: 'application/pdf',
    size: 2 * 1024 * 1024,
  });
  assert.equal(pdfResult.contentType, 'application/pdf');
  assert.equal(pdfResult.extension, '.pdf');

  const jpgResult = validateUploadMetadata({
    purpose: 'homework',
    role: 'student',
    filename: 'page1.jpg',
    contentType: 'image/jpeg',
    size: 1 * 1024 * 1024,
  });
  assert.equal(jpgResult.contentType, 'image/jpeg');

  const pngResult = validateUploadMetadata({
    purpose: 'homework',
    role: 'student',
    filename: 'exercise.png',
    contentType: 'image/png',
    size: 1 * 1024 * 1024,
  });
  assert.equal(pngResult.contentType, 'image/png');

  const webpResult = validateUploadMetadata({
    purpose: 'homework',
    role: 'student',
    filename: 'submission.webp',
    contentType: 'image/webp',
    size: 500 * 1024,
  });
  assert.equal(webpResult.contentType, 'image/webp');
  assert.equal(webpResult.extension, '.webp');

  const audioResult = validateUploadMetadata({
    purpose: 'homework',
    role: 'student',
    filename: 'recitation.mp3',
    contentType: 'audio/mpeg',
    size: 5 * 1024 * 1024,
  });
  assert.equal(audioResult.contentType, 'audio/mpeg');
});

test('validateMagicBytes correctly recognizes WebP signature', () => {
  const { validateMagicBytes } = require('../utils/magicBytes');
  // RIFF header (4 bytes) + file size (4 bytes) + WEBP (4 bytes)
  const webpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    0x24, 0x00, 0x00, 0x00, // size
    0x57, 0x45, 0x42, 0x50, // 'WEBP'
    0x56, 0x50, 0x38, 0x20, // 'VP8 '
  ]);

  const result = validateMagicBytes(webpBuffer, 'image/webp');
  assert.equal(result.valid, true);
  assert.equal(result.detected, 'image/webp');

  const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const invalidResult = validateMagicBytes(invalidBuffer, 'image/webp');
  assert.equal(invalidResult.valid, false);
});
