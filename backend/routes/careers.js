const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const JobApplication = require('../models/JobApplication');
const JOBS = require('../config/careers');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdmin } = require('../services/growthNotify');

router.get('/jobs', (req, res) => {
  res.json({ jobs: JOBS });
});

router.post('/apply', async (req, res) => {
  try {
    const { name, email, phone, position, coverLetter, resumeUrl, experience, languages } = req.body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanCoverLetter = String(coverLetter || '').trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !position) {
      return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة' });
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'الاسم غير صالح' });
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanEmail.length > 254) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    if (cleanPhone.length > 32 || cleanCoverLetter.length > 2000) {
      return res.status(400).json({ error: 'بيانات الطلب تتجاوز الحد المسموح' });
    }

    let cleanResumeUrl = '';
    if (resumeUrl) {
      try {
        const parsed = new URL(String(resumeUrl));
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
        cleanResumeUrl = parsed.toString().slice(0, 1000);
      } catch {
        return res.status(400).json({ error: 'رابط السيرة الذاتية غير صالح' });
      }
    }

    const years = Number(experience || 0);
    if (!Number.isFinite(years) || years < 0 || years > 80) {
      return res.status(400).json({ error: 'سنوات الخبرة غير صالحة' });
    }

    const cleanLanguages = Array.isArray(languages)
      ? languages.slice(0, 20).map((value) => String(value).trim().slice(0, 50)).filter(Boolean)
      : [];

    const job = JOBS.find((j) => j.id === position);
    if (!job) return res.status(400).json({ error: 'الوظيفة غير موجودة' });

    const app = await JobApplication.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      position,
      coverLetter: cleanCoverLetter,
      resumeUrl: cleanResumeUrl,
      experience: years,
      languages: cleanLanguages,
    });
    notifyAdmin({
      subject: `طلب توظيف — ${position}`,
      html: `<p>تم استلام طلب توظيف جديد.</p><p>راجع لوحة الإدارة لعرض بيانات المتقدم للوظيفة: ${position}</p>`,
    }).catch(() => {});
    res.status(201).json({ success: true, message: 'تم استلام طلبك — سنتواصل معك قريباً', id: app._id });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/applications/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['new', 'reviewing', 'interview', 'hired', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'حالة الطلب غير صالحة' });
    }
    const app = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!app) return res.status(404).json({ error: 'الطلب غير موجود' });
    res.json(app);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/applications', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [applications, total] = await Promise.all([
      JobApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobApplication.countDocuments(filter),
    ]);
    res.json({ applications, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
