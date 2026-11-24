'use strict';

const express = require('express');
const mongoose = require('mongoose');
const MushafProgress = require('../models/MushafProgress');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');
const { doesTeacherOwnStudent } = require('../utils/teacherStudentScope');
const { notifyUser, notifyGuardiansForStudent } = require('../utils/notify');
const { safeErrorMessage } = require('../utils/safeError');
const { isMockMode } = require('../config/runtime');

const router = express.Router();

const ALLOWED_ANNOTATION_TYPES = new Set(['memorization', 'tajweed', 'tashkeel']);
const ALLOWED_JUZ_STATUSES = new Set(['not_started', 'in_progress', 'memorized', 'mastered']);
const MAX_ANNOTATIONS_PER_STUDENT = 300;

const mockStore = new Map();

function isValidObjectId(val) {
  return Boolean(val && mongoose.Types.ObjectId.isValid(String(val)));
}

function shouldUseMock() {
  return isMockMode && mongoose.connection.readyState !== 1;
}

function buildDefaultJuzList(existing = []) {
  const map = new Map();
  for (const item of existing || []) {
    if (item && Number.isInteger(item.juzNumber) && item.juzNumber >= 1 && item.juzNumber <= 30) {
      map.set(item.juzNumber, {
        juzNumber: item.juzNumber,
        status: ALLOWED_JUZ_STATUSES.has(item.status) ? item.status : 'not_started',
        certifiedByName: item.certifiedByName || '',
        updatedAt: item.updatedAt || null,
      });
    }
  }
  const result = [];
  for (let juz = 1; juz <= 30; juz += 1) {
    result.push(
      map.get(juz) || {
        juzNumber: juz,
        status: 'not_started',
        certifiedByName: '',
        updatedAt: null,
      }
    );
  }
  return result;
}

function presentProgress(studentId, doc) {
  const khatmahJuz = buildDefaultJuzList(doc?.khatmahJuz || []);
  const annotations = [...(doc?.annotations || [])]
    .map((a) => (typeof a?.toObject === 'function' ? a.toObject() : a))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const masteredCount = khatmahJuz.filter((j) => j.status === 'mastered').length;
  const memorizedCount = khatmahJuz.filter((j) => j.status === 'memorized' || j.status === 'mastered').length;
  const openAnnotationsCount = annotations.filter((a) => !a.resolved).length;

  return {
    studentId: String(studentId),
    khatmahJuz,
    annotations,
    summary: {
      masteredCount,
      memorizedCount,
      completionPercent: Math.round((memorizedCount / 30) * 100),
      openAnnotationsCount,
      totalAnnotationsCount: annotations.length,
    },
  };
}

async function resolveTeacherAndCheckScope(req, studentId) {
  if (req.user.role === 'admin') {
    return { allowed: true, teacherId: null, teacherName: req.user.name || 'الإدارة' };
  }
  if (req.user.role !== 'teacher') {
    return { allowed: false, status: 403, error: 'صلاحية المعلم مطلوبة' };
  }
  if (shouldUseMock()) {
    return { allowed: true, teacherId: req.user.id, teacherName: req.user.name || 'معلم' };
  }
  const teacher = await Teacher.findOne({ user: req.user.id }).select('_id personalInfo.fullName').lean();
  if (!teacher) {
    return { allowed: false, status: 404, error: 'لم يتم العثور على ملف المعلم' };
  }
  const owns = await doesTeacherOwnStudent(teacher._id, studentId);
  if (!owns) {
    return { allowed: false, status: 403, error: 'لا يمكنك الوصول إلى سجل مصحف طالب غير مرتبط بك' };
  }
  return {
    allowed: true,
    teacherId: teacher._id,
    teacherName: teacher.personalInfo?.fullName || req.user.name || 'المعلم',
  };
}

async function canReadStudentProgress(req, studentId) {
  const role = req.user.role;
  if (role === 'admin') return { allowed: true };
  if (role === 'student') {
    return String(req.user.id) === String(studentId)
      ? { allowed: true }
      : { allowed: false, status: 403, error: 'لا يمكنك عرض مصحف طالب آخر' };
  }
  if (role === 'teacher') {
    return resolveTeacherAndCheckScope(req, studentId);
  }
  if (role === 'guardian') {
    if (shouldUseMock()) return { allowed: true };
    const ownsChild = await Guardian.exists({
      user: req.user.id,
      'children.student': studentId,
      isActive: { $ne: false },
    });
    return ownsChild
      ? { allowed: true }
      : { allowed: false, status: 403, error: 'لا يمكنك عرض سجل طالب غير مرتبط بحساب ولي الأمر' };
  }
  return { allowed: false, status: 403, error: 'غير مصرح' };
}

