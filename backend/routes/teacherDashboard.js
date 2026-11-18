const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const path = require('path');
const router = express.Router();
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const TeacherProfileChangeRequest = require('../models/TeacherProfileChangeRequest');
const TeacherTask = require('../models/TeacherTask');
const GroupCircle = require('../models/GroupCircle');
const User = require('../models/User');
const mongoose = require('mongoose');
const TeacherLedger = require('../models/TeacherLedger');
const {
  calculateTeacherBalance,
  requestTeacherPayout,
} = require('../services/teacherFinance');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdmins, notifyUser, notifyGuardiansForStudent } = require('../utils/notify');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const objectStorage = require('../services/objectStorage');
const { sanitizeTeacherProfileChange, listChangedFields } = require('../services/teacherProfileChange');
const { doesTeacherOwnStudent } = require('../utils/teacherStudentScope');

const SESSION_RATE = 50;
const HOMEWORK_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'homework');
const TEACHER_FEEDBACK_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'teacher-feedback-audio');
const ALLOWED_TASK_TYPES = new Set(['memorization', 'review-recent', 'review-far', 'audio', 'test']);

function normalizeTaskType(rawType) {
  const value = String(rawType || '').trim();
  if (value === 'review') return 'review-recent';
  return ALLOWED_TASK_TYPES.has(value) ? value : null;
}

function serializeTaskForResponse(task) {
  const obj = typeof task?.toObject === 'function' ? task.toObject() : { ...(task || {}) };
  const hasAudio = Boolean(obj.hasTeacherFeedbackAudio || obj.teacherFeedbackAudio);
  delete obj.teacherFeedbackAudio;
  return {
    ...obj,
    hasTeacherFeedbackAudio: hasAudio,
    teacherFeedbackDuration: Number(obj.teacherFeedbackDuration || 0),
  };
}
const { isMockMode } = require('../config/runtime');
const { safeTimeZone } = require('../services/sessionScheduling');

const shouldUseMockTeacherDashboard = () => (
  isMockMode
  && mongoose.connection.readyState !== 1
  && process.env.FORCE_REAL_FINANCE_IN_TEST !== 'true'
  && process.env.FORCE_REAL_TEACHER_DASHBOARD_IN_TEST !== 'true'
);

// Simple mock-mode fallbacks so the teacher dashboard works in local dev without DB.
router.use((req, res, next) => {
  if (!shouldUseMockTeacherDashboard()) return next();
  const key = `${req.method} ${req.path}`;
  if (key === 'GET /profile') {
    return protect(req, res, () => authorize('teacher')(req, res, () => {
      const teacher = {
        _id: `mock-teacher-${req.user.id}`,
        personalInfo: { fullName: req.user.name || 'معلم تجريبي', phone: '', country: '' },
        academicInfo: {},
        earnings: { pendingEarnings: 0, totalEarned: 0, withdrawnEarnings: 0 },
        stats: { totalStudents: 0, totalHours: 0, totalSessions: 0 },
        rating: { average: 0, count: 0 },
        availability: [],
      };
      return res.json({ teacher, wallet: { sessionRate: SESSION_RATE, sessionDurationMinutes: 60, pendingEarnings: 0, totalEarned: 0, withdrawn: 0, completedSessions: 0 } });
    }));
  }
  if (key === 'GET /active-students') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ students: [] })));
  if (key === 'GET /tasks') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ tasks: [] })));
  if (key === 'POST /tasks') return protect(req, res, () => authorize('teacher')(req, res, () => res.status(201).json({ success: true, task: { _id: `mock-task-${Date.now()}`, ...req.body } })));
  if (req.method === 'PATCH' && req.path.startsWith('/tasks/')) return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ success: true, task: { _id: req.params.id, ...req.body } })));
  if (key === 'GET /stats') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ totalStudents: 0, totalSessions: 0, totalHours: 0, pendingEarnings: 0, totalEarnings: 0, averageRating: 0, sessionRate: SESSION_RATE })));
  if (key === 'GET /students') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ students: [] })));
  if (key === 'GET /analytics') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ monthlySessions: [], totalCompleted: 0, averageRating: 0, totalStudents: 0, earnings: { daily: 0, weekly: 0, monthly: 0, pending: 0 } })));
  if (key === 'GET /withdrawals') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ withdrawals: [], available: 0 })));
  if (key === 'POST /withdrawals') return protect(req, res, () => authorize('teacher')(req, res, () => res.status(201).json({ success: true, withdrawal: { _id: `mock-withdraw-${Date.now()}`, amount: req.body.amount, method: req.body.method, accountInfo: req.body.accountInfo, status: 'pending' } })));
  if (key === 'GET /availability') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ availability: [] })));
  if (key === 'PUT /availability') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ success: true, availability: req.body.availability || [] })));
  if (key === 'GET /reviews') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ reviews: [], averageRating: 0, totalReviews: 0 })));
  if (key === 'GET /circles') return protect(req, res, () => authorize('teacher')(req, res, () => res.json({ circles: [] })));
  return next();
});

