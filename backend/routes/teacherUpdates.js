const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const Teacher = require('../models/Teacher');
const TeacherUpdate = require('../models/TeacherUpdate');
const Session = require('../models/Session');
const { protect, authorize } = require('../middleware/auth');
const storage = require('../services/objectStorage');
const { notifyUser } = require('../utils/notify');

const VIDEO_PURPOSE = 'teacher-update-video';
const MAX_VIDEOS_PER_UPDATE = 5;
const ACCESS_TOKEN_TTL = '10m';

function accessSecret() {
  return process.env.JWT_SECRET || 'wahy-namaa-dev-access-secret-change-me';
}

async function getTeacherByUser(userId) {
  return Teacher.findOne({ user: userId }).select('_id user personalInfo status isVerified');
}

async function activeStudentIdsForTeacher(teacherId) {
  const sessions = await Session.find({
    teacher: teacherId,
    type: 'regular',
    status: { $in: ['accepted', 'completed'] },
    student: { $ne: null },
  }).distinct('student');

  return [...new Set(sessions.map((id) => String(id)))];
}

async function teacherHasStudent(teacherId, studentId) {
  return Boolean(await Session.exists({
    teacher: teacherId,
    student: studentId,
    type: 'regular',
    status: { $in: ['accepted', 'completed'] },
  }));
}

