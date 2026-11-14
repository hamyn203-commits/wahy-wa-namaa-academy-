const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const objectStorage = require('../services/objectStorage');
const { PURPOSES, normalizeContentType } = require('../config/uploadPolicy');
const { validateMagicBytes } = require('../utils/magicBytes');

async function readObjectHeaderBytes(reference, maxBytes = 64) {
  const obj = await objectStorage.getPrivateObject(reference, {
    headers: { Range: `bytes=0-${maxBytes - 1}` },
  });
  if (!obj?.stream) return null;

  const chunks = [];
  let total = 0;

  if (typeof obj.stream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of obj.stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
      if (total >= maxBytes) {
        if (typeof obj.stream.destroy === 'function') obj.stream.destroy();
        break;
      }
    }
  } else if (typeof obj.stream.getReader === 'function') {
    const reader = obj.stream.getReader();
    try {
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        chunks.push(buf);
        total += buf.length;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  return Buffer.concat(chunks).subarray(0, maxBytes);
}

router.get('/status', protect, (_req, res) => {
  res.json({
    configured: objectStorage.isConfigured(),
    driver: objectStorage.getDriver(),
    directUpload: true,
  });
});

router.post('/upload', protect, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    const storageFile = req.body?.storageFile;
    const reference = storageFile?.url || storageFile?.pathname;

    if (!reference) {
      return res.status(400).json({
        error: 'Direct object-storage upload is required',
        code: 'DIRECT_UPLOAD_REQUIRED',
      });
    }

    const driver = objectStorage.getDriver();
    const validReference = ['vercel-blob', 's3'].includes(driver)
      ? objectStorage.isOwnedObjectReference(reference, 'recitation-audio', req.user.id, driver)
      : objectStorage.referenceMatches(reference, 'recitation-audio', req.user.id);

    if (!validReference) {
      return res.status(400).json({ error: 'Invalid audio upload reference' });
    }

    const normalizedMime = normalizeContentType(storageFile.contentType || 'audio/mpeg');
    if (!PURPOSES['recitation-audio'].types.includes(normalizedMime)) {
      return res.status(400).json({ error: 'Unsupported audio content type' });
    }

    const declaredSize = Number(storageFile.size || 0);
    if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > PURPOSES['recitation-audio'].maxBytes) {
      return res.status(413).json({ error: 'Audio file exceeds maximum allowed size' });
    }

    if (['vercel-blob', 's3'].includes(driver)) {
      const headerBytes = await readObjectHeaderBytes(reference, 64);
      if (!headerBytes || headerBytes.length < 4) {
        return res.status(400).json({ error: 'Uploaded audio object could not be verified' });
      }
      const magicCheck = validateMagicBytes(headerBytes, normalizedMime);
      if (!magicCheck.valid) {
        return res.status(400).json({
          error: 'Audio binary signature does not match declared type',
          code: 'INVALID_AUDIO_MAGIC_BYTES',
        });
      }
    }

    return res.status(200).json({
      message: 'Audio upload finalized',
      file: {
        url: reference,
        name: String(storageFile.name || 'recitation').slice(0, 180),
        size: declaredSize,
        contentType: normalizedMime,
      },
      driver,
    });
  } catch (error) {
    console.error('Audio finalization error:', error.message);
    return res.status(500).json({ error: 'Failed to finalize audio upload' });
  }
});

module.exports = router;
