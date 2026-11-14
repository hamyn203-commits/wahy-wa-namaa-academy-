const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const { translate, SUPPORTED, LANG_NAMES } = require('../services/translateService');

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

router.post('/', async (req, res) => {
  try {
    const { text, from = 'ar', to = 'en' } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    if (text.length > 800) return res.status(400).json({ error: 'Text too long' });
    if (!SUPPORTED.includes(from) || !SUPPORTED.includes(to)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }
    const result = await translate(text, from, to);
    res.json({ original: text, translated: result.text, from, to, provider: result.provider });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
