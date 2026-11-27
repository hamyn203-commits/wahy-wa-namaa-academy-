const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const JobApplication = require('../models/JobApplication');
const JOBS = require('../config/careers');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdmin } = require('../services/growthNotify');
const { logAdminAction } = require('../services/adminAudit');

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
    if (cleanEmail.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    if (cleanPhone.length > 32 || cleanCoverLetter.length > 2000) {
      return res.status(400).json({ error: 'بيانات الطلب تتجاوز الحد المسموح' });
    }

    let cleanResumeUrl = '';
    if (resumeUrl) {
      try {
        const parsed = new URL(String(resumeUrl));
        if (parsed.protocol !== 'https:') throw new Error('unsupported');
        cleanResumeUrl = parsed.toString().slice(0, 1000);
      } catch {
        return res.status(400).json({ error: 'رابط السيرة الذاتية غير صالح (يجب أن يبدأ بـ https://)' });
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الطلب غير صالح' });
    }
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
    await logAdminAction({
      req,
      action: `career_application.status.${status}`,
      entityType: 'job_application',
      entityId: app._id,
      metadata: { position: app.position, status },
    }).catch(() => {});
    res.json(app);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/applications', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status, q } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const allowedStatuses = ['new', 'reviewing', 'interview', 'hired', 'rejected'];
    const filter = status && status !== 'all' && allowedStatuses.includes(String(status))
      ? { status: String(status) }
      : {};
    const cleanSearch = String(q || '').trim().slice(0, 80);
    if (cleanSearch) {
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { position: rx },
        { coverLetter: rx },
      ];
    }
    const skip = (pageNum - 1) * limitNum;
    const [applications, total] = await Promise.all([
      JobApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      JobApplication.countDocuments(filter),
    ]);
    res.json({ applications, pagination: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
