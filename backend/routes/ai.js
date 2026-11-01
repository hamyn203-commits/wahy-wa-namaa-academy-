const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const aiService = require('../services/aiService');
const RecitationReport = require('../models/RecitationReport');
const { validateMagicBytes } = require('../utils/magicBytes');

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
]);

const MAX_PROMPT_LENGTH = 1500;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIMES.has(mime)) {
      return cb(new Error('Unsupported audio format'));
    }
    return cb(null, true);
  },
});

router.post('/quran-assistant', protect, async (req, res) => {
  try {
    const { question, locale = 'ar' } = req.body || {};
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) return res.status(400).json({ error: 'Question is required' });
    if (cleanQuestion.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: 'Question is too long' });
    }

    const result = await aiService.chat(cleanQuestion, { locale, role: 'quran' });
    res.json({
      answer: result.text,
      sources: ['Quran', 'Authentic Tafsir'],
      confidence: result.fallback ? 0.6 : 0.9,
      provider: result.provider,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

router.post('/teacher-assistant', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { prompt, locale = 'ar' } = req.body || {};
    const cleanPrompt = String(prompt || 'Suggest a lesson plan for today Quran class').trim();
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: 'Prompt is too long' });
    }

    const result = await aiService.chat(cleanPrompt, { locale, role: 'teacher' });

    res.json({
      suggestions: result.text.split('\n').filter(Boolean).slice(0, 6),
      lessonPlan: result.text,
      provider: result.provider,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process teacher assistant request' });
  }
});

router.post('/student-assistant', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const { goal, level, locale = 'ar' } = req.body || {};
    const cleanGoal = String(goal || 'memorization').trim().slice(0, 200);
    const cleanLevel = String(level || 'beginner').trim().slice(0, 60);
    const result = await aiService.chat(
      `Daily plan for student. Goal: ${cleanGoal}. Level: ${cleanLevel}. Return structured daily tasks.`,
      { locale, role: 'student' }
    );

    res.json({
      dailyPlan: [
        { task: locale === 'ar' ? 'مراجعة حفظ الأمس' : 'Review yesterday', duration: 15 },
        { task: locale === 'ar' ? 'حفظ جديد (5 آيات)' : 'New memorization (5 ayat)', duration: 30 },
        { task: locale === 'ar' ? 'تدريب تجويد' : 'Tajweed practice', duration: 15 },
      ],
      aiNotes: result.text,
      goal: cleanGoal,
      level: cleanLevel,
      provider: result.provider,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process student assistant request' });
  }
});

router.post('/recitation-analyze', protect, authorize('student', 'teacher', 'admin'), (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid audio upload' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Audio file required' });
    const mime = String(req.file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    const magicCheck = validateMagicBytes(req.file.buffer, mime);
    if (!magicCheck.valid) {
      return res.status(400).json({ error: 'Audio file content does not match declared MIME type', code: 'INVALID_AUDIO_MAGIC_BYTES' });
    }
    const { locale = 'ar', surah = '' } = req.body || {};
    const cleanSurah = String(surah || '').trim().slice(0, 120);
    const report = await aiService.analyzeRecitation(req.user.id, req.file, { locale, surah: cleanSurah });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze recitation' });
  }
});

router.get('/recitation-reports', protect, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const reports = await RecitationReport.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recitation reports' });
  }
});

router.get('/recitation-reports/:reportId', protect, async (req, res) => {
  try {
    const reportId = String(req.params.reportId || '').trim().slice(0, 80);
    const mongoose = require('mongoose');
    const orConditions = [{ reportId }];
    if (mongoose.Types.ObjectId.isValid(reportId)) {
      orConditions.push({ _id: reportId });
    }
    const report = await RecitationReport.findOne({
      $or: orConditions,
      user: req.user.id,
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recitation report' });
  }
});

router.post('/homework-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { topic, level, count = 5, locale = 'ar' } = req.body || {};
    const cleanTopic = String(topic || '').trim().slice(0, 300);
    const cleanLevel = String(level || 'beginner').trim().slice(0, 60);
    const safeCount = Math.min(20, Math.max(1, parseInt(count, 10) || 5));
    const result = await aiService.generateHomework({ topic: cleanTopic, level: cleanLevel, count: safeCount, locale });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate homework' });
  }
});

router.post('/exam-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { topic, questionCount = 5, locale = 'ar' } = req.body || {};
    const cleanTopic = String(topic || '').trim().slice(0, 300);
    const safeCount = Math.min(20, Math.max(1, parseInt(questionCount, 10) || 5));
    const result = await aiService.generateExam({ topic: cleanTopic, questionCount: safeCount, locale });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate exam' });
  }
});

router.post('/reports-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { studentId, period = 'monthly', locale = 'ar' } = req.body || {};
    res.json({
      studentId: String(studentId || '').slice(0, 80),
      period: String(period || 'monthly').slice(0, 40),
      summary: { attendance: 92, progress: 78, homeworkCompletion: 85, averageScore: 88 },
      generatedAt: new Date().toISOString(),
      note: locale === 'ar' ? 'تقرير تجريبي — اربط بيانات LMS الفعلية' : 'Demo report — connect real LMS data',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/status', protect, authorize('admin'), (_req, res) => {
  const providers = aiService.getAiProviders();
  const active = providers.chain.find((p) => p !== 'local' && providers[p]);
  res.json({
    ...providers,
    mode: active ? 'cloud' : 'local-fallback',
    activeProvider: active || 'local',
  });
});

module.exports = router;
