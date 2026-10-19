import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Users, Star, Wallet, ClipboardList,
  BookOpen, X, Plus, Clock, BarChart3, MessageSquare, Sparkles,
  Video, MoreHorizontal, UserRound, CheckCircle2, AlertTriangle,
  Headphones, RotateCcw, ChevronLeft, TrendingUp, CalendarDays,
  Upload, Trash2, Send, Megaphone,
} from 'lucide-react';
import DashboardLayout, { StatCard } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { uploadTeacherFiles } from '../../lib/teacherUploadQueue.mjs';
import { apiUrl } from '../../config';
import { TASK_TYPES } from '../TeacherRegistration/constants';
import SessionChatModal from '../../components/session/SessionChatModal';
import { sessionJoinWindow, formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { teacherPublicImage, teacherImageFallback } from '../../lib/teacherMedia';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';

const SESSION_RATE = 50;
const WEEK_DAYS = [
  { id: 'sunday', label: 'الأحد' }, { id: 'monday', label: 'الإثنين' },
  { id: 'tuesday', label: 'الثلاثاء' }, { id: 'wednesday', label: 'الأربعاء' },
  { id: 'thursday', label: 'الخميس' }, { id: 'friday', label: 'الجمعة' },
  { id: 'saturday', label: 'السبت' },
];
const emptyEval = {
  attendance: 5,
  memorization: 5,
  tajweed: 5,
  behavior: 5,
  commitment: 5,
  overallNotes: '',
  surahRecited: '',
  fromAyah: '',
  toAyah: '',
  nextHomework: '',
};
const emptyHomework = { type: 'memorization', description: '', dueDate: '' };

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, logout } = useRequireAuth(['teacher']);
  const { locale } = useI18n();
  const lp = (value) => localizedPath(value, locale);
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [trials, setTrials] = useState([]);
  const [pendingRegular, setPendingRegular] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [activeStudents, setActiveStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const meetingProvider = 'jitsi';
  const [chatSession, setChatSession] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const [evalModal, setEvalModal] = useState(null);
  const [evaluation, setEvaluation] = useState(emptyEval);
  const [homeworkList, setHomeworkList] = useState([]);

  const [taskModal, setTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ studentId: '', type: 'memorization', title: '', description: '', dueDate: '' });
  const [finance, setFinance] = useState({
    balances: {
      EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
      USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
    },
    limits: { minPayoutEGP: 100, minPayoutUSD: 10 },
  });
  const [transactions, setTransactions] = useState([]);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    currency: 'EGP',
    payoutMethod: 'vodafone_cash',
    phone: '',
    ipaAddress: '',
    bankName: '',
    bankAccountNumber: '',
    paypalEmail: '',
  });
  const [withdrawing, setWithdrawing] = useState(false);
  const [studentModal, setStudentModal] = useState(null);
  const [studentSummary, setStudentSummary] = useState(null);
  const [studentSummaryLoading, setStudentSummaryLoading] = useState(false);
  const [homeworkAudio, setHomeworkAudio] = useState({ taskId: '', url: '', loading: false });
  const [taskReview, setTaskReview] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 0, totalReviews: 0 });
  const [schedule, setSchedule] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('التجويد');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [teacherUpdates, setTeacherUpdates] = useState([]);
  const [updateForm, setUpdateForm] = useState({
    title: '',
    message: '',
    audienceMode: 'all-active',
    studentIds: [],
    files: [],
  });
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [updateUploadProgress, setUpdateUploadProgress] = useState(null);
  const updateUploadCache = useRef(new Map());
  const [updateVideoUrls, setUpdateVideoUrls] = useState({});
  const [profileChange, setProfileChange] = useState(null);
  const [profileEdit, setProfileEdit] = useState({
    fullName: '', city: '', university: '', faculty: '', qualification: '',
    teachingExperience: 0, numberOfIjazat: 0, bio: '',
  });
  const [profileFiles, setProfileFiles] = useState({
    profilePhoto: null, introductionVideo: null, recitationVideo: null, teachingMethodVideo: null,
  });
  const [savingProfileChange, setSavingProfileChange] = useState(false);
  const [profileUploadProgress, setProfileUploadProgress] = useState(null);
  const profileUploadCache = useRef(new Map());
  const [attendanceUpdating, setAttendanceUpdating] = useState('');


  const load = useCallback(async () => {
    try {
      const [prof, st, tr, pendReg, sess, done, stud, tsk, balance, tx, analyticsData, updateData, profileChangeData] = await Promise.all([
        api.get('/api/teachers/dashboard/profile', { auth: true }),
        api.get('/api/teachers/dashboard/stats', { auth: true }),
        api.get('/api/sessions/my-sessions?type=trial&status=pending', { auth: true }),
        api.get('/api/sessions/my-sessions?type=regular&status=pending', { auth: true }),
        api.get('/api/sessions/my-sessions?status=accepted&limit=100', { auth: true }),
        api.get('/api/sessions/my-sessions?status=completed&limit=100', { auth: true }),
        api.get('/api/teachers/dashboard/active-students', { auth: true }),
        api.get('/api/teachers/dashboard/tasks', { auth: true }),
        api.get('/api/finance/teacher/balance', { auth: true }),
        api.get('/api/finance/teacher/transactions?limit=20', { auth: true }),
        api.get('/api/teachers/dashboard/analytics', { auth: true }),
        api.get('/api/teacher-updates/teacher', { auth: true }),
        api.get('/api/teachers/dashboard/profile-change', { auth: true }),
      ]);
      setProfile(prof);
      setStats(st);
      setTrials(tr.sessions || []);
      setPendingRegular(pendReg.sessions || []);
      setSessions((sess.sessions || []).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
      setCompletedSessions((done.sessions || []).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)));
      setActiveStudents(stud.students || []);
      setTasks(tsk.tasks || []);
      setFinance(balance || {
        balances: {
          EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
          USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
        },
        limits: { minPayoutEGP: 100, minPayoutUSD: 10 },
      });
      setTransactions(tx.transactions || []);
      setAnalytics(analyticsData || null);
      setTeacherUpdates(updateData.updates || []);
      setProfileChange(profileChangeData?.request || null);
    } catch {
      toast.error('تعذر تحميل بيانات لوحة المعلم');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  useEffect(() => {
    const teacher = profile?.teacher;
    if (!teacher) return;
    setProfileEdit({
      fullName: teacher.personalInfo?.fullName || user?.name || '',
      city: teacher.personalInfo?.city || '',
      university: teacher.academicInfo?.university || '',
      faculty: teacher.academicInfo?.faculty || '',
      qualification: teacher.academicInfo?.qualification || '',
      teachingExperience: Number(teacher.quranInfo?.teachingExperience || 0),
      numberOfIjazat: Number(teacher.quranInfo?.numberOfIjazat || 0),
      bio: teacher.user?.bio || '',
    });
  }, [profile?.teacher?._id, user?.name]);

  const submitProfileChange = async (event) => {
    event.preventDefault();
    if (profileChange?.status === 'pending') {
      return toast.error('لديك طلب تعديل قيد مراجعة الإدارة بالفعل');
    }

    const teacher = profile?.teacher;
    if (!teacher) return;
    setSavingProfileChange(true);

    try {
      const mediaEntries = Object.entries(profileFiles).filter(([, file]) => Boolean(file));
      const media = await uploadTeacherFiles(mediaEntries.map(([kind, file]) => ({
        key: kind, label: file.name || kind, purpose: 'teacher-public', files: [file],
      })), {
        upload: uploadFileDirect,
        cache: profileUploadCache.current,
        onProgress: setProfileUploadProgress,
      });
      const changes = { personalInfo: {}, academicInfo: {}, quranInfo: {}, user: {} };

      if (profileEdit.fullName.trim() !== String(teacher.personalInfo?.fullName || '').trim()) changes.personalInfo.fullName = profileEdit.fullName.trim();
      if (profileEdit.city.trim() !== String(teacher.personalInfo?.city || '').trim()) changes.personalInfo.city = profileEdit.city.trim();
      if (profileEdit.university.trim() !== String(teacher.academicInfo?.university || '').trim()) changes.academicInfo.university = profileEdit.university.trim();
      if (profileEdit.faculty.trim() !== String(teacher.academicInfo?.faculty || '').trim()) changes.academicInfo.faculty = profileEdit.faculty.trim();
      if (profileEdit.qualification.trim() !== String(teacher.academicInfo?.qualification || '').trim()) changes.academicInfo.qualification = profileEdit.qualification.trim();
      if (Number(profileEdit.teachingExperience) !== Number(teacher.quranInfo?.teachingExperience || 0)) changes.quranInfo.teachingExperience = Number(profileEdit.teachingExperience);
      if (Number(profileEdit.numberOfIjazat) !== Number(teacher.quranInfo?.numberOfIjazat || 0)) changes.quranInfo.numberOfIjazat = Number(profileEdit.numberOfIjazat);
      if (profileEdit.bio.trim() !== String(teacher.user?.bio || '').trim()) changes.user.bio = profileEdit.bio.trim();

      const result = await api.post('/api/teachers/dashboard/profile-change', { changes, media }, { auth: true });
      setProfileChange(result.request || null);
      profileUploadCache.current.clear();
      setProfileFiles({ profilePhoto: null, introductionVideo: null, recitationVideo: null, teachingMethodVideo: null });
      toast.success('تم إرسال التعديلات للإدارة. ملفك العام سيبقى كما هو حتى الموافقة.');
    } catch (error) {
      toast.error(error.message || 'تعذر إرسال طلب التعديل');
    } finally {
      setSavingProfileChange(false);
      setProfileUploadProgress(null);
    }
  };


  useEffect(() => {
    return () => {
      if (homeworkAudio.url) URL.revokeObjectURL(homeworkAudio.url);
    };
  }, [homeworkAudio.url]);

  const syncSessions = useCallback(async () => {
    if (!ready) return;
    try {
      const result = await api.get('/api/sessions/my-sessions?limit=100', { auth: true });
      const all = result.sessions || [];
      setTrials(all.filter((item) => item.type === 'trial' && item.status === 'pending'));
      setPendingRegular(all.filter((item) => item.type === 'regular' && item.status === 'pending'));
      setSessions(
        all
          .filter((item) => item.status === 'accepted')
          .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
      );
      setCompletedSessions(
        all
          .filter((item) => item.status === 'completed')
          .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)),
      );
    } catch {
      // Keep the current dashboard stable during a transient sync failure.
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') syncSessions();
    };

    refresh();
    const interval = window.setInterval(refresh, 15000);
    const onFocus = () => refresh();
    const onVisibility = () => refresh();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ready, syncSessions]);

  useEffect(() => {
    if (!ready) return undefined;

    const onRealtimeNotification = (event) => {
      const type = event?.detail?.type;
      if (['session-request', 'session-chat-message'].includes(type)) {
        syncSessions();
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, syncSessions]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = ['overview', 'requests', 'sessions', 'students', 'homework', 'updates', 'schedule', 'wallet', 'analytics', 'reviews', 'account'];
    if (requestedTab && allowedTabs.includes(requestedTab)) {
      setTab(requestedTab);
    }

    // Backwards-compatible deep links.
    if (requestedTab === 'trials') setTab('requests');
    if (requestedTab === 'evaluate') setTab('sessions');

    const requestedSessionId = searchParams.get('session');
    if (!requestedSessionId) return;
    const found = [...trials, ...pendingRegular, ...sessions, ...completedSessions]
      .find((item) => String(item._id) === String(requestedSessionId));
    if (found) setChatSession(found);
  }, [searchParams, trials, pendingRegular, sessions, completedSessions]);

  useEffect(() => {
    if (!ready) return;
    if (tab === 'analytics' && !analytics) {
      api.get('/api/teachers/dashboard/analytics', { auth: true }).then(setAnalytics).catch(() => {});
    }
    if (tab === 'reviews' && !reviewsData.reviews.length) {
      api.get('/api/teachers/dashboard/reviews', { auth: true }).then(setReviewsData).catch(() => {});
    }
    if (tab === 'schedule' && !schedule.length) {
      api.get('/api/teachers/dashboard/availability', { auth: true })
        .then((d) => setSchedule(mergeSchedule(d.availability)))
        .catch(() => setSchedule(mergeSchedule([])));
    }
  }, [tab, ready, analytics, reviewsData.reviews.length, schedule.length]);

  if (!ready) return null;

    const teacher = profile?.teacher;

  const respondTrial = async (id, action, extra = {}) => {
    try {
      let reason = extra.reason;
      if (action === 'reject' && reason == null) {
        reason = window.prompt('سبب الاعتذار عن الحصة (اختياري):', '') ?? '';
      }

      await api.put(`/api/sessions/${id}/respond`, {
        action,
        provider: action === 'accept' ? meetingProvider : undefined,
        reason,
        rescheduledDate: extra.rescheduledDate,
        rescheduleTimezone: extra.rescheduleTimezone,
      }, { auth: true });

      const labels = {
        accept: 'تم قبول الطلب وإشعار الطالب',
        reject: 'تم الاعتذار عن الطلب وإشعار الطالب',
        reschedule: 'تم اقتراح الموعد الجديد وإشعار الطالب',
      };
      toast.success(labels[action] || 'تم تحديث الطلب');
      setRescheduleModal(null);
      setRescheduleDate('');
      load();
    } catch (error) {
      toast.error(error.message || 'حدث خطأ');
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) {
      return toast.error('اختر الموعد الجديد');
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rescheduleDate)) {
      return toast.error('اختر موعدًا صحيحًا');
    }
    await respondTrial(rescheduleModal._id, 'reschedule', {
      rescheduledDate: rescheduleDate,
      rescheduleTimezone: sessionTimeZone(rescheduleModal, teacher?.availabilityTimezone || 'Africa/Cairo'),
    });
  };

  const openEval = (session) => {
    setEvalModal(session);
    setEvaluation(emptyEval);
    setHomeworkList([]);
  };

  const addHomework = () => {
    setHomeworkList((p) => [...p, { ...emptyHomework }]);
  };

  const completeSession = async () => {
    if (!evalModal) return;
    try {
      const completed = await api.put(`/api/sessions/${evalModal._id}/complete`, {
        evaluation: {
          attendance: evaluation.attendance,
          memorization: evaluation.memorization,
          tajweed: evaluation.tajweed,
          behavior: evaluation.behavior,
          commitment: evaluation.commitment,
          surahRecited: evaluation.surahRecited?.trim() || '',
          fromAyah: evaluation.fromAyah ? Number(evaluation.fromAyah) : undefined,
          toAyah: evaluation.toAyah ? Number(evaluation.toAyah) : undefined,
          nextHomework: evaluation.nextHomework?.trim() || homeworkList[0]?.description?.trim() || '',
          overallNotes: evaluation.overallNotes?.trim() || '',
          assignedHomework: homeworkList.filter((item) => item.description?.trim()),
        },
      }, { auth: true });

      try {
        await api.post(`/api/sessions/${evalModal._id}/report`, {
          studentId: evalModal.student?._id,
          memorizationScore: Math.min(10, Math.max(0, evaluation.memorization * 2)),
          tajweedScore: Math.min(10, Math.max(0, evaluation.tajweed * 2)),
          surahRecited: evaluation.surahRecited,
          fromAyah: evaluation.fromAyah || undefined,
          toAyah: evaluation.toAyah || undefined,
          nextHomework: evaluation.nextHomework || homeworkList[0]?.description || '',
          notes: evaluation.overallNotes,
        }, { auth: true });
      } catch {
        toast.info('تم إنهاء الحصة، لكن تعذر إرسال تقرير المتابعة الخارجي. التقرير محفوظ داخل الحصة.');
      }

      const earnedAmount = Number(completed?.session?.earnings?.amount || SESSION_RATE);
      toast.success(`تم إنهاء الحصة واعتماد الاستحقاق (+${earnedAmount} ج.م)`);
      setEvalModal(null);
      load();
    } catch (error) {
      toast.error(error.message || 'فشل إكمال الحصة');
    }
  };

  const updateGroupAttendance = async (session, studentId, status) => {
    if (!session?._id || !studentId) return;
    const key = session._id + ':' + studentId;
    setAttendanceUpdating(key);
    try {
      const result = await api.patch(`/api/sessions/${session._id}/attendance`, {
        records: [{ studentId, status }],
      }, { auth: true });

      setSessions((current) => current.map((item) => (
        item._id === session._id
          ? { ...item, attendance: result.attendance || item.attendance }
          : item
      )));
      toast.success(
        status === 'attended'
          ? 'تم تسجيل حضور الطالب'
          : status === 'excused'
            ? 'تم تسجيل اعتذار الطالب'
            : 'تم تسجيل غياب الطالب'
      );
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الحضور');
    } finally {
      setAttendanceUpdating('');
    }
  };

  const completeGroupSession = async (session) => {
    if (!session?._id) return;

    const unresolved = (session.attendance || []).filter(
      (entry) => ['pending', 'confirmed'].includes(entry.status)
    );
    if (unresolved.length) {
      toast.info('سجل الحضور النهائي لكل الطلاب من قائمة الحضور داخل الحصة قبل الإنهاء');
      return;
    }

    const confirmed = window.confirm(
      `تأكيد إنهاء ${session.circle?.name || 'الحصة الجماعية'}؟ سيتم احتساب حصة واحدة لكل طالب مستحق حسب الحضور والاعتذارات.`
    );
    if (!confirmed) return;

    try {
      const result = await api.put(`/api/sessions/${session._id}/complete`, {
        evaluation: {
          overallNotes: 'تم إغلاق الحصة الجماعية من لوحة المعلم',
        },
      }, { auth: true });

      const earnedAmount = Number(result?.session?.earnings?.amount || 0);
      toast.success(
        `تم إنهاء الحصة الجماعية واحتساب أرصدة الطلاب (+${earnedAmount} ج.م للمعلم)`
      );
      load();
    } catch (error) {
      toast.error(error.message || 'فشل إكمال الحصة الجماعية');
    }
  };

  const assignTask = async () => {
    if (!newTask.studentId || !newTask.title) return toast.error('اختر الطالب واكتب عنوان الواجب');
    try {
      await api.post('/api/teachers/dashboard/tasks', newTask, { auth: true });
      toast.success('تم إسناد الواجب');
      setTaskModal(false);
      setNewTask({ studentId: '', type: 'memorization', title: '', description: '', dueDate: '' });
      load();
    } catch { toast.error('فشل إسناد الواجب'); }
  };

  const requestWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawing(true);
    try {
      const payoutDetails = {};
      if (withdrawForm.payoutMethod === 'vodafone_cash') payoutDetails.phone = withdrawForm.phone;
      if (withdrawForm.payoutMethod === 'instapay') {
        payoutDetails.ipaAddress = withdrawForm.ipaAddress;
        payoutDetails.phone = withdrawForm.phone;
      }
      if (withdrawForm.payoutMethod === 'bank_transfer') {
        payoutDetails.bankName = withdrawForm.bankName;
        payoutDetails.bankAccountNumber = withdrawForm.bankAccountNumber;
      }
      if (withdrawForm.payoutMethod === 'paypal') payoutDetails.paypalEmail = withdrawForm.paypalEmail;

      await api.post('/api/finance/teacher/request-payout', {
        amount: Number(withdrawForm.amount),
        currency: withdrawForm.currency,
        payoutMethod: withdrawForm.payoutMethod,
        payoutDetails,
      }, { auth: true });

      toast.success('تم إرسال طلب السحب للإدارة');
      setWithdrawForm({
        amount: '',
        currency: 'EGP',
        payoutMethod: 'vodafone_cash',
        phone: '',
        ipaAddress: '',
        bankName: '',
        bankAccountNumber: '',
        paypalEmail: '',
      });
      load();
    } catch (err) {
      toast.error(err.message || 'فشل طلب السحب');
    } finally {
      setWithdrawing(false);
    }
  };

  const reviewTask = async (task, action) => {
    try {
      await api.patch(`/api/teachers/dashboard/tasks/${task._id}`, {
        action,
        teacherFeedback: taskReview[task._id] || '',
      }, { auth: true });
      toast.success(action === 'approve' ? 'تم اعتماد الواجب وإشعار الطالب' : 'تم طلب إعادة الواجب وإشعار الطالب');
      setTaskReview((current) => ({ ...current, [task._id]: '' }));
      if (homeworkAudio.url) URL.revokeObjectURL(homeworkAudio.url);
      setHomeworkAudio({ taskId: '', url: '', loading: false });
      load();
    } catch (error) {
      toast.error(error.message || 'تعذر مراجعة الواجب');
    }
  };

  const playHomeworkSubmission = async (task) => {
    if (!task.submissionFile) return toast.error('لا يوجد ملف تسليم لهذا الواجب');

    if (homeworkAudio.taskId === task._id && homeworkAudio.url) return;

    if (homeworkAudio.url) URL.revokeObjectURL(homeworkAudio.url);
    setHomeworkAudio({ taskId: task._id, url: '', loading: true });

    try {
      const response = await api.request(`/api/homework/tasks/${task._id}/file`, {
        auth: true,
        json: false,
        method: 'GET',
      });
      const blob = await response.blob();
      setHomeworkAudio({
        taskId: task._id,
        url: URL.createObjectURL(blob),
        loading: false,
      });
    } catch (error) {
      setHomeworkAudio({ taskId: '', url: '', loading: false });
      toast.error(error.message || 'تعذر تشغيل تسجيل الطالب');
    }
  };

  const openStudent = async (student) => {
    setStudentModal(student);
    setStudentSummary(null);
    setStudentSummaryLoading(true);
    try {
      const result = await api.get(`/api/teachers/dashboard/students/${student._id}/summary`, { auth: true });
      setStudentSummary(result);
    } catch (error) {
      toast.error(error.message || 'تعذر تحميل ملف الطالب');
    } finally {
      setStudentSummaryLoading(false);
    }
  };

  const enterAcademyRoom = async (session) => {
    try {
      const isGroupCircle = session.type === 'group_circle';
      const room = await api.post('/api/live/sessions', {
        title: isGroupCircle
          ? (session.circle?.name || 'حلقة جماعية')
          : `حلقة ${session.student?.name || 'الطالب'}`,
        description: isGroupCircle ? 'حلقة جماعية عبر غرفة الأكاديمية' : 'حلقة فردية عبر غرفة الأكاديمية',
        subject: 'quran',
        sessionId: session._id,
      }, { auth: true });
      navigate(lp(`/live/${room.roomId}`));
    } catch (error) {
      toast.error(error.message || 'تعذر فتح غرفة الأكاديمية');
    }
  };

  const toggleUpdateStudent = (studentId) => {
    setUpdateForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  };

  const publishTeacherUpdate = async (event) => {
    event.preventDefault();

    if (!updateForm.title.trim()) return toast.error('اكتب عنوان الرسالة');
    if (!updateForm.files.length) return toast.error('اختر فيديو واحدًا على الأقل');
    if (updateForm.files.length > 5) return toast.error('الحد الأقصى 5 فيديوهات في الرسالة الواحدة');
    if (updateForm.audienceMode === 'selected' && !updateForm.studentIds.length) {
      return toast.error('اختر طالبًا واحدًا على الأقل');
    }

    setPublishingUpdate(true);
    try {
      const files = await uploadTeacherFiles([{
        key: 'videos',
        label: 'فيديوهات الرسالة',
        purpose: 'teacher-update-video',
        multiple: true,
        files: updateForm.files,
      }], {
        upload: uploadFileDirect,
        cache: updateUploadCache.current,
        onProgress: setUpdateUploadProgress,
      });
      const uploaded = files.videos.map((result) => ({
        reference: result.url,
        name: result.name,
        size: result.size,
        contentType: result.contentType,
      }));

      await api.post('/api/teacher-updates/teacher', {
        title: updateForm.title.trim(),
        message: updateForm.message.trim(),
        audienceMode: updateForm.audienceMode,
        studentIds: updateForm.studentIds,
        videos: uploaded,
      }, { auth: true });

      updateUploadCache.current.clear();
      toast.success('تم نشر الرسالة وإشعار الطلاب');
      setUpdateForm({
        title: '',
        message: '',
        audienceMode: 'all-active',
        studentIds: [],
        files: [],
      });
      const result = await api.get('/api/teacher-updates/teacher', { auth: true });
      setTeacherUpdates(result.updates || []);
    } catch (error) {
      toast.error(error.message || 'تعذر نشر الرسالة');
    } finally {
      setPublishingUpdate(false);
      setUpdateUploadProgress(null);
    }
  };

  const deleteTeacherUpdate = async (updateId) => {
    if (!window.confirm('حذف هذه الرسالة وفيديوهاتها؟')) return;
    try {
      await api.delete(`/api/teacher-updates/teacher/${updateId}`, { auth: true });
      setTeacherUpdates((current) => current.filter((item) => item._id !== updateId));
      toast.success('تم حذف الرسالة');
    } catch (error) {
      toast.error(error.message || 'تعذر حذف الرسالة');
    }
  };

  const loadTeacherUpdateVideo = async (updateId, index) => {
    const key = `${updateId}-${index}`;
    if (updateVideoUrls[key]) return;

    try {
      const result = await api.post(`/api/teacher-updates/${updateId}/videos/${index}/access`, {}, { auth: true });
      setUpdateVideoUrls((current) => ({
        ...current,
        [key]: apiUrl(result.streamUrl),
      }));
    } catch (error) {
      toast.error(error.message || 'تعذر فتح الفيديو');
    }
  };

  const generateAiHomework = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/api/ai/homework-generate', { topic: aiTopic, level: 'intermediate', count: 5, locale: 'ar' }, { auth: true });
      setAiResult(res);
      toast.success('تم توليد الواجبات');
    } catch (e) { toast.error(e.message || 'فشل'); }
    finally { setAiLoading(false); }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const availability = schedule
        .map((day) => ({
          day: day.day,
          slots: (day.slots || []).filter((slot) => slot.startTime && slot.endTime),
        }))
        .filter((day) => day.slots.length);

      await api.put('/api/teachers/dashboard/availability', {
        availability,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }, { auth: true });
      toast.success('تم حفظ أوقات التوفر');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ الجدول');
    } finally {
      setSavingSchedule(false);
    }
  };

  const addScheduleSlot = (dayIndex) => {
    setSchedule((current) => current.map((day, index) => (
      index === dayIndex
        ? { ...day, slots: [...(day.slots || []), { startTime: '', endTime: '' }] }
        : day
    )));
  };

  const updateScheduleSlot = (dayIndex, slotIndex, key, value) => {
    setSchedule((current) => current.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        slots: day.slots.map((slot, currentSlotIndex) => (
          currentSlotIndex === slotIndex ? { ...slot, [key]: value } : slot
        )),
      };
    }));
  };

  const removeScheduleSlot = (dayIndex, slotIndex) => {
    setSchedule((current) => current.map((day, index) => (
      index === dayIndex
        ? { ...day, slots: day.slots.filter((_, currentSlotIndex) => currentSlotIndex !== slotIndex) }
        : day
    )));
  };

  const primaryNavItems = [
    { id: 'overview', label: 'الرئيسية', icon: Sparkles },
    { id: 'requests', label: 'الطلبات', icon: ClipboardList, badge: trials.length + pendingRegular.length },
    { id: 'sessions', label: 'حصصي', icon: Calendar, badge: sessions.length },
    { id: 'students', label: 'طلابي', icon: Users, badge: activeStudents.length },
    { id: 'homework', label: 'الواجبات', icon: BookOpen, badge: tasks.filter((task) => task.status === 'submitted').length },
  ];

  const secondaryNavItems = [
    { id: 'updates', label: 'رسائل لطلابي', icon: Megaphone, description: 'فيديوهات ورسائل تعليمية لطلابك' },
    { id: 'schedule', label: 'الجدول', icon: CalendarDays, description: 'أوقات التوفر الأسبوعية' },
    { id: 'wallet', label: 'المحفظة', icon: Wallet, description: 'الرصيد والسحب والمعاملات' },
    { id: 'analytics', label: 'الأداء', icon: BarChart3, description: 'الحصص والتحويل والواجبات' },
    { id: 'reviews', label: 'التقييمات', icon: Star, description: 'آراء الطلاب ومتوسط التقييم' },
    { id: 'account', label: 'ملفي العام', icon: UserRound, description: 'صورتي وبياناتي وطلب تعديل الملف' },
  ];

  const now = new Date();
  const upcomingSessions = sessions
    .filter((session) => new Date(session.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const nextSession = upcomingSessions[0] || null;
  const submittedTasks = tasks.filter((task) => task.status === 'submitted');
  const awaitingCompletion = sessions.filter((session) => new Date(session.scheduledAt) <= now);
  const actionCount = trials.length + pendingRegular.length + submittedTasks.length + awaitingCompletion.length;
  const egpBalance = finance?.balances?.EGP || { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 };

  return (
    <DashboardLayout title="لوحة تحكم المعلم" user={user} onLogout={logout}>
      {loading ? <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div> : (
        <>

          <section className="wn-teacher-welcome">
            <div className="wn-teacher-welcome__main">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-emerald-200 bg-emerald-50 grid place-items-center shrink-0">
                  {teacher?.media?.profilePhoto ? (
                    <img
                      src={teacherPublicImage(teacher.media.profilePhoto)}
                      alt={teacher?.personalInfo?.fullName || user?.name || 'المعلم'}
                      onError={teacherImageFallback}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-emerald-900">{(teacher?.personalInfo?.fullName || user?.name || 'م').slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <span className="wn-teacher-welcome__eyebrow">
                    <Sparkles size={15} />
                    مساحة المعلم اليومية
                  </span>
                  <h2>السلام عليكم، {teacher?.personalInfo?.fullName || user?.name || 'معلمنا'}</h2>
                </div>
              </div>
              <p>
                {nextSession
                  ? `حلقتك القادمة مع ${nextSession.student?.name || 'الطالب'} — كل ما تحتاجه للتحضير والمتابعة أمامك.`
                  : actionCount
                    ? 'لديك مهام تحتاج قرارك. ابدأ بمركز الإجراءات ثم راجع جدولك.'
                    : 'يومك هادئ الآن. راجع جدولك أو تابع تقدم طلابك.'}
              </p>

              <div className="wn-teacher-welcome__chips">
                <span className="is-verified"><CheckCircle2 size={14} /> معلم معتمد</span>
                <span><Users size={14} /> {activeStudents.length} طالب نشط</span>
                <span><Star size={14} /> {stats.averageRating?.toFixed?.(1) || '0'} تقييم</span>
              </div>

              <div className="wn-teacher-welcome__actions">
                {nextSession ? (
                  <button type="button" onClick={() => enterAcademyRoom(nextSession)} className="wn-teacher-primary-action">
                    <Video size={17} />
                    دخول الحصة القادمة
                  </button>
                ) : (
                  <button type="button" onClick={() => setTab('schedule')} className="wn-teacher-primary-action">
                    <CalendarDays size={17} />
                    مراجعة الجدول
                  </button>
                )}
                <button type="button" onClick={() => setTab('requests')} className="wn-teacher-secondary-action">
                  <ClipboardList size={17} />
                  مركز الطلبات
                  {(trials.length + pendingRegular.length) > 0 ? <b>{trials.length + pendingRegular.length}</b> : null}
                </button>
                <button type="button" onClick={() => setTab('updates')} className="wn-teacher-secondary-action">
                  <Megaphone size={17} />
                  رسالة لطلابي
                </button>
                <button type="button" onClick={() => setTab('account')} className="wn-teacher-secondary-action">
                  <UserRound size={17} />
                  ملفي العام
                  {profileChange?.status === 'pending' ? <b>مراجعة</b> : null}
                </button>
              </div>
            </div>

            <div className="wn-teacher-welcome__next">
              <div className="wn-teacher-welcome__next-heading">
                <span>{nextSession ? 'الحصة القادمة' : 'الحالة الحالية'}</span>
                {nextSession ? <Clock size={16} /> : <Sparkles size={16} />}
              </div>
              {nextSession ? (
                <>
                  <strong>{nextSession.student?.name || 'الطالب'}</strong>
                  <p>{formatSessionDateTime(nextSession, 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <p>{formatSessionDateTime(nextSession, 'ar-EG', { hour: '2-digit', minute: '2-digit' })} · {sessionTimeZone(nextSession, teacher?.availabilityTimezone || 'Africa/Cairo')}</p>
                  <div className="wn-teacher-welcome__next-actions">
                    <button type="button" onClick={() => setChatSession(nextSession)}>
                      <MessageSquare size={15} /> محادثة
                    </button>
                    <button type="button" onClick={() => openStudent(nextSession.student)}>
                      <UserRound size={15} /> ملف الطالب
                    </button>
                  </div>
                </>
              ) : (
                <div className="wn-teacher-welcome__empty">
                  <Calendar size={26} />
                  <strong>لا توجد حصة قادمة</strong>
                  <p>ستظهر أقرب حصة مؤكدة هنا تلقائيًا.</p>
                </div>
              )}
            </div>
          </section>

          <div className="wn-dashboard-surface wn-teacher-surface">
            <TeacherCommandBar
              primaryItems={primaryNavItems}
              secondaryItems={secondaryNavItems}
              active={tab}
              onChange={setTab}
              actionCount={actionCount}
            />

            {tab === 'overview' && (
              <div className="wn-teacher-overview">
                <div className="wn-teacher-overview__grid">
                  <section className="wn-teacher-today-card">
                    <div className="wn-teacher-section-heading">
                      <div>
                        <span>جدول اليوم</span>
                        <h3>الحصص القادمة</h3>
                      </div>
                      <button type="button" onClick={() => setTab('sessions')}>عرض كل الحصص</button>
                    </div>

                    {upcomingSessions.length === 0 ? (
                      <div className="wn-teacher-empty-state">
                        <Calendar size={28} />
                        <div>
                          <strong>لا توجد حصص قادمة حاليًا</strong>
                          <p>راجع التوفر الأسبوعي أو الطلبات الجديدة.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="wn-teacher-agenda">
                        {upcomingSessions.slice(0, 3).map((session, index) => (
                          <div key={session._id} className={'wn-teacher-agenda__item ' + (index === 0 ? 'is-next' : '')}>
                            <div className="wn-teacher-agenda__time">
                              <strong>{formatSessionDateTime(session, 'ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong>
                              <small>{formatSessionDateTime(session, 'ar-EG', { day: 'numeric', month: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                            </div>
                            <div className="wn-teacher-agenda__student">
                              <strong>{session.type === 'group_circle' ? (session.circle?.name || 'حلقة جماعية') : (session.student?.name || 'طالب')}</strong>
                              <span>{session.type === 'trial' ? 'حصة تجريبية' : session.type === 'group_circle' ? 'حصة جماعية' : 'حصة فردية'}</span>
                            </div>
                            <div className="wn-teacher-agenda__actions">
                              <button type="button" onClick={() => setChatSession(session)} aria-label="محادثة"><MessageSquare size={16} /></button>
                              <button type="button" onClick={() => enterAcademyRoom(session)} className="is-primary">
                                <Video size={16} /> دخول
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <aside className="wn-teacher-action-center">
                    <div className="wn-teacher-section-heading">
                      <div>
                        <span>يحتاج إجراء</span>
                        <h3>مركز الإجراءات</h3>
                      </div>
                      {actionCount > 0 ? <b>{actionCount}</b> : null}
                    </div>

                    <div className="wn-teacher-action-list">
                      <button type="button" onClick={() => setTab('requests')}>
                        <span className="wn-teacher-action-icon is-amber"><ClipboardList size={18} /></span>
                        <span><strong>طلبات جديدة</strong><small>تجريبية ومنتظمة تحتاج ردك</small></span>
                        <b>{trials.length + pendingRegular.length}</b>
                      </button>
                      <button type="button" onClick={() => setTab('homework')}>
                        <span className="wn-teacher-action-icon is-blue"><Headphones size={18} /></span>
                        <span><strong>واجبات للتصحيح</strong><small>تسجيلات الطلاب المُسلّمة</small></span>
                        <b>{submittedTasks.length}</b>
                      </button>
                      <button type="button" onClick={() => setTab('sessions')}>
                        <span className="wn-teacher-action-icon is-emerald"><CheckCircle2 size={18} /></span>
                        <span><strong>حصص تحتاج إغلاق</strong><small>انتهى موعدها ولم تُعتمد بعد</small></span>
                        <b>{awaitingCompletion.length}</b>
                      </button>
                    </div>
                  </aside>
                </div>

                <div className="wn-teacher-stat-grid">
                  <StatCard label="الرصيد المتاح" value={`${egpBalance.available || 0} ج.م`} icon={Wallet} />
                  <StatCard label="حصص مكتملة" value={stats.totalSessions || 0} icon={Calendar} />
                  <StatCard label="طلاب نشطون" value={activeStudents.length} icon={Users} />
                  <StatCard label="متوسط التقييم" value={stats.averageRating?.toFixed?.(1) || '0'} icon={Star} />
                </div>

                <div className="wn-teacher-overview__lower">
                  <section className="wn-teacher-students-preview">
                    <div className="wn-teacher-section-heading">
                      <div>
                        <span>طلابك</span>
                        <h3>متابعة سريعة</h3>
                      </div>
                      <button type="button" onClick={() => setTab('students')}>كل الطلاب</button>
                    </div>
                    {activeStudents.length === 0 ? (
                      <div className="wn-teacher-empty-state compact">
                        <Users size={24} />
                        <div><strong>لا يوجد طلاب نشطون بعد</strong><p>سيظهر الطلاب بعد قبول أول حصة منتظمة.</p></div>
                      </div>
                    ) : (
                      <div className="wn-teacher-student-preview-list">
                        {activeStudents.slice(0, 4).map((student) => (
                          <button type="button" key={student._id} onClick={() => openStudent(student)}>
                            <span className="wn-teacher-avatar">{(student.name || 'ط').slice(0, 1)}</span>
                            <span>
                              <strong>{student.name}</strong>
                              <small>
                                {student.nextSession
                                  ? `القادمة ${new Date(student.nextSession.scheduledAt).toLocaleDateString('ar-EG')}`
                                  : 'لا موعد قادم'}
                              </small>
                            </span>
                            <ChevronLeft size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="wn-teacher-performance-preview">
                    <span>هذا الشهر</span>
                    <h3>لوحة الأداء</h3>
                    <div className="wn-teacher-performance-preview__metrics">
                      <div><strong>{analytics?.trialConversion?.rate ?? '—'}%</strong><small>تحويل التجريبية</small></div>
                      <div><strong>{analytics?.homework?.completionRate ?? '—'}%</strong><small>إكمال الواجبات</small></div>
                      <div><strong>{analytics?.upcomingSevenDays ?? upcomingSessions.length}</strong><small>الأسبوع القادم</small></div>
                    </div>
                    <button type="button" onClick={() => setTab('analytics')}>
                      عرض تحليلات الأداء <TrendingUp size={15} />
                    </button>
                  </section>
                </div>
              </div>
            )}

            {tab === 'account' && teacher && (
              <div className="wn-teacher-profile-view">
                <section className="wn-teacher-profile-card">
                  <div className="wn-teacher-profile-card__top">
                    <div className="wn-teacher-profile-card__avatar">
                      {teacher.media?.profilePhoto ? (
                        <img
                          src={teacherPublicImage(teacher.media.profilePhoto)}
                          alt={teacher.personalInfo?.fullName || user?.name || 'المعلم'}
                          onError={teacherImageFallback}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (teacher.personalInfo?.fullName || user?.name || 'م').slice(0, 1)}
                    </div>
                    <div>
                      <span className="wn-teacher-profile-card__status"><CheckCircle2 size={14} /> {statusLabel(teacher.status)}</span>
                      <h3>{teacher.personalInfo?.fullName || user?.name}</h3>
                      <p>{teacher.academicInfo?.qualification || teacher.academicInfo?.specialization || 'معلم قرآن كريم'}</p>
                    </div>
                    <button type="button" onClick={() => setAiModal(true)} className="wn-teacher-ai-button">
                      <Sparkles size={16} /> مساعد المعلم
                    </button>
                  </div>

                  <div className="wn-teacher-profile-grid">
                    <InfoRow label="البريد" value={user?.email} />
                    <InfoRow label="الهاتف" value={teacher.personalInfo?.phone} />
                    <InfoRow label="البلد" value={teacher.personalInfo?.country} />
                    <InfoRow label="المدينة" value={teacher.personalInfo?.city} />
                    <InfoRow label="الجامعة" value={teacher.academicInfo?.university} />
                    <InfoRow label="التخصص" value={teacher.academicInfo?.specialization} />
                    <InfoRow label="سنوات الخبرة" value={teacher.quranInfo?.teachingExperience} />
                    <InfoRow label="الإجازات" value={teacher.quranInfo?.numberOfIjazat} />
                  </div>

                  <div className="wn-teacher-profile-note">
                    <AlertTriangle size={17} />
                    <div>
                      <strong>بيانات الملف العام</strong>
                      <p>أي تعديل ترسله هنا لا يظهر للطلاب إلا بعد مراجعة الإدارة واعتماده.</p>
                    </div>
                  </div>

                  {profileChange && (
                    <div className={`mt-5 rounded-xl border p-4 text-sm ${profileChange.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-900' : profileChange.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                      <strong className="block">
                        {profileChange.status === 'pending' ? 'طلب التعديل قيد مراجعة الإدارة' : profileChange.status === 'approved' ? 'آخر تعديل تم اعتماده' : 'آخر تعديل لم يتم اعتماده'}
                      </strong>
                      {profileChange.adminNote ? <p className="mt-1">ملاحظة الإدارة: {profileChange.adminNote}</p> : null}
                      {profileChange.createdAt ? <small className="block mt-1 opacity-80">{new Date(profileChange.createdAt).toLocaleString('ar-EG')}</small> : null}
                    </div>
                  )}

                  <form onSubmit={submitProfileChange} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <h4 className="font-bold text-emerald-950">تعديل الملف العام</h4>
                      <p className="text-xs text-slate-500 mt-1">حدّث بياناتك أو وسائطك، ثم أرسلها للمراجعة. البيانات الحالية تظل منشورة حتى اعتماد التغيير.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        ['fullName', 'الاسم العام'],
                        ['city', 'المدينة'],
                        ['university', 'الجامعة / جهة الدراسة'],
                        ['faculty', 'الكلية'],
                        ['qualification', 'المؤهل'],
                      ].map(([key, label]) => (
                        <label key={key} className="text-sm font-semibold">
                          {label}
                          <input
                            className="input-field w-full mt-1"
                            value={profileEdit[key]}
                            disabled={profileChange?.status === 'pending'}
                            onChange={(event) => setProfileEdit((current) => ({ ...current, [key]: event.target.value }))}
                          />
                        </label>
                      ))}
                      <label className="text-sm font-semibold">سنوات الخبرة
                        <input type="number" min="0" max="80" className="input-field w-full mt-1" value={profileEdit.teachingExperience}
                          disabled={profileChange?.status === 'pending'}
                          onChange={(event) => setProfileEdit((current) => ({ ...current, teachingExperience: event.target.value }))} />
                      </label>
                      <label className="text-sm font-semibold">عدد الإجازات
                        <input type="number" min="0" max="100" className="input-field w-full mt-1" value={profileEdit.numberOfIjazat}
                          disabled={profileChange?.status === 'pending'}
                          onChange={(event) => setProfileEdit((current) => ({ ...current, numberOfIjazat: event.target.value }))} />
                      </label>
                    </div>

                    <label className="block text-sm font-semibold mt-3">نبذة تظهر للطلاب
                      <textarea rows={4} maxLength={1200} className="input-field w-full mt-1" value={profileEdit.bio}
                        disabled={profileChange?.status === 'pending'}
                        onChange={(event) => setProfileEdit((current) => ({ ...current, bio: event.target.value }))} />
                    </label>

                    <div className="mt-5 grid sm:grid-cols-2 gap-3">
                      {[
                        ['profilePhoto', 'صورة شخصية جديدة', 'image/jpeg,image/png'],
                        ['introductionVideo', 'فيديو تعريفي جديد', 'video/mp4,video/webm,video/quicktime'],
                        ['recitationVideo', 'فيديو تلاوة جديد', 'video/mp4,video/webm,video/quicktime'],
                        ['teachingMethodVideo', 'فيديو طريقة تدريس جديد', 'video/mp4,video/webm,video/quicktime'],
                      ].map(([key, label, accept]) => (
                        <label key={key} className="rounded-xl border border-dashed border-slate-300 p-3 text-sm">
                          <strong className="block mb-2">{label}</strong>
                          <input type="file" accept={accept} disabled={profileChange?.status === 'pending'}
                            onChange={(event) => setProfileFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))} />
                          {profileFiles[key] ? <small className="block mt-1 text-emerald-700">{profileFiles[key].name}</small> : null}
                        </label>
                      ))}
                    </div>

                    {savingProfileChange && profileUploadProgress && (
                      <TeacherUploadProgress value={profileUploadProgress} />
                    )}
                    <button type="submit" disabled={savingProfileChange || profileChange?.status === 'pending'}
                      className="wn-btn wn-btn--primary mt-5 disabled:opacity-50">
                      <Send size={16} />
                      {savingProfileChange ? 'جاري الإرسال...' : profileChange?.status === 'pending' ? 'قيد المراجعة' : 'إرسال التعديلات للمراجعة'}
                    </button>
                  </form>
                </section>
              </div>
            )}

            {tab === 'wallet' && (
              <div className="wn-teacher-wallet">
                <div className="wn-teacher-wallet__hero">
                  <div>
                    <span>الرصيد المتاح للسحب</span>
                    <h3>{egpBalance.available || 0} <small>ج.م</small></h3>
                    <p>النظام المالي الجديد يعتمد سجل معاملات واحد لكل استحقاق وسحب.</p>
                  </div>
                  <Wallet size={34} />
                </div>

                <div className="wn-teacher-wallet__stats">
                  <div><span>إجمالي المستحقات</span><strong>{egpBalance.totalEarned || 0} ج.م</strong></div>
                  <div><span>طلبات سحب معلقة</span><strong>{egpBalance.pending || 0} ج.م</strong></div>
                  <div><span>تم سحبه</span><strong>{egpBalance.withdrawn || 0} ج.م</strong></div>
                </div>

                <div className="wn-teacher-wallet__grid">
                  <form onSubmit={requestWithdraw} className="wn-teacher-wallet__payout">
                    <div className="wn-teacher-section-heading">
                      <div><span>طلب جديد</span><h3>سحب الأرباح</h3></div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label>المبلغ</label>
                        <input
                          type="number"
                          required
                          min={finance?.limits?.minPayoutEGP || 100}
                          value={withdrawForm.amount}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, amount: event.target.value }))}
                          className="input-field w-full"
                          placeholder={`الحد الأدنى ${finance?.limits?.minPayoutEGP || 100} ج.م`}
                        />
                      </div>
                      <div>
                        <label>وسيلة السحب</label>
                        <select
                          value={withdrawForm.payoutMethod}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, payoutMethod: event.target.value }))}
                          className="input-field w-full"
                        >
                          <option value="vodafone_cash">محفظة إلكترونية</option>
                          <option value="instapay">InstaPay</option>
                          <option value="bank_transfer">تحويل بنكي</option>
                          <option value="paypal">PayPal</option>
                        </select>
                      </div>
                    </div>

                    {withdrawForm.payoutMethod === 'vodafone_cash' && (
                      <input
                        required
                        className="input-field w-full"
                        placeholder="رقم المحفظة — 01xxxxxxxxx"
                        value={withdrawForm.phone}
                        onChange={(event) => setWithdrawForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    )}
                    {withdrawForm.payoutMethod === 'instapay' && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          className="input-field w-full"
                          placeholder="InstaPay IPA"
                          value={withdrawForm.ipaAddress}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, ipaAddress: event.target.value }))}
                        />
                        <input
                          className="input-field w-full"
                          placeholder="أو رقم الهاتف"
                          value={withdrawForm.phone}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, phone: event.target.value }))}
                        />
                      </div>
                    )}
                    {withdrawForm.payoutMethod === 'bank_transfer' && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          required
                          className="input-field w-full"
                          placeholder="اسم البنك"
                          value={withdrawForm.bankName}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, bankName: event.target.value }))}
                        />
                        <input
                          required
                          className="input-field w-full"
                          placeholder="رقم الحساب / IBAN"
                          value={withdrawForm.bankAccountNumber}
                          onChange={(event) => setWithdrawForm((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                        />
                      </div>
                    )}
                    {withdrawForm.payoutMethod === 'paypal' && (
                      <input
                        required
                        type="email"
                        className="input-field w-full"
                        placeholder="بريد PayPal"
                        value={withdrawForm.paypalEmail}
                        onChange={(event) => setWithdrawForm((current) => ({ ...current, paypalEmail: event.target.value }))}
                      />
                    )}

                    <button type="submit" disabled={withdrawing} className="wn-teacher-primary-action">
                      {withdrawing ? 'جاري الإرسال...' : 'إرسال طلب السحب'}
                    </button>
                  </form>

                  <section className="wn-teacher-wallet__transactions">
                    <div className="wn-teacher-section-heading">
                      <div><span>السجل المالي</span><h3>آخر المعاملات</h3></div>
                    </div>
                    {transactions.length === 0 ? (
                      <div className="wn-teacher-empty-state compact">
                        <Wallet size={24} />
                        <div><strong>لا معاملات بعد</strong><p>ستظهر استحقاقات الحصص وطلبات السحب هنا.</p></div>
                      </div>
                    ) : (
                      <div className="wn-teacher-transaction-list">
                        {transactions.slice(0, 12).map((transaction) => (
                          <div key={transaction._id}>
                            <span className={'wn-teacher-transaction-icon ' + (transaction.type === 'payout' ? 'is-out' : 'is-in')}>
                              {transaction.type === 'payout' ? '−' : '+'}
                            </span>
                            <span>
                              <strong>
                                {transaction.type === 'session_earning'
                                  ? 'مستحق حصة'
                                  : transaction.type === 'payout'
                                    ? 'طلب سحب'
                                    : transaction.type === 'adjustment'
                                      ? 'رصيد مرحّل'
                                      : 'معاملة'}
                              </strong>
                              <small>{new Date(transaction.createdAt).toLocaleString('ar-EG')}</small>
                            </span>
                            <span className="wn-teacher-transaction-amount">
                              <strong>{transaction.type === 'payout' ? '−' : '+'}{transaction.amount} {transaction.currency}</strong>
                              <small>{financeStatusLabel(transaction.status)}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {tab === 'schedule' && (
              <div className="wn-teacher-schedule">
                <div className="wn-teacher-schedule__intro">
                  <div>
                    <span>إدارة التوفر</span>
                    <h3>جدولك الأسبوعي</h3>
                    <p>يمكنك إضافة أكثر من فترة في اليوم نفسه. يمنع النظام الفترات المتداخلة تلقائيًا.</p>
                  </div>
                  <button type="button" onClick={saveSchedule} disabled={savingSchedule} className="wn-teacher-primary-action">
                    {savingSchedule ? 'جاري الحفظ...' : 'حفظ التوفر'}
                  </button>
                </div>

                <div className="wn-teacher-schedule__days">
                  {schedule.map((day, dayIndex) => (
                    <section key={day.day} className="wn-teacher-schedule-day">
                      <div className="wn-teacher-schedule-day__heading">
                        <div>
                          <strong>{day.label}</strong>
                          <small>{day.slots.length ? `${day.slots.length} فترة متاحة` : 'غير متاح'}</small>
                        </div>
                        <button type="button" onClick={() => addScheduleSlot(dayIndex)}>
                          <Plus size={15} /> إضافة فترة
                        </button>
                      </div>

                      {day.slots.length === 0 ? (
                        <div className="wn-teacher-schedule-day__off">لا توجد أوقات متاحة في هذا اليوم</div>
                      ) : (
                        <div className="wn-teacher-schedule-day__slots">
                          {day.slots.map((slot, slotIndex) => (
                            <div key={`${day.day}-${slotIndex}`}>
                              <Clock size={16} />
                              <input
                                type="time"
                                className="input-field"
                                value={slot.startTime}
                                onChange={(event) => updateScheduleSlot(dayIndex, slotIndex, 'startTime', event.target.value)}
                              />
                              <span>إلى</span>
                              <input
                                type="time"
                                className="input-field"
                                value={slot.endTime}
                                onChange={(event) => updateScheduleSlot(dayIndex, slotIndex, 'endTime', event.target.value)}
                              />
                              <button type="button" onClick={() => removeScheduleSlot(dayIndex, slotIndex)} aria-label="حذف الفترة">
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </div>
            )}

            {tab === 'analytics' && (
              <div className="wn-teacher-analytics">
                {!analytics ? (
                  <div className="wn-teacher-empty-state">
                    <BarChart3 size={28} />
                    <div><strong>جاري إعداد لوحة الأداء</strong><p>يتم تجميع بيانات الحصص والواجبات والتحويل.</p></div>
                  </div>
                ) : (
                  <>
                    <div className="wn-teacher-analytics__hero">
                      <div>
                        <span>مؤشر الأداء التعليمي</span>
                        <h3>أداءك مع الطلاب في مكان واحد</h3>
                        <p>هذه المؤشرات تساعدك على تحسين الاستمرار بعد التجريبية ومتابعة الالتزام بالواجبات.</p>
                      </div>
                      <TrendingUp size={32} />
                    </div>

                    <div className="wn-teacher-analytics__kpis">
                      <div>
                        <span>تحويل التجريبية</span>
                        <strong>{analytics.trialConversion?.rate || 0}%</strong>
                        <small>{analytics.trialConversion?.converted || 0} من {analytics.trialConversion?.completedTrials || 0} استمروا</small>
                      </div>
                      <div>
                        <span>إكمال الواجبات</span>
                        <strong>{analytics.homework?.completionRate || 0}%</strong>
                        <small>{analytics.homework?.completed || 0} واجب معتمد</small>
                      </div>
                      <div>
                        <span>متوسط التقييم</span>
                        <strong>{Number(analytics.averageRating || 0).toFixed(1)}</strong>
                        <small>من 5 نجوم</small>
                      </div>
                      <div>
                        <span>الأسبوع القادم</span>
                        <strong>{analytics.upcomingSevenDays || 0}</strong>
                        <small>حصة مؤكدة</small>
                      </div>
                    </div>

                    <div className="wn-teacher-analytics__grid">
                      <section>
                        <div className="wn-teacher-section-heading">
                          <div><span>الحصص</span><h3>آخر 6 أشهر</h3></div>
                          <strong>{analytics.totalCompleted || 0}</strong>
                        </div>
                        <div className="wn-teacher-monthly-bars">
                          {(analytics.monthlySessions || []).length === 0 ? (
                            <div className="wn-teacher-empty-state compact">
                              <Calendar size={22} />
                              <div><strong>لا بيانات كافية بعد</strong><p>تظهر الاتجاهات بعد إكمال الحصص.</p></div>
                            </div>
                          ) : (analytics.monthlySessions || []).map((month) => {
                            const maxCount = Math.max(...analytics.monthlySessions.map((item) => item.count), 1);
                            return (
                              <div key={month.month}>
                                <span>{month.month}</span>
                                <div><i style={{ width: `${Math.max(8, (month.count / maxCount) * 100)}%` }} /></div>
                                <strong>{month.count}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section>
                        <div className="wn-teacher-section-heading">
                          <div><span>الدخل</span><h3>ملخص الاستحقاقات</h3></div>
                        </div>
                        <div className="wn-teacher-earning-summary">
                          <div><span>اليوم</span><strong>{analytics.earnings?.daily || 0} ج.م</strong></div>
                          <div><span>آخر 7 أيام</span><strong>{analytics.earnings?.weekly || 0} ج.م</strong></div>
                          <div><span>هذا الشهر</span><strong>{analytics.earnings?.monthly || 0} ج.م</strong></div>
                          <div><span>متاح للسحب</span><strong>{analytics.earnings?.available || 0} ج.م</strong></div>
                        </div>
                        <button type="button" onClick={() => setTab('wallet')} className="wn-teacher-text-link">
                          فتح المحفظة <ChevronLeft size={15} />
                        </button>
                      </section>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <MessageSquare size={16} /> متوسط التقييم: <strong>{reviewsData.averageRating?.toFixed?.(1) || '0'}</strong> ({reviewsData.totalReviews || 0} تقييم)
                </p>
                {reviewsData.reviews.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">لا تقييمات بعد</p>
                ) : reviewsData.reviews.map((r) => (
                  <div key={r._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-sm">{r.student?.name || 'طالب'}</p>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'requests' && (
              <div className="wn-teacher-requests">
                <div className="wn-teacher-requests__intro">
                  <div>
                    <span>صندوق الطلبات</span>
                    <h3>طلبات تحتاج قرارك</h3>
                    <p>اقبل الموعد، اقترح وقتًا آخر، أو اعتذر. الطالب يتلقى القرار فورًا.</p>
                  </div>
                  <div className="wn-teacher-request-count">
                    <strong>{trials.length + pendingRegular.length}</strong>
                    <small>طلب معلق</small>
                  </div>
                </div>

                {(trials.length + pendingRegular.length) === 0 ? (
                  <div className="wn-teacher-empty-state">
                    <CheckCircle2 size={28} />
                    <div><strong>صندوق الطلبات فارغ</strong><p>لا توجد طلبات تحتاج ردك الآن.</p></div>
                  </div>
                ) : (
                  <div className="wn-teacher-request-list">
                    {[
                      ...trials.map((item) => ({ ...item, requestKind: 'trial' })),
                      ...pendingRegular.map((item) => ({ ...item, requestKind: 'regular' })),
                    ]
                      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                      .map((session) => (
                        <article key={session._id} className="wn-teacher-request-card">
                          <div className="wn-teacher-request-card__date">
                            <strong>{formatSessionDateTime(session, 'ar-EG', { day: '2-digit' })}</strong>
                            <span>{formatSessionDateTime(session, 'ar-EG', { month: 'short' })}</span>
                          </div>
                          <div className="wn-teacher-request-card__body">
                            <span className={'wn-teacher-request-kind ' + (session.requestKind === 'trial' ? 'is-trial' : 'is-regular')}>
                              {session.requestKind === 'trial' ? 'حصة تجريبية' : 'حصة منتظمة'}
                            </span>
                            <h4>{session.student?.name || 'طالب'}</h4>
                            <p><Clock size={14} /> {formatSessionDateTime(session, 'ar-EG', { hour: '2-digit', minute: '2-digit' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</p>
                            {session.notes ? <small>{session.notes}</small> : null}
                          </div>
                          <div className="wn-teacher-request-card__actions">
                            <button type="button" onClick={() => setChatSession(session)} className="is-chat"><MessageSquare size={16} /> محادثة</button>
                            <button type="button" onClick={() => respondTrial(session._id, 'accept')} className="is-accept"><CheckCircle2 size={16} /> قبول</button>
                            <button type="button" onClick={() => { setRescheduleModal(session); setRescheduleDate(''); }} className="is-reschedule"><Clock size={16} /> موعد آخر</button>
                            <button type="button" onClick={() => respondTrial(session._id, 'reject')} className="is-reject"><X size={16} /> اعتذار</button>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'sessions' && (
              <div className="wn-teacher-sessions">
                <div className="wn-teacher-sessions__intro">
                  <div>
                    <span>الحصص المؤكدة</span>
                    <h3>جدول الحصص</h3>
                    <p>استخدم غرفة الأكاديمية للحصة، ثم أغلق الحصة وأرسل تقرير المتابعة بعد بدايتها.</p>
                  </div>
                  <button type="button" onClick={() => setTab('schedule')} className="wn-teacher-secondary-light">
                    <CalendarDays size={16} /> إدارة التوفر
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <div className="wn-teacher-empty-state">
                    <Calendar size={28} />
                    <div><strong>لا توجد حصص مؤكدة</strong><p>الحصص التي تقبلها ستظهر هنا.</p></div>
                  </div>
                ) : (
                  <div className="wn-teacher-session-list">
                    {[...sessions]
                      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                      .map((session) => {
                        const joinWindow = session.lifecycle
                          ? { phase: session.lifecycle.joinPhase, within: session.lifecycle.joinOpen }
                          : sessionJoinWindow(session);
                        const hasStarted = session.lifecycle?.started ?? (new Date(session.scheduledAt) <= new Date());
                        const canJoinRoom = session.lifecycle?.joinOpen ?? (session.status === 'accepted' && joinWindow.within);
                        const canComplete = session.lifecycle?.canComplete ?? hasStarted;
                        return (
                          <article key={session._id} className={'wn-teacher-session-card ' + (hasStarted ? 'is-due' : '')}>
                            <div className="wn-teacher-session-card__time">
                              <strong>{formatSessionDateTime(session, 'ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong>
                              <span>{formatSessionDateTime(session, 'ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                              <small>{sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                            </div>
                            <div className="wn-teacher-session-card__student">
                              <span>{session.type === 'trial' ? 'تجريبية' : session.type === 'group_circle' ? 'جماعية' : 'فردية'}</span>
                              <h4>{session.type === 'group_circle' ? (session.circle?.name || 'حلقة جماعية') : (session.student?.name || 'طالب')}</h4>
                              {session.type !== 'group_circle' ? (
                                <button type="button" onClick={() => openStudent(session.student)}>عرض ملف الطالب</button>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  <small>{session.attendance?.length || 0} طالب · {session.duration || 60} دقيقة</small>
                                  {!hasStarted ? (
                                    <p className="text-xs font-semibold text-slate-500">تسجيل الحضور يفتح عند بداية موعد الحلقة.</p>
                                  ) : null}
                                  <div className="space-y-1.5">
                                    {(session.attendance || []).map((entry) => {
                                      const studentId = entry.student?._id || entry.student;
                                      const studentName = entry.student?.name || 'طالب';
                                      const isEligibleExcuse = entry.status === 'excused' && entry.eligibleForCompensation;
                                      const isUpdating = attendanceUpdating === session._id + ':' + studentId;
                                      return (
                                        <div key={studentId} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs">
                                          <strong className="min-w-[90px]">{studentName}</strong>
                                          {isEligibleExcuse ? (
                                            <>
                                              <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                                                معتذر — لا تخصم
                                              </span>
                                              <button
                                                type="button"
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'attended')}
                                                className="rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700"
                                              >
                                                حضر فعليًا
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'attended')}
                                                className={
                                                  'rounded-lg px-2.5 py-1 font-bold ' +
                                                  (entry.status === 'attended'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-emerald-50 text-emerald-700')
                                                }
                                              >
                                                حضر
                                              </button>
                                              <button
                                                type="button"
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'absent')}
                                                className={
                                                  'rounded-lg px-2.5 py-1 font-bold ' +
                                                  (entry.status === 'absent'
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-rose-50 text-rose-700')
                                                }
                                              >
                                                غاب
                                              </button>
                                            </>
                                          )}
                                          {entry.status === 'excused' && !entry.eligibleForCompensation ? (
                                            <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                                              اعتذار متأخر — تخصم
                                            </span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="wn-teacher-session-card__actions">
                              <button type="button" onClick={() => setChatSession(session)}><MessageSquare size={16} /> محادثة</button>
                              {canJoinRoom ? (
                                <>
                                  <button type="button" onClick={() => enterAcademyRoom(session)} className="is-room"><Video size={16} /> غرفة الأكاديمية</button>
                                  <Link to={lp(`/meeting/${session._id}`)} className="is-translate">ترجمة مباشرة</Link>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-slate-500 px-2">
                                  {joinWindow.phase === 'early' ? 'الغرفة تفتح قبل الموعد بـ30 دقيقة' : 'انتهى وقت الدخول — أغلق الحصة وأرسل التقرير'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => session.type === 'group_circle' ? completeGroupSession(session) : openEval(session)}
                                disabled={!canComplete}
                                className="is-complete"
                                title={!canComplete ? 'يمكن إنهاء الحصة بعد بدء موعدها حسب توقيت السيرفر فقط' : undefined}
                              >
                                <CheckCircle2 size={16} /> {session.type === 'group_circle' ? 'إنهاء الحصة الجماعية' : 'إنهاء + تقرير'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}

                <section className="mt-8 border-t border-slate-200 pt-6">
                  <div className="wn-teacher-section-heading">
                    <div>
                      <span>السجل</span>
                      <h3>الحصص المكتملة وتقاريرها</h3>
                    </div>
                    <strong>{completedSessions.length}</strong>
                  </div>

                  {completedSessions.length === 0 ? (
                    <div className="wn-teacher-empty-state compact">
                      <CheckCircle2 size={22} />
                      <div><strong>لا توجد حصص مكتملة بعد</strong><p>بعد إنهاء أي حصة سيظهر تقريرها هنا.</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedSessions.map((session) => {
                        const ev = session.teacherEvaluation || {};
                        const legacyReport = (session.studentReports || []).find((report) => (
                          !report.student
                          || String(report.student?._id || report.student) === String(session.student?._id || session.student)
                        )) || {};
                        const surah = ev.surahRecited || legacyReport.surahRecited;
                        const fromAyah = ev.fromAyah || legacyReport.fromAyah;
                        const toAyah = ev.toAyah || legacyReport.toAyah;
                        const nextHomework = ev.nextHomework || legacyReport.nextHomework;
                        const notes = ev.overallNotes || legacyReport.notes;

                        return (
                          <article key={session._id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <span className="text-xs font-bold text-emerald-700">{session.type === 'trial' ? 'حصة تجريبية' : session.type === 'group_circle' ? 'حصة جماعية' : 'حصة منتظمة'}</span>
                                <h4 className="font-bold text-slate-900">{session.type === 'group_circle' ? (session.circle?.name || 'حلقة جماعية') : (session.student?.name || 'طالب')}</h4>
                                <p className="text-xs text-slate-500">
                                  {formatSessionDateTime(session, 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}
                                </p>
                              </div>
                              <button type="button" onClick={() => setChatSession(session)} className="wn-teacher-secondary-light">
                                <MessageSquare size={15} /> محادثة الحصة
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                              {[
                                ['attendance', 'الحضور'],
                                ['memorization', 'الحفظ'],
                                ['tajweed', 'التجويد'],
                                ['behavior', 'السلوك'],
                                ['commitment', 'الالتزام'],
                              ].map(([key, label]) => (
                                <div key={key} className="rounded-lg bg-slate-50 p-2 text-center">
                                  <span className="block text-slate-500">{label}</span>
                                  <strong className="text-emerald-800">{ev[key] ?? '—'}/5</strong>
                                </div>
                              ))}
                            </div>

                            {(surah || fromAyah || toAyah || nextHomework || notes) ? (
                              <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-slate-700">
                                {surah ? <p><strong>السورة / المقطع:</strong> {surah}</p> : null}
                                {(fromAyah || toAyah) ? <p><strong>الآيات:</strong> {fromAyah || '—'} إلى {toAyah || '—'}</p> : null}
                                {nextHomework ? <p><strong>الهدف / الواجب القادم:</strong> {nextHomework}</p> : null}
                                {notes ? <p><strong>الملاحظات:</strong> {notes}</p> : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'students' && (
              <div className="wn-teacher-students">
                <div className="wn-teacher-students__intro">
                  <div>
                    <span>Student Hub</span>
                    <h3>طلابي</h3>
                    <p>متابعة الطالب لا تتوقف عند الحجز: الحصص، الواجبات، آخر تقدم، والموعد القادم في مكان واحد.</p>
                  </div>
                  <strong>{activeStudents.length}</strong>
                </div>

                {activeStudents.length === 0 ? (
                  <div className="wn-teacher-empty-state">
                    <Users size={28} />
                    <div><strong>لا يوجد طلاب نشطون بعد</strong><p>بعد قبول أول حصة منتظمة سيظهر الطالب هنا تلقائيًا.</p></div>
                  </div>
                ) : (
                  <div className="wn-teacher-student-grid">
                    {activeStudents.map((student) => (
                      <article key={student._id} className="wn-teacher-student-card">
                        <div className="wn-teacher-student-card__top">
                          <span className="wn-teacher-avatar large">{(student.name || 'ط').slice(0, 1)}</span>
                          <div>
                            <h4>{student.name}</h4>
                            <p>{student.completedSessions || 0} حصة مكتملة</p>
                          </div>
                          {student.submittedHomework > 0 ? <b>{student.submittedHomework} واجب للتصحيح</b> : null}
                        </div>

                        <div className="wn-teacher-student-card__metrics">
                          <div>
                            <span>الحصة القادمة</span>
                            <strong>{student.nextSession ? new Date(student.nextSession.scheduledAt).toLocaleDateString('ar-EG') : '—'}</strong>
                          </div>
                          <div>
                            <span>واجبات معلقة</span>
                            <strong>{student.pendingHomework || 0}</strong>
                          </div>
                          <div>
                            <span>آخر حفظ</span>
                            <strong>{student.lastProgress?.surahRecited || '—'}</strong>
                          </div>
                        </div>

                        {student.lastProgress ? (
                          <div className="wn-teacher-student-card__progress">
                            <span>آخر تقييم</span>
                            <div>
                              <small>الحفظ</small><strong>{student.lastProgress.memorizationScore ?? '—'}/10</strong>
                              <small>التجويد</small><strong>{student.lastProgress.tajweedScore ?? '—'}/10</strong>
                            </div>
                          </div>
                        ) : null}

                        <button type="button" onClick={() => openStudent(student)} className="wn-teacher-student-card__open">
                          فتح الملف التعليمي <ChevronLeft size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'updates' && (
              <div className="wn-teacher-updates">
                <div className="wn-teacher-updates__intro">
                  <div>
                    <span>رسائل لطلابي</span>
                    <h3>شارك كلمة أو توجيهًا بالفيديو</h3>
                    <p>يمكنك إرفاق حتى 5 فيديوهات في الرسالة الواحدة، وإرسالها لكل طلابك النشطين أو لطلاب تختارهم.</p>
                  </div>
                  <Megaphone size={30} />
                </div>

                <div className="wn-teacher-updates__grid">
                  <form onSubmit={publishTeacherUpdate} className="wn-teacher-update-composer">
                    <div className="wn-teacher-section-heading">
                      <div><span>رسالة جديدة</span><h3>انشر تحديثًا لطلابك</h3></div>
                    </div>

                    <input className="input-field w-full" maxLength={140} required
                      placeholder="العنوان — مثال: كلمة قبل مراجعة سورة الملك"
                      value={updateForm.title}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} />

                    <textarea className="input-field w-full" rows={4} maxLength={2000}
                      placeholder="اكتب رسالة قصيرة أو تعليمات مع الفيديو..."
                      value={updateForm.message}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, message: event.target.value }))} />

                    <div className="wn-teacher-update-audience">
                      <label>
                        <input type="radio" name="teacher-update-audience"
                          checked={updateForm.audienceMode === 'all-active'}
                          onChange={() => setUpdateForm((current) => ({ ...current, audienceMode: 'all-active', studentIds: [] }))} />
                        <span><strong>كل طلابي النشطين</strong><small>تصل الرسالة لكل الطلاب المرتبطين بك</small></span>
                      </label>
                      <label>
                        <input type="radio" name="teacher-update-audience"
                          checked={updateForm.audienceMode === 'selected'}
                          onChange={() => setUpdateForm((current) => ({ ...current, audienceMode: 'selected' }))} />
                        <span><strong>طلاب محددون</strong><small>اختر طالبًا أو أكثر</small></span>
                      </label>
                    </div>

                    {updateForm.audienceMode === 'selected' && (
                      <div className="wn-teacher-update-students">
                        {activeStudents.length === 0 ? <p>لا يوجد طلاب نشطون للاختيار.</p> : activeStudents.map((student) => (
                          <label key={student._id} className={updateForm.studentIds.includes(student._id) ? 'is-selected' : ''}>
                            <input type="checkbox"
                              checked={updateForm.studentIds.includes(student._id)}
                              onChange={() => toggleUpdateStudent(student._id)} />
                            <span className="wn-teacher-avatar">{(student.name || 'ط').slice(0, 1)}</span>
                            <span><strong>{student.name}</strong><small>{student.completedSessions || 0} حصة مكتملة</small></span>
                          </label>
                        ))}
                      </div>
                    )}

                    <label className="wn-teacher-update-upload">
                      <Upload size={22} />
                      <span>
                        <strong>اختر فيديوهات</strong>
                        <small>MP4 / WebM / MOV — حتى 5 فيديوهات، 100MB لكل فيديو</small>
                      </span>
                      <input type="file" accept="video/mp4,video/webm,video/quicktime" multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []).slice(0, 5);
                          setUpdateForm((current) => ({ ...current, files }));
                        }} />
                    </label>

                    {updateForm.files.length > 0 && (
                      <div className="wn-teacher-update-files">
                        {updateForm.files.map((file, index) => (
                          <div key={`${file.name}-${index}`}>
                            <Video size={16} />
                            <span><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span>
                            <button type="button"
                              onClick={() => setUpdateForm((current) => ({ ...current, files: current.files.filter((_, i) => i !== index) }))}
                              aria-label="حذف الفيديو"><X size={15} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {publishingUpdate && updateUploadProgress && (
                      <TeacherUploadProgress value={updateUploadProgress} />
                    )}
                    <button type="submit" disabled={publishingUpdate || !updateForm.files.length} className="wn-teacher-primary-action">
                      <Send size={16} />
                      {publishingUpdate ? 'جاري رفع الفيديوهات والنشر...' : 'نشر وإشعار الطلاب'}
                    </button>
                  </form>

                  <section className="wn-teacher-update-history">
                    <div className="wn-teacher-section-heading">
                      <div><span>سجل النشر</span><h3>رسائلك السابقة</h3></div>
                      <strong>{teacherUpdates.length}</strong>
                    </div>

                    {teacherUpdates.length === 0 ? (
                      <div className="wn-teacher-empty-state compact">
                        <Megaphone size={24} />
                        <div><strong>لم تنشر رسالة بعد</strong><p>أول رسالة فيديو ستظهر هنا.</p></div>
                      </div>
                    ) : (
                      <div className="wn-teacher-update-list">
                        {teacherUpdates.map((update) => (
                          <article key={update._id}>
                            <div className="wn-teacher-update-list__heading">
                              <div>
                                <span>{update.audience?.mode === 'selected' ? 'طلاب محددون' : 'كل الطلاب النشطين'}</span>
                                <h4>{update.title}</h4>
                                <small>{new Date(update.publishedAt || update.createdAt).toLocaleString('ar-EG')}</small>
                              </div>
                              <button type="button" onClick={() => deleteTeacherUpdate(update._id)} aria-label="حذف الرسالة">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {update.message ? <p>{update.message}</p> : null}
                            <div className="wn-teacher-update-videos">
                              {(update.videos || []).map((video, index) => {
                                const key = `${update._id}-${index}`;
                                return (
                                  <div key={key}>
                                    {updateVideoUrls[key] ? (
                                      <video src={updateVideoUrls[key]} controls preload="metadata" />
                                    ) : (
                                      <button type="button" onClick={() => loadTeacherUpdateVideo(update._id, index)}>
                                        <Video size={20} />
                                        <span><strong>تشغيل الفيديو {index + 1}</strong><small>{video.name || 'فيديو المعلم'}</small></span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {tab === 'homework' && (
              <div className="wn-teacher-homework">
                <div className="wn-teacher-homework__intro">
                  <div>
                    <span>متابعة الواجبات</span>
                    <h3>الواجبات والتسجيلات الصوتية</h3>
                    <p>استمع لتسليم الطالب، اكتب ملاحظتك، ثم اعتمد الواجب أو اطلب إعادة التسجيل.</p>
                  </div>
                  <div className="wn-teacher-homework__actions">
                    {submittedTasks.length > 0 ? <b>{submittedTasks.length} تحتاج مراجعة</b> : null}
                    <button type="button" onClick={() => setTaskModal(true)} className="wn-teacher-primary-action">
                      <Plus size={16} /> واجب جديد
                    </button>
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <div className="wn-teacher-empty-state">
                    <BookOpen size={28} />
                    <div><strong>لا توجد واجبات بعد</strong><p>أنشئ واجبًا لطالب نشط ليظهر هنا.</p></div>
                  </div>
                ) : (
                  <div className="wn-teacher-homework-list">
                    {tasks.map((task) => (
                      <article key={task._id} className={'wn-teacher-homework-card is-' + task.status}>
                        <div className="wn-teacher-homework-card__top">
                          <span className="wn-teacher-homework-card__icon"><BookOpen size={18} /></span>
                          <div>
                            <span>{taskTypeLabel(task.type)}</span>
                            <h4>{task.title}</h4>
                            <p>{task.student?.name || 'طالب'}</p>
                          </div>
                          <span className="wn-teacher-homework-status">
                            {task.status === 'done' ? 'معتمد' : task.status === 'submitted' ? 'جاهز للمراجعة' : 'بانتظار الطالب'}
                          </span>
                        </div>

                        {task.description ? <p className="wn-teacher-homework-card__description">{task.description}</p> : null}

                        <div className="wn-teacher-homework-card__meta">
                          <span><Calendar size={14} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'بدون موعد'}</span>
                          <span><Clock size={14} /> أُنشئ {new Date(task.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>

                        {task.status === 'submitted' && (
                          <div className="wn-teacher-homework-review">
                            <div className="wn-teacher-homework-audio">
                              <button type="button" onClick={() => playHomeworkSubmission(task)} disabled={homeworkAudio.loading && homeworkAudio.taskId === task._id}>
                                <Headphones size={17} />
                                {homeworkAudio.loading && homeworkAudio.taskId === task._id ? 'جاري التحميل...' : 'استماع لتسجيل الطالب'}
                              </button>
                              {homeworkAudio.taskId === task._id && homeworkAudio.url ? (
                                <audio src={homeworkAudio.url} controls preload="metadata" />
                              ) : null}
                            </div>

                            <textarea
                              rows={2}
                              className="input-field w-full"
                              placeholder="ملاحظة للطالب — مثال: ممتاز، راجع أحكام النون الساكنة في الآية 6"
                              value={taskReview[task._id] || ''}
                              onChange={(event) => setTaskReview((current) => ({ ...current, [task._id]: event.target.value }))}
                            />

                            <div className="wn-teacher-homework-review__actions">
                              <button type="button" onClick={() => reviewTask(task, 'approve')} className="is-approve">
                                <CheckCircle2 size={16} /> اعتماد الواجب
                              </button>
                              <button type="button" onClick={() => reviewTask(task, 'request-revision')} className="is-revision">
                                <RotateCcw size={16} /> يحتاج إعادة
                              </button>
                            </div>
                          </div>
                        )}

                        {task.teacherFeedback ? (
                          <div className="wn-teacher-homework-feedback">
                            <MessageSquare size={15} />
                            <div><strong>ملاحظتك</strong><p>{task.teacherFeedback}</p></div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </>
      )}

      {chatSession && (
        <SessionChatModal
          session={chatSession}
          locale="ar"
          viewerRole="teacher"
          onClose={() => setChatSession(null)}
        />
      )}

      {rescheduleModal && (
        <Modal title={`اقتراح موعد جديد لـ ${rescheduleModal.student?.name || 'الطالب'}`} onClose={() => { setRescheduleModal(null); setRescheduleDate(''); }}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              الموعد الحالي: {formatSessionDateTime(rescheduleModal, 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-900">
              سيتم تفسير الموعد الجديد حسب <strong>{sessionTimeZone(rescheduleModal, teacher?.availabilityTimezone || 'Africa/Cairo')}</strong> وليس حسب منطقة جهازك.
            </div>
            <div>
              <label className="text-sm font-medium">الموعد المقترح</label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(event) => setRescheduleDate(event.target.value)}
                className="input-field w-full mt-1"
              />
            </div>
            <button type="button" onClick={submitReschedule} className="btn-primary w-full">
              إرسال الموعد الجديد للطالب
            </button>
          </div>
        </Modal>
      )}

      {studentModal && (
        <Modal
          title={`الملف التعليمي — ${studentModal.name || 'الطالب'}`}
          onClose={() => { setStudentModal(null); setStudentSummary(null); }}
          wide
        >
          {studentSummaryLoading ? (
            <div className="wn-teacher-empty-state">
              <Users size={28} />
              <div><strong>جاري تحميل ملف الطالب</strong><p>يتم جمع الحصص والواجبات والتقارير.</p></div>
            </div>
          ) : !studentSummary ? (
            <div className="wn-teacher-empty-state">
              <AlertTriangle size={28} />
              <div><strong>تعذر تحميل الملف</strong><p>أغلق النافذة وحاول مرة أخرى.</p></div>
            </div>
          ) : (
            <div className="wn-teacher-student-profile">
              <div className="wn-teacher-student-profile__hero">
                <span className="wn-teacher-avatar xlarge">{(studentSummary.student?.name || 'ط').slice(0, 1)}</span>
                <div>
                  <h3>{studentSummary.student?.name}</h3>
                  <p>{studentSummary.student?.email}</p>
                </div>
                <button type="button" onClick={() => {
                  setStudentModal(null);
                  setNewTask((current) => ({ ...current, studentId: studentSummary.student?._id || '' }));
                  setTaskModal(true);
                }}>
                  <Plus size={15} /> إسناد واجب
                </button>
              </div>

              <div className="wn-teacher-student-profile__stats">
                <div><span>إجمالي الحصص</span><strong>{studentSummary.summary?.totalSessions || 0}</strong></div>
                <div><span>مكتملة</span><strong>{studentSummary.summary?.completedSessions || 0}</strong></div>
                <div><span>قادمة</span><strong>{studentSummary.summary?.upcomingSessions || 0}</strong></div>
                <div><span>واجبات للتصحيح</span><strong>{studentSummary.summary?.submittedHomework || 0}</strong></div>
              </div>

              <section className="wn-teacher-student-profile__section">
                <div className="wn-teacher-section-heading">
                  <div><span>التاريخ التعليمي</span><h3>آخر الحصص والتقارير</h3></div>
                </div>
                {(studentSummary.sessions || []).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد حصص مسجلة.</p>
                ) : (
                  <div className="wn-teacher-student-timeline">
                    {studentSummary.sessions.slice(0, 10).map((session) => (
                      <div key={session._id}>
                        <span className={'wn-teacher-timeline-dot ' + (session.status === 'completed' ? 'is-done' : '')} />
                        <div>
                          <strong>{session.type === 'trial' ? 'حصة تجريبية' : 'حصة منتظمة'}</strong>
                          <small>{formatSessionDateTime(session, 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                          {(session.evaluation || session.progressReport) ? (
                            <div className="wn-teacher-timeline-report">
                              {session.evaluation ? (
                                <>
                                  <span>الحفظ <b>{session.evaluation.memorization ?? '—'}/5</b></span>
                                  <span>التجويد <b>{session.evaluation.tajweed ?? '—'}/5</b></span>
                                </>
                              ) : (
                                <>
                                  <span>الحفظ <b>{session.progressReport?.memorizationScore ?? '—'}/10</b></span>
                                  <span>التجويد <b>{session.progressReport?.tajweedScore ?? '—'}/10</b></span>
                                </>
                              )}
                              {(session.evaluation?.surahRecited || session.progressReport?.surahRecited) ? (
                                <p>تم التسميع: {session.evaluation?.surahRecited || session.progressReport?.surahRecited}</p>
                              ) : null}
                              {(session.evaluation?.nextHomework || session.progressReport?.nextHomework) ? (
                                <p>التالي: {session.evaluation?.nextHomework || session.progressReport?.nextHomework}</p>
                              ) : null}
                              {(session.evaluation?.overallNotes || session.progressReport?.notes) ? (
                                <p>ملاحظات: {session.evaluation?.overallNotes || session.progressReport?.notes}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="wn-teacher-student-profile__section">
                <div className="wn-teacher-section-heading">
                  <div><span>الواجبات</span><h3>آخر المهام</h3></div>
                </div>
                {(studentSummary.tasks || []).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد واجبات لهذا الطالب.</p>
                ) : (
                  <div className="wn-teacher-student-task-list">
                    {studentSummary.tasks.slice(0, 8).map((task) => (
                      <div key={task._id}>
                        <span>{taskTypeLabel(task.type)}</span>
                        <strong>{task.title}</strong>
                        <small>{task.status === 'done' ? 'معتمد' : task.status === 'submitted' ? 'مُسلّم' : 'قيد الانتظار'}</small>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </Modal>
      )}

      {evalModal && (
        <Modal title={`تقييم ${evalModal.student?.name}`} onClose={() => setEvalModal(null)}>
          <div className="space-y-4">
            {[
              ['attendance', 'الحضور والانتباه'],
              ['memorization', 'الحفظ'],
              ['tajweed', 'التجويد'],
              ['behavior', 'السلوك'],
              ['commitment', 'الالتزام'],
            ].map(([key, label]) => {
              const inputId = `teacher-eval-${key}`;
              return (
                <fieldset key={key} className="space-y-2">
                  <legend className="text-sm font-medium">{label} (1-5)</legend>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={label}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        id={`${inputId}-${score}`}
                        type="button"
                        role="radio"
                        aria-checked={evaluation[key] === score}
                        onClick={() => setEvaluation((current) => ({ ...current, [key]: score }))}
                        className={`min-h-11 rounded-lg border text-sm font-bold transition ${evaluation[key] === score
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <output className="text-sm text-emerald-700 font-bold">{evaluation[key]} من 5</output>
                </fieldset>
              );
            })}
            <div className="wn-teacher-eval-report">
              <div className="wn-teacher-section-heading">
                <div><span>تقرير ولي الأمر</span><h3>ماذا تم في الحصة؟</h3></div>
              </div>
              <label htmlFor="teacher-eval-surah" className="text-sm font-medium">السورة / المقطع الذي تم تسميعه</label>
              <input
                id="teacher-eval-surah"
                name="surahRecited"
                className="input-field w-full"
                placeholder="مثال: سورة البقرة"
                value={evaluation.surahRecited}
                onChange={(event) => setEvaluation((current) => ({ ...current, surahRecited: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium" htmlFor="teacher-eval-from-ayah">
                  من آية
                  <input
                    id="teacher-eval-from-ayah"
                    name="fromAyah"
                    type="number"
                    min="1"
                    className="input-field w-full mt-1"
                    placeholder="1"
                    value={evaluation.fromAyah}
                    onChange={(event) => setEvaluation((current) => ({ ...current, fromAyah: event.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium" htmlFor="teacher-eval-to-ayah">
                  إلى آية
                  <input
                    id="teacher-eval-to-ayah"
                    name="toAyah"
                    type="number"
                    min="1"
                    className="input-field w-full mt-1"
                    placeholder="5"
                    value={evaluation.toAyah}
                    onChange={(event) => setEvaluation((current) => ({ ...current, toAyah: event.target.value }))}
                  />
                </label>
              </div>
              <label htmlFor="teacher-eval-next-homework" className="text-sm font-medium">الواجب أو الهدف القادم</label>
              <input
                id="teacher-eval-next-homework"
                name="nextHomework"
                className="input-field w-full"
                placeholder="الهدف أو الواجب التالي"
                value={evaluation.nextHomework}
                onChange={(event) => setEvaluation((current) => ({ ...current, nextHomework: event.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="teacher-eval-notes" className="text-sm font-medium">ملاحظات</label>
              <textarea
                id="teacher-eval-notes"
                name="overallNotes"
                className="input-field w-full mt-1"
                rows={2}
                value={evaluation.overallNotes}
                onChange={(e) => setEvaluation((p) => ({ ...p, overallNotes: e.target.value }))}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium flex items-center gap-1"><ClipboardList size={16} /> واجبات بعد الحصة</label>
                <button type="button" onClick={addHomework} className="text-sm text-emerald-600">+ إضافة</button>
              </div>
              {homeworkList.map((hw, i) => (
                <div key={i} className="border rounded-lg p-3 mb-2 space-y-2">
                  <select className="input-field w-full" value={hw.type}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, type: e.target.value } : h))}>
                    {TASK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <input className="input-field w-full" placeholder="التفاصيل (مثلاً: سورة البقرة 1-5)"
                    value={hw.description}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, description: e.target.value } : h))} />
                  <input type="date" className="input-field w-full" value={hw.dueDate}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, dueDate: e.target.value } : h))} />
                </div>
              ))}
            </div>
            <div className="wn-teacher-eval-submit">
              <p id="teacher-eval-submit-note"><CheckCircle2 size={16} /> سيتم إنهاء الحصة، تسجيل الاستحقاق، وحفظ تقرير المتابعة.</p>
              <button
                id="teacher-eval-submit"
                type="button"
                onClick={completeSession}
                className="btn-primary w-full"
                aria-describedby="teacher-eval-submit-note"
              >
                إنهاء الحصة وإرسال التقرير (+{SESSION_RATE} ج.م)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {taskModal && (
        <Modal title="إسناد واجب جديد" onClose={() => setTaskModal(false)}>
          <div className="space-y-3">
            <select className="input-field w-full" value={newTask.studentId}
              onChange={(e) => setNewTask((p) => ({ ...p, studentId: e.target.value }))}>
              <option value="">اختر الطالب</option>
              {activeStudents.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <select className="input-field w-full" value={newTask.type}
              onChange={(e) => setNewTask((p) => ({ ...p, type: e.target.value }))}>
              {TASK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input className="input-field w-full" placeholder="عنوان الواجب" value={newTask.title}
              onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))} />
            <textarea className="input-field w-full" placeholder="التفاصيل" rows={2} value={newTask.description}
              onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))} />
            <input type="date" className="input-field w-full" value={newTask.dueDate}
              onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))} />
            <button onClick={assignTask} className="btn-primary w-full">إسناد</button>
          </div>
        </Modal>
      )}

      {aiModal && (
        <Modal title="مساعد المعلم — AI V4" onClose={() => setAiModal(false)}>
          <div className="space-y-3">
            <input className="input-field w-full" placeholder="موضوع الواجبات (مثلاً: الغنة)"
              value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
            <button type="button" onClick={generateAiHomework} disabled={aiLoading} className="btn-primary w-full flex items-center justify-center gap-2">
              <Sparkles size={16} /> {aiLoading ? 'جاري التوليد...' : 'توليد 5 واجبات'}
            </button>
            {aiResult?.assignments?.map((a) => (
              <div key={a.id} className="border rounded-lg p-3 text-sm">
                <p className="font-bold">{a.title}</p>
                {a.description && <p className="text-gray-600 mt-1">{a.description}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}

function TeacherCommandBar({ primaryItems, secondaryItems, active, onChange, actionCount }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActiveItem = secondaryItems.find((item) => item.id === active);

  const selectItem = (id) => {
    onChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="wn-teacher-command-shell">
      <nav className="wn-teacher-command" aria-label="التنقل داخل مساحة المعلم">
        <div className="wn-teacher-command__identity" aria-hidden="true">
          <span><BookOpen size={17} /></span>
          <div>
            <strong>مساحة المعلم</strong>
            <small>إدارة يومك التعليمي</small>
          </div>
        </div>

        <div className="wn-teacher-command__primary">
          {primaryItems.map(({ id, label, icon: Icon, badge }) => {
            const selected = active === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => selectItem(id)}
                className={'wn-teacher-command__item ' + (selected ? 'is-active' : '')}
                aria-current={selected ? 'page' : undefined}
              >
                <span className="wn-teacher-command__icon"><Icon size={18} /></span>
                <strong>{label}</strong>
                {badge ? <b>{badge}</b> : null}
              </button>
            );
          })}
        </div>

        <div className="wn-teacher-command__more">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={'wn-teacher-command__item wn-teacher-command__more-button ' + (secondaryActiveItem ? 'is-active' : '')}
            aria-expanded={moreOpen}
          >
            <span className="wn-teacher-command__icon"><MoreHorizontal size={19} /></span>
            <span>
              <strong>المزيد</strong>
              {secondaryActiveItem ? <small>{secondaryActiveItem.label}</small> : null}
            </span>
            {actionCount > 0 && active === 'overview' ? <i>{actionCount}</i> : null}
          </button>

          {moreOpen && (
            <div className="wn-teacher-command__panel">
              <div className="wn-teacher-command__panel-heading">
                <div><span>أدوات المعلم</span><strong>إدارة المساحة</strong></div>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label="إغلاق"><X size={17} /></button>
              </div>
              <div className="wn-teacher-command__panel-grid">
                {secondaryItems.map(({ id, label, icon: Icon, description }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => selectItem(id)}
                    className={active === id ? 'is-active' : ''}
                  >
                    <span><Icon size={18} /></span>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <ChevronLeft size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div
        className={`bg-white rounded-xl ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-y-auto p-6 relative`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <span className="text-slate-500 text-xs">{label}</span>
      <p className="font-semibold">{value || '—'}</p>
    </div>
  );
}

function statusLabel(s) {
  const m = { pending: 'قيد المراجعة', 'under-review': 'تحت المراجعة', approved: 'موافق', rejected: 'مرفوض', suspended: 'موقوف' };
  return m[s] || s;
}

function financeStatusLabel(status) {
  const labels = {
    pending: 'قيد المراجعة',
    processing: 'جاري التحويل',
    completed: 'مكتمل',
    rejected: 'مرفوض',
  };
  return labels[status] || status;
}

function taskTypeLabel(t) {
  return TASK_TYPES.find((x) => x.id === t)?.label || t;
}

function mergeSchedule(apiDays) {
  return WEEK_DAYS.map((day) => {
    const found = (apiDays || []).find((item) => item.day === day.id);
    return {
      day: day.id,
      label: day.label,
      slots: (found?.slots || []).map((slot) => ({
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
      })),
    };
  });
}


function TeacherUploadProgress({ value }) {
  const percentage = value.overallPercentage || 0;
  const state = value.status === 'paused'
    ? 'انقطع الإنترنت؛ سنكمل عند عودة الاتصال.'
    : value.status === 'retrying'
      ? 'نعيد محاولة الجزء غير المكتمل تلقائيًا.'
      : value.status === 'resuming'
        ? 'جاري استكمال الأجزاء المحفوظة.'
        : value.status === 'finalizing'
          ? 'جاري تأكيد حفظ الفيديو.'
          : 'جاري رفع الملفات.';
  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
      <div className="flex justify-between gap-3">
        <span>{state}</span>
        <strong className="tabular-nums" dir="ltr">{percentage}%</strong>
      </div>
      <progress className="mt-2 w-full accent-emerald-600" max="100" value={percentage} aria-label="إجمالي رفع الملفات" />
      <p className="mt-1 text-xs">
        {value.completed} من {value.total} ملفات مكتملة — {value.label}
      </p>
      <p className="mt-1 text-xs text-slate-600">لا تغلق الصفحة قبل تأكيد الحفظ.</p>
    </div>
  );
}
