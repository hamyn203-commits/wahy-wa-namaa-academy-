import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Users, Star, Wallet, ClipboardList,
  BookOpen, X, Plus, Clock, BarChart3, MessageSquare, Sparkles,
  Video, MoreHorizontal, UserRound, CheckCircle2, AlertTriangle,
  Headphones, ChevronLeft, ChevronRight, TrendingUp, CalendarDays,
  Upload, Trash2, Send, Megaphone, Loader2, RefreshCw,
} from 'lucide-react';
import DashboardLayout, { StatCard } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { apiUrl } from '../../config';
import { TASK_TYPES } from '../TeacherRegistration/constants';
import SessionChatModal from '../../components/session/SessionChatModal';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import { sessionJoinWindow, formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import GroupSessionCompleteModal from './GroupSessionCompleteModal';
import { RejectSessionModal, ConfirmDeleteUpdateModal } from './TeacherActionModals';
import QuranProgressSummary from '../../components/dashboard/QuranProgressSummary';
import {
  prepareTeacherFeedbackAudio,
  uploadTeacherFeedbackMultipart,
} from '../../components/homework/VoiceFeedbackControls';
import TeacherWalletPanel from './TeacherWalletPanel';
import TeacherSchedulePanel from './TeacherSchedulePanel';
import TeacherAnalyticsPanel from './TeacherAnalyticsPanel';
import TeacherProfileTab from './TeacherProfileTab';
import TeacherHomeworkPanel from './TeacherHomeworkPanel';

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
  recommendedLevel: 'beginner',
  recommendedTrack: 'memorization',
  trialRequestId: '',
};
const emptyHomework = { type: 'memorization', description: '', dueDate: '' };

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, logout } = useRequireAuth(['teacher']);
  const { locale, isRTL, t } = useI18n();
  const tp = t?.teacherPortal || {};
  const trReg = t?.teacherRegistration || {};
  const intlLocale = resolveIntlLocale(locale);
  const lp = (value) => localizedPath(value, locale);
  const toast = useToast();
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;

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
  const [loadError, setLoadError] = useState(false);

  const meetingProvider = 'livekit';
  const [chatSession, setChatSession] = useState(null);
  const [unreadChatSessionIds, setUnreadChatSessionIds] = useState(() => new Set());
  const consumedChatSessionRef = useRef('');
  const consumedEvaluateRef = useRef('');

  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [respondingSessionId, setRespondingSessionId] = useState('');
  const respondingLock = useRef(false);

  const [evalModal, setEvalModal] = useState(null);
  const [evaluation, setEvaluation] = useState(emptyEval);
  const [homeworkList, setHomeworkList] = useState([]);
  const [completingSession, setCompletingSession] = useState(false);
  const [evalAyahError, setEvalAyahError] = useState('');
  const completingSessionLock = useRef(false);
  const [groupCompleteModal, setGroupCompleteModal] = useState(null);

  const [taskModal, setTaskModal] = useState(false);
  const [taskTargetMode, setTaskTargetMode] = useState('student');
  const [taskCircleId, setTaskCircleId] = useState('');
  const [newTask, setNewTask] = useState({ studentId: '', type: 'memorization', title: '', description: '', dueDate: '' });
  const [assigningTask, setAssigningTask] = useState(false);
  const assignTaskLock = useRef(false);

  const [taskFeedbackAudio, setTaskFeedbackAudio] = useState({});
  const [reviewingTaskId, setReviewingTaskId] = useState('');
  const [aiTargetMode, setAiTargetMode] = useState('student');
  const [aiTargetId, setAiTargetId] = useState('');
  const [assigningAiId, setAssigningAiId] = useState('');
  const [deleteUpdateModal, setDeleteUpdateModal] = useState(null);
  const [deletingUpdate, setDeletingUpdate] = useState(false);

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
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const withdrawLock = useRef(false);

  const [studentModal, setStudentModal] = useState(null);
  const [studentSummary, setStudentSummary] = useState(null);
  const [studentSummaryLoading, setStudentSummaryLoading] = useState(false);
  const [studentSummaryError, setStudentSummaryError] = useState(false);

  const [homeworkAudio, setHomeworkAudio] = useState({ taskId: '', url: '', loading: false });
  const [taskReview, setTaskReview] = useState({});

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);

  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 0, totalReviews: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);

  const [schedule, setSchedule] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [aiModal, setAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
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
  const [updateVideoUrls, setUpdateVideoUrls] = useState({});
  const [loadingVideoKey, setLoadingVideoKey] = useState('');
  const loadingVideoLock = useRef(new Set());

  const [profileChange, setProfileChange] = useState(null);
  const [profileEdit, setProfileEdit] = useState({
    fullName: '', city: '', university: '', faculty: '', qualification: '',
    teachingExperience: 0, numberOfIjazat: 0, bio: '',
  });
  const [profileFiles, setProfileFiles] = useState({
    profilePhoto: null, introductionVideo: null, recitationVideo: null, teachingMethodVideo: null,
  });
  const [savingProfileChange, setSavingProfileChange] = useState(false);
  const [attendanceUpdating, setAttendanceUpdating] = useState('');
  const [enteringRoomId, setEnteringRoomId] = useState('');
  const enteringRoomLock = useRef(false);

  const [myCircles, setMyCircles] = useState([]);
  const [circleSessionModal, setCircleSessionModal] = useState(null);
  const [circleSessionForm, setCircleSessionForm] = useState({ scheduledAt: '', duration: 60, notes: '' });
  const [savingCircleSession, setSavingCircleSession] = useState(false);

  const toastsDict = tp.toasts || {};
  const errDict = tp.errors || {};
  const valDict = tp.validation || {};
  const profileLoadFailedMsg = errDict.profileLoadFailed || 'تعذر تحميل الملف التعريفي للمعلم';
  const dashboardLoadFailedMsg = errDict.dashboardLoadFailed || 'تعذر تحميل بيانات لوحة المعلم';
  const analyticsLoadFailedMsg = errDict.analyticsLoadFailed || 'تعذر تحميل بيانات الأداء';
  const reviewsLoadFailedMsg = errDict.reviewsLoadFailed || 'تعذر تحميل التقييمات';
  const homeworkSubmittedMsg = toastsDict.homeworkSubmittedNotif || 'وصل تسليم واجب صوتي جديد من أحد طلابك';

  const statusLabel = (s) => tp.statusLabels?.[s] || s;
  const financeStatusLabel = (status) => tp.financeStatus?.[status] || status;
  const teacherLearnerLevelLabel = (level) => tp.learnerLevels?.[level] || tp.learnerLevels?.unspecified || 'غير محدد';
  const teacherLearnerTrackLabel = (track) => tp.learnerTracks?.[track] || tp.learnerTracks?.unspecified || 'لم يُحدد المسار';
  const taskTypeLabel = (typeId) => trReg.taskTypes?.[typeId] || TASK_TYPES.find((x) => x.id === typeId)?.label || typeId;

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const results = await Promise.allSettled([
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
        api.get('/api/teachers/dashboard/circles', { auth: true }),
      ]);

      const [
        profRes, stRes, trRes, pendRegRes, sessRes, doneRes, studRes,
        tskRes, balanceRes, txRes, analyticsRes, updateRes, profileChangeRes, circlesRes,
      ] = results;

      if (profRes.status === 'fulfilled' && profRes.value) setProfile(profRes.value);
      if (stRes.status === 'fulfilled' && stRes.value) setStats(stRes.value);

      const tr = trRes.status === 'fulfilled' ? trRes.value : null;
      setTrials(tr?.sessions || []);

      const pendReg = pendRegRes.status === 'fulfilled' ? pendRegRes.value : null;
      setPendingRegular(pendReg?.sessions || []);

      const sess = sessRes.status === 'fulfilled' ? sessRes.value : null;
      setSessions((sess?.sessions || []).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));

      const done = doneRes.status === 'fulfilled' ? doneRes.value : null;
      setCompletedSessions((done?.sessions || []).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)));

      const stud = studRes.status === 'fulfilled' ? studRes.value : null;
      setActiveStudents(stud?.students || []);

      const tsk = tskRes.status === 'fulfilled' ? tskRes.value : null;
      setTasks(tsk?.tasks || []);

      const balance = balanceRes.status === 'fulfilled' ? balanceRes.value : null;
      setFinance(balance || {
        balances: {
          EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
          USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
        },
        limits: { minPayoutEGP: 100, minPayoutUSD: 10 },
      });

      const tx = txRes.status === 'fulfilled' ? txRes.value : null;
      setTransactions(tx?.transactions || []);

      const analyticsData = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
      if (analyticsData) {
        setAnalytics(analyticsData);
        setAnalyticsError(false);
      }

      const updateData = updateRes.status === 'fulfilled' ? updateRes.value : null;
      setTeacherUpdates(updateData?.updates || []);

      const profileChangeData = profileChangeRes.status === 'fulfilled' ? profileChangeRes.value : null;
      setProfileChange(profileChangeData?.request || null);
      setMyCircles(circlesRes?.status === 'fulfilled' ? (circlesRes.value?.circles || []) : []);

      const rejectedCount = results.filter((r) => r.status === 'rejected').length;
      if (profRes.status === 'rejected' || rejectedCount >= 5) {
        setLoadError(true);
        toast.error(profileLoadFailedMsg);
      }
    } catch {
      setLoadError(true);
      toast.error(dashboardLoadFailedMsg);
    } finally {
      setLoading(false);
    }
  }, [toast, profileLoadFailedMsg, dashboardLoadFailedMsg]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    try {
      const data = await api.get('/api/teachers/dashboard/analytics', { auth: true });
      setAnalytics(data);
    } catch {
      setAnalyticsError(true);
      toast.error(analyticsLoadFailedMsg);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [toast, analyticsLoadFailedMsg]);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(false);
    try {
      const data = await api.get('/api/teachers/dashboard/reviews', { auth: true });
      setReviewsData(data || { reviews: [], averageRating: 0, totalReviews: 0 });
    } catch {
      setReviewsError(true);
      toast.error(reviewsLoadFailedMsg);
    } finally {
      setReviewsLoading(false);
    }
  }, [toast, reviewsLoadFailedMsg]);

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
  }, [profile?.teacher, user?.name]);

  const submitProfileChange = async (event) => {
    event.preventDefault();
    if (savingProfileChange) return;
    if (profileChange?.status === 'pending') {
      return toast.error(toastsDict.profileChangePending || 'لديك طلب تعديل قيد مراجعة الإدارة بالفعل');
    }

    const teacher = profile?.teacher;
    if (!teacher) return;
    setSavingProfileChange(true);

    try {
      const mediaEntries = Object.entries(profileFiles).filter(([, file]) => Boolean(file));
      const uploadedPairs = await Promise.all(mediaEntries.map(async ([kind, file]) => (
        [kind, await uploadFileDirect(file, 'teacher-public')]
      )));
      const media = Object.fromEntries(uploadedPairs);
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
      setProfileFiles({ profilePhoto: null, introductionVideo: null, recitationVideo: null, teachingMethodVideo: null });
      toast.success(toastsDict.profileChangeSuccess || 'تم إرسال التعديلات للإدارة. ملفك العام سيبقى كما هو حتى الموافقة.');
    } catch (error) {
      toast.error(error.message || toastsDict.profileChangeFailed || 'تعذر إرسال طلب التعديل');
    } finally {
      setSavingProfileChange(false);
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
      // Keep the current dashboard stable during a transient background sync failure.
    }
  }, [ready]);

  const syncTasksAndStudents = useCallback(async () => {
    if (!ready) return;
    try {
      const [tasksRes, studentsRes] = await Promise.allSettled([
        api.get('/api/teachers/dashboard/tasks', { auth: true }),
        api.get('/api/teachers/dashboard/active-students', { auth: true }),
      ]);
      if (tasksRes.status === 'fulfilled' && tasksRes.value) {
        setTasks(tasksRes.value.tasks || []);
      }
      if (studentsRes.status === 'fulfilled' && studentsRes.value) {
        setActiveStudents(studentsRes.value.students || []);
      }
    } catch {
      // Ignore transient refresh failure.
    }
  }, [ready]);

  const openSessionChat = (session) => {
    if (!session) return;
    setChatSession(session);
    setUnreadChatSessionIds((current) => {
      if (!current.has(String(session._id))) return current;
      const next = new Set(current);
      next.delete(String(session._id));
      return next;
    });
  };

  const openEval = (session) => {
    setEvalModal(session);
    setEvaluation(emptyEval);
    setEvalAyahError('');
    if (session?.type === 'trial' && session?._id) {
      api.get(`/api/trials/by-session/${session._id}`, { auth: true })
        .then((res) => {
          if (res?.trial) {
            setEvaluation((prev) => ({
              ...prev,
              recommendedLevel: res.trial.currentLevel || 'beginner',
              recommendedTrack: res.trial.preferredTrack || 'memorization',
              trialRequestId: res.trial._id || '',
            }));
          }
        })
        .catch(() => {});
    }
    setHomeworkList([]);
  };

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
      const detail = event?.detail;
      const type = detail?.type;
      if (['session-request', 'session-accepted', 'session-cancelled', 'session-reminder'].includes(type)) {
        syncSessions();
      }
      if (type === 'session-chat-message') {
        syncSessions();
        const incomingSessionId = detail?.data?.session;
        if (incomingSessionId && String(chatSession?._id || '') !== String(incomingSessionId)) {
          setUnreadChatSessionIds((current) => {
            const next = new Set(current);
            next.add(String(incomingSessionId));
            return next;
          });
        }
      }
      if (type === 'homework-submitted') {
        syncTasksAndStudents();
        toast.info(homeworkSubmittedMsg);
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, syncSessions, syncTasksAndStudents, chatSession?._id, toast, homeworkSubmittedMsg]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = ['overview', 'requests', 'sessions', 'students', 'homework', 'updates', 'schedule', 'wallet', 'analytics', 'reviews', 'account'];
    if (requestedTab && allowedTabs.includes(requestedTab)) {
      setTab(requestedTab);
    }

    if (requestedTab === 'trials') setTab('requests');
    if (requestedTab === 'evaluate') setTab('sessions');

    const allKnown = [...trials, ...pendingRegular, ...sessions, ...completedSessions];
    const requestedSessionId = searchParams.get('session');
    if (requestedSessionId && consumedChatSessionRef.current !== String(requestedSessionId)) {
      const found = allKnown.find((item) => String(item._id) === String(requestedSessionId));
      if (found) {
        consumedChatSessionRef.current = String(requestedSessionId);
        setChatSession(found);
        setUnreadChatSessionIds((current) => {
          if (!current.has(String(found._id))) return current;
          const next = new Set(current);
          next.delete(String(found._id));
          return next;
        });
      }
    }

    const requestedEvaluateId = searchParams.get('evaluate');
    if (requestedEvaluateId && consumedEvaluateRef.current !== String(requestedEvaluateId)) {
      const foundEval = allKnown.find((item) => String(item._id) === String(requestedEvaluateId));
      if (foundEval && foundEval.status === 'accepted') {
        consumedEvaluateRef.current = String(requestedEvaluateId);
        if (foundEval.type === 'group_circle') {
          setGroupCompleteModal(foundEval);
        } else {
          setEvalModal(foundEval);
          setEvaluation(emptyEval);
          setEvalAyahError('');
          setHomeworkList([]);
          if (foundEval.type === 'trial' && foundEval._id) {
            api.get(`/api/trials/by-session/${foundEval._id}`, { auth: true })
              .then((res) => {
                if (res?.trial) {
                  setEvaluation((prev) => ({
                    ...prev,
                    recommendedLevel: res.trial.currentLevel || 'beginner',
                    recommendedTrack: res.trial.preferredTrack || 'memorization',
                    trialRequestId: res.trial._id || '',
                  }));
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  }, [searchParams, trials, pendingRegular, sessions, completedSessions]);

  useEffect(() => {
    if (!ready) return;
    if (tab === 'analytics' && !analytics && !analyticsLoading && !analyticsError) {
      fetchAnalytics();
    }
    if (tab === 'reviews' && !reviewsData.reviews.length && !reviewsLoading && !reviewsError) {
      fetchReviews();
    }
    if (tab === 'schedule' && !schedule.length) {
      api.get('/api/teachers/dashboard/availability', { auth: true })
        .then((d) => setSchedule(mergeSchedule(d.availability, tp.weekdays)))
        .catch(() => setSchedule(mergeSchedule([], tp.weekdays)));
    }
  }, [
    tab, ready, analytics, analyticsLoading, analyticsError, fetchAnalytics,
    reviewsData.reviews.length, reviewsLoading, reviewsError, fetchReviews,
    schedule.length, tp.weekdays,
  ]);

  if (!ready) return null;

  const expectedSessionEarning = Math.round(((Number(profile?.teacher?.hourlyRate || SESSION_RATE) * Math.max(1, Number(evalModal?.duration || 60))) / 60) * 100) / 100;
  const teacher = profile?.teacher;

  const submitGroupCircleSession = async () => {
    if (savingCircleSession) return;
    if (!circleSessionModal || !circleSessionForm.scheduledAt) {
      return toast.error(valDict.circleDateRequired || 'اختر موعد الحصة الجماعية');
    }
    setSavingCircleSession(true);
    try {
      await api.post('/api/sessions/group-circle', {
        circleId: circleSessionModal._id,
        scheduledAt: circleSessionForm.scheduledAt,
        timezone: circleSessionModal.timezone || profile?.teacher?.availabilityTimezone || 'Africa/Cairo',
        duration: Number(circleSessionForm.duration || circleSessionModal.durationMaxMinutes || 60),
        notes: circleSessionForm.notes?.trim() || '',
      }, { auth: true });
      toast.success(toastsDict.circleSessionScheduled || 'تم جدولة حصة الحلقة الجماعية وإشعار الطلاب');
      setCircleSessionModal(null);
      setCircleSessionForm({ scheduledAt: '', duration: 60, notes: '' });
      load();
    } catch (error) {
      toast.error(error.message || toastsDict.circleSessionFailed || 'تعذر جدولة حصة الحلقة');
    } finally {
      setSavingCircleSession(false);
    }
  };

  const respondTrial = async (id, action, extra = {}) => {
    if (respondingLock.current) return;
    respondingLock.current = true;
    setRespondingSessionId(String(id));
    try {
      await api.put(`/api/sessions/${id}/respond`, {
        action,
        provider: action === 'accept' ? meetingProvider : undefined,
        reason: extra.reason,
        rescheduledDate: extra.rescheduledDate,
        rescheduleTimezone: extra.rescheduleTimezone,
      }, { auth: true });

      const labels = {
        accept: toastsDict.requestAccepted || 'تم قبول الطلب وإشعار الطالب',
        reject: toastsDict.requestRejected || 'تم الاعتذار عن الطلب وإشعار الطالب',
        reschedule: toastsDict.requestRescheduled || 'تم اقتراح الموعد الجديد وإشعار الطالب',
      };
      toast.success(labels[action] || toastsDict.requestUpdated || 'تم تحديث الطلب');
      setRescheduleModal(null);
      setRescheduleDate('');
      setRejectModal(null);
      load();
    } catch (error) {
      toast.error(error.message || toastsDict.genericError || 'حدث خطأ');
    } finally {
      respondingLock.current = false;
      setRespondingSessionId('');
    }
  };

  const confirmRejectSession = async (reason) => {
    if (!rejectModal?._id || rejectSubmitting) return;
    setRejectSubmitting(true);
    try {
      await respondTrial(rejectModal._id, 'reject', { reason });
    } finally {
      setRejectSubmitting(false);
    }
  };

  const submitReschedule = async () => {
    if (respondingLock.current) return;
    if (!rescheduleModal || !rescheduleDate) {
      return toast.error(valDict.rescheduleDateRequired || 'اختر الموعد الجديد');
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rescheduleDate)) {
      return toast.error(valDict.rescheduleDateInvalid || 'اختر موعدًا صحيحًا');
    }
    await respondTrial(rescheduleModal._id, 'reschedule', {
      rescheduledDate: rescheduleDate,
      rescheduleTimezone: sessionTimeZone(rescheduleModal, teacher?.availabilityTimezone || 'Africa/Cairo'),
    });
  };

  const addHomework = () => {
    setHomeworkList((p) => [...p, { ...emptyHomework }]);
  };

  const completeSession = async () => {
    if (!evalModal || completingSessionLock.current || completingSession) return;

    const fromNum = evaluation.fromAyah ? Number(evaluation.fromAyah) : null;
    const toNum = evaluation.toAyah ? Number(evaluation.toAyah) : null;
    if (fromNum !== null && toNum !== null && toNum < fromNum) {
      const msg = valDict.ayahOrderInvalid || 'يجب أن تكون آية النهاية أكبر من أو تساوي آية البداية';
      setEvalAyahError(msg);
      return;
    }
    setEvalAyahError('');

    completingSessionLock.current = true;
    setCompletingSession(true);
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
          ...(evalModal.type === 'trial' ? {
            recommendedLevel: evaluation.recommendedLevel || 'beginner',
            recommendedTrack: evaluation.recommendedTrack || 'memorization',
          } : {}),
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
        toast.info(toastsDict.reportPartialError || 'تم إنهاء الحصة، لكن تعذر إرسال تقرير المتابعة الخارجي. التقرير محفوظ داخل الحصة.');
      }

      const earnedAmount = Number(completed?.session?.earnings?.amount || expectedSessionEarning);
      if (evalModal.type === 'trial' && evaluation.trialRequestId) {
        await api.put(`/api/trials/${evaluation.trialRequestId}/assess`, {
          level: evaluation.recommendedLevel || 'beginner',
          recommendedTrack: evaluation.recommendedTrack || 'memorization',
          notes: evaluation.overallNotes?.trim() || '',
        }, { auth: true }).catch(() => {
          toast.info(toastsDict.trialAssessWarn || 'تم إنهاء الحصة، وتعذر تحديث توصية المسار المبدئية.');
        });
      }
      toast.success(formatMsg(toastsDict.sessionCompleted || 'تم إنهاء الحصة واعتماد الاستحقاق (+{amount} ج.م)', { amount: earnedAmount }));
      setEvalModal(null);
      load();
    } catch (error) {
      toast.error(error.message || toastsDict.sessionCompleteFailed || 'فشل إكمال الحصة');
    } finally {
      completingSessionLock.current = false;
      setCompletingSession(false);
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
          ? (toastsDict.attendanceAttended || 'تم تسجيل حضور الطالب')
          : status === 'excused'
            ? (toastsDict.attendanceExcused || 'تم تسجيل اعتذار الطالب')
            : (toastsDict.attendanceAbsent || 'تم تسجيل غياب الطالب')
      );
    } catch (error) {
      toast.error(error.message || toastsDict.attendanceFailed || 'فشل تحديث الحضور');
    } finally {
      setAttendanceUpdating('');
    }
  };

  const completeGroupSession = (session) => {
    if (!session?._id) return;

    const unresolved = (session.attendance || []).filter(
      (entry) => ['pending', 'confirmed'].includes(entry.status)
    );
    if (unresolved.length) {
      toast.info(toastsDict.completeGroupUnresolved || 'سجل الحضور النهائي لكل الطلاب من قائمة الحضور داخل الحصة قبل الإنهاء');
      return;
    }

    setGroupCompleteModal(session);
  };

  const assignTask = async () => {
    if (assignTaskLock.current || assigningTask) return;
    if (!newTask.title?.trim()) return toast.error(valDict.taskTitleRequired || 'اكتب عنوان الواجب');
    if (taskTargetMode === 'student' && !newTask.studentId) return toast.error(valDict.taskStudentRequired || 'اختر الطالب');
    if (taskTargetMode === 'circle' && !taskCircleId) return toast.error(valDict.taskCircleRequired || 'اختر الحلقة الجماعية');

    assignTaskLock.current = true;
    setAssigningTask(true);
    try {
      const payload = {
        type: newTask.type,
        title: newTask.title.trim(),
        description: newTask.description?.trim() || '',
        dueDate: newTask.dueDate || undefined,
        ...(taskTargetMode === 'circle'
          ? { circleId: taskCircleId }
          : { studentId: newTask.studentId }),
      };
      const res = await api.post('/api/teachers/dashboard/tasks', payload, { auth: true });
      toast.success(
        taskTargetMode === 'circle'
          ? formatMsg(toastsDict.taskAssignedCircle || 'تم إسناد الواجب لجميع طلاب الحلقة ({count})', { count: res.count || 0 })
          : (toastsDict.taskAssignedStudent || 'تم إسناد الواجب وإشعار الطالب')
      );
      setTaskModal(false);
      setNewTask({ studentId: '', type: 'memorization', title: '', description: '', dueDate: '' });
      setTaskCircleId('');
      load();
    } catch (error) {
      toast.error(error.message || toastsDict.taskAssignFailed || 'فشل إسناد الواجب');
    } finally {
      assignTaskLock.current = false;
      setAssigningTask(false);
    }
  };

  const assignAiTask = async (assignment) => {
    if (assigningAiId) return;
    if (!aiTargetId) {
      return toast.error(
        aiTargetMode === 'circle'
          ? (valDict.aiTargetCircleRequired || 'اختر الحلقة أولاً')
          : (valDict.aiTargetStudentRequired || 'اختر الطالب أولاً')
      );
    }
    setAssigningAiId(assignment.id || assignment.title);
    try {
      const payload = {
        type: 'memorization',
        title: String(assignment.title || tp.homework?.newTaskBtn || 'واجب قرآني').slice(0, 180),
        description: String(assignment.description || '').slice(0, 1500),
        ...(aiTargetMode === 'circle'
          ? { circleId: aiTargetId }
          : { studentId: aiTargetId }),
      };
      await api.post('/api/teachers/dashboard/tasks', payload, { auth: true });
      toast.success(toastsDict.aiTaskAssigned || 'تم إسناد الواجب المقترح بنجاح');
      syncTasksAndStudents();
    } catch (error) {
      toast.error(error.message || toastsDict.aiTaskFailed || 'تعذر إسناد الواجب');
    } finally {
      setAssigningAiId('');
    }
  };

  const requestWithdraw = async (e) => {
    e.preventDefault();
    if (withdrawLock.current || withdrawing) return;

    if (withdrawForm.payoutMethod === 'instapay' && !withdrawForm.ipaAddress.trim() && !withdrawForm.phone.trim()) {
      const msg = valDict.instapayContactRequired || 'أدخل عنوان InstaPay IPA أو رقم الهاتف المرتبط';
      setWithdrawError(msg);
      return;
    }
    setWithdrawError('');

    withdrawLock.current = true;
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

      toast.success(toastsDict.withdrawSuccess || 'تم إرسال طلب السحب للإدارة');
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
      toast.error(err.message || toastsDict.withdrawFailed || 'فشل طلب السحب');
    } finally {
      withdrawLock.current = false;
      setWithdrawing(false);
    }
  };

  const reviewTask = async (task, action) => {
    if (reviewingTaskId) return;
    setReviewingTaskId(task._id);
    try {
      const audioDraft = taskFeedbackAudio[task._id];
      const prepared = audioDraft?.blob ? await prepareTeacherFeedbackAudio(audioDraft) : null;

      await api.patch(`/api/teachers/dashboard/tasks/${task._id}`, {
        action,
        teacherFeedback: taskReview[task._id] || '',
        ...(prepared?.mode === 'direct' ? { feedbackAudio: prepared.feedbackAudio } : {}),
      }, { auth: true });

      if (prepared?.mode === 'multipart') {
        await uploadTeacherFeedbackMultipart(task._id, prepared);
      }

      if (audioDraft?.url) URL.revokeObjectURL(audioDraft.url);
      setTaskFeedbackAudio((current) => {
        const next = { ...current };
        delete next[task._id];
        return next;
      });
      toast.success(
        action === 'approve'
          ? (toastsDict.taskApproved || 'تم اعتماد الواجب وإشعار الطالب')
          : (toastsDict.taskRevisionRequested || 'تم طلب إعادة الواجب وإشعار الطالب')
      );
      setTaskReview((current) => ({ ...current, [task._id]: '' }));
      if (homeworkAudio.url) URL.revokeObjectURL(homeworkAudio.url);
      setHomeworkAudio({ taskId: '', url: '', loading: false });
      load();
    } catch (error) {
      toast.error(error.message || toastsDict.taskReviewFailed || 'تعذر مراجعة الواجب');
    } finally {
      setReviewingTaskId('');
    }
  };

  const playHomeworkSubmission = async (task) => {
    if (!task.submissionFile) return toast.error(toastsDict.noSubmissionFile || 'لا يوجد ملف تسليم لهذا الواجب');
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
      toast.error(error.message || toastsDict.audioPlayFailed || 'تعذر تشغيل تسجيل الطالب');
    }
  };

  const openStudent = async (student) => {
    if (!student?._id) {
      toast.info(toastsDict.studentInfoUnavailable || 'بيانات الطالب غير متوفرة');
      return;
    }
    setStudentModal(student);
    setStudentSummary(null);
    setStudentSummaryError(false);
    setStudentSummaryLoading(true);
    try {
      const result = await api.get(`/api/teachers/dashboard/students/${student._id}/summary`, { auth: true });
      setStudentSummary(result);
    } catch (error) {
      setStudentSummaryError(true);
      toast.error(error.message || toastsDict.studentLoadFailed || 'تعذر تحميل ملف الطالب');
    } finally {
      setStudentSummaryLoading(false);
    }
  };

  const enterAcademyRoom = async (session) => {
    if (!session?._id || enteringRoomLock.current) return;
    enteringRoomLock.current = true;
    setEnteringRoomId(String(session._id));
    try {
      const isGroupCircle = session.type === 'group_circle';
      const room = await api.post('/api/live/sessions', {
        title: isGroupCircle
          ? (session.circle?.name || tp.circles?.liveTitleGroup || 'حلقة جماعية')
          : formatMsg(tp.circles?.liveTitleStudent || 'حلقة {name}', {
              name: session.student?.name || tp.welcome?.studentFallback || 'الطالب',
            }),
        description: isGroupCircle
          ? (tp.circles?.liveDescGroup || 'حلقة جماعية عبر غرفة الأكاديمية')
          : (tp.circles?.liveDescStudent || 'حلقة فردية عبر غرفة الأكاديمية'),
        subject: 'quran',
        sessionId: session._id,
      }, { auth: true });
      navigate(lp(`/live/${room.roomId}`));
    } catch (error) {
      toast.error(error.message || toastsDict.roomOpenFailed || 'تعذر فتح غرفة الأكاديمية');
    } finally {
      enteringRoomLock.current = false;
      setEnteringRoomId('');
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

  const toggleUpdateCircleStudents = (circle) => {
    const ids = (circle?.students || []).map((st) => String(st?._id || st)).filter(Boolean);
    if (!ids.length) return;
    setUpdateForm((current) => {
      const allIncluded = ids.every((id) => current.studentIds.includes(id));
      if (allIncluded) {
        return {
          ...current,
          studentIds: current.studentIds.filter((id) => !ids.includes(id)),
        };
      }
      return {
        ...current,
        studentIds: [...new Set([...current.studentIds, ...ids])],
      };
    });
  };

  const publishTeacherUpdate = async (event) => {
    event.preventDefault();
    if (publishingUpdate) return;

    if (!updateForm.title.trim()) return toast.error(valDict.updateTitleRequired || 'اكتب عنوان الرسالة');
    if (!updateForm.message.trim() && !updateForm.files.length) {
      return toast.error(valDict.updateContentRequired || 'اكتب نص الرسالة أو أرفق فيديو');
    }
    if (updateForm.files.length > 5) return toast.error(valDict.updateMaxVideos || 'الحد الأقصى 5 فيديوهات في الرسالة الواحدة');
    if (updateForm.audienceMode === 'selected' && !updateForm.studentIds.length) {
      return toast.error(valDict.updateStudentRequired || 'اختر طالبًا واحدًا على الأقل');
    }

    setPublishingUpdate(true);
    try {
      const uploaded = [];
      for (const file of updateForm.files) {
        const result = await uploadFileDirect(file, 'teacher-update-video');
        uploaded.push({
          reference: result.url,
          name: result.name,
          size: result.size,
          contentType: result.contentType,
        });
      }

      await api.post('/api/teacher-updates/teacher', {
        title: updateForm.title.trim(),
        message: updateForm.message.trim(),
        audienceMode: updateForm.audienceMode,
        studentIds: updateForm.studentIds,
        videos: uploaded,
      }, { auth: true });

      toast.success(toastsDict.updatePublished || 'تم نشر الرسالة وإشعار الطلاب');
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
      toast.error(error.message || toastsDict.updatePublishFailed || 'تعذر نشر الرسالة');
    } finally {
      setPublishingUpdate(false);
    }
  };

  const confirmDeleteTeacherUpdate = async () => {
    if (!deleteUpdateModal?._id || deletingUpdate) return;
    setDeletingUpdate(true);
    try {
      await api.delete(`/api/teacher-updates/teacher/${deleteUpdateModal._id}`, { auth: true });
      setTeacherUpdates((current) => current.filter((item) => item._id !== deleteUpdateModal._id));
      toast.success(toastsDict.updateDeleted || 'تم حذف الرسالة');
      setDeleteUpdateModal(null);
    } catch (error) {
      toast.error(error.message || toastsDict.updateDeleteFailed || 'تعذر حذف الرسالة');
    } finally {
      setDeletingUpdate(false);
    }
  };

  const loadTeacherUpdateVideo = async (updateId, index) => {
    const key = `${updateId}-${index}`;
    if (updateVideoUrls[key] || loadingVideoLock.current.has(key)) return;

    loadingVideoLock.current.add(key);
    setLoadingVideoKey(key);
    try {
      const result = await api.post(`/api/teacher-updates/${updateId}/videos/${index}/access`, {}, { auth: true });
      setUpdateVideoUrls((current) => ({
        ...current,
        [key]: apiUrl(result.streamUrl),
      }));
    } catch (error) {
      toast.error(error.message || toastsDict.videoOpenFailed || 'تعذر فتح الفيديو');
    } finally {
      loadingVideoLock.current.delete(key);
      setLoadingVideoKey('');
    }
  };

  const generateAiHomework = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post(
        '/api/ai/homework-generate',
        { topic: aiTopic || tp.evalCriteria?.tajweed || 'التجويد', level: 'intermediate', count: 5, locale },
        { auth: true }
      );
      setAiResult(res);
      toast.success(toastsDict.aiGenerated || 'تم توليد الواجبات');
    } catch (e) {
      toast.error(e.message || toastsDict.aiFailed || 'تعذر توليد الواجبات حاليًا');
    } finally {
      setAiLoading(false);
    }
  };

  const saveSchedule = async () => {
    if (savingSchedule) return;
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
      toast.success(toastsDict.scheduleSaved || 'تم حفظ أوقات التوفر');
    } catch (error) {
      toast.error(error.message || toastsDict.scheduleSaveFailed || 'فشل حفظ الجدول');
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

  const tabsDict = tp.tabs || {};
  const tabDescs = tabsDict.descriptions || {};
  const primaryNavItems = [
    { id: 'overview', label: tabsDict.overview || 'الرئيسية', icon: Sparkles },
    { id: 'requests', label: tabsDict.requests || 'الطلبات', icon: ClipboardList, badge: trials.length + pendingRegular.length },
    { id: 'sessions', label: tabsDict.sessions || 'حصصي', icon: Calendar, badge: sessions.length },
    { id: 'students', label: tabsDict.students || 'طلابي', icon: Users, badge: activeStudents.length },
    { id: 'homework', label: tabsDict.homework || 'الواجبات', icon: BookOpen, badge: tasks.filter((task) => task.status === 'submitted').length },
  ];

  const secondaryNavItems = [
    { id: 'updates', label: tabsDict.updates || 'رسائل لطلابي', icon: Megaphone, description: tabDescs.updates || 'فيديوهات ورسائل تعليمية لطلابك' },
    { id: 'schedule', label: tabsDict.schedule || 'الجدول', icon: CalendarDays, description: tabDescs.schedule || 'أوقات التوفر الأسبوعية' },
    { id: 'wallet', label: tabsDict.wallet || 'المحفظة', icon: Wallet, description: tabDescs.wallet || 'الرصيد والسحب والمعاملات' },
    { id: 'analytics', label: tabsDict.analytics || 'الأداء', icon: BarChart3, description: tabDescs.analytics || 'الحصص والتحويل والواجبات' },
    { id: 'reviews', label: tabsDict.reviews || 'التقييمات', icon: Star, description: tabDescs.reviews || 'آراء الطلاب ومتوسط التقييم' },
    { id: 'account', label: tabsDict.account || 'ملفي العام', icon: UserRound, description: tabDescs.account || 'صورتي وبياناتي وطلب تعديل الملف' },
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
  const usdBalance = finance?.balances?.USD || { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 };

  const wl = tp.welcome || {};
  const ov = tp.overview || {};
  const rq = tp.requests || {};
  const ss = tp.sessions || {};
  const att = tp.attendance || {};
  const st = tp.students || {};
  const up = tp.updates || {};
  const rv = tp.reviews || {};
  const mod = tp.modals || {};
  const currencyEgp = ov.currencyEgp || 'ج.م';
  const teacherDisplayName = teacher?.personalInfo?.fullName || user?.name || wl.tutorFallback || 'معلمنا';

  return (
    <DashboardLayout title={tp.dashboardTitle || 'لوحة تحكم المعلم'} user={user} onLogout={logout}>
      {loading ? (
        <div className="space-y-4 py-6" role="status" aria-live="polite">
          <span className="sr-only">{tp.loadingSr || 'جاري تحميل لوحة المعلم…'}</span>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {loadError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-text-danger)]"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{errDict.dashboardLoadFailed || 'تعذر تحميل بيانات لوحة المعلم'}</span>
              </div>
              <button
                type="button"
                onClick={load}
                className="wn-btn wn-btn--primary min-h-[44px] text-xs inline-flex items-center gap-1.5"
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>{errDict.retry || 'إعادة المحاولة'}</span>
              </button>
            </div>
          )}

          <section className="wn-teacher-welcome">
            <div className="wn-teacher-welcome__main">
              <div className="flex items-center gap-3 mb-3">
                <TeacherAvatar
                  src={teacher?.media?.profilePhoto}
                  name={teacherDisplayName}
                  alt={teacherDisplayName}
                  size="md"
                  className="w-14 h-14 rounded-full border border-[var(--wn-border-mint)] shrink-0"
                />
                <div>
                  <span className="wn-teacher-welcome__eyebrow">
                    <Sparkles size={15} aria-hidden="true" />
                    {wl.eyebrow || 'مساحة المعلم اليومية'}
                  </span>
                  <h2>{formatMsg(wl.greeting || 'السلام عليكم، {name}', { name: teacherDisplayName })}</h2>
                </div>
              </div>
              <p>
                {nextSession
                  ? formatMsg(wl.subtitleNext || 'حلقتك القادمة مع {student} — كل ما تحتاجه للتحضير والمتابعة أمامك.', {
                      student: nextSession.student?.name || wl.studentFallback || 'الطالب',
                    })
                  : actionCount
                    ? (wl.subtitleActions || 'لديك مهام تحتاج قرارك. ابدأ بمركز الإجراءات ثم راجع جدولك.')
                    : (wl.subtitleCalm || 'يومك هادئ الآن. راجع جدولك أو تابع تقدم طلابك.')}
              </p>

              <div className="wn-teacher-welcome__chips">
                <span className="is-verified"><CheckCircle2 size={14} aria-hidden="true" /> {wl.verifiedChip || 'معلم معتمد'}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 rounded-full ${
                      nextSession
                        ? 'bg-[var(--wn-emerald)] animate-pulse'
                        : (trials.length + pendingRegular.length) > 0
                          ? 'bg-[var(--wn-gold)] animate-pulse'
                          : 'bg-[var(--wn-emerald)]'
                    }`}
                  />
                  {nextSession
                    ? (wl.chipUpcoming || 'حصة مجدولة قادمة')
                    : (trials.length + pendingRegular.length) > 0
                      ? formatMsg(wl.chipPendingRequests || '{count} طلب بانتظارك', { count: trials.length + pendingRegular.length })
                      : (wl.chipAvailable || 'متاح لاستقبال الحجوزات')}
                </span>
                <span>
                  <Users size={14} aria-hidden="true" />{' '}
                  {formatMsg(wl.chipActiveStudents || '{count} طالب نشط', { count: activeStudents.length })}
                </span>
                <span>
                  <Star size={14} aria-hidden="true" />{' '}
                  {formatMsg(wl.chipRating || '{rating} تقييم', { rating: stats.averageRating?.toFixed?.(1) || '0' })}
                </span>
              </div>

              <div className="wn-teacher-welcome__actions">
                {nextSession ? (
                  <button
                    type="button"
                    disabled={enteringRoomId === String(nextSession._id)}
                    onClick={() => enterAcademyRoom(nextSession)}
                    className="wn-teacher-primary-action min-h-[44px]"
                  >
                    {enteringRoomId === String(nextSession._id) ? (
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Video size={17} aria-hidden="true" />
                    )}
                    {wl.enterNextBtn || 'دخول الحصة القادمة'}
                  </button>
                ) : (
                  <button type="button" onClick={() => setTab('schedule')} className="wn-teacher-primary-action min-h-[44px]">
                    <CalendarDays size={17} aria-hidden="true" />
                    {wl.reviewScheduleBtn || 'مراجعة الجدول'}
                  </button>
                )}
                <button type="button" onClick={() => setTab('requests')} className="wn-teacher-secondary-action min-h-[44px]">
                  <ClipboardList size={17} aria-hidden="true" />
                  {wl.requestsCenterBtn || 'مركز الطلبات'}
                  {(trials.length + pendingRegular.length) > 0 ? <b>{trials.length + pendingRegular.length}</b> : null}
                </button>
                <button type="button" onClick={() => setTab('updates')} className="wn-teacher-secondary-action min-h-[44px]">
                  <Megaphone size={17} aria-hidden="true" />
                  {wl.messageStudentsBtn || 'رسالة لطلابي'}
                </button>
                <button type="button" onClick={() => setTab('account')} className="wn-teacher-secondary-action min-h-[44px]">
                  <UserRound size={17} aria-hidden="true" />
                  {wl.publicProfileBtn || 'ملفي العام'}
                  {profileChange?.status === 'pending' ? <b>{wl.reviewBadge || 'مراجعة'}</b> : null}
                </button>
              </div>
            </div>

            <div className="wn-teacher-welcome__next">
              <div className="wn-teacher-welcome__next-heading">
                <span>{nextSession ? (wl.nextCardTitle || 'الحصة القادمة') : (wl.statusCardTitle || 'الحالة الحالية')}</span>
                {nextSession ? <Clock size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
              </div>
              {nextSession ? (
                <>
                  <strong>
                    {nextSession.type === 'group_circle'
                      ? (nextSession.circle?.name || wl.groupCircleFallback || 'حلقة جماعية')
                      : (nextSession.student?.name || wl.studentFallback || 'الطالب')}
                  </strong>
                  <p>{formatSessionDateTime(nextSession, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <p>{formatSessionDateTime(nextSession, locale, { hour: '2-digit', minute: '2-digit' })} · {sessionTimeZone(nextSession, teacher?.availabilityTimezone || 'Africa/Cairo')}</p>
                  <div className="wn-teacher-welcome__next-actions">
                    <button type="button" onClick={() => openSessionChat(nextSession)} className="relative min-h-[44px]">
                      <MessageSquare size={15} aria-hidden="true" /> {wl.chatBtn || 'محادثة'}
                      {unreadChatSessionIds.has(String(nextSession._id)) ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-[var(--wn-danger)]"
                          aria-label={wl.newMessageAria || 'رسالة جديدة'}
                        />
                      ) : null}
                    </button>
                    {nextSession.type === 'group_circle' ? (
                      <button type="button" onClick={() => setTab('sessions')} className="min-h-[44px]">
                        <Users size={15} aria-hidden="true" /> {wl.circleStudentsBtn || 'طلاب الحلقة'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="min-h-[44px]"
                        onClick={() => {
                          if (nextSession.student?._id) {
                            openStudent(nextSession.student);
                          } else {
                            toast.info(toastsDict.studentInfoUnavailable || 'بيانات الطالب غير متوفرة');
                          }
                        }}
                      >
                        <UserRound size={15} aria-hidden="true" /> {wl.studentFileBtn || 'ملف الطالب'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="wn-teacher-welcome__empty">
                  <Calendar size={26} aria-hidden="true" />
                  <strong>{wl.noUpcomingTitle || 'لا توجد حصة قادمة'}</strong>
                  <p>{wl.noUpcomingDesc || 'ستظهر أقرب حصة مؤكدة هنا تلقائيًا.'}</p>
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
              isRTL={isRTL}
              t={t}
            />

            {tab === 'overview' && (
              <div className="wn-teacher-overview">
                <div className="wn-teacher-overview__grid">
                  <section className="wn-teacher-today-card">
                    <div className="wn-teacher-section-heading">
                      <div>
                        <span>{ov.todayEyebrow || 'جدول اليوم'}</span>
                        <h3>{ov.upcomingTitle || 'الحصص القادمة'}</h3>
                      </div>
                      <button type="button" onClick={() => setTab('sessions')} className="min-h-[44px]">
                        {ov.viewAllSessions || 'عرض كل الحصص'}
                      </button>
                    </div>

                    {upcomingSessions.length === 0 ? (
                      <EmptyState
                        icon={Calendar}
                        title={ov.noUpcomingTitle || 'لا توجد حصص قادمة حاليًا'}
                        description={ov.noUpcomingDesc || 'راجع التوفر الأسبوعي أو الطلبات الجديدة.'}
                      />
                    ) : (
                      <div className="wn-teacher-agenda">
                        {upcomingSessions.slice(0, 3).map((session, index) => (
                          <div key={session._id} className={'wn-teacher-agenda__item ' + (index === 0 ? 'is-next' : '')}>
                            <div className="wn-teacher-agenda__time">
                              <strong>{formatSessionDateTime(session, locale, { hour: '2-digit', minute: '2-digit' })}</strong>
                              <small>{formatSessionDateTime(session, locale, { day: 'numeric', month: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                            </div>
                            <div className="wn-teacher-agenda__student">
                              <strong>
                                {session.type === 'group_circle'
                                  ? (session.circle?.name || wl.groupCircleFallback || 'حلقة جماعية')
                                  : (session.student?.name || rq.studentFallback || 'طالب')}
                              </strong>
                              <span>
                                {session.type === 'trial'
                                  ? (ov.sessionTrial || 'حصة تجريبية')
                                  : session.type === 'group_circle'
                                    ? (ov.sessionGroup || 'حصة جماعية')
                                    : (ov.sessionIndividual || 'حصة فردية')}
                              </span>
                            </div>
                            <div className="wn-teacher-agenda__actions">
                              <button
                                type="button"
                                onClick={() => openSessionChat(session)}
                                aria-label={ov.chatAria || 'محادثة'}
                                className="relative min-h-[44px]"
                              >
                                <MessageSquare size={16} aria-hidden="true" />
                                {unreadChatSessionIds.has(String(session._id)) ? (
                                  <span
                                    aria-hidden="true"
                                    className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-[var(--wn-danger)]"
                                  />
                                ) : null}
                              </button>
                              <button
                                type="button"
                                disabled={enteringRoomId === String(session._id)}
                                onClick={() => enterAcademyRoom(session)}
                                className="is-primary min-h-[44px]"
                              >
                                {enteringRoomId === String(session._id) ? (
                                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Video size={16} aria-hidden="true" />
                                )}
                                {ov.enterBtn || 'دخول'}
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
                        <span>{ov.actionEyebrow || 'يحتاج إجراء'}</span>
                        <h3>{ov.actionTitle || 'مركز الإجراءات'}</h3>
                      </div>
                      {actionCount > 0 ? <b>{actionCount}</b> : null}
                    </div>

                    <div className="wn-teacher-action-list">
                      <button type="button" onClick={() => setTab('requests')} className="min-h-[44px]">
                        <span className="wn-teacher-action-icon is-amber"><ClipboardList size={18} aria-hidden="true" /></span>
                        <span><strong>{ov.newRequestsTitle || 'طلبات جديدة'}</strong><small>{ov.newRequestsDesc || 'تجريبية ومنتظمة تحتاج ردك'}</small></span>
                        <b>{trials.length + pendingRegular.length}</b>
                      </button>
                      <button type="button" onClick={() => setTab('homework')} className="min-h-[44px]">
                        <span className="wn-teacher-action-icon is-blue"><Headphones size={18} aria-hidden="true" /></span>
                        <span><strong>{ov.homeworkReviewTitle || 'واجبات للتصحيح'}</strong><small>{ov.homeworkReviewDesc || 'تسجيلات الطلاب المُسلّمة'}</small></span>
                        <b>{submittedTasks.length}</b>
                      </button>
                      <button type="button" onClick={() => setTab('sessions')} className="min-h-[44px]">
                        <span className="wn-teacher-action-icon is-emerald"><CheckCircle2 size={18} aria-hidden="true" /></span>
                        <span><strong>{ov.awaitingCloseTitle || 'حصص تحتاج إغلاق'}</strong><small>{ov.awaitingCloseDesc || 'انتهى موعدها ولم تُعتمد بعد'}</small></span>
                        <b>{awaitingCompletion.length}</b>
                      </button>
                    </div>
                  </aside>
                </div>

                <div className="wn-teacher-stat-grid">
                  <StatCard
                    label={ov.statAvailableBalance || 'الرصيد المتاح'}
                    value={(usdBalance.available || 0) > 0
                      ? `${egpBalance.available || 0} ${currencyEgp} / $${usdBalance.available}`
                      : `${egpBalance.available || 0} ${currencyEgp}`}
                    icon={Wallet}
                  />
                  <StatCard label={ov.statCompletedSessions || 'حصص مكتملة'} value={stats.totalSessions || 0} icon={Calendar} />
                  <StatCard label={ov.statActiveStudents || 'طلاب نشطون'} value={activeStudents.length} icon={Users} />
                  <StatCard label={ov.statAverageRating || 'متوسط التقييم'} value={stats.averageRating?.toFixed?.(1) || '0'} icon={Star} />
                </div>

                <div className="wn-teacher-overview__lower">
                  <section className="wn-teacher-students-preview">
                    <div className="wn-teacher-section-heading">
                      <div>
                        <span>{ov.studentsEyebrow || 'طلابك'}</span>
                        <h3>{ov.studentsTitle || 'متابعة سريعة'}</h3>
                      </div>
                      <button type="button" onClick={() => setTab('students')} className="min-h-[44px]">
                        {ov.allStudentsBtn || 'كل الطلاب'}
                      </button>
                    </div>
                    {activeStudents.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title={ov.noStudentsTitle || 'لا يوجد طلاب نشطون بعد'}
                        description={ov.noStudentsDesc || 'سيظهر الطلاب بعد قبول أول حصة منتظمة.'}
                      />
                    ) : (
                      <div className="wn-teacher-student-preview-list">
                        {activeStudents.slice(0, 4).map((student) => (
                          <button type="button" key={student._id} onClick={() => openStudent(student)} className="min-h-[44px]">
                            <span className="wn-teacher-avatar">{(student.name || 'ط').slice(0, 1)}</span>
                            <span>
                              <strong>{student.name}</strong>
                              <small>
                                {student.nextSession
                                  ? formatMsg(ov.nextPrefix || 'القادمة {date}', {
                                      date: new Date(student.nextSession.scheduledAt).toLocaleDateString(intlLocale),
                                    })
                                  : (ov.noNextDate || 'لا موعد قادم')}
                              </small>
                            </span>
                            <ForwardChevron size={16} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="wn-teacher-performance-preview">
                    <span>{ov.thisMonthEyebrow || 'هذا الشهر'}</span>
                    <h3>{ov.performanceTitle || 'لوحة الأداء'}</h3>
                    <div className="wn-teacher-performance-preview__metrics">
                      <div><strong>{analytics?.trialConversion?.rate ?? '—'}%</strong><small>{ov.trialConversion || 'تحويل التجريبية'}</small></div>
                      <div><strong>{analytics?.homework?.completionRate ?? '—'}%</strong><small>{ov.homeworkCompletion || 'إكمال الواجبات'}</small></div>
                      <div><strong>{analytics?.upcomingSevenDays ?? upcomingSessions.length}</strong><small>{ov.nextWeek || 'الأسبوع القادم'}</small></div>
                    </div>
                    <button type="button" onClick={() => setTab('analytics')} className="min-h-[44px]">
                      {ov.viewAnalyticsBtn || 'عرض تحليلات الأداء'} <TrendingUp size={15} aria-hidden="true" />
                    </button>
                  </section>
                </div>
              </div>
            )}

            {tab === 'account' && teacher && (
              <TeacherProfileTab
                teacher={teacher}
                user={user}
                statusLabel={statusLabel}
                profileChange={profileChange}
                profileEdit={profileEdit}
                setProfileEdit={setProfileEdit}
                profileFiles={profileFiles}
                setProfileFiles={setProfileFiles}
                savingProfileChange={savingProfileChange}
                submitProfileChange={submitProfileChange}
                onOpenAi={() => setAiModal(true)}
                locale={locale}
                t={t}
              />
            )}

            {tab === 'wallet' && (
              <TeacherWalletPanel
                egpBalance={egpBalance}
                usdBalance={usdBalance}
                finance={finance}
                withdrawForm={withdrawForm}
                setWithdrawForm={setWithdrawForm}
                withdrawError={withdrawError}
                setWithdrawError={setWithdrawError}
                requestWithdraw={requestWithdraw}
                withdrawing={withdrawing}
                transactions={transactions}
                financeStatusLabel={financeStatusLabel}
                locale={locale}
                t={t}
              />
            )}

            {tab === 'schedule' && (
              <TeacherSchedulePanel
                schedule={schedule}
                savingSchedule={savingSchedule}
                saveSchedule={saveSchedule}
                addScheduleSlot={addScheduleSlot}
                updateScheduleSlot={updateScheduleSlot}
                removeScheduleSlot={removeScheduleSlot}
                t={t}
              />
            )}

            {tab === 'analytics' && (
              <TeacherAnalyticsPanel
                analytics={analytics}
                analyticsLoading={analyticsLoading}
                analyticsError={analyticsError}
                onRetry={fetchAnalytics}
                onOpenWallet={() => setTab('wallet')}
                isRTL={isRTL}
                t={t}
              />
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--wn-text-secondary)] flex items-center gap-2">
                  <MessageSquare size={16} aria-hidden="true" />
                  <span>{rv.avgLabel || 'متوسط التقييم:'}</span>
                  <strong>{reviewsData.averageRating?.toFixed?.(1) || '0'}</strong>
                  <span>({formatMsg(rv.reviewsCount || '{count} تقييم', { count: reviewsData.totalReviews || 0 })})</span>
                </p>
                {reviewsError && !reviewsData.reviews.length ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-5 text-center space-y-3"
                  >
                    <p className="text-sm font-semibold text-[var(--wn-text-danger)]">
                      {rv.errorTitle || 'تعذر تحميل تقييمات الطلاب'}
                    </p>
                    <button
                      type="button"
                      onClick={fetchReviews}
                      className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      <span>{rv.retryBtn || 'إعادة المحاولة'}</span>
                    </button>
                  </div>
                ) : reviewsLoading && !reviewsData.reviews.length ? (
                  <div className="space-y-3" role="status" aria-live="polite">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </div>
                ) : reviewsData.reviews.length === 0 ? (
                  <EmptyState icon={Star} title={rv.empty || 'لا تقييمات بعد'} />
                ) : reviewsData.reviews.map((r) => (
                  <div key={r._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-sm text-[var(--wn-heading)]">{r.student?.name || rv.studentFallback || 'طالب'}</p>
                      <div className="flex gap-0.5" aria-label={`${r.rating}/5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            aria-hidden="true"
                            className={i < r.rating ? 'text-[var(--wn-gold)] fill-[var(--wn-gold)]' : 'text-[var(--wn-border-strong)]'}
                          />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-[var(--wn-text-secondary)] mt-2">{r.comment}</p>}
                    <p className="text-xs text-[var(--wn-text-tertiary)] mt-1">{new Date(r.createdAt).toLocaleDateString(intlLocale)}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'requests' && (
              <div className="wn-teacher-requests">
                <div className="wn-teacher-requests__intro">
                  <div>
                    <span>{rq.eyebrow || 'صندوق الطلبات'}</span>
                    <h3>{rq.title || 'طلبات تحتاج قرارك'}</h3>
                    <p>{rq.subtitle || 'اقبل الموعد، اقترح وقتًا آخر، أو اعتذر. الطالب يتلقى القرار فورًا.'}</p>
                  </div>
                  <div className="wn-teacher-request-count">
                    <strong>{trials.length + pendingRegular.length}</strong>
                    <small>{rq.pendingCountLabel || 'طلب معلق'}</small>
                  </div>
                </div>

                {(trials.length + pendingRegular.length) === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title={rq.emptyTitle || 'صندوق الطلبات فارغ'}
                    description={rq.emptyDesc || 'لا توجد طلبات تحتاج ردك الآن.'}
                  />
                ) : (
                  <div className="wn-teacher-request-list">
                    {[
                      ...trials.map((item) => ({ ...item, requestKind: 'trial' })),
                      ...pendingRegular.map((item) => ({ ...item, requestKind: 'regular' })),
                    ]
                      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                      .map((session) => {
                        const isResponding = respondingSessionId === String(session._id);
                        return (
                          <article key={session._id} className="wn-teacher-request-card">
                            <div className="wn-teacher-request-card__date">
                              <strong>{formatSessionDateTime(session, locale, { day: '2-digit' })}</strong>
                              <span>{formatSessionDateTime(session, locale, { month: 'short' })}</span>
                            </div>
                            <div className="wn-teacher-request-card__body">
                              <span className={'wn-teacher-request-kind ' + (session.requestKind === 'trial' ? 'is-trial' : 'is-regular')}>
                                {session.requestKind === 'trial' ? (rq.kindTrial || 'حصة تجريبية') : (rq.kindRegular || 'حصة منتظمة')}
                              </span>
                              {session.rescheduledFrom ? (
                                <span className="ms-1.5 inline-block rounded-full bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)]/40 px-2.5 py-0.5 text-[11px] font-bold text-[var(--wn-badge-gold-text)]">
                                  {rq.awaitingStudentConfirm || 'بانتظار تأكيد الطالب للموعد المقترح'}
                                </span>
                              ) : null}
                              <h4>{session.student?.name || rq.studentFallback || 'طالب'}</h4>
                              <p>
                                <Clock size={14} aria-hidden="true" />{' '}
                                {formatSessionDateTime(session, locale, { hour: '2-digit', minute: '2-digit' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}
                              </p>
                              {session.notes ? <small>{session.notes}</small> : null}
                            </div>
                            <div className="wn-teacher-request-card__actions">
                              <button type="button" onClick={() => openSessionChat(session)} className="is-chat relative min-h-[44px]">
                                <MessageSquare size={16} aria-hidden="true" /> {rq.chatBtn || 'محادثة'}
                                {unreadChatSessionIds.has(String(session._id)) ? (
                                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--wn-danger)]" />
                                ) : null}
                              </button>
                              <button
                                type="button"
                                disabled={isResponding}
                                onClick={() => respondTrial(session._id, 'accept')}
                                className="is-accept min-h-[44px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {isResponding ? (
                                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <CheckCircle2 size={16} aria-hidden="true" />
                                )}
                                {rq.acceptBtn || 'قبول'}
                              </button>
                              <button
                                type="button"
                                disabled={isResponding}
                                onClick={() => { setRescheduleModal(session); setRescheduleDate(''); }}
                                className="is-reschedule min-h-[44px] disabled:opacity-50"
                              >
                                <Clock size={16} aria-hidden="true" /> {rq.rescheduleBtn || 'موعد آخر'}
                              </button>
                              <button
                                type="button"
                                disabled={isResponding}
                                onClick={() => setRejectModal(session)}
                                className="is-reject min-h-[44px] disabled:opacity-50"
                              >
                                <X size={16} aria-hidden="true" /> {rq.rejectBtn || 'اعتذار'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {tab === 'sessions' && (
              <div className="wn-teacher-sessions">
                <div className="wn-teacher-sessions__intro">
                  <div>
                    <span>{ss.eyebrow || 'الحصص المؤكدة'}</span>
                    <h3>{ss.title || 'جدول الحصص'}</h3>
                    <p>{ss.subtitle || 'استخدم غرفة الأكاديمية للحصة، ثم أغلق الحصة وأرسل تقرير المتابعة بعد بدايتها.'}</p>
                  </div>
                  <button type="button" onClick={() => setTab('schedule')} className="wn-teacher-secondary-light min-h-[44px]">
                    <CalendarDays size={16} aria-hidden="true" /> {ss.manageScheduleBtn || 'إدارة التوفر'}
                  </button>
                </div>

                {myCircles.length > 0 && (
                  <section className="mb-6 rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">{ss.circlesEyebrow || 'حلقات الاشتراكات الجماعية'}</span>
                        <h4 className="text-base font-bold text-[var(--wn-heading)]">
                          {formatMsg(ss.circlesTitle || 'حلقاتي الجماعية المسندة إليّ ({count})', { count: myCircles.length })}
                        </h4>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {myCircles.map((circle) => {
                        const canSchedule = ['active', 'full'].includes(circle.status);
                        return (
                          <div key={circle._id} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3.5 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-sm text-[var(--wn-heading)]">{circle.name}</strong>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    canSchedule
                                      ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                                      : 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]'
                                  }`}
                                >
                                  {circle.status === 'active'
                                    ? (ss.circleActive || 'نشطة')
                                    : circle.status === 'full'
                                      ? (ss.circleFull || 'مكتملة العدد')
                                      : (ss.circleForming || 'قيد التكوين')}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                                {formatMsg(ss.circleMeta || 'الطلاب: {current} / {capacity} · المدة: {min}–{max} دقيقة', {
                                  current: circle.currentCount || 0,
                                  capacity: circle.capacity || 10,
                                  min: circle.durationMinMinutes || 30,
                                  max: circle.durationMaxMinutes || 60,
                                })}
                              </p>
                              {(circle.students || []).length > 0 && (
                                <p className="text-xs text-[var(--wn-text-tertiary)] mt-1 truncate">
                                  {circle.students.map((stItem) => stItem.name).filter(Boolean).join('، ')}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!canSchedule}
                              onClick={() => {
                                setCircleSessionModal(circle);
                                setCircleSessionForm({
                                  scheduledAt: '',
                                  duration: Number(circle.durationMaxMinutes || 60),
                                  notes: '',
                                });
                              }}
                              className="btn-primary min-h-[44px] text-xs py-2 disabled:opacity-50"
                            >
                              <Plus size={14} aria-hidden="true" /> {ss.scheduleCircleBtn || 'جدولة حصة للحلقة'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {sessions.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={ss.noConfirmedTitle || 'لا توجد حصص مؤكدة'}
                    description={ss.noConfirmedDesc || 'الحصص التي تقبلها ستظهر هنا.'}
                  />
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
                        const isEntering = enteringRoomId === String(session._id);

                        return (
                          <article key={session._id} className={'wn-teacher-session-card ' + (hasStarted ? 'is-due' : '')}>
                            <div className="wn-teacher-session-card__time">
                              <strong>{formatSessionDateTime(session, locale, { hour: '2-digit', minute: '2-digit' })}</strong>
                              <span>{formatSessionDateTime(session, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                              <small>{sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                            </div>
                            <div className="wn-teacher-session-card__student">
                              <span>
                                {session.type === 'trial'
                                  ? (ss.badgeTrial || 'تجريبية')
                                  : session.type === 'group_circle'
                                    ? (ss.badgeGroup || 'جماعية')
                                    : (ss.badgeIndividual || 'فردية')}
                              </span>
                              <h4>
                                {session.type === 'group_circle'
                                  ? (session.circle?.name || wl.groupCircleFallback || 'حلقة جماعية')
                                  : (session.student?.name || rq.studentFallback || 'طالب')}
                              </h4>
                              {session.type !== 'group_circle' ? (() => {
                                const studentEntry = (session.attendance || []).find(
                                  (entry) => String(entry.student?._id || entry.student || '') === String(session.student?._id || session.student || '')
                                );
                                return (
                                  <div className="space-y-1.5">
                                    <button type="button" onClick={() => openStudent(session.student)} className="min-h-[44px]">
                                      {ss.viewStudentProfileBtn || 'عرض ملف الطالب'}
                                    </button>
                                    {studentEntry?.status === 'confirmed' ? (
                                      <span className="block w-fit rounded-full bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] px-2.5 py-0.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                                        {ss.studentConfirmed || '✓ أكد الطالب الحضور'}
                                      </span>
                                    ) : null}
                                    {studentEntry?.status === 'excused' ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-block rounded-full bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)]/40 px-2.5 py-0.5 text-xs font-bold text-[var(--wn-badge-gold-text)]">
                                          {ss.studentExcused || 'اعتذر الطالب مسبقًا'}
                                        </span>
                                        {studentEntry.excuseReason ? (
                                          <p className="text-xs text-[var(--wn-text-secondary)]">
                                            {formatMsg(ss.excuseReason || 'السبب: {reason}', { reason: studentEntry.excuseReason })}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })() : (
                                <div className="mt-2 space-y-2">
                                  <small>
                                    {formatMsg(ss.groupMeta || '{count} طالب · {duration} دقيقة', {
                                      count: session.attendance?.length || 0,
                                      duration: session.duration || 60,
                                    })}
                                  </small>
                                  {!hasStarted ? (
                                    <p className="text-xs font-semibold text-[var(--wn-text-secondary)]">
                                      {ss.attendanceOpensOnStart || 'تسجيل الحضور يفتح عند بداية موعد الحلقة.'}
                                    </p>
                                  ) : null}
                                  <div className="space-y-1.5">
                                    {(session.attendance || []).map((entry) => {
                                      const studentId = entry.student?._id || entry.student;
                                      const studentName = entry.student?.name || rq.studentFallback || 'طالب';
                                      const isEligibleExcuse = entry.status === 'excused' && entry.eligibleForCompensation;
                                      const isUpdating = attendanceUpdating === session._id + ':' + studentId;
                                      return (
                                        <div
                                          key={studentId}
                                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-2 text-xs"
                                        >
                                          <strong className="min-w-[90px] text-[var(--wn-heading)]">{studentName}</strong>
                                          {isEligibleExcuse ? (
                                            <>
                                              <span className="rounded-full bg-[var(--wn-surface-mint)] px-2 py-1 font-semibold text-[var(--wn-badge-emerald-text)]">
                                                {att.excusedExempt || 'معتذر — لا تخصم'}
                                              </span>
                                              <button
                                                type="button"
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'attended')}
                                                className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--wn-emerald-soft)] px-3 py-1 font-bold text-[var(--wn-badge-emerald-text)] disabled:opacity-50"
                                              >
                                                {att.markAttendedActual || 'حضر فعليًا'}
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                aria-pressed={entry.status === 'attended'}
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'attended')}
                                                className={
                                                  'min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 py-1 font-bold disabled:opacity-50 ' +
                                                  (entry.status === 'attended'
                                                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                                                    : 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]')
                                                }
                                              >
                                                {att.markAttended || 'حضر'}
                                              </button>
                                              <button
                                                type="button"
                                                aria-pressed={entry.status === 'absent'}
                                                disabled={isUpdating || !hasStarted}
                                                onClick={() => updateGroupAttendance(session, studentId, 'absent')}
                                                className={
                                                  'min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 py-1 font-bold disabled:opacity-50 ' +
                                                  (entry.status === 'absent'
                                                    ? 'bg-[var(--wn-danger)] text-[var(--wn-white)]'
                                                    : 'bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]')
                                                }
                                              >
                                                {att.markAbsent || 'غاب'}
                                              </button>
                                            </>
                                          )}
                                          {entry.status === 'excused' && !entry.eligibleForCompensation ? (
                                            <span className="rounded-full bg-[var(--wn-gold-soft)] px-2 py-1 font-semibold text-[var(--wn-badge-gold-text)]">
                                              {att.excusedLate || 'اعتذار متأخر — تخصم'}
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
                              <button type="button" onClick={() => openSessionChat(session)} className="relative min-h-[44px]">
                                <MessageSquare size={16} aria-hidden="true" /> {ss.chatBtn || 'محادثة'}
                                {unreadChatSessionIds.has(String(session._id)) ? (
                                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--wn-danger)]" />
                                ) : null}
                              </button>
                              {canJoinRoom ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isEntering}
                                    onClick={() => enterAcademyRoom(session)}
                                    className="is-room min-h-[44px]"
                                  >
                                    {isEntering ? (
                                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                    ) : (
                                      <Video size={16} aria-hidden="true" />
                                    )}
                                    {ss.academyRoomBtn || 'غرفة الأكاديمية'}
                                  </button>
                                  <Link to={lp(`/meeting/${session._id}`)} className="is-translate min-h-[44px]">
                                    {ss.liveTranslateBtn || 'ترجمة مباشرة'}
                                  </Link>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-[var(--wn-text-secondary)] px-2">
                                  {joinWindow.phase === 'early'
                                    ? (ss.roomOpensEarly || 'الغرفة تفتح قبل الموعد بـ 30 دقيقة')
                                    : (ss.roomWindowEnded || 'انتهى وقت الدخول — أغلق الحصة وأرسل التقرير')}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => session.type === 'group_circle' ? completeGroupSession(session) : openEval(session)}
                                disabled={!canComplete}
                                className="is-complete min-h-[44px]"
                                title={!canComplete ? (ss.completeDisabledTitle || 'يمكن إنهاء الحصة بعد بدء موعدها حسب توقيت السيرفر فقط') : undefined}
                              >
                                <CheckCircle2 size={16} aria-hidden="true" />{' '}
                                {session.type === 'group_circle'
                                  ? (ss.completeGroupBtn || 'إنهاء الحصة الجماعية')
                                  : (ss.completeReportBtn || 'إنهاء + تقرير')}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}

                <section className="mt-8 border-t border-[var(--wn-border)] pt-6">
                  <div className="wn-teacher-section-heading">
                    <div>
                      <span>{ss.historyEyebrow || 'السجل'}</span>
                      <h3>{ss.historyTitle || 'الحصص المكتملة وتقاريرها'}</h3>
                    </div>
                    <strong>{completedSessions.length}</strong>
                  </div>

                  {completedSessions.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle2}
                      title={ss.noCompletedTitle || 'لا توجد حصص مكتملة بعد'}
                      description={ss.noCompletedDesc || 'بعد إنهاء أي حصة سيظهر تقريرها هنا.'}
                    />
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
                        const evalCriteria = ss.evalCriteria || {};

                        return (
                          <article key={session._id} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                                  {session.type === 'trial'
                                    ? (ov.sessionTrial || 'حصة تجريبية')
                                    : session.type === 'group_circle'
                                      ? (ov.sessionGroup || 'حصة جماعية')
                                      : (ss.historyRegular || 'حصة منتظمة')}
                                </span>
                                <h4 className="font-bold text-[var(--wn-heading)]">
                                  {session.type === 'group_circle'
                                    ? (session.circle?.name || wl.groupCircleFallback || 'حلقة جماعية')
                                    : (session.student?.name || rq.studentFallback || 'طالب')}
                                </h4>
                                <p className="text-xs text-[var(--wn-text-secondary)]">
                                  {formatSessionDateTime(session, locale, { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}
                                </p>
                              </div>
                              <button type="button" onClick={() => openSessionChat(session)} className="wn-teacher-secondary-light relative min-h-[44px]">
                                <MessageSquare size={15} aria-hidden="true" /> {ss.chatSessionBtn || 'محادثة الحصة'}
                                {unreadChatSessionIds.has(String(session._id)) ? (
                                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--wn-danger)]" />
                                ) : null}
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                              {[
                                ['attendance', evalCriteria.attendance || 'الحضور'],
                                ['memorization', evalCriteria.memorization || 'الحفظ'],
                                ['tajweed', evalCriteria.tajweed || 'التجويد'],
                                ['behavior', evalCriteria.behavior || 'السلوك'],
                                ['commitment', evalCriteria.commitment || 'الالتزام'],
                              ].map(([key, label]) => (
                                <div key={key} className="rounded-lg bg-[var(--wn-surface-soft)] p-2 text-center">
                                  <span className="block text-[var(--wn-text-secondary)]">{label}</span>
                                  <strong className="text-[var(--wn-heading)]">{ev[key] ?? '—'}/5</strong>
                                </div>
                              ))}
                            </div>

                            {(surah || fromAyah || toAyah || nextHomework || notes) ? (
                              <div className="mt-3 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-3 text-sm text-[var(--wn-text-primary)]">
                                {surah ? <p><strong>{ss.surahLabel || 'السورة / المقطع:'}</strong> {surah}</p> : null}
                                {(fromAyah || toAyah) ? (
                                  <p>
                                    <strong>{ss.ayahsLabel || 'الآيات:'}</strong> {fromAyah || '—'} {ss.toAyah || 'إلى'} {toAyah || '—'}
                                  </p>
                                ) : null}
                                {nextHomework ? <p><strong>{ss.nextHomeworkLabel || 'الهدف / الواجب القادم:'}</strong> {nextHomework}</p> : null}
                                {notes ? <p><strong>{ss.notesLabel || 'الملاحظات:'}</strong> {notes}</p> : null}
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
                    <span>{st.eyebrow || 'ملفات الطلاب'}</span>
                    <h3>{st.title || 'طلابي'}</h3>
                    <p>{st.subtitle || 'متابعة الطالب لا تتوقف عند الحجز: الحصص، الواجبات، آخر تقدم، والموعد القادم في مكان واحد.'}</p>
                  </div>
                  <strong>{activeStudents.length}</strong>
                </div>

                {activeStudents.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={st.emptyTitle || 'لا يوجد طلاب نشطون بعد'}
                    description={st.emptyDesc || 'بعد قبول أول حصة منتظمة سيظهر الطالب هنا تلقائيًا.'}
                  />
                ) : (
                  <div className="wn-teacher-student-grid">
                    {activeStudents.map((student) => (
                      <article key={student._id} className="wn-teacher-student-card">
                        <div className="wn-teacher-student-card__top">
                          <span className="wn-teacher-avatar large">{(student.name || 'ط').slice(0, 1)}</span>
                          <div>
                            <h4>{student.name}</h4>
                            <p>{formatMsg(st.completedCount || '{count} حصة مكتملة', { count: student.completedSessions || 0 })}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(student.circles || []).length > 0 ? (
                                student.circles.map((circle) => (
                                  <span
                                    key={circle._id}
                                    className="inline-block rounded-full bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] px-2 py-0.5 text-[11px] font-bold text-[var(--wn-badge-emerald-text)]"
                                  >
                                    {circle.name}
                                  </span>
                                ))
                              ) : (
                                <span className="inline-block rounded-full bg-[var(--wn-surface-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wn-text-secondary)]">
                                  {st.individualCircles || 'حلقات فردية'}
                                </span>
                              )}
                            </div>
                          </div>
                          {student.submittedHomework > 0 ? (
                            <b>{formatMsg(st.homeworkToReview || '{count} واجب للتصحيح', { count: student.submittedHomework })}</b>
                          ) : null}
                        </div>

                        <div className="wn-teacher-student-card__metrics">
                          <div>
                            <span>{st.nextSessionLabel || 'الحصة القادمة'}</span>
                            <strong>{student.nextSession ? new Date(student.nextSession.scheduledAt).toLocaleDateString(intlLocale) : '—'}</strong>
                          </div>
                          <div>
                            <span>{st.pendingHomeworkLabel || 'واجبات معلقة'}</span>
                            <strong>{student.pendingHomework || 0}</strong>
                          </div>
                          <div>
                            <span>{st.lastMemorizationLabel || 'آخر حفظ'}</span>
                            <strong>{student.lastProgress?.surahRecited || '—'}</strong>
                          </div>
                        </div>

                        {student.lastProgress ? (
                          <div className="wn-teacher-student-card__progress">
                            <span>{st.lastEvalLabel || 'آخر تقييم'}</span>
                            <div>
                              <small>{st.memorization || 'الحفظ'}</small><strong>{student.lastProgress.memorizationScore ?? '—'}/10</strong>
                              <small>{st.tajweed || 'التجويد'}</small><strong>{student.lastProgress.tajweedScore ?? '—'}/10</strong>
                            </div>
                          </div>
                        ) : null}

                        <button type="button" onClick={() => openStudent(student)} className="wn-teacher-student-card__open min-h-[44px]">
                          {st.openProfileBtn || 'فتح الملف التعليمي'} <ForwardChevron size={16} aria-hidden="true" />
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
                    <span>{up.eyebrow || 'رسائل لطلابي'}</span>
                    <h3>{up.title || 'شارك كلمة أو توجيهًا بالفيديو'}</h3>
                    <p>{up.subtitle || 'يمكنك إرفاق حتى 5 فيديوهات في الرسالة الواحدة، وإرسالها لكل طلابك النشطين أو لطلاب تختارهم.'}</p>
                  </div>
                  <Megaphone size={30} aria-hidden="true" />
                </div>

                <div className="wn-teacher-updates__grid">
                  <form onSubmit={publishTeacherUpdate} className="wn-teacher-update-composer">
                    <div className="wn-teacher-section-heading">
                      <div><span>{up.composerEyebrow || 'رسالة جديدة'}</span><h3>{up.composerTitle || 'انشر تحديثًا لطلابك'}</h3></div>
                    </div>

                    <div>
                      <label htmlFor="teacher-update-title" className="sr-only">
                        {up.titlePlaceholder || 'عنوان الرسالة'}
                      </label>
                      <input
                        id="teacher-update-title"
                        className="input-field w-full"
                        maxLength={140}
                        required
                        placeholder={up.titlePlaceholder || 'العنوان — مثال: كلمة قبل مراجعة سورة الملك'}
                        value={updateForm.title}
                        onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))}
                      />
                    </div>

                    <div>
                      <label htmlFor="teacher-update-message" className="sr-only">
                        {up.messagePlaceholder || 'نص الرسالة'}
                      </label>
                      <textarea
                        id="teacher-update-message"
                        className="input-field w-full"
                        rows={4}
                        maxLength={2000}
                        placeholder={up.messagePlaceholder || 'اكتب رسالة قصيرة أو تعليمات مع الفيديو...'}
                        value={updateForm.message}
                        onChange={(event) => setUpdateForm((current) => ({ ...current, message: event.target.value }))}
                      />
                    </div>

                    <div className="wn-teacher-update-audience">
                      <label htmlFor="update-audience-all">
                        <input
                          id="update-audience-all"
                          type="radio"
                          name="teacher-update-audience"
                          checked={updateForm.audienceMode === 'all-active'}
                          onChange={() => setUpdateForm((current) => ({ ...current, audienceMode: 'all-active', studentIds: [] }))}
                        />
                        <span><strong>{up.audienceAllTitle || 'كل طلابي النشطين'}</strong><small>{up.audienceAllDesc || 'تصل الرسالة لكل الطلاب المرتبطين بك'}</small></span>
                      </label>
                      <label htmlFor="update-audience-selected">
                        <input
                          id="update-audience-selected"
                          type="radio"
                          name="teacher-update-audience"
                          checked={updateForm.audienceMode === 'selected'}
                          onChange={() => setUpdateForm((current) => ({ ...current, audienceMode: 'selected' }))}
                        />
                        <span><strong>{up.audienceSelectedTitle || 'طلاب محددون'}</strong><small>{up.audienceSelectedDesc || 'اختر طالبًا أو أكثر'}</small></span>
                      </label>
                    </div>

                    {updateForm.audienceMode === 'selected' && (
                      <div className="space-y-3">
                        {myCircles.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-2.5">
                            <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                              {up.selectCirclePrefix || 'تحديد حلقة كاملة:'}
                            </span>
                            {myCircles.map((circle) => {
                              const circleIds = (circle.students || []).map((stItem) => String(stItem?._id || stItem)).filter(Boolean);
                              const allSelected = circleIds.length > 0 && circleIds.every((id) => updateForm.studentIds.includes(id));
                              return (
                                <button
                                  key={circle._id}
                                  type="button"
                                  aria-pressed={allSelected}
                                  disabled={!circleIds.length}
                                  onClick={() => toggleUpdateCircleStudents(circle)}
                                  className={`min-h-[44px] inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold transition ${
                                    allSelected
                                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                                      : 'border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-badge-emerald-text)] hover:bg-[var(--wn-emerald-soft)]'
                                  } disabled:opacity-40`}
                                >
                                  {circle.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="wn-teacher-update-students">
                          {activeStudents.length === 0 ? (
                            <p>{up.noActiveStudents || 'لا يوجد طلاب نشطون للاختيار.'}</p>
                          ) : activeStudents.map((student) => (
                            <label key={student._id} className={updateForm.studentIds.includes(student._id) ? 'is-selected' : ''}>
                              <input
                                type="checkbox"
                                checked={updateForm.studentIds.includes(student._id)}
                                onChange={() => toggleUpdateStudent(student._id)}
                              />
                              <span className="wn-teacher-avatar">{(student.name || 'ط').slice(0, 1)}</span>
                              <span>
                                <strong>{student.name}</strong>
                                <small>{formatMsg(up.completedCount || '{count} حصة مكتملة', { count: student.completedSessions || 0 })}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <label htmlFor="teacher-update-video-upload" className="wn-teacher-update-upload">
                      <Upload size={22} aria-hidden="true" />
                      <span>
                        <strong>{up.uploadTitle || 'اختر فيديوهات (اختياري)'}</strong>
                        <small>{up.uploadHint || 'MP4 / WebM / MOV — حتى 5 فيديوهات، 100MB لكل فيديو'}</small>
                      </span>
                      <input
                        id="teacher-update-video-upload"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        multiple
                        onChange={(event) => {
                          const selected = Array.from(event.target.files || []).slice(0, 5);
                          setUpdateForm((current) => ({ ...current, files: selected }));
                        }}
                      />
                    </label>

                    {updateForm.files.length > 0 && (
                      <div className="wn-teacher-update-files">
                        {updateForm.files.map((file, index) => (
                          <div key={`${file.name}-${index}`}>
                            <Video size={16} aria-hidden="true" />
                            <span><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span>
                            <button
                              type="button"
                              onClick={() => setUpdateForm((current) => ({ ...current, files: current.files.filter((_, i) => i !== index) }))}
                              aria-label={up.removeVideoAria || 'حذف الفيديو'}
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={publishingUpdate || !updateForm.title.trim()}
                      className="wn-teacher-primary-action min-h-[44px] inline-flex items-center justify-center gap-2"
                    >
                      {publishingUpdate ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Send size={16} aria-hidden="true" />
                      )}
                      <span>
                        {publishingUpdate
                          ? (updateForm.files.length > 0 ? (up.publishingVideosBtn || 'جاري رفع الفيديوهات والنشر…') : (up.publishingBtn || 'جاري النشر…'))
                          : (up.publishBtn || 'نشر وإشعار الطلاب')}
                      </span>
                    </button>
                  </form>

                  <section className="wn-teacher-update-history">
                    <div className="wn-teacher-section-heading">
                      <div><span>{up.historyEyebrow || 'سجل النشر'}</span><h3>{up.historyTitle || 'رسائلك السابقة'}</h3></div>
                      <strong>{teacherUpdates.length}</strong>
                    </div>

                    {teacherUpdates.length === 0 ? (
                      <EmptyState
                        icon={Megaphone}
                        title={up.emptyTitle || 'لم تنشر رسالة بعد'}
                        description={up.emptyDesc || 'أول رسالة فيديو ستظهر هنا.'}
                      />
                    ) : (
                      <div className="wn-teacher-update-list">
                        {teacherUpdates.map((update) => (
                          <article key={update._id}>
                            <div className="wn-teacher-update-list__heading">
                              <div>
                                <span>
                                  {update.audience?.mode === 'selected'
                                    ? (up.audienceSelectedBadge || 'طلاب محددون')
                                    : (up.audienceAllBadge || 'كل الطلاب النشطين')}
                                </span>
                                <h4>{update.title}</h4>
                                <small>{new Date(update.publishedAt || update.createdAt).toLocaleString(intlLocale)}</small>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDeleteUpdateModal(update)}
                                aria-label={up.deleteAria || 'حذف الرسالة'}
                                className="min-h-[44px] min-w-[44px]"
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                            {update.message ? <p>{update.message}</p> : null}
                            <div className="wn-teacher-update-videos">
                              {(update.videos || []).map((video, index) => {
                                const key = `${update._id}-${index}`;
                                const isVideoLoading = loadingVideoKey === key;
                                return (
                                  <div key={key}>
                                    {updateVideoUrls[key] ? (
                                      <video src={updateVideoUrls[key]} controls preload="metadata" />
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={isVideoLoading}
                                        onClick={() => loadTeacherUpdateVideo(update._id, index)}
                                        className="min-h-[44px]"
                                      >
                                        {isVideoLoading ? (
                                          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                                        ) : (
                                          <Video size={20} aria-hidden="true" />
                                        )}
                                        <span>
                                          <strong>{formatMsg(up.playVideoTitle || 'تشغيل الفيديو {index}', { index: index + 1 })}</strong>
                                          <small>{video.name || up.videoFallbackName || 'فيديو المعلم'}</small>
                                        </span>
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
              <TeacherHomeworkPanel
                tasks={tasks}
                submittedTasks={submittedTasks}
                taskTypeLabel={taskTypeLabel}
                homeworkAudio={homeworkAudio}
                playHomeworkSubmission={playHomeworkSubmission}
                taskReview={taskReview}
                setTaskReview={setTaskReview}
                taskFeedbackAudio={taskFeedbackAudio}
                setTaskFeedbackAudio={setTaskFeedbackAudio}
                reviewingTaskId={reviewingTaskId}
                reviewTask={reviewTask}
                onOpenNewTask={() => setTaskModal(true)}
                locale={locale}
                t={t}
              />
            )}
          </div>
        </>
      )}

      {chatSession && (
        <SessionChatModal
          session={chatSession}
          locale={locale}
          viewerRole="teacher"
          onClose={() => setChatSession(null)}
        />
      )}

      <Modal
        isOpen={Boolean(rescheduleModal)}
        onClose={() => { setRescheduleModal(null); setRescheduleDate(''); }}
        title={formatMsg(mod.reschedule?.title || 'اقتراح موعد جديد لـ {name}', {
          name: rescheduleModal?.student?.name || wl.studentFallback || 'الطالب',
        })}
        maxWidth="480px"
        disableClose={Boolean(respondingSessionId)}
      >
        {rescheduleModal && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--wn-text-secondary)]">
              {formatMsg(mod.reschedule?.currentTime || 'الموعد الحالي: {date}', {
                date: formatSessionDateTime(rescheduleModal, locale, { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </p>
            <div className="rounded-lg bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] p-3 text-xs text-[var(--wn-badge-emerald-text)]">
              {formatMsg(
                mod.reschedule?.tzNotice || 'سيتم تفسير الموعد الجديد حسب {tz} وليس حسب منطقة جهازك.',
                { tz: sessionTimeZone(rescheduleModal, teacher?.availabilityTimezone || 'Africa/Cairo') }
              )}
            </div>
            <div>
              <label htmlFor="teacher-reschedule-date" className="block text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.reschedule?.label || 'الموعد المقترح'}
              </label>
              <input
                id="teacher-reschedule-date"
                type="datetime-local"
                value={rescheduleDate}
                onChange={(event) => setRescheduleDate(event.target.value)}
                className="input-field w-full mt-1"
              />
            </div>
            <button
              type="button"
              disabled={Boolean(respondingSessionId)}
              onClick={submitReschedule}
              className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {respondingSessionId && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              <span>
                {respondingSessionId
                  ? (mod.reschedule?.submittingBtn || 'جاري الإرسال…')
                  : (mod.reschedule?.submitBtn || 'إرسال الموعد الجديد للطالب')}
              </span>
            </button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(studentModal)}
        onClose={() => { setStudentModal(null); setStudentSummary(null); setStudentSummaryError(false); }}
        title={formatMsg(mod.studentSummary?.title || 'الملف التعليمي — {name}', {
          name: studentModal?.name || wl.studentFallback || 'الطالب',
        })}
        maxWidth="896px"
      >
        {studentSummaryLoading ? (
          <div className="space-y-4 py-2" role="status" aria-live="polite">
            <span className="sr-only">{mod.studentSummary?.loadingTitle || 'جاري تحميل ملف الطالب'}</span>
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : studentSummaryError || !studentSummary ? (
          <div className="rounded-xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center space-y-3" role="alert">
            <AlertTriangle size={28} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
            <strong className="block text-[var(--wn-heading)]">{mod.studentSummary?.errorTitle || 'تعذر تحميل الملف'}</strong>
            <p className="text-xs text-[var(--wn-text-secondary)]">{mod.studentSummary?.errorDesc || 'أعد المحاولة أو أغلق النافذة.'}</p>
            <button
              type="button"
              onClick={() => openStudent(studentModal)}
              className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>{mod.studentSummary?.retryBtn || 'إعادة المحاولة'}</span>
            </button>
          </div>
        ) : (
          <div className="wn-teacher-student-profile">
            <div className="wn-teacher-student-profile__hero">
              <span className="wn-teacher-avatar xlarge">{(studentSummary.student?.name || 'ط').slice(0, 1)}</span>
              <div>
                <h3>{studentSummary.student?.name}</h3>
                <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                  {teacherLearnerLevelLabel(studentSummary.student?.currentLevel)} · {teacherLearnerTrackLabel(studentSummary.student?.preferredTrack)}
                </p>
                {(studentSummary.circles || []).length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {studentSummary.circles.map((circle) => (
                      <span
                        key={circle._id}
                        className="inline-block rounded-full bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] px-2 py-0.5 text-[11px] font-bold text-[var(--wn-badge-emerald-text)]"
                      >
                        {circle.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="min-h-[44px]"
                onClick={() => {
                  setStudentModal(null);
                  setTaskTargetMode('student');
                  setNewTask((current) => ({ ...current, studentId: studentSummary.student?._id || '' }));
                  setTaskModal(true);
                }}
              >
                <Plus size={15} aria-hidden="true" /> {mod.studentSummary?.assignTaskBtn || 'إسناد واجب'}
              </button>
            </div>

            <div className="wn-teacher-student-profile__stats">
              <div><span>{mod.studentSummary?.totalSessions || 'إجمالي الحصص'}</span><strong>{studentSummary.summary?.totalSessions || 0}</strong></div>
              <div><span>{mod.studentSummary?.completed || 'مكتملة'}</span><strong>{studentSummary.summary?.completedSessions || 0}</strong></div>
              <div><span>{mod.studentSummary?.upcoming || 'قادمة'}</span><strong>{studentSummary.summary?.upcomingSessions || 0}</strong></div>
              <div><span>{mod.studentSummary?.homeworkToReview || 'واجبات للتصحيح'}</span><strong>{studentSummary.summary?.submittedHomework || 0}</strong></div>
            </div>

            <QuranProgressSummary
              variant="teacher"
              locale={locale}
              quranSummary={studentSummary.quranSummary}
              evaluations={studentSummary.sessions}
            />

            <section className="wn-teacher-student-profile__section">
              <div className="wn-teacher-section-heading">
                <div><span>{mod.studentSummary?.timelineEyebrow || 'التاريخ التعليمي'}</span><h3>{mod.studentSummary?.timelineTitle || 'آخر الحصص والتقارير'}</h3></div>
              </div>
              {(studentSummary.sessions || []).length === 0 ? (
                <p className="text-sm text-[var(--wn-text-secondary)]">{mod.studentSummary?.noSessions || 'لا توجد حصص مسجلة.'}</p>
              ) : (
                <div className="wn-teacher-student-timeline">
                  {studentSummary.sessions.slice(0, 10).map((session) => (
                    <div key={session._id}>
                      <span className={'wn-teacher-timeline-dot ' + (session.status === 'completed' ? 'is-done' : '')} />
                      <div>
                        <strong>
                          {session.type === 'trial'
                            ? (mod.studentSummary?.trialLabel || 'حصة تجريبية')
                            : session.type === 'group_circle'
                              ? (session.circle?.name
                                  ? formatMsg(mod.studentSummary?.groupNamed || 'حلقة جماعية — {name}', { name: session.circle.name })
                                  : (mod.studentSummary?.groupLabel || 'حلقة جماعية'))
                              : (mod.studentSummary?.regularLabel || 'حصة منتظمة')}
                        </strong>
                        <small>{formatSessionDateTime(session, locale, { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session, teacher?.availabilityTimezone || 'Africa/Cairo')}</small>
                        {(session.evaluation || session.progressReport) ? (
                          <div className="wn-teacher-timeline-report">
                            {session.evaluation ? (
                              <>
                                <span>{mod.studentSummary?.memLabel || 'الحفظ'} <b>{session.evaluation.memorization ?? '—'}/5</b></span>
                                <span>{mod.studentSummary?.tajweedLabel || 'التجويد'} <b>{session.evaluation.tajweed ?? '—'}/5</b></span>
                              </>
                            ) : (
                              <>
                                <span>{mod.studentSummary?.memLabel || 'الحفظ'} <b>{session.progressReport?.memorizationScore ?? '—'}/10</b></span>
                                <span>{mod.studentSummary?.tajweedLabel || 'التجويد'} <b>{session.progressReport?.tajweedScore ?? '—'}/10</b></span>
                              </>
                            )}
                            {(session.evaluation?.surahRecited || session.progressReport?.surahRecited) ? (
                              <p>{mod.studentSummary?.recitedLabel || 'تم التسميع:'} {session.evaluation?.surahRecited || session.progressReport?.surahRecited}</p>
                            ) : null}
                            {(session.evaluation?.nextHomework || session.progressReport?.nextHomework) ? (
                              <p>{mod.studentSummary?.nextLabel || 'التالي:'} {session.evaluation?.nextHomework || session.progressReport?.nextHomework}</p>
                            ) : null}
                            {(session.evaluation?.overallNotes || session.progressReport?.notes) ? (
                              <p>{mod.studentSummary?.notesLabel || 'ملاحظات:'} {session.evaluation?.overallNotes || session.progressReport?.notes}</p>
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
                <div><span>{mod.studentSummary?.tasksEyebrow || 'الواجبات'}</span><h3>{mod.studentSummary?.tasksTitle || 'آخر المهام'}</h3></div>
              </div>
              {(studentSummary.tasks || []).length === 0 ? (
                <p className="text-sm text-[var(--wn-text-secondary)]">{mod.studentSummary?.noTasks || 'لا توجد واجبات لهذا الطالب.'}</p>
              ) : (
                <div className="wn-teacher-student-task-list">
                  {studentSummary.tasks.slice(0, 8).map((task) => (
                    <div key={task._id}>
                      <span>{taskTypeLabel(task.type)}</span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.status === 'done'
                          ? (mod.studentSummary?.taskDone || 'معتمد')
                          : task.status === 'submitted'
                            ? (mod.studentSummary?.taskSubmitted || 'مُسلّم')
                            : (mod.studentSummary?.taskPending || 'قيد الانتظار')}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(evalModal)}
        onClose={() => setEvalModal(null)}
        title={formatMsg(mod.eval?.title || 'تقييم {name}', {
          name: evalModal?.student?.name || wl.studentFallback || 'الطالب',
        })}
        maxWidth="560px"
        disableClose={completingSession}
      >
        {evalModal && (
          <div className="space-y-4">
            {evalModal.type === 'trial' && (
              <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-3.5 space-y-3">
                <div>
                  <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                    {mod.eval?.trialEyebrow || 'تقييم الحصة التجريبية'}
                  </span>
                  <h4 className="text-sm font-bold text-[var(--wn-heading)]">
                    {mod.eval?.trialTitle || 'تحديد مستوى الطالب والمسار الموصى به'}
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="eval-rec-level" className="block text-xs font-semibold text-[var(--wn-text-primary)]">
                      {mod.eval?.levelLabel || 'المستوى الحالي للطالب'}
                    </label>
                    <select
                      id="eval-rec-level"
                      className="input-field w-full mt-1 text-sm min-h-[44px]"
                      value={evaluation.recommendedLevel || 'beginner'}
                      onChange={(e) => setEvaluation((cur) => ({ ...cur, recommendedLevel: e.target.value }))}
                    >
                      <option value="beginner">{tp.learnerLevels?.beginnerFull || 'مبتدئ (تأسيس وقصار السور)'}</option>
                      <option value="intermediate">{tp.learnerLevels?.intermediateFull || 'متوسط (حفظ مع التجويد الأساسي)'}</option>
                      <option value="advanced">{tp.learnerLevels?.advancedFull || 'متقدم (إتقان ومراجعة مكثفة)'}</option>
                      <option value="ijazah">{tp.learnerLevels?.ijazahFull || 'مؤهل لمسار الإجازة والسند'}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="eval-rec-track" className="block text-xs font-semibold text-[var(--wn-text-primary)]">
                      {mod.eval?.trackLabel || 'المسار التعليمي الموصى به'}
                    </label>
                    <select
                      id="eval-rec-track"
                      className="input-field w-full mt-1 text-sm min-h-[44px]"
                      value={evaluation.recommendedTrack || 'memorization'}
                      onChange={(e) => setEvaluation((cur) => ({ ...cur, recommendedTrack: e.target.value }))}
                    >
                      <option value="memorization">{tp.learnerTracks?.memorizationFull || 'مسار الحفظ والمراجعة'}</option>
                      <option value="tajweed_ijazah">{tp.learnerTracks?.tajweedIjazahFull || 'مسار التجويد والإجازة'}</option>
                      <option value="kids_foundation">{tp.learnerTracks?.kidsFoundationFull || 'مسار تأسيس الأطفال والبراعم'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {[
              ['attendance', ss.evalCriteria?.attendance || 'الحضور والانتباه'],
              ['memorization', ss.evalCriteria?.memorization || 'الحفظ'],
              ['tajweed', ss.evalCriteria?.tajweed || 'التجويد'],
              ['behavior', ss.evalCriteria?.behavior || 'السلوك'],
              ['commitment', ss.evalCriteria?.commitment || 'الالتزام'],
            ].map(([key, label]) => {
              const inputId = `teacher-eval-${key}`;
              return (
                <fieldset key={key} className="space-y-2">
                  <legend className="text-sm font-medium text-[var(--wn-heading)]">
                    {label} {mod.eval?.criteriaScale || '(1–5)'}
                  </legend>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={label}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        id={`${inputId}-${score}`}
                        type="button"
                        role="radio"
                        aria-checked={evaluation[key] === score}
                        onClick={() => setEvaluation((current) => ({ ...current, [key]: score }))}
                        className={`min-h-[44px] rounded-lg border text-sm font-bold transition ${
                          evaluation[key] === score
                            ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                            : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <output className="text-sm text-[var(--wn-badge-emerald-text)] font-bold">
                    {formatMsg(mod.eval?.outOfFive || '{score} من 5', { score: evaluation[key] })}
                  </output>
                </fieldset>
              );
            })}

            <div className="wn-teacher-eval-report">
              <div className="wn-teacher-section-heading">
                <div>
                  <span>{mod.eval?.guardianReportEyebrow || 'تقرير ولي الأمر'}</span>
                  <h3>{mod.eval?.guardianReportTitle || 'ماذا تم في الحصة؟'}</h3>
                </div>
              </div>
              <label htmlFor="teacher-eval-surah" className="text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.eval?.surahLabel || 'السورة / المقطع الذي تم تسميعه'}
              </label>
              <input
                id="teacher-eval-surah"
                name="surahRecited"
                className="input-field w-full"
                placeholder={mod.eval?.surahPlaceholder || 'مثال: سورة البقرة'}
                value={evaluation.surahRecited}
                onChange={(event) => setEvaluation((current) => ({ ...current, surahRecited: event.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--wn-text-primary)]" htmlFor="teacher-eval-from-ayah">
                    {mod.eval?.fromAyah || 'من آية'}
                  </label>
                  <input
                    id="teacher-eval-from-ayah"
                    name="fromAyah"
                    type="number"
                    min="1"
                    aria-invalid={Boolean(evalAyahError)}
                    aria-describedby={evalAyahError ? 'teacher-eval-ayah-error' : undefined}
                    className="input-field w-full mt-1"
                    placeholder="1"
                    value={evaluation.fromAyah}
                    onChange={(event) => {
                      setEvalAyahError('');
                      setEvaluation((current) => ({ ...current, fromAyah: event.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--wn-text-primary)]" htmlFor="teacher-eval-to-ayah">
                    {mod.eval?.toAyah || 'إلى آية'}
                  </label>
                  <input
                    id="teacher-eval-to-ayah"
                    name="toAyah"
                    type="number"
                    min="1"
                    aria-invalid={Boolean(evalAyahError)}
                    aria-describedby={evalAyahError ? 'teacher-eval-ayah-error' : undefined}
                    className="input-field w-full mt-1"
                    placeholder="5"
                    value={evaluation.toAyah}
                    onChange={(event) => {
                      setEvalAyahError('');
                      setEvaluation((current) => ({ ...current, toAyah: event.target.value }));
                    }}
                  />
                </div>
              </div>
              {evalAyahError && (
                <p id="teacher-eval-ayah-error" role="alert" className="text-xs font-semibold text-[var(--wn-text-danger)]">
                  {evalAyahError}
                </p>
              )}
              <label htmlFor="teacher-eval-next-homework" className="text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.eval?.nextHomeworkLabel || 'الواجب أو الهدف القادم'}
              </label>
              <input
                id="teacher-eval-next-homework"
                name="nextHomework"
                className="input-field w-full"
                placeholder={mod.eval?.nextHomeworkPlaceholder || 'الهدف أو الواجب التالي'}
                value={evaluation.nextHomework}
                onChange={(event) => setEvaluation((current) => ({ ...current, nextHomework: event.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="teacher-eval-notes" className="text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.eval?.notesLabel || 'ملاحظات'}
              </label>
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
                <span className="text-sm font-medium text-[var(--wn-text-primary)] flex items-center gap-1">
                  <ClipboardList size={16} aria-hidden="true" /> {mod.eval?.extraHomeworkLabel || 'واجبات بعد الحصة'}
                </span>
                <button
                  type="button"
                  onClick={addHomework}
                  className="min-h-[44px] inline-flex items-center px-2 text-sm font-semibold text-[var(--wn-badge-emerald-text)]"
                >
                  {mod.eval?.addHomeworkBtn || '+ إضافة'}
                </button>
              </div>
              {homeworkList.map((hwItem, i) => (
                <div key={i} className="border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-lg p-3 mb-2 space-y-2">
                  <select
                    aria-label={`${mod.eval?.extraHomeworkLabel || 'واجب'} ${i + 1}`}
                    className="input-field w-full min-h-[44px]"
                    value={hwItem.type}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, type: e.target.value } : h))}
                  >
                    {TASK_TYPES.map((typeItem) => (
                      <option key={typeItem.id} value={typeItem.id}>
                        {taskTypeLabel(typeItem.id)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={mod.eval?.hwDetailsPlaceholder || 'تفاصيل الواجب'}
                    className="input-field w-full"
                    placeholder={mod.eval?.hwDetailsPlaceholder || 'التفاصيل (مثلاً: سورة البقرة 1-5)'}
                    value={hwItem.description}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, description: e.target.value } : h))}
                  />
                  <input
                    aria-label={mod.taskAssign?.dueDateLabel || 'موعد التسليم'}
                    type="date"
                    className="input-field w-full"
                    value={hwItem.dueDate}
                    onChange={(e) => setHomeworkList((p) => p.map((h, j) => j === i ? { ...h, dueDate: e.target.value } : h))}
                  />
                </div>
              ))}
            </div>

            <div className="wn-teacher-eval-submit">
              <p id="teacher-eval-submit-note">
                <CheckCircle2 size={16} aria-hidden="true" />{' '}
                {mod.eval?.submitNote || 'سيتم إنهاء الحصة، تسجيل الاستحقاق، وحفظ تقرير المتابعة.'}
              </p>
              <button
                id="teacher-eval-submit"
                type="button"
                disabled={completingSession}
                onClick={completeSession}
                className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                aria-describedby="teacher-eval-submit-note"
              >
                {completingSession && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                <span>
                  {completingSession
                    ? (mod.eval?.submittingBtn || 'جاري الإغلاق والاعتماد…')
                    : formatMsg(mod.eval?.submitBtn || 'إنهاء الحصة وإرسال التقرير (+{amount} ج.م)', {
                        amount: expectedSessionEarning,
                      })}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {(() => {
        const assignableCircles = myCircles.filter((c) => ['active', 'full'].includes(c.status));
        return (
          <Modal
            isOpen={taskModal}
            onClose={() => setTaskModal(false)}
            title={mod.taskAssign?.title || 'إسناد واجب جديد'}
            maxWidth="480px"
            disableClose={assigningTask}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-[var(--wn-surface-sunken)] p-1">
                <button
                  type="button"
                  aria-pressed={taskTargetMode === 'student'}
                  onClick={() => { setTaskTargetMode('student'); setTaskCircleId(''); }}
                  className={`min-h-[44px] rounded-lg py-2 text-xs font-bold transition ${
                    taskTargetMode === 'student'
                      ? 'bg-[var(--wn-surface)] text-[var(--wn-heading)] shadow-sm'
                      : 'text-[var(--wn-text-secondary)]'
                  }`}
                >
                  {mod.taskAssign?.modeStudent || 'طالب محدد'}
                </button>
                <button
                  type="button"
                  aria-pressed={taskTargetMode === 'circle'}
                  disabled={assignableCircles.length === 0}
                  onClick={() => { setTaskTargetMode('circle'); setNewTask((p) => ({ ...p, studentId: '' })); }}
                  className={`min-h-[44px] rounded-lg py-2 text-xs font-bold transition ${
                    taskTargetMode === 'circle'
                      ? 'bg-[var(--wn-surface)] text-[var(--wn-heading)] shadow-sm'
                      : 'text-[var(--wn-text-secondary)]'
                  } disabled:opacity-40`}
                >
                  {mod.taskAssign?.modeCircle || 'حلقة جماعية كاملة'}
                </button>
              </div>
              {taskTargetMode === 'circle' ? (
                <div>
                  <label htmlFor="task-assign-circle" className="sr-only">{mod.taskAssign?.selectCircle || 'اختر الحلقة الجماعية'}</label>
                  <select
                    id="task-assign-circle"
                    className="input-field w-full min-h-[44px]"
                    value={taskCircleId}
                    onChange={(e) => setTaskCircleId(e.target.value)}
                  >
                    <option value="">{mod.taskAssign?.selectCircle || 'اختر الحلقة الجماعية'}</option>
                    {assignableCircles.map((c) => (
                      <option key={c._id} value={c._id}>
                        {formatMsg(mod.taskAssign?.circleCount || '{name} ({count} طالب)', {
                          name: c.name,
                          count: c.currentCount || c.students?.length || 0,
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="task-assign-student" className="sr-only">{mod.taskAssign?.selectStudent || 'اختر الطالب'}</label>
                  <select
                    id="task-assign-student"
                    className="input-field w-full min-h-[44px]"
                    value={newTask.studentId}
                    onChange={(e) => setNewTask((p) => ({ ...p, studentId: e.target.value }))}
                  >
                    <option value="">{mod.taskAssign?.selectStudent || 'اختر الطالب'}</option>
                    {activeStudents.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="task-assign-type" className="sr-only">{mod.taskAssign?.title || 'نوع الواجب'}</label>
                <select
                  id="task-assign-type"
                  className="input-field w-full min-h-[44px]"
                  value={newTask.type}
                  onChange={(e) => setNewTask((p) => ({ ...p, type: e.target.value }))}
                >
                  {TASK_TYPES.map((typeItem) => (
                    <option key={typeItem.id} value={typeItem.id}>
                      {taskTypeLabel(typeItem.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-assign-title" className="sr-only">{mod.taskAssign?.titlePlaceholder || 'عنوان الواجب'}</label>
                <input
                  id="task-assign-title"
                  className="input-field w-full"
                  placeholder={mod.taskAssign?.titlePlaceholder || 'عنوان الواجب'}
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="task-assign-details" className="sr-only">{mod.taskAssign?.detailsPlaceholder || 'التفاصيل'}</label>
                <textarea
                  id="task-assign-details"
                  className="input-field w-full"
                  placeholder={mod.taskAssign?.detailsPlaceholder || 'التفاصيل'}
                  rows={2}
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="task-assign-due" className="block text-xs font-medium text-[var(--wn-text-secondary)] mb-1">
                  {mod.taskAssign?.dueDateLabel || 'موعد التسليم (اختياري)'}
                </label>
                <input
                  id="task-assign-due"
                  type="date"
                  className="input-field w-full"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
              <button
                type="button"
                disabled={assigningTask}
                onClick={assignTask}
                className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {assigningTask && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                <span>{assigningTask ? (mod.taskAssign?.submittingBtn || 'جاري الإسناد…') : (mod.taskAssign?.submitBtn || 'إسناد')}</span>
              </button>
            </div>
          </Modal>
        );
      })()}

      {(() => {
        const assignableCircles = myCircles.filter((c) => ['active', 'full'].includes(c.status));
        return (
          <Modal
            isOpen={aiModal}
            onClose={() => setAiModal(false)}
            title={mod.aiAssistant?.title || 'مساعد المعلم الذكي'}
            maxWidth="520px"
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-3 space-y-2">
                <span className="block text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                  {mod.aiAssistant?.quickAssignTitle || 'إسناد سريع بعد التوليد (اختياري)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={aiTargetMode === 'student'}
                    onClick={() => { setAiTargetMode('student'); setAiTargetId(''); }}
                    className={`min-h-[44px] rounded-lg border py-1.5 text-xs font-bold ${
                      aiTargetMode === 'student'
                        ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                        : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                    }`}
                  >
                    {mod.aiAssistant?.modeStudent || 'طالب'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={aiTargetMode === 'circle'}
                    disabled={assignableCircles.length === 0}
                    onClick={() => { setAiTargetMode('circle'); setAiTargetId(''); }}
                    className={`min-h-[44px] rounded-lg border py-1.5 text-xs font-bold ${
                      aiTargetMode === 'circle'
                        ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                        : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                    } disabled:opacity-40`}
                  >
                    {mod.aiAssistant?.modeCircle || 'حلقة جماعية'}
                  </button>
                </div>
                <label htmlFor="ai-target-select" className="sr-only">
                  {aiTargetMode === 'circle'
                    ? (mod.aiAssistant?.selectCircle || 'اختر الحلقة المستهدفة')
                    : (mod.aiAssistant?.selectStudent || 'اختر الطالب المستهدف')}
                </label>
                <select
                  id="ai-target-select"
                  className="input-field w-full text-sm min-h-[44px]"
                  value={aiTargetId}
                  onChange={(e) => setAiTargetId(e.target.value)}
                >
                  <option value="">
                    {aiTargetMode === 'circle'
                      ? (mod.aiAssistant?.selectCircle || 'اختر الحلقة المستهدفة')
                      : (mod.aiAssistant?.selectStudent || 'اختر الطالب المستهدف')}
                  </option>
                  {aiTargetMode === 'circle'
                    ? assignableCircles.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)
                    : activeStudents.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ai-homework-topic" className="sr-only">{mod.aiAssistant?.topicPlaceholder || 'موضوع الواجبات'}</label>
                <input
                  id="ai-homework-topic"
                  className="input-field w-full"
                  placeholder={mod.aiAssistant?.topicPlaceholder || 'موضوع الواجبات (مثلاً: الغنة)'}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={generateAiHomework}
                disabled={aiLoading}
                className="btn-primary w-full min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                <span>{aiLoading ? (mod.aiAssistant?.generatingBtn || 'جاري التوليد…') : (mod.aiAssistant?.generateBtn || 'توليد 5 واجبات')}</span>
              </button>
              {aiResult?.assignments?.map((a) => {
                const itemKey = a.id || a.title;
                const assigning = assigningAiId === itemKey;
                return (
                  <div key={itemKey} className="border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-lg p-3 text-sm space-y-2">
                    <div>
                      <p className="font-bold text-[var(--wn-heading)]">{a.title}</p>
                      {a.description && <p className="text-[var(--wn-text-secondary)] mt-1">{a.description}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => assignAiTask(a)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3 py-1.5 text-xs font-bold text-[var(--wn-badge-emerald-text)] hover:opacity-90 disabled:opacity-50"
                    >
                      {assigning ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                      <span>{assigning ? (mod.aiAssistant?.assigningBtn || 'جاري الإسناد…') : (mod.aiAssistant?.assignBtn || 'إسناد هذا الواجب')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      <Modal
        isOpen={Boolean(circleSessionModal)}
        onClose={() => setCircleSessionModal(null)}
        title={formatMsg(mod.scheduleCircle?.title || 'جدولة حصة — {name}', { name: circleSessionModal?.name || '' })}
        maxWidth="480px"
        disableClose={savingCircleSession}
      >
        {circleSessionModal && (
          <div className="space-y-3">
            <div>
              <label htmlFor="circle-session-datetime" className="block text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.scheduleCircle?.dateTimeLabel || 'موعد الحصة الجماعية *'}
              </label>
              <input
                id="circle-session-datetime"
                type="datetime-local"
                className="input-field w-full mt-1"
                value={circleSessionForm.scheduledAt}
                onChange={(e) => setCircleSessionForm((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="circle-session-duration" className="block text-sm font-medium text-[var(--wn-text-primary)]">
                {formatMsg(mod.scheduleCircle?.durationLabel || 'مدة الحصة (بالدقائق: {min}–{max})', {
                  min: circleSessionModal.durationMinMinutes || 30,
                  max: circleSessionModal.durationMaxMinutes || 60,
                })}
              </label>
              <input
                id="circle-session-duration"
                type="number"
                min={circleSessionModal.durationMinMinutes || 30}
                max={circleSessionModal.durationMaxMinutes || 60}
                className="input-field w-full mt-1"
                value={circleSessionForm.duration}
                onChange={(e) => setCircleSessionForm((p) => ({ ...p, duration: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="circle-session-notes" className="block text-sm font-medium text-[var(--wn-text-primary)]">
                {mod.scheduleCircle?.notesLabel || 'ملاحظات أو مقرر الحلقة (اختياري)'}
              </label>
              <textarea
                id="circle-session-notes"
                rows={2}
                className="input-field w-full mt-1"
                placeholder={mod.scheduleCircle?.notesPlaceholder || 'مثال: تسميع سورة الملك من الآية 1 إلى 15'}
                value={circleSessionForm.notes}
                onChange={(e) => setCircleSessionForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button
              type="button"
              disabled={savingCircleSession}
              onClick={submitGroupCircleSession}
              className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingCircleSession && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              <span>
                {savingCircleSession
                  ? (mod.scheduleCircle?.submittingBtn || 'جاري الجدولة…')
                  : (mod.scheduleCircle?.confirmBtn || 'تأكيد جدولة الحصة الجماعية')}
              </span>
            </button>
          </div>
        )}
      </Modal>

      <GroupSessionCompleteModal
        session={groupCompleteModal}
        onClose={() => setGroupCompleteModal(null)}
        onCompleted={load}
      />
      <RejectSessionModal
        session={rejectModal}
        onClose={() => setRejectModal(null)}
        onConfirm={confirmRejectSession}
        submitting={rejectSubmitting}
      />
      <ConfirmDeleteUpdateModal
        update={deleteUpdateModal}
        onClose={() => setDeleteUpdateModal(null)}
        onConfirm={confirmDeleteTeacherUpdate}
        submitting={deletingUpdate}
      />
    </DashboardLayout>
  );
}

function TeacherCommandBar({ primaryItems, secondaryItems, active, onChange, actionCount, isRTL, t }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const cb = t?.teacherPortal?.commandBar || {};
  const secondaryActiveItem = secondaryItems.find((item) => item.id === active);
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!moreOpen) return undefined;
    const handlePointerDown = (event) => {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  const selectItem = (id) => {
    onChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="wn-teacher-command-shell">
      <nav className="wn-teacher-command" aria-label={cb.ariaLabel || 'التنقل داخل مساحة المعلم'}>
        <div className="wn-teacher-command__identity" aria-hidden="true">
          <span><BookOpen size={17} /></span>
          <div>
            <strong>{cb.brandTitle || 'مساحة المعلم'}</strong>
            <small>{cb.brandSubtitle || 'إدارة يومك التعليمي'}</small>
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
                className={'wn-teacher-command__item min-h-[44px] ' + (selected ? 'is-active' : '')}
                aria-current={selected ? 'page' : undefined}
              >
                <span className="wn-teacher-command__icon"><Icon size={18} aria-hidden="true" /></span>
                <strong>{label}</strong>
                {badge ? <b>{badge}</b> : null}
              </button>
            );
          })}
        </div>

        <div className="wn-teacher-command__more" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={'wn-teacher-command__item wn-teacher-command__more-button min-h-[44px] ' + (secondaryActiveItem ? 'is-active' : '')}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            aria-controls="teacher-command-more-panel"
          >
            <span className="wn-teacher-command__icon"><MoreHorizontal size={19} aria-hidden="true" /></span>
            <span>
              <strong>{cb.more || 'المزيد'}</strong>
              {secondaryActiveItem ? <small>{secondaryActiveItem.label}</small> : null}
            </span>
            {actionCount > 0 && active === 'overview' ? <i>{actionCount}</i> : null}
          </button>

          {moreOpen && (
            <div id="teacher-command-more-panel" className="wn-teacher-command__panel">
              <div className="wn-teacher-command__panel-heading">
                <div><span>{cb.panelEyebrow || 'أدوات المعلم'}</span><strong>{cb.panelTitle || 'إدارة المساحة'}</strong></div>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label={cb.closeAria || 'إغلاق'} className="min-h-[44px] min-w-[44px]">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="wn-teacher-command__panel-grid">
                {secondaryItems.map(({ id, label, icon: Icon, description }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => selectItem(id)}
                    className={'min-h-[44px] ' + (active === id ? 'is-active' : '')}
                  >
                    <span><Icon size={18} aria-hidden="true" /></span>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <ForwardChevron size={15} aria-hidden="true" />
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

function mergeSchedule(apiDays, weekdayDict = {}) {
  return WEEK_DAYS.map((day) => {
    const found = (apiDays || []).find((item) => item.day === day.id);
    return {
      day: day.id,
      label: weekdayDict[day.id] || day.label,
      slots: (found?.slots || []).map((slot) => ({
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
      })),
    };
  });
}