router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    if (shouldUseMock()) {
      return res.json(presentProgress(req.user.id, mockStore.get(String(req.user.id))));
    }
    const doc = await MushafProgress.findOne({ student: req.user.id }).lean();
    return res.json(presentProgress(req.user.id, doc));
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/student/:studentId', protect, authorize('teacher', 'student', 'guardian', 'admin'), async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    if (!shouldUseMock() && !isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'معرّف الطالب غير صالح' });
    }
    const access = await canReadStudentProgress(req, studentId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'غير مصرح' });
    }

    if (shouldUseMock()) {
      return res.json(presentProgress(studentId, mockStore.get(studentId)));
    }
    const doc = await MushafProgress.findOne({ student: studentId }).lean();
    return res.json(presentProgress(studentId, doc));
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/student/:studentId/annotations', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    if (!shouldUseMock() && !isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'معرّف الطالب غير صالح' });
    }
    const access = await resolveTeacherAndCheckScope(req, studentId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'غير مصرح' });
    }

    const surahNumber = Number(req.body?.surahNumber);
    const ayahNumber = Number(req.body?.ayahNumber);
    const type = String(req.body?.type || '').trim();
    const surahName = String(req.body?.surahName || '').trim().slice(0, 80);
    const wordText = String(req.body?.wordText || '').trim().slice(0, 100);
    const note = String(req.body?.note || '').trim().slice(0, 400);

    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({ error: 'رقم السورة يجب أن يكون بين 1 و114' });
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > 286) {
      return res.status(400).json({ error: 'رقم الآية غير صالح' });
    }
    if (!ALLOWED_ANNOTATION_TYPES.has(type)) {
      return res.status(400).json({ error: 'نوع الملاحظة يجب أن يكون memorization أو tajweed أو tashkeel' });
    }

    const entry = {
      _id: new mongoose.Types.ObjectId(),
      surahNumber,
      surahName,
      ayahNumber,
      wordText,
      type,
      note,
      teacher: access.teacherId || undefined,
      teacherName: access.teacherName,
      resolved: false,
      resolvedAt: null,
      createdAt: new Date(),
    };

    if (shouldUseMock()) {
      const existing = mockStore.get(studentId) || { khatmahJuz: [], annotations: [] };
      existing.annotations = [entry, ...existing.annotations].slice(0, MAX_ANNOTATIONS_PER_STUDENT);
      mockStore.set(studentId, existing);
      return res.status(201).json({ success: true, annotation: entry, ...presentProgress(studentId, existing) });
    }

    let doc = await MushafProgress.findOne({ student: studentId });
    if (!doc) {
      doc = new MushafProgress({ student: studentId, khatmahJuz: [], annotations: [] });
    }
    doc.annotations.unshift(entry);
    if (doc.annotations.length > MAX_ANNOTATIONS_PER_STUDENT) {
      doc.annotations = doc.annotations.slice(0, MAX_ANNOTATIONS_PER_STUDENT);
    }
    await doc.save();

    const typeLabelAr =
      type === 'memorization' ? 'ملاحظة حفظ' : type === 'tajweed' ? 'ملاحظة تجويد' : 'ملاحظة تشكيل';
    notifyUser(studentId, {
      type: 'homework-assigned',
      title: { ar: `${typeLabelAr} على المصحف`, en: 'New Mushaf correction note' },
      message: {
        ar: `${surahName || `سورة ${surahNumber}`} — آية ${ayahNumber}${wordText ? ` (${wordText})` : ''}`,
        en: `Surah ${surahNumber}, Ayah ${ayahNumber}`,
      },
      data: { actionUrl: '/student/dashboard', metadata: { surahNumber, ayahNumber, type } },
      priority: 'normal',
    }).catch(() => {});

    return res.status(201).json({ success: true, annotation: doc.annotations[0], ...presentProgress(studentId, doc) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.patch('/student/:studentId/annotations/:annotationId', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    const annotationId = String(req.params.annotationId || '').trim();
    if (!shouldUseMock() && (!isValidObjectId(studentId) || !isValidObjectId(annotationId))) {
      return res.status(400).json({ error: 'معرّف غير صالح' });
    }
    const access = await resolveTeacherAndCheckScope(req, studentId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'غير مصرح' });
    }

    const resolved = Boolean(req.body?.resolved);

    if (shouldUseMock()) {
      const existing = mockStore.get(studentId);
      if (!existing) return res.status(404).json({ error: 'الملاحظة غير موجودة' });
      const target = existing.annotations.find((a) => String(a._id) === annotationId);
      if (!target) return res.status(404).json({ error: 'الملاحظة غير موجودة' });
      target.resolved = resolved;
      target.resolvedAt = resolved ? new Date() : null;
      return res.json({ success: true, ...presentProgress(studentId, existing) });
    }

    const doc = await MushafProgress.findOne({ student: studentId });
    if (!doc) return res.status(404).json({ error: 'سجل المصحف غير موجود' });
    const target = doc.annotations.id(annotationId);
    if (!target) return res.status(404).json({ error: 'الملاحظة غير موجودة' });

    target.resolved = resolved;
    target.resolvedAt = resolved ? new Date() : null;
    await doc.save();

    return res.json({ success: true, ...presentProgress(studentId, doc) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/student/:studentId/khatmah/:juzNumber', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    const juzNumber = Number(req.params.juzNumber);
    const status = String(req.body?.status || '').trim();

    if (!shouldUseMock() && !isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'معرّف الطالب غير صالح' });
    }
    if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
      return res.status(400).json({ error: 'رقم الجزء يجب أن يكون بين 1 و30' });
    }
    if (!ALLOWED_JUZ_STATUSES.has(status)) {
      return res.status(400).json({ error: 'حالة الجزء غير صالحة' });
    }

    const access = await resolveTeacherAndCheckScope(req, studentId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'غير مصرح' });
    }

    const updatedEntry = {
      juzNumber,
      status,
      certifiedBy: access.teacherId || undefined,
      certifiedByName: access.teacherName,
      updatedAt: new Date(),
    };

    if (shouldUseMock()) {
      const existing = mockStore.get(studentId) || { khatmahJuz: [], annotations: [] };
      existing.khatmahJuz = existing.khatmahJuz.filter((j) => j.juzNumber !== juzNumber);
      existing.khatmahJuz.push(updatedEntry);
      mockStore.set(studentId, existing);
      return res.json({ success: true, ...presentProgress(studentId, existing) });
    }

    let doc = await MushafProgress.findOne({ student: studentId });
    if (!doc) {
      doc = new MushafProgress({ student: studentId, khatmahJuz: [], annotations: [] });
    }
    const existingIdx = doc.khatmahJuz.findIndex((j) => j.juzNumber === juzNumber);
    if (existingIdx >= 0) {
      doc.khatmahJuz[existingIdx] = updatedEntry;
    } else {
      doc.khatmahJuz.push(updatedEntry);
    }
    await doc.save();

    if (status === 'memorized' || status === 'mastered') {
      const titleAr = status === 'mastered'
        ? `🏆 تم اعتماد وإتقان الجزء ${juzNumber}!`
        : `📖 مبارك! إتمام حفظ الجزء ${juzNumber}`;
      await Promise.allSettled([
        notifyUser(studentId, {
          type: 'system',
          title: { ar: titleAr, en: `Juz ${juzNumber} ${status}` },
          message: {
            ar: `اعتمد المعلم ${access.teacherName} إنجازك في الجزء ${juzNumber} على خريطة الختمة.`,
            en: `${access.teacherName} updated your Juz ${juzNumber} status.`,
          },
          data: { actionUrl: '/student/dashboard', metadata: { juzNumber, status } },
          priority: 'high',
        }),
        notifyGuardiansForStudent(studentId, {
          type: 'system',
          title: { ar: titleAr, en: `Juz ${juzNumber} ${status}` },
          message: {
            ar: `مبارك! اعتمد المعلم ${access.teacherName} إنجاز الطالب في الجزء ${juzNumber}.`,
            en: `${access.teacherName} certified Juz ${juzNumber}.`,
          },
          data: { actionUrl: '/guardian/dashboard', metadata: { juzNumber, status, studentId } },
          priority: 'high',
        }),
      ]);
    }

    return res.json({ success: true, ...presentProgress(studentId, doc) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
