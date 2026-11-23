function normalizeEgyptDigits(digits) {
  if (/^2001\d{9}$/.test(digits)) {
    return '+20' + digits.slice(3);
  }
  if (/^201\d{9}$/.test(digits)) {
    return '+' + digits;
  }
  return null;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let compact = raw.replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) compact = '+' + compact.slice(2);

  if (compact.startsWith('+')) {
    const digits = compact.slice(1).replace(/\D/g, '');
    const egyptNormalized = normalizeEgyptDigits(digits);
    if (egyptNormalized) return egyptNormalized;
    return digits.length >= 8 && digits.length <= 15 ? '+' + digits : '';
  }

  const digits = compact.replace(/\D/g, '');
  if (!digits) return '';

  // Egypt local mobile format: 01XXXXXXXXX -> +201XXXXXXXXX
  if (/^01\d{9}$/.test(digits)) {
    return '+20' + digits.slice(1);
  }

  // Egypt international without + (201XXXXXXXXX or 2001XXXXXXXXX)
  const egyptNormalized = normalizeEgyptDigits(digits);
  if (egyptNormalized) {
    return egyptNormalized;
  }

  return digits.length >= 8 && digits.length <= 15 ? '+' + digits : '';
}

function maskPhone(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return '';
  const suffix = normalized.slice(-4);
  const prefix = normalized.startsWith('+') ? normalized.slice(0, Math.min(4, normalized.length - 4)) : '';
  return `${prefix}••••${suffix}`;
}

function syntheticPhoneEmail(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return '';
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  return `teacher-phone-${digits}@phone.wahywanamaa.local`;
}

module.exports = { normalizePhone, maskPhone, syntheticPhoneEmail };
