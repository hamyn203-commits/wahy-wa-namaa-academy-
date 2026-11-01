'use strict';

function normalizeType(contentType) {
  return String(contentType || '').split(';', 1)[0].trim().toLowerCase();
}

function startsWithBytes(buf, bytes, offset = 0) {
  if (!Buffer.isBuffer(buf) || buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Validates that a binary Buffer's magic bytes match the declared MIME type.
 * Returns { valid: boolean, detected?: string, reason?: string }.
 */
function validateMagicBytes(input, expectedContentType) {
  const buf = Buffer.isBuffer(input)
    ? input
    : input instanceof Uint8Array
      ? Buffer.from(input)
      : null;

  if (!buf || buf.length < 4) {
    return { valid: false, reason: 'Buffer too short to verify file signature' };
  }

  const type = normalizeType(expectedContentType);

  switch (type) {
    case 'application/pdf': {
      // %PDF- (25 50 44 46 2D)
      const valid = startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]);
      return valid ? { valid: true, detected: 'application/pdf' } : { valid: false, reason: 'Invalid PDF signature' };
    }

    case 'image/png': {
      // 89 50 4E 47 0D 0A 1A 0A
      const valid = startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      return valid ? { valid: true, detected: 'image/png' } : { valid: false, reason: 'Invalid PNG signature' };
    }

    case 'image/jpeg': {
      // FF D8 FF
      const valid = startsWithBytes(buf, [0xff, 0xd8, 0xff]);
      return valid ? { valid: true, detected: 'image/jpeg' } : { valid: false, reason: 'Invalid JPEG signature' };
    }

    case 'image/webp': {
      // RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
      const isRiff = startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]);
      const isWebp = buf.length >= 12 && startsWithBytes(buf, [0x57, 0x45, 0x42, 0x50], 8);
      return isRiff && isWebp ? { valid: true, detected: 'image/webp' } : { valid: false, reason: 'Invalid WebP signature' };
    }

    case 'video/mp4':
    case 'video/quicktime':
    case 'audio/mp4':
    case 'audio/x-m4a': {
      // ISO Base Media File Format: bytes 4..7 == 'ftyp' (66 74 79 70) or 'moov' / 'wide'
      const box = buf.length >= 8 ? buf.subarray(4, 8).toString('ascii') : '';
      const valid = ['ftyp', 'moov', 'wide', 'mdat'].includes(box);
      return valid ? { valid: true, detected: type } : { valid: false, reason: 'Invalid MP4/MOV container signature' };
    }

    case 'video/webm':
    case 'audio/webm': {
      // EBML header: 1A 45 DF A3
      const valid = startsWithBytes(buf, [0x1a, 0x45, 0xdf, 0xa3]);
      return valid ? { valid: true, detected: type } : { valid: false, reason: 'Invalid WebM/EBML signature' };
    }

    case 'audio/wav': {
      // RIFF....WAVE
      const isRiff = startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]);
      const isWave = buf.length >= 12 && startsWithBytes(buf, [0x57, 0x41, 0x56, 0x45], 8);
      return isRiff && isWave ? { valid: true, detected: 'audio/wav' } : { valid: false, reason: 'Invalid WAV signature' };
    }

    case 'audio/ogg': {
      // OggS (4F 67 67 53)
      const valid = startsWithBytes(buf, [0x4f, 0x67, 0x67, 0x53]);
      return valid ? { valid: true, detected: 'audio/ogg' } : { valid: false, reason: 'Invalid OGG signature' };
    }

    case 'audio/mpeg':
    case 'audio/aac': {
      // ID3 tag (49 44 33) or MPEG ADTS sync word (FF Ex / FF Fx)
      const isId3 = startsWithBytes(buf, [0x49, 0x44, 0x33]);
      const isSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
      return isId3 || isSync ? { valid: true, detected: type } : { valid: false, reason: 'Invalid MP3/AAC signature' };
    }

    default:
      return { valid: false, reason: `Unsupported MIME type for signature check: ${type}` };
  }
}

module.exports = { validateMagicBytes };
