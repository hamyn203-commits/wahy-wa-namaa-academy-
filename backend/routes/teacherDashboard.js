const express = require('express');
const path = require('path');
const router = express.Router();
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const TeacherProfileChangeRequest = require('../models/TeacherProfileChangeRequest');
const TeacherTask = require('../models/TeacherTask');
const User = require('../models/User');
const WithdrawRequest = require('../models/WithdrawRequest');
const TeacherLedger = require('../models/TeacherLedger');
const { calculateTeacherBalance } = require('../services/teacherFinance');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdmins, notifyUser, notifyGuardiansForStudent } = require('../utils/notify');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const objectStorage = require('../services/objectStorage');
const { sanitizeTeacherProfileChange, listChangedFields } = require('../services/teacherProfileChange');

const SESSION_RATE = 50;
const HOMEWORK_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'homework');
const { isMockMode } = require('../config/runtime');
const { safeTimeZone } = require('../services/sessionScheduling');

// Simple mock-mode fallbacks so the teacher dashboard works in local dev without DB.
if (isMockMode) {
  router.get('/profile', protect, authorize('teacher'), (req, res) => {
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
  });

  router.get('/active-students', protect, authorize('teacher'), (req, res) => res.json({ students: [] }));
  router.get('/tasks', protect, authorize('teacher'), (req, res) => res.json({ tasks: [] }));
  router.post('/tasks', protect, authorize('teacher'), (req, res) => res.status(201).json({ success: true, task: { _id: `mock-task-${Date.now()}`, ...req.body } }));
  router.patch('/tasks/:id', protect, authorize('teacher'), (req, res) => res.json({ success: true, task: { _id: req.params.id, ...req.body } }));
  router.get('/stats', protect, authorize('teacher'), (req, res) => res.json({ totalStudents: 0, totalSessions: 0, totalHours: 0, pendingEarnings: 0, totalEarnings: 0, averageRating: 0, sessionRate: SESSION_RATE }));
  router.get('/students', protect, authorize('teacher'), (req, res) => res.json({ students: [] }));
  router.get('/analytics', protect, authorize('teacher'), (req, res) => res.json({ monthlySessions: [], totalCompleted: 0, averageRating: 0, totalStudents: 0, earnings: { daily: 0, weekly: 0, monthly: 0, pending: 0 } }));
  router.get('/withdrawals', protect, authorize('teacher'), (req, res) => res.json({ withdrawals: [], available: 0 }));
  router.post('/withdrawals', protect, authorize('teacher'), (req, res) => res.status(201).json({ success: true, withdrawal: { _id: `mock-withdraw-${Date.now()}`, amount: req.body.amount, method: req.body.method, accountInfo: req.body.accountInfo, status: 'pending' } }));
  router.get('/availability', protect, authorize('teacher'), (req, res) => res.json({ availability: [] }));
  router.put('/availability', protect, authorize('teacher'), (req, res) => res.json({ success: true, availability: req.body.availability || [] }));
  router.get('/reviews', protect, authorize('teacher'), (req, res) => res.json({ reviews: [], averageRating: 0, totalReviews: 0 }));
  router.get('/circles', protect, authorize('teacher'), (req, res) => res.json({ circles: [] }));
}

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

    res.json({
      teacher: teacherValue,
      wallet: {
        sessionRate: Number(teacher.hourlyRate || SESSION_RATE),
        sessionDurationMinutes: 60,
        pendingEarnings: teacher.earnings.pendingEarnings,
        totalEarned: teacher.earnings.totalEarned,
        withdrawn: teacher.earnings.withdrawnEarnings,
        completedSessions: teacher.stats.totalSessions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      .populate('reviewedBy', 'name email')
      .lean();

    return res.json({ request: request || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
  }
});

router.get('/active-students', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const [sessions, tasks] = await Promise.all([
      Session.find({
        teacher: teacher._id,
        type: 'regular',
        status: { $in: ['accepted', 'completed'] },
      })
        .populate('student', 'name email avatar phone')
        .sort({ scheduledAt: -1 })
        .lean(),
      TeacherTask.find({ teacher: teacher._id })
        .select('student status dueDate updatedAt')
        .lean(),
    ]);

    const now = Date.now();
    const map = new Map();

    for (const session of sessions) {
      if (!session.student?._id) continue;
      const id = String(session.student._id);

      if (!map.has(id)) {
        map.set(id, {
          ...session.student,
          sessionCount: 0,
          completedSessions: 0,
          nextSession: null,
          lastSession: null,
          pendingHomework: 0,
          submittedHomework: 0,
          lastProgress: null,
        });
      }

      const record = map.get(id);
      record.sessionCount += 1;

      const at = new Date(session.scheduledAt).getTime();
      if (session.status === 'completed') {
        record.completedSessions += 1;
        if (!record.lastSession || at > new Date(record.lastSession.scheduledAt).getTime()) {
          record.lastSession = {
            _id: session._id,
            scheduledAt: session.scheduledAt,
            type: session.type,
          };
        }

        const latestReport = (session.studentReports || []).find(
          (report) => report.student && String(report.student) === id,
        );
        if (latestReport && (!record.lastProgress || at > new Date(record.lastProgress.scheduledAt).getTime())) {
          record.lastProgress = {
            scheduledAt: session.scheduledAt,
            memorizationScore: latestReport.memorizationScore,
            tajweedScore: latestReport.tajweedScore,
            surahRecited: latestReport.surahRecited,
            nextHomework: latestReport.nextHomework,
            notes: latestReport.notes,
          };
        }
      }

      if (session.status === 'accepted' && at >= now) {
        if (!record.nextSession || at < new Date(record.nextSession.scheduledAt).getTime()) {
          record.nextSession = {
            _id: session._id,
            scheduledAt: session.scheduledAt,
            type: session.type,
          };
        }
      }
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
    return res.status(500).json({ error: error.message });
  }
});

router.get('/students/:studentId/summary', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const relationship = await Session.findOne({
      teacher: teacher._id,
      student: req.params.studentId,
      status: { $in: ['accepted', 'completed'] },
    })
      .populate('student', 'name email avatar phone')
      .lean();

    if (!relationship?.student) {
      return res.status(403).json({ error: 'لا يمكنك فتح ملف طالب غير مرتبط بحصصك' });
    }

    const [sessions, tasks] = await Promise.all([
      Session.find({
        teacher: teacher._id,
        student: req.params.studentId,
        status: { $in: ['accepted', 'completed'] },
      })
        .select('type status scheduledAt duration teacherEvaluation studentReports')
        .sort({ scheduledAt: -1 })
        .limit(50)
        .lean(),
      TeacherTask.find({
        teacher: teacher._id,
        student: req.params.studentId,
      })
        .select('type title description dueDate status teacherFeedback reviewedAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const studentId = String(req.params.studentId);
    const timeline = sessions.map((session) => ({
      _id: session._id,
      type: session.type,
      status: session.status,
      scheduledAt: session.scheduledAt,
      duration: session.duration,
      evaluation: session.teacherEvaluation || null,
      progressReport: (session.studentReports || []).find(
        (report) => report.student && String(report.student) === studentId,
      ) || null,
    }));

    return res.json({
      student: relationship.student,
      summary: {
        totalSessions: sessions.length,
        completedSessions: sessions.filter((session) => session.status === 'completed').length,
        upcomingSessions: sessions.filter((session) => (
          session.status === 'accepted' && new Date(session.scheduledAt) >= new Date()
        )).length,
        pendingHomework: tasks.filter((task) => task.status === 'pending').length,
        submittedHomework: tasks.filter((task) => task.status === 'submitted').length,
      },
      sessions: timeline,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tasks', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const tasks = await TeacherTask.find({ teacher: teacher._id })
      .populate('student', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const { studentId, sessionId, type, title, description, dueDate } = req.body;
    if (!studentId || !type || !title) {
      return res.status(400).json({ error: 'studentId, type, title مطلوبة' });
    }

    const relationship = await Session.findOne({
      teacher: teacher._id,
      student: studentId,
      status: { $in: ['accepted', 'completed'] },
    }).select('_id');

    if (!relationship) {
      return res.status(403).json({ error: 'لا يمكن تعيين واجب لطالب غير مرتبط بهذا المعلم' });
    }

    if (sessionId) {
      const ownedSession = await Session.findOne({
        _id: sessionId,
        teacher: teacher._id,
        student: studentId,
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
      description: description || '',
      dueDate: dueDate ? new Date(dueDate) : undefined,
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

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/tasks/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const task = await TeacherTask.findOne({
      _id: req.params.id,
      teacher: teacher._id,
    });
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

    await task.save();

    notifyUser(task.student, {
      type: 'homework-assigned',
      title: {
        ar: action === 'approve' ? 'تم اعتماد واجبك' : 'مطلوب إعادة الواجب',
        en: action === 'approve' ? 'Homework approved' : 'Homework revision requested',
      },
      message: {
        ar: task.teacherFeedback || (action === 'approve' ? 'أحسنت، تم اعتماد الواجب.' : 'راجع ملاحظات المعلم وأعد التسليم.'),
        en: action === 'approve' ? 'Your homework was approved.' : 'Please review the tutor feedback and resubmit.',
      },
      data: {
        actionUrl: '/student/dashboard?tab=homework',
        metadata: { taskId: String(task._id) },
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

    return res.json({ success: true, task });
  } catch (error) {
    return res.status(400).json({ error: error.message });
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

    const totalHours = Math.round(teacher.stats.totalHours);
    const totalEarnings = teacher.earnings.totalEarned + teacher.earnings.withdrawnEarnings;

    res.json({
      totalStudents: teacher.stats.totalStudents,
      totalSessions: completedSessions,
      totalHours,
      pendingEarnings: teacher.earnings.pendingEarnings,
      totalEarnings,
      averageRating: Number(teacher.rating?.count || 0) > 0 ? Number(teacher.rating?.average || 0) : 0,
      sessionRate: Number(teacher.hourlyRate || SESSION_RATE),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/circles', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });
    const GroupCircle = require('../models/GroupCircle');
    const { getPlan } = require('../config/subscriptionPlans');
    const circles = await GroupCircle.find({ teacher: teacher._id, status: { $ne: 'completed' } })
      .populate('students', 'name email avatar')
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
    return res.status(500).json({ error: error.message });
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
    }).populate('student', 'name email avatar');

    const studentMap = {};
    sessions.forEach(session => {
      const studentId = session.student._id.toString();
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          _id: session.student._id,
          name: session.student.name,
          email: session.student.email,
          avatar: session.student.avatar,
          sessionCount: 0
        };
      }
      studentMap[studentId].sessionCount++;
    });

    const students = Object.values(studentMap);
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
        .select('student type status scheduledAt updatedAt duration')
        .lean(),
      TeacherTask.find({ teacher: teacher._id }).select('status').lean(),
      TeacherLedger.find({
        teacher: teacher._id,
        type: 'session_earning',
        status: 'completed',
        createdAt: { $gte: sixMonthsAgo },
      }).select('amount currency createdAt').lean(),
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
    const continuingStudentIds = new Set(
      allSessions
        .filter((session) => (
          session.type === 'regular'
          && ['accepted', 'completed'].includes(session.status)
          && session.student
        ))
        .map((session) => String(session.student)),
    );
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
    return res.status(500).json({ error: error.message });
  }
});

async function availableBalance(teacherId) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) return 0;
  const pendingSum = await WithdrawRequest.aggregate([
    { $match: { teacher: teacher._id, status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const locked = pendingSum[0]?.total || 0;
  return Math.max(0, teacher.earnings.pendingEarnings - locked);
}

router.get('/withdrawals', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const withdrawals = await WithdrawRequest.find({ teacher: teacher._id }).sort({ createdAt: -1 });
    const available = await availableBalance(teacher._id);
    res.json({ withdrawals, available });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/withdrawals', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const { amount, method, accountInfo } = req.body;
    const num = Number(amount);
    if (!num || num < SESSION_RATE) {
      return res.status(400).json({ error: `الحد الأدنى للسحب ${SESSION_RATE} ج.م` });
    }
    if (!accountInfo?.trim()) {
      return res.status(400).json({ error: 'بيانات الحساب مطلوبة' });
    }

    const available = await availableBalance(teacher._id);
    if (num > available) {
      return res.status(400).json({ error: `الرصيد المتاح ${available} ج.م فقط` });
    }

    const withdrawal = await WithdrawRequest.create({
      teacher: teacher._id,
      amount: num,
      method: method || 'vodafone_cash',
      accountInfo: accountInfo.trim(),
    });

    notifyAdmins({
      type: 'system',
      title: { ar: 'طلب سحب أرباح جديد', en: 'New withdrawal request' },
      message: {
        ar: `طلب معلم سحب ${num} ج.م ويحتاج مراجعة الإدارة.`,
        en: `A tutor requested a withdrawal of ${num} EGP and it needs admin review.`,
      },
      data: {
        actionUrl: '/admin?tab=withdrawals',
        metadata: { withdrawalId: String(withdrawal._id), amount: num },
      },
      priority: 'high',
    }).catch((error) => {
      console.warn('Admin withdrawal notification failed:', error.message);
    });

    res.status(201).json({ success: true, withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
  }
});

router.get('/reviews', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const Review = require('../models/Review');
    const reviews = await Review.find({ teacher: teacher._id, isApproved: true })
      .populate('student', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    const totalReviews = Number(teacher.rating?.count || 0);
    res.json({
      reviews,
      averageRating: totalReviews > 0 ? Number(teacher.rating?.average || 0) : 0,
      totalReviews,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;