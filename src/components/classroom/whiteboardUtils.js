/**
 * أدوات السبورة القرآنية المتجهية الخفيفة (Zero External Dependencies)
 * - ضغط مسارات الرسم بنسبة ~80% إلى مسار SVG مدمج خفيف جداً (< 0.5 KB)
 * - إزالة التشكيل لاختبار ضبط الطالب
 * - تفكيك الكلمات العربية إلى مقاطع صوتية تعليمية (الساكن مع ما قبله والمد مع الممدود)
 * - تصدير السبورة كبطاقة PNG عالية الدقة للمراجعة
 */

export const TAJWEED_PENS = [
  { id: 'emerald', labelAr: 'قلم الشرح', cssColor: 'var(--wn-emerald)', width: 4, isLaser: false },
  { id: 'madd', labelAr: '🔴 المدود', cssColor: 'var(--wn-danger)', width: 5, isLaser: false },
  { id: 'ghunnah', labelAr: '🟢 الغنّة والإخفاء', cssColor: 'var(--wn-teal-dark)', width: 5, isLaser: false },
  { id: 'qalqalah', labelAr: '🔵 القلقلة والتفخيم', cssColor: 'var(--wn-gold-dark)', width: 5, isLaser: false },
  { id: 'silent', labelAr: '⚪ ما لا يُلفظ', cssColor: 'var(--wn-text-tertiary)', width: 4, isLaser: false },
  { id: 'laser', labelAr: '✨ ليزر متلاشٍ (٣ث)', cssColor: 'var(--wn-gold)', width: 6, isLaser: true },
];

export const PEN_COLOR_MAP = {
  emerald: 'var(--wn-emerald)',
  madd: 'var(--wn-danger)',
  ghunnah: 'var(--wn-teal-dark)',
  qalqalah: 'var(--wn-gold-dark)',
  silent: 'var(--wn-text-tertiary)',
  laser: 'var(--wn-gold)',
};

export const HARAKAT_STAMPS = [
  { id: 'fatha', symbol: 'ـَ', glyph: 'َ', labelAr: 'فتحة' },
  { id: 'kasra', symbol: 'ـِ', glyph: 'ِ', labelAr: 'كسرة' },
  { id: 'damma', symbol: 'ـُ', glyph: 'ُ', labelAr: 'ضمة' },
  { id: 'sukoon', symbol: 'ـْ', glyph: 'ۡ', labelAr: 'سكون قرآني' },
  { id: 'shadda', symbol: 'ـّ', glyph: 'ّ', labelAr: 'شدّة' },
  { id: 'madd', symbol: 'ـٓ', glyph: 'ٓ', labelAr: 'علامة مدّ' },
  { id: 'iqlab', symbol: 'ـۢ', glyph: 'ۢ', labelAr: 'ميم إقلاب' },
  { id: 'tanween', symbol: 'ـً', glyph: 'ً', labelAr: 'تنوين' },
];

export const TRACING_LETTERS = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي',
];

/**
 * إزالة الحركات وعلامات الضبط المصحفي لاختبار الطالب في التشكيل على السبورة
 */
export function stripArabicTashkeel(text) {
  return String(text || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
}

/**
 * تفكيك الكلمات العربية إلى مقاطع صوتية تعليمية مبسطة للأطفال والمبتدئين:
 * يدمج الحرف الساكن أو حرف المد أو أول المشدد مع الحرف المتحرك قبله.
 */
export function splitIntoArabicSyllables(text) {
  const words = String(text || '')
    .replace(/[۞۩﴿﴾]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  const DIACRITIC_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
  const SUKOON_RE = /[\u0652\u06E1]/;
  const SHADDA_RE = /\u0651/;
  const MADD_LETTERS = new Set(['ا', 'و', 'ي', 'ى', 'آ']);

  const allSyllables = [];

  for (const word of words) {
    // Group each base letter with its trailing diacritics
    const clusters = [];
    for (const ch of word) {
      if (DIACRITIC_RE.test(ch) && clusters.length > 0) {
        clusters[clusters.length - 1] += ch;
      } else {
        clusters.push(ch);
      }
    }

    const wordSyllables = [];
    for (let i = 0; i < clusters.length; i += 1) {
      const unit = clusters[i];
      const baseChar = unit[0];
      const hasDiacritic = unit.length > 1;
      const isSukoon = SUKOON_RE.test(unit);
      const isShadda = SHADDA_RE.test(unit);
      const isBareMadd = MADD_LETTERS.has(baseChar) && !hasDiacritic;

      if (wordSyllables.length > 0 && (isSukoon || isBareMadd)) {
        wordSyllables[wordSyllables.length - 1] += unit;
      } else if (wordSyllables.length > 0 && isShadda) {
        // Shadda splits into sukoon on previous syllable + vowelized letter on new syllable
        wordSyllables[wordSyllables.length - 1] += `${baseChar}\u0652`;
        wordSyllables.push(unit.replace(SHADDA_RE, ''));
      } else if (i === 0 && baseChar === 'ا' && clusters[1]?.[0] === 'ل') {
        // Definite article الـ joins together
        wordSyllables.push(unit + clusters[1]);
        i += 1;
      } else {
        wordSyllables.push(unit);
      }
    }

    allSyllables.push(...wordSyllables);
  }

  return allSyllables.slice(0, 24);
}

/**
 * ضغط نقاط حركة القلم إلى مسار SVG خفيف جداً على شبكة 1000×600
 */
export function simplifyPointsToSvgPath(points, minDistance = 6) {
  if (!Array.isArray(points) || points.length === 0) return '';
  const kept = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = kept[kept.length - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx * dx + dy * dy >= minDistance * minDistance || i === points.length - 1) {
      kept.push(curr);
    }
    if (kept.length >= 65) break;
  }

  if (kept.length === 1) {
    const x = Math.round(kept[0].x);
    const y = Math.round(kept[0].y);
    return `M${x} ${y}L${x + 1} ${y + 1}`;
  }

  let d = `M${Math.round(kept[0].x)} ${Math.round(kept[0].y)}`;
  for (let i = 1; i < kept.length; i += 1) {
    d += `L${Math.round(kept[i].x)} ${Math.round(kept[i].y)}`;
  }
  return d.slice(0, 650);
}

export function createClientStrokeId(prefix = 'st') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * تصدير لوح السبورة الحالي كصورة PNG نظيفة للمراجعة دون أي مكتبة خارجية
 */
export function exportSvgBoardAsPng(svgElement, filename = 'wahy-whiteboard.png') {
  if (!svgElement || typeof window === 'undefined') return;
  try {
    const serializer = new XMLSerializer();
    const cloned = svgElement.cloneNode(true);
    cloned.setAttribute('width', '1000');
    cloned.setAttribute('height', '600');
    const svgString = serializer.serializeToString(cloned);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bgToken = getComputedStyle(document.documentElement).getPropertyValue('--wn-ivory').trim();
        ctx.fillStyle = bgToken || 'ivory';
        ctx.fillRect(0, 0, 1000, 600);
        ctx.drawImage(img, 0, 0, 1000, 600);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename;
        link.href = pngUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  } catch {
    // ignore unsupported environments
  }
}
