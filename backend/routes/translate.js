const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createScopedRateLimiter } = require('../middleware/userRateLimit');
const { translate, SUPPORTED, LANG_NAMES } = require('../services/translateService');

const translateLimiter = createScopedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  scope: 'ai-translate',
  message: 'Too many translation requests. Please try again shortly.',
});

router.get('/languages', (_req, res) => {
  res.json({
    languages: SUPPORTED.map((code) => ({
      code,
      name: LANG_NAMES[code],
      native: {
        ar: 'العربية', en: 'English', fr: 'Français', de: 'Deutsch', tr: 'Türkçe',
        ur: 'اردو', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', ku: 'کوردی',
      }[code] || LANG_NAMES[code],
    })),
  });
});

router.post('/', protect, translateLimiter, async (req, res) => {
  try {
    const { text, from = 'ar', to = 'en' } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text required' });
    }
    const cleanText = text.trim();
    if (cleanText.length > 800) return res.status(400).json({ error: 'Text too long' });
    const cleanFrom = String(from || '').trim();
    const cleanTo = String(to || '').trim();
    if (!SUPPORTED.includes(cleanFrom) || !SUPPORTED.includes(cleanTo)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }
    const result = await translate(cleanText, cleanFrom, cleanTo);
    res.json({ original: cleanText, translated: result.text, from: cleanFrom, to: cleanTo, provider: result.provider });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