function presentUpdate(update, { includeAudienceStudents = true } = {}) {
  const raw = update?.toObject ? update.toObject() : update;
  return {
    _id: raw._id,
    teacher: raw.teacher,
    teacherUser: raw.teacherUser,
    title: raw.title,
    message: raw.message,
    videos: (raw.videos || []).map((video, index) => ({
      index,
      name: video.name,
      size: video.size,
      contentType: video.contentType,
    })),
    audience: {
      mode: raw.audience?.mode || 'all-active',
      ...(includeAudienceStudents ? { students: raw.audience?.students || [] } : {}),
    },
    isPublished: raw.isPublished,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function canStudentAccessUpdate(update, studentUserId) {
  if (!update?.isPublished) return false;
  if (!await teacherHasStudent(update.teacher, studentUserId)) return false;

  return (update.audience?.students || [])
    .some((id) => String(id) === String(studentUserId));
}

async function canUserAccessUpdate(update, user) {
  if (!update || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return String(update.teacherUser) === String(user.id);
  if (user.role === 'student') return canStudentAccessUpdate(update, user.id);
  return false;
}

async function streamReference(reference, res) {
  const result = await storage.getPrivateObject(reference);
  if (!result) return res.status(404).end();
  if (result.statusCode === 304) return res.status(304).end();

  res.setHeader('Content-Type', result.blob?.contentType || 'video/mp4');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Accept-Ranges', 'none');
  if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

  if (result.stream?.pipe) {
    return result.stream.pipe(res);
  }

  const reader = result.stream?.getReader?.();
  if (!reader) return res.status(500).end();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  return res.end();
}

// Short-lived token lets the native <video> element stream private media
// without exposing the teacher's stored object reference.
router.get('/:id/videos/:index/stream', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(401).json({ error: 'Media token required' });

    const payload = jwt.verify(token, accessSecret());
    if (
      payload?.purpose !== VIDEO_PURPOSE
      || String(payload.updateId) !== String(req.params.id)
      || Number(payload.index) !== Number(req.params.index)
    ) {
      return res.status(403).json({ error: 'Invalid media token' });
    }

    const update = await TeacherUpdate.findById(req.params.id).lean();
    if (!update?.isPublished) return res.status(404).json({ error: 'Update not found' });

    const video = update.videos?.[Number(req.params.index)];
    if (!video?.reference) return res.status(404).json({ error: 'Video not found' });

    return streamReference(video.reference, res);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired media token' });
  }
});

router.use(protect);

router.get('/teacher', authorize('teacher'), async (req, res) => {
  try {
    const teacher = await getTeacherByUser(req.user.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const updates = await TeacherUpdate.find({ teacher: teacher._id })
      .populate('audience.students', 'name email avatar')
      .sort({ publishedAt: -1 })
      .limit(100);

    return res.json({ updates: updates.map(presentUpdate) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/teacher', authorize('teacher'), async (req, res) => {
  try {
    const teacher = await getTeacherByUser(req.user.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const videos = Array.isArray(req.body.videos) ? req.body.videos : [];
    const audienceMode = req.body.audienceMode === 'selected' ? 'selected' : 'all-active';
    const requestedStudents = Array.isArray(req.body.studentIds)
      ? [...new Set(req.body.studentIds.map(String))]
      : [];

    if (!title) return res.status(400).json({ error: 'عنوان الرسالة مطلوب' });
    if (title.length > 140) return res.status(400).json({ error: 'العنوان طويل جدًا' });
    if (message.length > 2000) return res.status(400).json({ error: 'نص الرسالة طويل جدًا' });
    if (videos.length > MAX_VIDEOS_PER_UPDATE) {
      return res.status(400).json({ error: 'لا يمكن نشر أكثر من فيديوهات في الرسالة الواحدة' });
    }

    const normalizedVideos = [];
    for (const item of videos) {
      const reference = String(item?.reference || item?.url || '').trim();
      if (!storage.referenceMatches(reference, VIDEO_PURPOSE, req.user.id)) {
        return res.status(400).json({ error: 'مرجع فيديو غير صالح أو لا يخص هذا المعلم' });
      }

      normalizedVideos.push({
        reference,
        name: String(item?.name || 'video').slice(0, 180),
        size: Math.max(0, Number(item?.size) || 0),
        contentType: String(item?.contentType || 'video/mp4').slice(0, 80),
      });
    }

    const activeStudents = await activeStudentIdsForTeacher(teacher._id);
    let targetStudents = activeStudents;

    if (audienceMode === 'selected') {
      targetStudents = requestedStudents.filter((id) => activeStudents.includes(id));
      if (!targetStudents.length) {
        return res.status(400).json({ error: 'اختر طالبًا نشطًا واحدًا على الأقل' });
      }
    }

    const update = await TeacherUpdate.create({
      teacher: teacher._id,
      teacherUser: req.user.id,
      title,
      message,
      videos: normalizedVideos,
      audience: {
        mode: audienceMode,
        // Snapshot recipients at publish time so future students do not inherit old messages.
        students: targetStudents,
      },
      isPublished: true,
      publishedAt: new Date(),
    });

    const teacherName = teacher.personalInfo?.fullName || 'المعلم';
    await Promise.allSettled(
      targetStudents.map((studentId) => notifyUser(studentId, {
        type: 'teacher-update',
        title: {
          ar: `رسالة جديدة من ${teacherName}`,
          en: `New update from ${teacherName}`,
        },
        message: {
          ar: title,
          en: title,
        },
        data: {
          actionUrl: '/student/dashboard?tab=teacher-updates',
          metadata: { teacherUpdateId: String(update._id) },
        },
        priority: 'normal',
        channels: {
          inApp: { enabled: true },
          email: { enabled: false },
          push: { enabled: false },
          telegram: { enabled: false },
          sms: { enabled: false },
        },
      })),
    );

    return res.status(201).json({ success: true, update: presentUpdate(update) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/teacher/:id', authorize('teacher'), async (req, res) => {
  try {
    const teacher = await getTeacherByUser(req.user.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const update = await TeacherUpdate.findOne({ _id: req.params.id, teacher: teacher._id });
    if (!update) return res.status(404).json({ error: 'الرسالة غير موجودة' });

    await Promise.allSettled(
      (update.videos || []).map((video) => storage.deleteOwnedObject(
        video.reference,
        VIDEO_PURPOSE,
        req.user.id,
      )),
    );

    await update.deleteOne();
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/student', authorize('student'), async (req, res) => {
  try {
    const teacherIds = await Session.find({
      student: req.user.id,
      type: 'regular',
      status: { $in: ['accepted', 'completed'] },
    }).distinct('teacher');

    if (!teacherIds.length) return res.json({ updates: [] });

    const updates = await TeacherUpdate.find({
      teacher: { $in: teacherIds },
      isPublished: true,
      'audience.students': req.user.id,
    })
      .populate({
        path: 'teacher',
        select: 'personalInfo user',
        populate: { path: 'user', select: 'name avatar' },
      })
      .sort({ publishedAt: -1 })
      .limit(100);

    const visible = [];
    for (const update of updates) {
      if (await canStudentAccessUpdate(update, req.user.id)) {
        visible.push(presentUpdate(update, { includeAudienceStudents: false }));
      }
    }

    return res.json({ updates: visible });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/videos/:index/access', authorize('teacher', 'student', 'admin'), async (req, res) => {
  try {
    const update = await TeacherUpdate.findById(req.params.id);
    if (!update) return res.status(404).json({ error: 'الرسالة غير موجودة' });

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= update.videos.length) {
      return res.status(404).json({ error: 'الفيديو غير موجود' });
    }

    if (!await canUserAccessUpdate(update, req.user)) {
      return res.status(403).json({ error: 'لا تملك صلاحية مشاهدة هذا الفيديو' });
    }

    const token = jwt.sign({
      purpose: VIDEO_PURPOSE,
      updateId: String(update._id),
      index,
      viewerId: String(req.user.id),
      viewerRole: req.user.role,
    }, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL });

    return res.json({
      streamUrl: `/api/teacher-updates/${update._id}/videos/${index}/stream?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
