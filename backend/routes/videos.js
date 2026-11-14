const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const VideoAsset = require('../models/VideoAsset');
const { protect, authorize } = require('../middleware/auth');

const SEED_VIDEOS = [
  { title: 'مقدمة في التجويد', titleEn: 'Introduction to Tajweed', category: 'tajweed', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 600, sortOrder: 1 },
  { title: 'تلاوة قرآنية — نموذج', titleEn: 'Quran Recitation Sample', category: 'quran', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 480, sortOrder: 2 },
  { title: 'تعلم الحروف العربية', titleEn: 'Learn Arabic Letters', category: 'arabic', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 420, sortOrder: 3 },
  { title: 'سيرة النبي ﷺ — مقدمة', titleEn: 'Prophet Biography Intro', category: 'seerah', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 720, sortOrder: 4 },
  { title: 'تجويد للأطفال', titleEn: 'Tajweed for Kids', category: 'kids', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 360, sortOrder: 5 },
  { title: 'أحكام النون الساكنة', titleEn: 'Noon Sakinah Rules', category: 'tajweed', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 540, sortOrder: 6 },
];

router.get('/', async (req, res) => {
  try {
    const { category, language, page = 1, limit = 12 } = req.query;
    const filter = { isPublished: true };
    if (category) filter.category = category;
    if (language) filter.language = language;

    let count = await VideoAsset.countDocuments(filter);
    if (count === 0) {
      await VideoAsset.insertMany(SEED_VIDEOS);
      count = SEED_VIDEOS.length;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const videos = await VideoAsset.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(Number(limit));
    res.json({ videos, pagination: { page: Number(page), limit: Number(limit), total: count } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const video = await VideoAsset.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    if (!video || !video.isPublished) return res.status(404).json({ error: 'الفيديو غير موجود' });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const video = await VideoAsset.create(req.body);
    res.status(201).json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const video = await VideoAsset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!video) return res.status(404).json({ error: 'الفيديو غير موجود' });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await VideoAsset.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
