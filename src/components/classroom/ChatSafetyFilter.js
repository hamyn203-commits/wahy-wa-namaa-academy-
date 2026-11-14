/**
 * ═══════════════════════════════════════════════════════════════════
 * Wahy Wa Namaa Academy — Chat Safety & Moral Filter (V7.3)
 * فلتر الأمان والشات الأخلاقي لغرف الحلقات الافتراضية
 * ═══════════════════════════════════════════════════════════════════
 * 
 * - حظر مشاركة أرقام الهواتف (المصرية، الخليجية، الدولية، والأرقام > 7 خانات)
 * - حظر مشاركة الروابط الخارجية (URLs, HTTP, WWW, TLDs, Shorteners)
 * - حظر مشاركة عناوين البريد الإلكتروني (Emails)
 * - دعم الأرقام المشرقية (٠١٢٣٤٥٦٧٨٩) والتحايل بالفراغات والنقاط
 */

export const SAFETY_WARNING_MESSAGE = 'حفاظاً على خصوصية وسلامة الطلاب والمعلمات، يُمنع مشاركة أرقام الهواتف والروابط الخارجية داخل الغرفة';

/**
 * تحويل الأرقام العربية المشرقية إلى أرقام قياسية
 */
/**
 * تطبيع النص من المحارف المخفية والتطويل والأرقام المشرقية والفارسية/الأردية
 */
export function normalizeSafetyText(text = '') {
  return String(text || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u0640]/g, '')
    .replace(/[\u0660-\u0669]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (char) => String(char.charCodeAt(0) - 0x06f0));
}

export function normalizeArabicDigits(text = '') {
  return normalizeSafetyText(text);
}

/**
 * فحص وجود أرقام هواتف
 * يلتقط:
 * - 010..., 011..., 012..., 015... (مصر)
 * - +966..., 05..., 00966... (السعودية والخليج)
 * - أي تسلسل رقمي يزيد عن 7 أرقام سواء متصل أو مفصول بمسافات أو رموز
 */
export function containsPhoneNumber(text = '') {
  if (!text) return false;
  const normalized = normalizeArabicDigits(text);

  // 1. أرقام هواتف مصرية معروفة حتى مع مسافات (010, 011, 012, 015)
  const egyptPattern = /(?:^|[^\d])(?:(?:\+?20|0020)\s*)?0?1[0125][\s\-._/]*(?:\d[\s\-._/]*){8}(?=[^\d]|$)/;
  if (egyptPattern.test(normalized)) return true;

  // 2. أرقام خليجية/سعودية (05, +966, 00966)
  const gulfPattern = /(?:^|[^\d])(?:(?:\+?966|00966)\s*)?0?5[\s\-._/]*(?:\d[\s\-._/]*){8}(?=[^\d]|$)/;
  if (gulfPattern.test(normalized)) return true;

  // 3. كود دولي صريح (+ أو 00 متبوع بـ 7 إلى 15 رقماً)
  const internationalPattern = /(?:\+|00)\s*(?:\d[\s\-._/]*){7,15}(?=[^\d]|$)/;
  if (internationalPattern.test(normalized)) return true;

  // 4. استخراج كل الأرقام بعد تنظيف الفواصل المعتادة
  const strippedOfSeparators = normalized.replace(/[\s\-._/()+,]/g, '');
  // البحث عن تسلسل رقمي من 7 خانات متتالية فما فوق
  if (/\d{7,}/.test(strippedOfSeparators)) {
    return true;
  }

  // 5. فحص وجود أرقام كثيفة منفصلة (لمنع كتابة 0 1 0 5 4 ...)
  const digitMatches = normalized.match(/\d/g);
  if (digitMatches && digitMatches.length >= 7) {
    const words = normalized.split(/\s+/);
    let consecutiveDigitCount = 0;
    for (const w of words) {
      if (/^\d+$/.test(w)) {
        consecutiveDigitCount += w.length;
        if (consecutiveDigitCount >= 7) return true;
      } else {
        consecutiveDigitCount = 0;
      }
    }
  }

  return false;
}

/**
 * فحص وجود روابط ومواقع خارجية
 */
export function containsExternalLink(text = '') {
  if (!text) return false;
  const lower = normalizeSafetyText(text).toLowerCase();

  // 1. بروتوكولات صريحة
  if (/https?:\/\/|ftp:\/\/|file:\/\//i.test(lower)) return true;

  // 2. بادئة www
  if (/www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(lower)) return true;

  // 3. روابط شات ومكالمات واختصار
  const shorteners = [
    'wa.me', 'api.whatsapp.com', 'chat.whatsapp.com',
    't.me', 'telegram.me',
    'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy',
    'zoom.us', 'meet.google.com', 'teams.microsoft.com',
    'facebook.com', 'fb.me', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'youtu.be', 'discord.gg'
  ];
  for (const s of shorteners) {
    if (lower.includes(s)) return true;
  }

  // 4. نطاقات عامة شهيرة (.com, .org, .net, .io, إلخ)
  const domainPattern = /\b[a-z0-9\-_]{2,}\.(com|org|net|edu|gov|io|me|app|ai|info|biz|site|online|link|store|top|xyz|co|cc|live|space|club|tv|dev)\b/i;
  if (domainPattern.test(lower)) return true;

  // 5. التحايل بكتابة dot أو دوت
  if (/[a-z0-9\-_]{3,}\s*(?:\[dot\]|\(dot\)|\.|\sdot\s|دوت)\s*(?:com|net|org|io)/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * فحص وجود بريد إلكتروني
 */
export function containsEmail(text = '') {
  if (!text) return false;
  const lower = normalizeSafetyText(text).toLowerCase();

  // بريد إلكتروني قياسي
  const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  if (emailPattern.test(lower)) return true;

  // تحايل بالمسافات أو [at]
  if (/[a-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\sat\s|آت)\s*[a-z0-9.-]+\s*(?:\.|\sdot\s|دوت)\s*[a-z]{2,}/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * الفاحص اللحظي الشامل للرسالة
 * @param {string} text - نص الرسالة
 * @returns {{ isSafe: boolean, safe: boolean, reason: 'phone'|'url'|'email'|null, reasonArabic: string|null, warning: string }}
 */
export function inspectMessage(text = '') {
  if (!text || !text.trim()) {
    return { isSafe: true, safe: true, reason: null, reasonArabic: null, warning: '' };
  }

  if (containsEmail(text)) {
    return {
      isSafe: false,
      safe: false,
      reason: 'email',
      reasonArabic: 'مشاركة البريد الإلكتروني غير مسموح بها',
      warning: SAFETY_WARNING_MESSAGE
    };
  }

  if (containsExternalLink(text)) {
    return {
      isSafe: false,
      safe: false,
      reason: 'url',
      reasonArabic: 'مشاركة الروابط والمواقع الخارجية غير مسموح بها',
      warning: SAFETY_WARNING_MESSAGE
    };
  }

  if (containsPhoneNumber(text)) {
    return {
      isSafe: false,
      safe: false,
      reason: 'phone',
      reasonArabic: 'مشاركة أرقام الهواتف غير مسموح بها',
      warning: SAFETY_WARNING_MESSAGE
    };
  }

  return {
    isSafe: true,
    safe: true,
    reason: null,
    reasonArabic: null,
    warning: ''
  };
}

export default {
  containsPhoneNumber,
  containsExternalLink,
  containsEmail,
  inspectMessage,
  normalizeArabicDigits,
  SAFETY_WARNING_MESSAGE
};