router.get('/profile', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id })
      .populate('user', 'name email phone avatar bio');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const teacherValue = teacher.toObject();
    const reviewCount = Number(teacherValue.rating?.count || 0);
    teacherValue.rating = {
      ...(teacherValue.rating || {}),
      average: reviewCount > 0 ? Number(teacherValue.rating?.average || 0) : 0,
      count: reviewCount,
    };

    const balances = (mongoose.connection.readyState === 1 || TeacherLedger.find !== mongoose.Model.find)
      ? await calculateTeacherBalance(teacher._id).catch(() => null)
      : null;

    res.json({
      teacher: teacherValue,
      wallet: {
        sessionRate: Number(teacher.hourlyRate || SESSION_RATE),
        sessionDurationMinutes: 60,
        pendingEarnings: balances ? balances.EGP.pending : teacher.earnings.pendingEarnings,
        totalEarned: balances ? balances.EGP.available : teacher.earnings.totalEarned,
        grossTotalEarned: balances ? balances.EGP.totalEarned : (teacher.earnings.totalEarned + teacher.earnings.withdrawnEarnings),
        withdrawn: balances ? balances.EGP.withdrawn : teacher.earnings.withdrawnEarnings,
        balances: balances || undefined,
        completedSessions: teacher.stats.totalSessions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/profile-change', protect, authorize('teacher'), async (req, res) => {
  try {
    if (isMockMode && require('mongoose').connection.readyState !== 1) {
      return res.json({ request: null });
    }

    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id status isVerified');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const request = await TeacherProfileChangeRequest.findOne({ teacher: teacher._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name')
      .lean();

    return res.json({ request: request || null });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/profile-change', protect, authorize('teacher'), async (req, res) => {
  try {
    if (isMockMode && require('mongoose').connection.readyState !== 1) {
      return res.status(201).json({
        success: true,
        request: { _id: 'mock-profile-change', status: 'pending', proposed: req.body?.changes || {}, createdAt: new Date() },
      });
    }

    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id status isVerified media');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });
    if (teacher.status !== 'approved' || teacher.isVerified !== true) {
      return res.status(403).json({ error: 'Only approved tutors can submit public profile changes', code: 'TEACHER_NOT_APPROVED' });
    }

    const existing = await TeacherProfileChangeRequest.findOne({ teacher: teacher._id, status: 'pending' }).lean();
    if (existing) {
      return res.status(409).json({
        error: 'لديك طلب تعديل قيد مراجعة الإدارة بالفعل',
        code: 'TEACHER_PROFILE_CHANGE_PENDING',
        request: existing,
      });
    }

    const proposed = sanitizeTeacherProfileChange(req.body?.changes || {});
    const incomingMedia = req.body?.media || {};
    const mediaKinds = ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo'];

    for (const kind of mediaKinds) {
      const value = incomingMedia[kind];
      if (!value) continue;
      const reference = value?.url || value?.pathname || String(value || '');
      if (
        !reference
        || !objectStorage.referenceMatches(reference, 'teacher-public', req.user.id)
        || (objectStorage.getDriver() === 'vercel-blob' && !objectStorage.isVercelBlobReference(reference))
      ) {
        return res.status(400).json({
          error: 'One or more profile media files do not belong to this tutor account',
          code: 'INVALID_TEACHER_PROFILE_MEDIA',
        });
      }
      proposed.media[kind] = objectStorage.publicProxyUrl(reference);
    }

    const changedFields = listChangedFields(proposed);
    if (!changedFields.length) {
      return res.status(400).json({ error: 'No profile changes were supplied', code: 'NO_PROFILE_CHANGES' });
    }

    const request = await TeacherProfileChangeRequest.create({
      teacher: teacher._id,
      user: req.user.id,
      proposed,
      changedFields,
      status: 'pending',
    });

    notifyAdmins({
      type: 'system',
      title: { ar: 'طلب تعديل ملف معلم', en: 'Tutor profile change request' },
      message: {
        ar: 'أرسل معلم معتمد تعديلات جديدة على ملفه العام وتحتاج مراجعة الإدارة قبل النشر.',
        en: 'An approved tutor submitted public profile changes that require admin review before publishing.',
      },
      data: {
        actionUrl: '/admin?tab=teachers',
        metadata: { teacherId: String(teacher._id), profileChangeRequestId: String(request._id) },
      },
      priority: 'high',
    }).catch((error) => console.warn('Teacher profile change admin notification failed:', error.message));

    return res.status(201).json({ success: true, request });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/active-students', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const [sessions, circles, tasks] = await Promise.all([
      Session.find({
        teacher: teacher._id,
        type: { $in: ['regular', 'group_circle'] },
        status: { $in: ['accepted', 'completed'] },
      })
        .populate('student', 'name avatar currentLevel preferredTrack')
        .populate('attendance.student', 'name avatar currentLevel preferredTrack')
        .populate('circle', 'name status')
        .sort({ scheduledAt: -1 })
        .lean(),
      GroupCircle.find({
        teacher: teacher._id,
        status: { $in: ['active', 'full'] },
      })
        .populate('students', 'name avatar currentLevel preferredTrack')
        .select('name status track level students')
        .lean(),
      TeacherTask.find({ teacher: teacher._id })
        .select('student status dueDate updatedAt')
        .lean(),
    ]);

    const now = Date.now();
    const map = new Map();

    const ensureRecord = (studentDoc) => {
      if (!studentDoc?._id) return null;
      const id = String(studentDoc._id);
      if (!map.has(id)) {
        map.set(id, {
          _id: studentDoc._id,
          name: studentDoc.name || 'طالب',
          avatar: studentDoc.avatar || '',
          currentLevel: studentDoc.currentLevel || 'beginner',
          preferredTrack: studentDoc.preferredTrack || 'memorization',
          circles: [],
          sessionCount: 0,
          completedSessions: 0,
          nextSession: null,
          lastSession: null,
          pendingHomework: 0,
          submittedHomework: 0,
          lastProgress: null,
        });
      }
      return map.get(id);
    };

    const attachCircle = (record, circleDoc) => {
      if (!record || !circleDoc?._id || !circleDoc?.name) return;
      const cid = String(circleDoc._id);
      if (!record.circles.some((item) => String(item._id) === cid)) {
        record.circles.push({ _id: circleDoc._id, name: circleDoc.name });
      }
    };

    for (const circle of circles || []) {
      for (const studentDoc of circle.students || []) {
        const record = ensureRecord(studentDoc);
        attachCircle(record, circle);
      }
    }

    const applySessionToRecord = (record, session, studentId, { isCompletedForStudent, isUpcomingForStudent }) => {
      if (!record) return;
      record.sessionCount += 1;
      const at = new Date(session.scheduledAt).getTime();

      if (isCompletedForStudent) {
        record.completedSessions += 1;
        if (!record.lastSession || at > new Date(record.lastSession.scheduledAt).getTime()) {
          record.lastSession = {
            _id: session._id,
            scheduledAt: session.scheduledAt,
            type: session.type,
          };
        }

        const matchedReport = (session.studentReports || []).find(
          (report) => report.student && String(report.student) === studentId,
        );
        const ev = session.teacherEvaluation;
        const progressCandidate = matchedReport
          ? {
              scheduledAt: session.scheduledAt,
              memorizationScore: matchedReport.memorizationScore,
              tajweedScore: matchedReport.tajweedScore,
              surahRecited: matchedReport.surahRecited || ev?.surahRecited || '',
              nextHomework: matchedReport.nextHomework || ev?.nextHomework || '',
              notes: matchedReport.notes || ev?.overallNotes || '',
            }
          : ev && (ev.surahRecited || ev.memorization != null || ev.tajweed != null || ev.nextHomework)
            ? {
                scheduledAt: session.scheduledAt,
                memorizationScore: ev.memorization != null ? ev.memorization * 2 : undefined,
                tajweedScore: ev.tajweed != null ? ev.tajweed * 2 : undefined,
                surahRecited: ev.surahRecited || '',
                nextHomework: ev.nextHomework || '',
                notes: ev.overallNotes || '',
              }
            : null;

        if (progressCandidate && (!record.lastProgress || at > new Date(record.lastProgress.scheduledAt).getTime())) {
          record.lastProgress = progressCandidate;
        }
      }

      if (isUpcomingForStudent && at >= now) {
        if (!record.nextSession || at < new Date(record.nextSession.scheduledAt).getTime()) {
          record.nextSession = {
            _id: session._id,
            scheduledAt: session.scheduledAt,
            type: session.type,
            ...(session.circle?.name ? { circleName: session.circle.name } : {}),
          };
        }
      }
    };

    for (const session of sessions) {
      if (session.type === 'group_circle') {
        for (const entry of session.attendance || []) {
          const studentDoc = entry?.student;
          if (!studentDoc?._id) continue;
          const sid = String(studentDoc._id);
          const record = ensureRecord(studentDoc);
          attachCircle(record, session.circle);
          applySessionToRecord(record, session, sid, {
            isCompletedForStudent: session.status === 'completed' && entry.status === 'attended',
            isUpcomingForStudent: session.status === 'accepted' && entry.status !== 'excused',
          });
        }
        continue;
      }

      if (!session.student?._id) continue;
      const sid = String(session.student._id);
      const record = ensureRecord(session.student);
      applySessionToRecord(record, session, sid, {
        isCompletedForStudent: session.status === 'completed',
        isUpcomingForStudent: session.status === 'accepted',
      });
    }

    for (const task of tasks) {
      const record = map.get(String(task.student));
      if (!record) continue;
      if (task.status === 'submitted') record.submittedHomework += 1;
      if (task.status === 'pending') record.pendingHomework += 1;
    }

    const students = [...map.values()].sort((a, b) => {
      const aNext = a.nextSession ? new Date(a.nextSession.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bNext = b.nextSession ? new Date(b.nextSession.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aNext - bNext || String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });

    return res.json({ students });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/students/:studentId/summary', protect, authorize('teacher'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.studentId || ''))) {
      return res.status(400).json({ error: 'معرّف الطالب غير صالح' });
    }

    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const studentId = String(req.params.studentId);
    const ownsStudent = await doesTeacherOwnStudent(teacher._id, studentId);
    if (!ownsStudent) {
      return res.status(403).json({ error: 'لا يمكنك فتح ملف طالب غير مرتبط بحصصك' });
    }

    const [studentDoc, circles, sessions, tasks] = await Promise.all([
      User.findById(studentId).select('name avatar currentLevel preferredTrack').lean(),
      GroupCircle.find({
        teacher: teacher._id,
        students: studentId,
        status: { $in: ['active', 'full'] },
      })
        .select('_id name status track level')
        .lean(),
      Session.find({
        teacher: teacher._id,
        status: { $in: ['accepted', 'completed'] },
        $or: [
          { student: studentId },
          { type: 'group_circle', 'attendance.student': studentId },
        ],
      })
        .select('type status scheduledAt duration circle teacherEvaluation studentReports attendance')
        .populate('circle', 'name')
        .sort({ scheduledAt: -1 })
        .limit(50)
        .lean(),
      TeacherTask.find({
        teacher: teacher._id,
        student: studentId,
      })
        .select('type title description dueDate status teacherFeedback hasTeacherFeedbackAudio teacherFeedbackDuration reviewedAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    if (!studentDoc) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    const surahsSet = new Set();
    let lastRecitation = null;
    let memSum = 0;
    let memCount = 0;
    let tajSum = 0;
    let tajCount = 0;

    const timeline = sessions.map((session) => {
      const studentAttendance = Array.isArray(session.attendance)
        ? session.attendance.find((entry) => entry?.student && String(entry.student) === studentId)
        : null;
      const progressReport = (session.studentReports || []).find(
        (report) => report.student && String(report.student) === studentId,
      ) || null;
      const ev = session.teacherEvaluation || null;

      if (session.status === 'completed') {
        const surah = String(progressReport?.surahRecited || ev?.surahRecited || '').trim();
        if (surah) surahsSet.add(surah);
        if (!lastRecitation && (surah || progressReport?.nextHomework || ev?.nextHomework || progressReport?.notes || ev?.overallNotes)) {
          lastRecitation = {
            surahRecited: surah,
            fromAyah: progressReport?.fromAyah ?? ev?.fromAyah ?? null,
            toAyah: progressReport?.toAyah ?? ev?.toAyah ?? null,
            nextHomework: progressReport?.nextHomework || ev?.nextHomework || '',
            notes: progressReport?.notes || ev?.overallNotes || '',
            scheduledAt: session.scheduledAt,
          };
        }
        const mem5 = ev?.memorization != null
          ? Number(ev.memorization)
          : progressReport?.memorizationScore != null
            ? Number(progressReport.memorizationScore) / 2
            : null;
        const taj5 = ev?.tajweed != null
          ? Number(ev.tajweed)
          : progressReport?.tajweedScore != null
            ? Number(progressReport.tajweedScore) / 2
            : null;
        if (Number.isFinite(mem5)) {
          memSum += mem5;
          memCount += 1;
        }
        if (Number.isFinite(taj5)) {
          tajSum += taj5;
          tajCount += 1;
        }
      }

      return {
        _id: session._id,
        type: session.type,
        status: session.status,
        scheduledAt: session.scheduledAt,
        duration: session.duration,
        circle: session.circle ? { _id: session.circle._id, name: session.circle.name } : undefined,
        attendanceStatus: studentAttendance?.status || null,
        evaluation: ev,
        progressReport,
      };
    });

    const completedSessionsCount = sessions.filter((session) => {
      if (session.status !== 'completed') return false;
      if (session.type !== 'group_circle') return true;
      const entry = (session.attendance || []).find((item) => item?.student && String(item.student) === studentId);
      return entry?.status === 'attended';
    }).length;

    return res.json({
      student: studentDoc,
      circles: circles || [],
      quranSummary: {
        recitedSurahs: [...surahsSet],
        lastRecitation,
        avgMemorizationOutOf5: memCount ? Math.round((memSum / memCount) * 10) / 10 : null,
        avgTajweedOutOf5: tajCount ? Math.round((tajSum / tajCount) * 10) / 10 : null,
      },
      summary: {
        totalSessions: sessions.length,
        completedSessions: completedSessionsCount,
        upcomingSessions: sessions.filter((session) => (
          session.status === 'accepted' && new Date(session.scheduledAt) >= new Date()
        )).length,
        pendingHomework: tasks.filter((task) => task.status === 'pending').length,
        submittedHomework: tasks.filter((task) => task.status === 'submitted').length,
      },
      sessions: timeline,
      tasks: tasks.map(serializeTaskForResponse),
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/tasks', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const tasks = await TeacherTask.find({ teacher: teacher._id })
      .populate('student', 'name avatar')
      .populate('circle', 'name')
      .sort({ createdAt: -1 });
    res.json({ tasks: tasks.map(serializeTaskForResponse) });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/tasks', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const { studentId, circleId, sessionId, type: rawType, title: rawTitle, description, dueDate } = req.body || {};
    const type = normalizeTaskType(rawType);
    const title = String(rawTitle || '').trim().slice(0, 200);
    if ((!studentId && !circleId) || !type || !title) {
      return res.status(400).json({ error: 'studentId أو circleId مع type و title مطلوبة' });
    }

    const cleanDescription = String(description || '').trim().slice(0, 1500);
    const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ error: 'تاريخ التسليم غير صحيح' });
    }

    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(String(studentId))) {
        return res.status(400).json({ error: 'معرّف الطالب غير صالح' });
      }
      const ownsStudent = await doesTeacherOwnStudent(teacher._id, studentId);
      if (!ownsStudent) {
        return res.status(403).json({ error: 'لا يمكن تعيين واجب لطالب غير مرتبط بهذا المعلم' });
      }

      if (sessionId) {
        if (!mongoose.Types.ObjectId.isValid(String(sessionId))) {
          return res.status(400).json({ error: 'معرّف الحصة غير صالح' });
        }
        const ownedSession = await Session.findOne({
          _id: sessionId,
          teacher: teacher._id,
          $or: [
            { student: studentId },
            { type: 'group_circle', 'attendance.student': studentId },
          ],
        }).select('_id');
        if (!ownedSession) {
          return res.status(403).json({ error: 'الحصة المحددة لا تخص هذا المعلم والطالب' });
        }
      }

      const task = await TeacherTask.create({
        teacher: teacher._id,
        student: studentId,
        session: sessionId || undefined,
        type,
        title,
        description: cleanDescription,
        dueDate: parsedDueDate,
      });

      const studentUser = await User.findById(studentId).select('name');
      const studentName = studentUser?.name || 'الطالب';

      await Promise.allSettled([
        notifyUser(studentId, {
          type: 'homework-assigned',
          title: { ar: 'واجب جديد من معلمك', en: 'New homework from your tutor' },
          message: { ar: title, en: title },
          data: {
            actionUrl: '/student/dashboard?tab=homework',
            metadata: { taskId: String(task._id) },
          },
          priority: 'normal',
        }),
        notifyGuardiansForStudent(studentId, {
          type: 'homework-assigned',
          title: { ar: `واجب جديد لـ ${studentName}`, en: `New homework for ${studentName}` },
          message: {
            ar: `${title}${dueDate ? ' — راجع موعد التسليم من لوحة ولي الأمر.' : ''}`,
            en: title,
          },
          data: {
            actionUrl: '/guardian/dashboard',
            metadata: { taskId: String(task._id), studentId: String(studentId) },
          },
          priority: 'normal',
        }),
      ]);

      return res.status(201).json({ success: true, task: serializeTaskForResponse(task) });
    }

    if (!mongoose.Types.ObjectId.isValid(String(circleId))) {
      return res.status(400).json({ error: 'معرّف الحلقة غير صالح' });
    }
    const circle = await GroupCircle.findOne({
      _id: circleId,
      teacher: teacher._id,
      status: { $in: ['active', 'full'] },
    }).select('_id name students').lean();

    if (!circle) {
      return res.status(403).json({ error: 'لا يمكنك إسناد واجب لحلقة غير مسندة إليك' });
    }

    let targetStudentIds = (circle.students || []).map(String).filter(Boolean);
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(String(sessionId))) {
        return res.status(400).json({ error: 'معرّف الحصة غير صالح' });
      }
      const ownedGroupSession = await Session.findOne({
        _id: sessionId,
        teacher: teacher._id,
        circle: circle._id,
        type: 'group_circle',
      }).select('status attendance').lean();
      if (!ownedGroupSession) {
        return res.status(403).json({ error: 'الحصة المحددة لا تخص هذه الحلقة' });
      }
      if (ownedGroupSession.status === 'completed') {
        const attendedIds = (ownedGroupSession.attendance || [])
          .filter((entry) => entry.student && entry.status === 'attended')
          .map((entry) => String(entry.student));
        if (attendedIds.length) {
          targetStudentIds = attendedIds;
        }
      }
    }

    targetStudentIds = [...new Set(targetStudentIds)];
    if (!targetStudentIds.length) {
      return res.status(400).json({ error: 'لا يوجد طلاب نشطون في هذه الحلقة لإسناد الواجب إليهم' });
    }

    const createdTasks = [];
    for (const sid of targetStudentIds) {
      const created = await TeacherTask.create({
        teacher: teacher._id,
        student: sid,
        session: sessionId || undefined,
        circle: circle._id,
        type,
        title,
        description: cleanDescription,
        dueDate: parsedDueDate,
      });
      createdTasks.push(created);
    }

    const studentUsers = await User.find({ _id: { $in: targetStudentIds } }).select('name').lean();
    const studentNameById = new Map((studentUsers || []).map((u) => [String(u._id), u.name || 'الطالب']));

    await Promise.allSettled(
      createdTasks.flatMap((task) => {
        const sid = String(task.student);
        const studentName = studentNameById.get(sid) || 'الطالب';
        return [
          notifyUser(sid, {
            type: 'homework-assigned',
            title: { ar: `واجب جديد — ${circle.name}`, en: 'New homework from your tutor' },
            message: { ar: title, en: title },
            data: {
              actionUrl: '/student/dashboard?tab=homework',
              metadata: { taskId: String(task._id), circleId: String(circle._id) },
            },
            priority: 'normal',
          }),
          notifyGuardiansForStudent(sid, {
            type: 'homework-assigned',
            title: { ar: `واجب جديد لـ ${studentName}`, en: `New homework for ${studentName}` },
            message: {
              ar: `${title}${dueDate ? ' — راجع موعد التسليم من لوحة ولي الأمر.' : ''}`,
              en: title,
            },
            data: {
              actionUrl: '/guardian/dashboard',
              metadata: { taskId: String(task._id), studentId: sid },
            },
            priority: 'normal',
          }),
        ];
      })
    );

    const safeTasks = createdTasks.map(serializeTaskForResponse);
    return res.status(201).json({
      success: true,
      count: safeTasks.length,
      tasks: safeTasks,
      task: safeTasks[0] || null,
    });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.patch('/tasks/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
      return res.status(400).json({ error: 'معرّف الواجب غير صالح' });
    }
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const task = await TeacherTask.findOne({
      _id: req.params.id,
      teacher: teacher._id,
    }).select('+teacherFeedbackAudio');
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const action = req.body.action || (req.body.status === 'done' ? 'approve' : null);
    const teacherFeedback = String(req.body.teacherFeedback || '').trim().slice(0, 1500);

    if (action === 'approve') {
      if (task.status !== 'submitted' && task.status !== 'done') {
        return res.status(409).json({
          error: 'لا يمكن اعتماد واجب لم يرسله الطالب بعد',
          code: 'TASK_NOT_SUBMITTED',
        });
      }
      task.status = 'done';
      task.teacherFeedback = teacherFeedback;
      task.reviewedAt = new Date();
    } else if (action === 'request-revision') {
      if (task.status !== 'submitted') {
        return res.status(409).json({
          error: 'لا يمكن طلب إعادة واجب غير مُسلّم',
          code: 'TASK_NOT_SUBMITTED',
        });
      }

      if (task.submissionFile) {
        await deleteStoredReference({
          reference: task.submissionFile,
          purpose: 'homework',
          owner: task.student,
          localRoot: HOMEWORK_UPLOAD_ROOT,
        });
      }

      task.submissionFile = '';
      task.status = 'pending';
      task.teacherFeedback = teacherFeedback || 'يرجى إعادة التسجيل بعد مراجعة ملاحظات المعلم.';
      task.reviewedAt = new Date();
    } else {
      return res.status(400).json({ error: 'action يجب أن يكون approve أو request-revision' });
    }

    const feedbackAudio = req.body?.feedbackAudio && typeof req.body.feedbackAudio === 'object'
      ? req.body.feedbackAudio
      : null;
    if (feedbackAudio) {
      const reference = String(feedbackAudio.url || feedbackAudio.pathname || '').trim();
      const driver = objectStorage.getDriver();
      const validRef = Boolean(reference)
        && objectStorage.referenceMatches(reference, 'teacher-feedback-audio', req.user.id)
        && ((driver !== 'vercel-blob' && driver !== 's3')
          || objectStorage.isOwnedObjectReference(reference, 'teacher-feedback-audio', req.user.id));

      if (!validRef) {
        return res.status(400).json({
          error: 'مرجع التعليق الصوتي غير صالح أو لا يخص هذا المعلم',
          code: 'INVALID_TEACHER_FEEDBACK_AUDIO',
        });
      }

      const magicVerify = await objectStorage.verifyUploadedObjectMagicBytes(
        reference,
        feedbackAudio.contentType || 'audio/webm',
        10 * 1024 * 1024
      );
      if (!magicVerify.ok) {
        return res.status(400).json({ error: magicVerify.error, code: magicVerify.code });
      }

      if (task.teacherFeedbackAudio && task.teacherFeedbackAudio !== reference) {
        await deleteStoredReference({
          reference: task.teacherFeedbackAudio,
          purpose: 'teacher-feedback-audio',
          owner: req.user.id,
          localRoot: TEACHER_FEEDBACK_UPLOAD_ROOT,
        }).catch(() => {});
      }

      task.teacherFeedbackAudio = reference;
      task.hasTeacherFeedbackAudio = true;
      task.teacherFeedbackDuration = Math.min(300, Math.max(0, Math.round(Number(feedbackAudio.durationSeconds) || 0)));
    }

    await task.save();

    notifyUser(task.student, {
      type: 'homework-assigned',
      title: {
        ar: action === 'approve' ? 'تم اعتماد واجبك' : 'مطلوب إعادة الواجب',
        en: action === 'approve' ? 'Homework approved' : 'Homework revision requested',
      },
      message: {
        ar: task.teacherFeedback || (task.hasTeacherFeedbackAudio
          ? (action === 'approve' ? 'تم اعتماد الواجب وأرفق المعلم تعليقاً صوتياً.' : 'راجع التعليق الصوتي من المعلم وأعد التسليم.')
          : (action === 'approve' ? 'أحسنت، تم اعتماد الواجب.' : 'راجع ملاحظات المعلم وأعد التسليم.')),
        en: action === 'approve' ? 'Your homework was approved.' : 'Please review the tutor feedback and resubmit.',
      },
      data: {
        actionUrl: '/student/dashboard?tab=homework',
        metadata: { taskId: String(task._id), hasAudioFeedback: Boolean(task.hasTeacherFeedbackAudio) },
      },
      priority: 'normal',
    }).catch(() => {});

    User.findById(task.student).select('name').then((studentUser) => (
      notifyGuardiansForStudent(task.student, {
        type: 'homework-assigned',
        title: {
          ar: action === 'approve'
            ? `تم اعتماد واجب ${studentUser?.name || 'الطالب'}`
            : `مطلوب إعادة واجب ${studentUser?.name || 'الطالب'}`,
          en: action === 'approve' ? 'Homework approved' : 'Homework revision requested',
        },
        message: {
          ar: task.teacherFeedback || (action === 'approve' ? 'تم اعتماد الواجب.' : 'راجع ملاحظات المعلم من لوحة ولي الأمر.'),
          en: action === 'approve' ? 'Homework approved.' : 'Homework revision requested.',
        },
        data: {
          actionUrl: '/guardian/dashboard',
          metadata: { taskId: String(task._id), studentId: String(task.student) },
        },
        priority: 'normal',
      })
    )).catch(() => {});

    return res.json({ success: true, task: serializeTaskForResponse(task) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/stats', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const totalSessions = await Session.countDocuments({ teacher: teacher._id });
    const completedSessions = await Session.countDocuments({ 
      teacher: teacher._id, 
      status: 'completed' 
    });

    const balances = (mongoose.connection.readyState === 1 || TeacherLedger.find !== mongoose.Model.find)
      ? await calculateTeacherBalance(teacher._id).catch(() => null)
      : null;

    const totalHours = Math.round(teacher.stats.totalHours);
    const totalEarnings = balances
      ? balances.EGP.totalEarned
      : (teacher.earnings.totalEarned + teacher.earnings.withdrawnEarnings);
    const pendingEarnings = balances
      ? balances.EGP.pending
      : teacher.earnings.pendingEarnings;

    res.json({
      totalStudents: teacher.stats.totalStudents,
      totalSessions: completedSessions,
      totalHours,
      pendingEarnings,
      availableEarnings: balances ? balances.EGP.available : teacher.earnings.totalEarned,
      totalEarnings,
      averageRating: Number(teacher.rating?.count || 0) > 0 ? Number(teacher.rating?.average || 0) : 0,
      sessionRate: Number(teacher.hourlyRate || SESSION_RATE),
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/circles', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });
    const GroupCircle = require('../models/GroupCircle');
    const { getPlan } = require('../config/subscriptionPlans');
    const circles = await GroupCircle.find({ teacher: teacher._id, status: { $ne: 'completed' } })
      .populate('students', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();
    const enriched = circles.map((circle) => {
      const plan = circle.subscriptionPlanKey ? getPlan(circle.subscriptionPlanKey) : null;
      return {
        ...circle,
        currentCount: Array.isArray(circle.students) ? circle.students.length : 0,
        durationMinMinutes: Number(plan?.durationMinMinutes || 30),
        durationMaxMinutes: Number(plan?.durationMaxMinutes || 60),
      };
    });
    return res.json({ circles: enriched });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/students', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const sessions = await Session.find({ 
      teacher: teacher._id, 
      status: 'completed' 
    }).populate('student', 'name avatar');

    const studentMap = {};
    sessions.forEach(session => {
      if (!session.student?._id) return;
      const studentId = session.student._id.toString();
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          _id: session.student._id,
          name: session.student.name,
          avatar: session.student.avatar,
          sessionCount: 0
        };
      }
      studentMap[studentId].sessionCount++;
    });

    const students = Object.values(studentMap);
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/analytics', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAhead = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    const [allSessions, tasks, ledgerEntries, balances] = await Promise.all([
      Session.find({ teacher: teacher._id })
        .sort({ scheduledAt: -1 })
        .limit(2000)
        .select('student attendance.student type status scheduledAt updatedAt duration')
        .lean(),
      TeacherTask.find({ teacher: teacher._id }).sort({ createdAt: -1 }).limit(1000).select('status').lean(),
      TeacherLedger.find({
        teacher: teacher._id,
        type: 'session_earning',
        status: 'completed',
        createdAt: { $gte: sixMonthsAgo },
      }).sort({ createdAt: -1 }).limit(2000).select('amount currency createdAt').lean(),
      calculateTeacherBalance(teacher._id),
    ]);

    const recentCompleted = allSessions.filter((session) => (
      session.status === 'completed'
      && new Date(session.updatedAt || session.scheduledAt) >= sixMonthsAgo
    ));

    const monthly = {};
    for (const session of recentCompleted) {
      const date = new Date(session.updatedAt || session.scheduledAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + 1;
    }

    const earnings = { daily: 0, weekly: 0, monthly: 0 };
    for (const entry of ledgerEntries) {
      if (entry.currency !== 'EGP') continue;
      const date = new Date(entry.createdAt);
      const amount = Number(entry.amount) || 0;
      if (date >= dayStart) earnings.daily += amount;
      if (date >= weekStart) earnings.weekly += amount;
      if (date >= monthStart) earnings.monthly += amount;
    }

    const completedTrials = allSessions.filter((session) => (
      session.type === 'trial' && session.status === 'completed' && session.student
    ));
    const trialStudentIds = new Set(completedTrials.map((session) => String(session.student)));
    const continuingStudentIds = new Set();
    for (const session of allSessions) {
      if (!['accepted', 'completed'].includes(session.status)) continue;
      if (session.type === 'regular' && session.student) {
        continuingStudentIds.add(String(session.student));
      } else if (session.type === 'group_circle') {
        for (const entry of session.attendance || []) {
          if (entry?.student) continuingStudentIds.add(String(entry.student));
        }
      }
    }
    const convertedCount = [...trialStudentIds].filter((id) => continuingStudentIds.has(id)).length;
    const trialConversionRate = trialStudentIds.size
      ? Math.round((convertedCount / trialStudentIds.size) * 100)
      : 0;

    const completedTasks = tasks.filter((task) => task.status === 'done').length;
    const homeworkCompletionRate = tasks.length
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;

    const upcomingSevenDays = allSessions.filter((session) => {
      if (session.status !== 'accepted') return false;
      const scheduledAt = new Date(session.scheduledAt);
      return scheduledAt >= now && scheduledAt <= sevenDaysAhead;
    }).length;

    return res.json({
      monthlySessions: Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      totalCompleted: recentCompleted.length,
      lifetimeCompleted: allSessions.filter((session) => session.status === 'completed').length,
      averageRating: Number(teacher.rating?.count || 0) > 0 ? Number(teacher.rating?.average || 0) : 0,
      totalStudents: continuingStudentIds.size,
      trialConversion: {
        completedTrials: trialStudentIds.size,
        converted: convertedCount,
        rate: trialConversionRate,
      },
      homework: {
        total: tasks.length,
        completed: completedTasks,
        completionRate: homeworkCompletionRate,
      },
      upcomingSevenDays,
      earnings: {
        ...earnings,
        available: balances?.EGP?.available || 0,
        pendingPayouts: balances?.EGP?.pending || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

function serializeLegacyWithdrawal(entry) {
  const details = entry?.payoutDetails || {};
  const accountInfo = details.phone || details.ipaAddress || details.bankAccountNumber || details.paypalEmail || '';
  return {
    _id: entry._id,
    teacher: entry.teacher,
    amount: entry.amount,
    currency: entry.currency || 'EGP',
    method: entry.payoutMethod === 'bank_transfer' ? 'bank' : (entry.payoutMethod || 'vodafone_cash'),
    payoutMethod: entry.payoutMethod,
    payoutDetails: details,
    accountInfo,
    status: entry.status === 'completed' ? 'approved' : entry.status,
    ledgerStatus: entry.status,
    adminNote: entry.notes || '',
    referenceNumber: entry.referenceNumber || '',
    createdAt: entry.createdAt,
    processedAt: entry.processedAt,
  };
}

router.get('/withdrawals', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const balances = await calculateTeacherBalance(teacher._id);
    const ledgerEntries = await TeacherLedger.find({ teacher: teacher._id, type: 'payout' })
      .sort({ createdAt: -1 })
      .limit(100);
    const withdrawals = (Array.isArray(ledgerEntries) ? ledgerEntries : []).map(serializeLegacyWithdrawal);
    res.json({
      withdrawals,
      available: balances?.EGP?.available || 0,
      balances,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/withdrawals', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const {
      amount,
      currency = 'EGP',
      method,
      payoutMethod: rawPayoutMethod,
      accountInfo,
      payoutDetails: rawPayoutDetails,
      notes,
    } = req.body || {};

    const cleanAccount = String(accountInfo || '').trim();
    const mappedMethod = rawPayoutMethod || (method === 'bank' ? 'bank_transfer' : (method || 'vodafone_cash'));
    const resolvedDetails = rawPayoutDetails && typeof rawPayoutDetails === 'object'
      ? rawPayoutDetails
      : mappedMethod === 'bank_transfer'
        ? { bankName: String(req.body?.bankName || 'Bank Transfer').trim(), bankAccountNumber: cleanAccount }
        : mappedMethod === 'instapay'
          ? { ipaAddress: cleanAccount, phone: cleanAccount }
          : mappedMethod === 'paypal'
            ? { paypalEmail: cleanAccount }
            : { phone: cleanAccount };

    const transaction = await requestTeacherPayout({
      teacherId: teacher._id,
      amount,
      currency,
      payoutMethod: mappedMethod,
      payoutDetails: resolvedDetails,
      notes,
    });

    notifyAdmins({
      type: 'system',
      title: { ar: 'طلب سحب أرباح جديد', en: 'New withdrawal request' },
      message: {
        ar: `طلب معلم سحب ${transaction.amount} ${transaction.currency} ويحتاج مراجعة الإدارة.`,
        en: `A tutor requested a withdrawal of ${transaction.amount} ${transaction.currency} and it needs admin review.`,
      },
      data: {
        actionUrl: '/admin?tab=withdrawals',
        metadata: { withdrawalId: String(transaction._id), amount: transaction.amount },
      },
      priority: 'high',
    }).catch((error) => {
      console.warn('Admin withdrawal notification failed:', error.message);
    });

    res.status(201).json({
      success: true,
      withdrawal: serializeLegacyWithdrawal(transaction),
      transaction,
    });
  } catch (error) {
    const status = error?.status || 400;
    res.status(status).json({
      error: error?.publicMessage || safeErrorMessage(error, status),
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

const VALID_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
}

function normalizeAvailabilityDays(availability) {
  const normalized = [];

  for (const day of availability || []) {
    if (!VALID_DAYS.includes(day?.day)) continue;

    const slots = [];
    for (const slot of day.slots || []) {
      const start = timeToMinutes(slot?.startTime);
      const end = timeToMinutes(slot?.endTime);
      if (start == null || end == null || start >= end) {
        const error = new Error('كل فترة متاحة يجب أن تحتوي وقت بداية ونهاية صحيحين وأن تكون النهاية بعد البداية');
        error.code = 'INVALID_AVAILABILITY_SLOT';
        throw error;
      }
      slots.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBooked: false,
        start,
        end,
      });
    }

    slots.sort((a, b) => a.start - b.start);
    for (let index = 1; index < slots.length; index += 1) {
      if (slots[index].start < slots[index - 1].end) {
        const error = new Error('لا يمكن حفظ فترات متداخلة في اليوم نفسه');
        error.code = 'OVERLAPPING_AVAILABILITY_SLOTS';
        throw error;
      }
    }

    if (slots.length) {
      normalized.push({
        day: day.day,
        slots: slots.map(({ startTime, endTime, isBooked }) => ({ startTime, endTime, isBooked })),
      });
    }
  }

  return normalized;
}

router.get('/availability', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).select('availability availabilityTimezone');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });
    res.json({
      availability: teacher.availability || [],
      timezone: safeTimeZone(teacher.availabilityTimezone),
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/availability', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const { availability, timezone } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ error: 'availability must be an array' });
    }

    const cleaned = normalizeAvailabilityDays(availability);
    const normalizedTimezone = safeTimeZone(timezone || teacher.availabilityTimezone);

    teacher.availability = cleaned;
    teacher.availabilityTimezone = normalizedTimezone;
    await teacher.save();
    res.json({
      success: true,
      availability: teacher.availability,
      timezone: teacher.availabilityTimezone,
    });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/reviews', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const Review = require('../models/Review');
    const rawReviews = await Review.find({ teacher: teacher._id, isApproved: true })
      .populate('student', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    // Respect the student's anonymity choice: the reviewed teacher must never
    // learn the identity or the exact session behind an anonymous review.
    const reviews = rawReviews.map((review) => {
      const obj = typeof review?.toObject === 'function' ? review.toObject() : { ...review };
      if (obj.isAnonymous) {
        delete obj.session;
        obj.student = { name: 'طالب مجهول', avatar: '' };
      } else if (obj.student && typeof obj.student === 'object') {
        obj.student = { name: obj.student.name || '', avatar: obj.student.avatar || '' };
      }
      return obj;
    });

    const totalReviews = Number(teacher.rating?.count || 0);
    res.json({
      reviews,
      averageRating: totalReviews > 0 ? Number(teacher.rating?.average || 0) : 0,
      totalReviews,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;