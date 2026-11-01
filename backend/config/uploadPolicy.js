const path = require('path');
const { validateMagicBytes } = require('../utils/magicBytes');

const PURPOSES = Object.freeze({
  homework: {
    roles: ['student'],
    types: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
    ],
    maxBytes: 25 * 1024 * 1024,
  },
  'recitation-audio': {
    roles: ['student', 'teacher'],
    types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
    maxBytes: 25 * 1024 * 1024,
  },
  'session-chat-audio': {
    roles: ['student', 'teacher'],
    types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
    maxBytes: 10 * 1024 * 1024,
  },
  assignment: {
    roles: ['student'],
    types: ['application/pdf', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm'],
    maxBytes: 50 * 1024 * 1024,
  },
  'payment-proof': {
    roles: ['student', 'guardian'],
    types: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024,
  },
  'course-media': {
    roles: ['teacher', 'admin'],
    types: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'video/webm'],
    maxBytes: 200 * 1024 * 1024,
  },
  'student-avatar': {
    roles: ['student'],
    types: ['image/jpeg', 'image/png'],
    maxBytes: 5 * 1024 * 1024,
  },
  'teacher-public': {
    roles: ['teacher', 'admin', 'teacher-registration'],
    types: ['image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav'],
    maxBytes: 100 * 1024 * 1024,
  },
  'teacher-private': {
    roles: ['teacher', 'admin', 'teacher-registration'],
    types: ['image/jpeg', 'image/png', 'application/pdf'],
    maxBytes: 25 * 1024 * 1024,
  },
  'teacher-update-video': {
    roles: ['teacher'],
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxBytes: 100 * 1024 * 1024,
  },
});

const EXTENSIONS_BY_CONTENT_TYPE = Object.freeze({
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'audio/mpeg': ['.mp3', '.mpeg', '.mpga'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/webm': ['.webm'],
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/aac': ['.aac'],
  'audio/x-m4a': ['.m4a'],
});

function normalizeContentType(value) {
  return String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
}

function getFileExtension(filename) {
  return path.extname(String(filename || '').trim()).toLowerCase();
}

function validateUploadMetadata({ purpose, role, filename, contentType, size }) {
  const rule = PURPOSES[purpose];
  if (!rule) throw new Error('Unsupported upload purpose');

  if (!role || !rule.roles.includes(role)) {
    throw new Error('Not allowed for this upload purpose');
  }

  const cleanFilename = String(filename || '').trim();
  if (!cleanFilename || cleanFilename.length > 180 || /[\u0000-\u001f\u007f]/.test(cleanFilename)) {
    throw new Error('Invalid filename');
  }

  const extension = getFileExtension(cleanFilename);
  if (!extension || extension.length > 10) {
    throw new Error('Invalid filename');
  }

  const normalizedType = normalizeContentType(contentType);
  if (!rule.types.includes(normalizedType)) {
    throw new Error('File type is not allowed');
  }

  const allowedExtensions = EXTENSIONS_BY_CONTENT_TYPE[normalizedType] || [];
  if (!allowedExtensions.includes(extension)) {
    throw new Error('File extension does not match content type');
  }

  const numericSize = Number(size);
  if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > rule.maxBytes) {
    throw new Error('Invalid file size');
  }

  return {
    rule,
    contentType: normalizedType,
    size: numericSize,
    extension,
  };
}

module.exports = {
  PURPOSES,
  EXTENSIONS_BY_CONTENT_TYPE,
  normalizeContentType,
  getFileExtension,
  validateUploadMetadata,
  validateMagicBytes,
};
