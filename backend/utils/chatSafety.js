'use strict';

const SAFETY_WARNING_MESSAGE = 'حفاظاً على خصوصية وسلامة الطلاب والمعلمات، يُمنع مشاركة أرقام الهواتف والروابط الخارجية داخل المحادثة';

function normalizeSafetyText(text = '') {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u0640\u00AD\u034F]/g, '')
    .replace(/[\u3002\uFF0E\uFF61\u2024\uFE52]/g, '.')
    .replace(/[\uFF20\uFE6B]/g, '@')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

function containsPhoneNumber(text = '') {
  if (!text) return false;
  const normalized = normalizeSafetyText(text);
  if (/(?:^|[^\d])(?:(?:\+?20|0020)\s*)?0?1[0125][\s\-._/]*(?:\d[\s\-._/]*){8}(?=[^\d]|$)/.test(normalized)) return true;
  if (/(?:^|[^\d])(?:(?:\+?966|00966)\s*)?0?5[\s\-._/]*(?:\d[\s\-._/]*){8}(?=[^\d]|$)/.test(normalized)) return true;
  if (/(?:\+|00)\s*(?:\d[\s\-._/]*){7,15}(?=[^\d]|$)/.test(normalized)) return true;
  const stripped = normalized.replace(/[\s\-._/()+,]/g, '');
  if (/\d{7,}/.test(stripped)) return true;
  // Any punctuation/symbol between digits (010*1234*5678, 010:1234:5678, 010|1234|5678)
  // must not hide a phone number. Nine or more digits covers every mobile format
  // while avoiding false positives on verse citations such as 2:255-260.
  const compactDigits = normalized.replace(/[^\p{L}\p{N}]+/gu, '');
  if (/\d{9,}/.test(compactDigits)) return true;
  const words = normalized.split(/\s+/);
  let consecutiveDigits = 0;
  for (const w of words) {
    if (/^\d+$/.test(w)) {
      consecutiveDigits += w.length;
      if (consecutiveDigits >= 7) return true;
    } else {
      consecutiveDigits = 0;
    }
  }
  return false;
}

function containsExternalLink(text = '') {
  if (!text) return false;
  const lower = normalizeSafetyText(text).toLowerCase();
  if (/https?:\/\/|ftp:\/\/|file:\/\//i.test(lower)) return true;
  if (/www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(lower)) return true;
  const shorteners = [
    'wa.me', 'api.whatsapp.com', 'chat.whatsapp.com',
    't.me', 'telegram.me', 'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 't.co', 'goo.gl',
    'zoom.us', 'meet.google.com', 'teams.microsoft.com',
    'facebook.com', 'fb.me', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'youtu.be', 'discord.gg', 'snapchat.com',
  ];
  for (const s of shorteners) {
    if (lower.includes(s)) return true;
  }
  if (/\b[a-z0-9\-_]{2,}\.(com|org|net|edu|gov|io|me|app|ai|info|biz|site|online|link|store|top|xyz|co|cc|live|space|club|tv|dev|eg|sa|ae|id|my|tr|pk|uk|de|fr|qa|kw|bh|om|jo|ma|dz|tn)\b/i.test(lower)) {
    return true;
  }
  if (/[a-z0-9\-_]{2,}\s*(?:\[dot\]|\(dot\)|\.|\sdot\s|دوت)\s*(?:com|net|org|io|me|co|eg|sa|ae|id|my|tr|uk|de|fr)/i.test(lower)) {
    return true;
  }
  return false;
}

function containsEmail(text = '') {
  if (!text) return false;
  const lower = normalizeSafetyText(text).toLowerCase();
  if (lower.length <= 254 && /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(lower)) return true;
  if (/[a-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\sat\s|آت)\s*[a-z0-9.-]+\s*(?:\.|\sdot\s|دوت)\s*[a-z]{2,}/i.test(lower)) {
    return true;
  }
  return false;
}

function inspectChatSafety(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return { isSafe: true, reason: null, warning: '' };
  if (containsEmail(clean)) return { isSafe: false, reason: 'email', warning: SAFETY_WARNING_MESSAGE };
  if (containsExternalLink(clean)) return { isSafe: false, reason: 'url', warning: SAFETY_WARNING_MESSAGE };
  if (containsPhoneNumber(clean)) return { isSafe: false, reason: 'phone', warning: SAFETY_WARNING_MESSAGE };
  return { isSafe: true, reason: null, warning: '' };
}

module.exports = {
  SAFETY_WARNING_MESSAGE,
  normalizeSafetyText,
  containsPhoneNumber,
  containsExternalLink,
  containsEmail,
  inspectChatSafety,
};
