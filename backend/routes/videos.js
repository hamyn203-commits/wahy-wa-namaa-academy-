const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const VideoAsset = require('../models/VideoAsset');
const { protect, authorize } = require('../middleware/auth');

const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));
const ALLOWED_VIDEO_FIELDS = [
  'title',
  'titleEn',
  'description',
  'category',
  'language',
  'videoUrl',
  'thumbnailUrl',
  'duration',
  'sortOrder',
  'isPublished',
];

function sanitizeVideoPayload(body = {}) {
  const out = {};
  for (const field of ALLOWED_VIDEO_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      out[field] = body[field];
    }
  }
  for (const urlField of ['videoUrl', 'thumbnailUrl']) {
    if (out[urlField]) {
      const parsed = new URL(String(out[urlField]));
      if (parsed.protocol !== 'https:') {
        const err = new Error(`${urlField} must use HTTPS`);
        err.statusCode = 400;
        err.publicMessage = 'رابط الوسائط يجب أن يبدأ بـ https://';
        throw err;
      }
      out[urlField] = parsed.toString().slice(0, 1000);
    }
  }
  return out;
}

const SEED_VIDEOS = [
  { _id: 'seed-video-1', title: 'مقدمة في التجويد', titleEn: 'Introduction to Tajweed', category: 'tajweed', language: 'ar', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 600, sortOrder: 1, isPublished: true },
  { _id: 'seed-video-2', title: 'تلاوة قرآنية — نموذج', titleEn: 'Quran Recitation Sample', category: 'quran', language: 'ar', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 480, sortOrder: 2, isPublished: true },
  { _id: 'seed-video-3', title: 'تعلم الحروف العربية', titleEn: 'Learn Arabic Letters', category: 'arabic', language: 'ar', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 420, sortOrder: 3, isPublished: true },
  { _id: 'seed-video-4', title: 'سيرة النبي ﷺ — مقدمة', titleEn: 'Prophet Biography Intro', category: 'seerah', language: 'ar', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 720, sortOrder: 4, isPublished: true },
  { _id: 'seed-video-5', title: 'تجويد للأطفال', titleEn: 'Tajweed for Kids', category: 'kids', language: 'ar', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 360, sortOrder: 5, isPublished: true },
  { _id: 'seed-video-6', title: 'أحكام النون الساكنة', titleEn: 'Noon Sakinah Rules', category: 'tajweed', language: 'ar', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 540, sortOrder: 6, isPublished: true },
];

router.get('/', async (req, res) => {
  try {
    const { category, language, page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isPublished: true };
    if (category) filter.category = String(category).trim().slice(0, 60);
    if (language) filter.language = String(language).trim().slice(0, 16);

    const [videos, count, totalCollectionCount] = await Promise.all([
      VideoAsset.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limitNum),
      VideoAsset.countDocuments(filter),
      VideoAsset.estimatedDocumentCount(),
    ]);

    if (totalCollectionCount === 0) {
      const fallback = SEED_VIDEOS.filter((v) => (
        (!filter.category || v.category === filter.category) &&
        (!filter.language || v.language === filter.language)
      ));
      return res.json({
        videos: fallback.slice(skip, skip + limitNum),
        pagination: { page: pageNum, limit: limitNum, total: fallback.length },
      });
    }

    res.json({ videos, pagination: { page: pageNum, limit: limitNum, total: count } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const seedMatch = SEED_VIDEOS.find((v) => v._id === req.params.id);
    if (seedMatch) return res.json(seedMatch);
    if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'الفيديو غير موجود' });

    const video = await VideoAsset.findOneAndUpdate(
      { _id: req.params.id, isPublished: true },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!video) return res.status(404).json({ error: 'الفيديو غير موجود' });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const payload = sanitizeVideoPayload(req.body || {});
    const video = await VideoAsset.create(payload);
    res.status(201).json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'معرف الفيديو غير صالح' });
    const payload = sanitizeVideoPayload(req.body || {});
    const video = await VideoAsset.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!video) return res.status(404).json({ error: 'الفيديو غير موجود' });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'معرف الفيديو غير صالح' });
    await VideoAsset.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
