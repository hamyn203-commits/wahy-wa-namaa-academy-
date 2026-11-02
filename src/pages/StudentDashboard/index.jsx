import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, CheckCircle, FileText, Star, Trophy, BookOpen,
  Upload, Clock, Users, X, Award, Video, Gift, Copy, CreditCard,
  Mic, Square, RotateCcw, Send, Sparkles, MoreHorizontal, UserRound, Megaphone
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import DashboardLayout, { StatCard } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useGamificationApi } from '../../hooks/useGamificationApi';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { TASK_TYPES } from '../TeacherRegistration/constants';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { localizeInternalHref } from '../../lib/navigation';
import { apiUrl } from '../../config';
import StudentTeacherMarketplace from './TeacherMarketplace';
import SessionChatModal from '../../components/session/SessionChatModal';
import SupportChat, { SupportLauncher } from '../../components/support/SupportChat';
import Skeleton from '../../components/shared/Skeleton';
import { StudentInspirationStrip } from '../../components/dashboard/QuranJourneyWidgets';
import { sessionJoinWindow, formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { teacherLockFromSubscriptions } from '../../lib/studentTeacherLock';

const emptyReview = { rating: 5, comment: '', wouldContinue: true };
const emptyBook = { date: '', time: '', notes: '' };

function getSessionLiveRoomPath(session) {
  if (!session) return '/live';
  if (typeof session.meetingLink === 'string' && session.meetingLink.startsWith('/live/')) {
    return session.meetingLink;
  }
  const identifier = session.roomId || session._id;
  return identifier ? `/live/${identifier}` : '/live';
}

function guardianRelationshipLabel(value, locale) {
  const ar = { father: 'الأب', mother: 'الأم', guardian: 'ولي الأمر / الوصي', other: 'ولي أمر' };
  const en = { father: 'Father', mother: 'Mother', guardian: 'Guardian', other: 'Guardian' };
  return (locale === 'ar' ? ar : en)[value] || (locale === 'ar' ? 'ولي الأمر' : 'Guardian');
}

function learnerLevelLabel(level, locale) {
  const ar = { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم', ijazah: 'إجازة' };
  const en = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', ijazah: 'Ijazah' };
  return (locale === 'ar' ? ar : en)[level] || (locale === 'ar' ? 'غير محدد' : 'Not set');
}

function learnerTrackLabel(track, locale) {
  const ar = { memorization: 'الحفظ والمراجعة', tajweed_ijazah: 'التجويد والإجازة', kids_foundation: 'تأسيس الأطفال' };
  const en = { memorization: 'Memorization', tajweed_ijazah: 'Tajweed and Ijazah', kids_foundation: 'Kids foundation' };
  return (locale === 'ar' ? ar : en)[track] || (locale === 'ar' ? 'لم يتم الاختيار' : 'Not selected');
}

function guardianInvitationStatus(status, locale) {
  const ar = { pending: 'بانتظار ولي الأمر', accepted: 'تم الربط', rejected: 'تم الرفض', cancelled: 'ملغي', expired: 'انتهت الصلاحية' };
  const en = { pending: 'Waiting for guardian', accepted: 'Linked', rejected: 'Rejected', cancelled: 'Cancelled', expired: 'Expired' };
  return (locale === 'ar' ? ar : en)[status] || status;
}


function StudentCommandBar({ primaryItems, secondaryItems, active, onChange, locale }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActiveItem = secondaryItems.find((item) => item.id === active);
  const isAr = locale === 'ar';

  const selectItem = (id) => {
    onChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="wn-student-command-shell">
      <nav className="wn-student-command" aria-label={isAr ? 'التنقل داخل لوحة الطالب' : 'Student dashboard navigation'}>
        <div className="wn-student-command__identity" aria-hidden="true">
          <span className="wn-student-command__identity-icon"><Sparkles size={17} /></span>
          <div>
            <strong>{isAr ? 'مساحتك التعليمية' : 'Your learning space'}</strong>
            <small>{isAr ? 'كل رحلتك من مكان واحد' : 'Your journey in one place'}</small>
          </div>
        </div>

        <div className="wn-student-command__primary">
          {primaryItems.map(({ id, label, icon: Icon, badge }) => {
            const selected = active === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => selectItem(id)}
                className={'wn-student-command__item ' + (selected ? 'is-active' : '')}
                aria-current={selected ? 'page' : undefined}
              >
                <span className="wn-student-command__item-icon"><Icon size={18} /></span>
                <span className="wn-student-command__item-copy">
                  <strong>{label}</strong>
                </span>
                {badge ? <span className="wn-student-command__badge">{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="wn-student-command__more">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={'wn-student-command__item wn-student-command__more-button ' + (secondaryActiveItem ? 'is-active' : '')}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            <span className="wn-student-command__item-icon"><MoreHorizontal size={19} /></span>
            <span className="wn-student-command__item-copy">
              <strong>{isAr ? 'المزيد' : 'More'}</strong>
              {secondaryActiveItem ? <small>{secondaryActiveItem.label}</small> : null}
            </span>
          </button>

          {moreOpen && (
            <div className="wn-student-command__more-panel" role="menu">
              <div className="wn-student-command__more-heading">
                <div>
                  <span>{isAr ? 'أدوات إضافية' : 'More tools'}</span>
                  <strong>{isAr ? 'كل ما تحتاجه في رحلتك' : 'Everything else you need'}</strong>
                </div>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label={isAr ? 'إغلاق' : 'Close'}>
                  <X size={17} />
                </button>
              </div>
              <div className="wn-student-command__more-grid">
                {secondaryItems.map(({ id, label, icon: Icon, badge, description }) => {
                  const selected = active === id;
                  return (
                    <button
                      type="button"
                      role="menuitem"
                      key={id}
                      onClick={() => selectItem(id)}
                      className={'wn-student-command__more-item ' + (selected ? 'is-active' : '')}
                    >
                      <span className="wn-student-command__more-icon"><Icon size={18} /></span>
                      <span>
                        <strong>{label}</strong>
                        {description ? <small>{description}</small> : null}
                      </span>
                      {badge ? <b>{badge}</b> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

const getStatusLabel = (status, locale) => {
  const labels = {
    id: {
      pending: 'Menunggu',
      accepted: 'Dikonfirmasi',
      rejected: 'Ditolak',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
    },
    ar: {
      pending: 'قيد الانتظار',
      accepted: 'مؤكدة',
      rejected: 'مرفوضة',
      completed: 'مكتملة',
      cancelled: 'ملغاة',
    },
    en: {
      pending: 'Pending',
      accepted: 'Confirmed',
      rejected: 'Rejected',
      completed: 'Completed',
      cancelled: 'Cancelled',
    }
  };
  const active = labels[locale] || labels.en;
  return active[status] || status;
};

const getHwStatus = (status, locale) => {
  const statuses = {
    id: {
      pending: { label: 'Belum Dikirim', cls: 'bg-yellow-100 text-yellow-700' },
      submitted: { label: 'Dikirim', cls: 'bg-blue-100 text-blue-700' },
      done: { label: 'Disetujui', cls: 'bg-green-100 text-green-700' },
    },
    ar: {
      pending: { label: 'لم يُسلّم', cls: 'bg-yellow-100 text-yellow-700' },
      submitted: { label: 'مُسلّم', cls: 'bg-blue-100 text-blue-700' },
      done: { label: 'معتمد', cls: 'bg-green-100 text-green-700' },
    },
    en: {
      pending: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
      submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
      done: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
    }
  };
  const active = statuses[locale] || statuses.en;
  return active[status] || active.pending;
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, logout } = useRequireAuth(['student']);
  const { locale } = useI18n();
  const lp = (path) => localizedPath(path, locale);
  const toast = useToast();
  const { stats: gameStats, badges } = useGamificationApi();

  const [requestedTab, setTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [trials, setTrials] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [homework, setHomework] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [discoverTeachers, setDiscoverTeachers] = useState([]);
  // Sections whose request failed on the last load, so the UI can show
  // "could not load + retry" instead of a misleading empty state.
  const [loadErrors, setLoadErrors] = useState({});
  const [evaluations, setEvaluations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [courses, setCourses] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [referral, setReferral] = useState(null);
  const [teacherUpdates, setTeacherUpdates] = useState([]);
  const [teacherUpdateVideoUrls, setTeacherUpdateVideoUrls] = useState({});
  const [guardianInvitations, setGuardianInvitations] = useState([]);
  const [linkedGuardians, setLinkedGuardians] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsLoaded, setSubscriptionsLoaded] = useState(false);
  const defaultStudentTabRef = useRef(false);
  const [renewalSessionCount, setRenewalSessionCount] = useState(8);
  const [renewingSubscription, setRenewingSubscription] = useState(false);
  const [guardianInviteForm, setGuardianInviteForm] = useState({ guardianPhone: '', relationship: 'father' });
  const [savingGuardianInvite, setSavingGuardianInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  // Once a tutor is chosen on a subscription the student stays with that tutor:
  // the tutor marketplace is closed and only the chosen tutor is listed.
  const teacherLock = teacherLockFromSubscriptions(subscriptions);
  const tab = teacherLock && requestedTab === 'discover' ? 'overview' : requestedTab;
  const myTeachers = teacherLock
    ? teachers.filter((item) => String(item._id) === teacherLock.teacherId)
    : teachers;

  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState(emptyReview);
  const [bookModal, setBookModal] = useState(null);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [bookAvailability, setBookAvailability] = useState({
    loading: false,
    configured: false,
    teacherTimezone: '',
    slots: [],
  });
  const [chatSession, setChatSession] = useState(null);
  const consumedChatSessionRef = useRef(null);
  const [booking, setBooking] = useState(false);
  const [studentExcuseModal, setStudentExcuseModal] = useState(null);
  const [studentExcuseReason, setStudentExcuseReason] = useState('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  // In-Browser Voice Recording Studio
  const [recordModalHw, setRecordModalHw] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [submittingVoice, setSubmittingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api.get('/api/students/dashboard/profile', { auth: true }),
        api.get('/api/students/dashboard/stats', { auth: true }),
        api.get('/api/sessions/my-sessions?type=trial&limit=50', { auth: true }),
        api.get('/api/sessions/my-sessions?limit=100', { auth: true }),
        api.get('/api/homework/student', { auth: true }),
        api.get('/api/students/dashboard/teachers', { auth: true }),
        api.get('/api/students/dashboard/evaluations', { auth: true }),
        api.get('/api/reviews/student', { auth: true }),
        api.get('/api/courses/my-courses', { auth: true }),
        api.get('/api/referrals/my', { auth: true }),
        api.get('/api/teachers?limit=8&sortBy=rating&sortOrder=desc'),
        api.get('/api/teacher-updates/student', { auth: true }),
        api.get('/api/students/dashboard/guardian-invitations', { auth: true }),
        api.get('/api/subscriptions/me', { auth: true }),
      ]);

      const [
        profRes,
        stRes,
        trRes,
        sessRes,
        hwRes,
        tchRes,
        evRes,
        revRes,
        enrollRes,
        refRes,
        discRes,
        updRes,
        guardRes,
        subRes,
      ] = results;

      if (profRes.status === 'fulfilled' && profRes.value) {
        setProfile(profRes.value);
      }
      if (stRes.status === 'fulfilled' && stRes.value) {
        setStats(stRes.value);
      }
      if (trRes.status === 'fulfilled' && trRes.value) {
        setTrials(trRes.value.sessions || []);
      }
      if (sessRes.status === 'fulfilled' && sessRes.value) {
        setSessions((sessRes.value.sessions || []).filter((item) => item.type !== 'trial'));
      }
      if (hwRes.status === 'fulfilled' && hwRes.value) {
        setHomework(hwRes.value.homework || []);
      }
      if (tchRes.status === 'fulfilled' && tchRes.value) {
        setTeachers(tchRes.value.teachers || []);
      }
      if (discRes.status === 'fulfilled' && discRes.value) {
        setDiscoverTeachers(discRes.value.teachers || []);
      }
      if (evRes.status === 'fulfilled' && evRes.value) {
        setEvaluations(evRes.value.evaluations || []);
      }
      if (revRes.status === 'fulfilled' && revRes.value) {
        const rev = revRes.value;
        setReviews(Array.isArray(rev) ? rev : rev.reviews || []);
      }
      if (enrollRes.status === 'fulfilled' && enrollRes.value) {
        setCourses(Array.isArray(enrollRes.value) ? enrollRes.value : []);
      }
      if (refRes.status === 'fulfilled' && refRes.value) {
        setReferral(refRes.value);
      }
      if (updRes.status === 'fulfilled' && updRes.value) {
        setTeacherUpdates(updRes.value.updates || []);
      }
      if (guardRes.status === 'fulfilled' && guardRes.value) {
        setGuardianInvitations(guardRes.value.invitations || []);
        setLinkedGuardians(guardRes.value.linkedGuardians || []);
      }
      if (subRes.status === 'fulfilled' && subRes.value) {
        setSubscriptions(subRes.value.subscriptions || []);
      }
      setSubscriptionsLoaded(true);
      setLoadErrors({
        discover: discRes.status === 'rejected',
        trials: trRes.status === 'rejected',
        sessions: sessRes.status === 'rejected',
      });

      if (profRes.status === 'rejected' && stRes.status === 'rejected') {
        toast.error(locale === 'id' ? 'Gagal memuat data dasbor siswa' : locale === 'ar' ? 'تعذر تحميل بيانات لوحة الطالب' : 'Failed to load student dashboard data');
      }
    } catch {
      toast.error(locale === 'id' ? 'Gagal memuat data dasbor siswa' : locale === 'ar' ? 'تعذر تحميل بيانات لوحة الطالب' : 'Failed to load student dashboard data');
    } finally {
      setLoading(false);
    }
  }, [locale, toast]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const syncSessions = useCallback(async () => {
    if (!ready) return;
    try {
      const result = await api.get('/api/sessions/my-sessions?limit=100', { auth: true });
      const all = result.sessions || [];
      setTrials(all.filter((item) => item.type === 'trial'));
      setSessions(all.filter((item) => item.type !== 'trial'));
    } catch {
      // Keep the current dashboard stable during a transient sync failure.
    }
  }, [ready]);

  const refreshSubscriptions = useCallback(async () => {
    if (!ready) return;
    try {
      const result = await api.get('/api/subscriptions/me', { auth: true });
      setSubscriptions(result.subscriptions || []);
      setSubscriptionsLoaded(true);
    } catch {
      // Keep the last known subscription state during transient failures.
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        syncSessions();
        refreshSubscriptions();
      }
    };

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
  }, [ready, syncSessions, refreshSubscriptions]);

  useEffect(() => {
    if (!ready) return undefined;

    const onRealtimeNotification = (event) => {
      const type = event?.detail?.type;
      if ([
        'session-accepted',
        'session-rejected',
        'session-rescheduled',
        'session-completed',
        'session-chat-message',
      ].includes(type)) {
        syncSessions();
      }
      if (type === 'teacher-update') {
        api.get('/api/teacher-updates/student', { auth: true })
          .then((result) => setTeacherUpdates(result.updates || []))
          .catch(() => {});
      }
      if (type === 'system') {
        refreshSubscriptions();
        api.get('/api/students/dashboard/guardian-invitations', { auth: true })
          .then((result) => {
            setGuardianInvitations(result.invitations || []);
            setLinkedGuardians(result.linkedGuardians || []);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, syncSessions, refreshSubscriptions]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = ['overview', 'discover', 'trials', 'sessions', 'homework', 'teacher-updates', 'evaluations', 'recordings', 'certificates', 'achievements', 'referral', 'account', 'support'];
    if (requestedTab && allowedTabs.includes(requestedTab)) {
      setTab(requestedTab);
    }

    const requestedSessionId = searchParams.get('session');
    if (!requestedSessionId) return;
    if (consumedChatSessionRef.current === String(requestedSessionId)) return;
    const found = [...trials, ...sessions].find((item) => String(item._id) === String(requestedSessionId));
    if (found) {
      consumedChatSessionRef.current = String(requestedSessionId);
      setChatSession(found);
    }
  }, [searchParams, trials, sessions]);

  useEffect(() => {
    if (!ready) return;
    if (tab === 'certificates' && !certificates.length) {
      api.get('/api/lms/my-certificates', { auth: true }).then(setCertificates).catch(() => setCertificates([]));
    }
    if (tab === 'recordings' && !recordings.length) {
      api.get('/api/students/dashboard/recordings', { auth: true })
        .then((d) => setRecordings(d.sessions || [])).catch(() => setRecordings([]));
    }
    if (tab === 'referral' && !referral) {
      api.get('/api/referrals/my', { auth: true }).then(setReferral).catch(() => setReferral({ code: '', stats: {}, referrals: [] }));
    }
  }, [tab, ready, certificates.length, recordings.length, referral]);

  const downloadAllCertificates = async () => {
    if (!certificates.length) return;
    toast.success(
      locale === 'id' ? 'Memulai unduhan massal...' :
      locale === 'ar' ? 'بدء تحميل الشهادات...' :
      'Starting batch download...'
    );

    for (let i = 0; i < certificates.length; i++) {
      const c = certificates[i];
      const certWithStudent = {
        ...c,
        student: c.student || { name: user.name }
      };

      setTimeout(async () => {
        try {
          const { downloadCertificatePdf } = await import('../../lib/certificatePdf');
          await downloadCertificatePdf({ certificate: certWithStudent, locale });
        } catch (err) {
          console.error('Failed to download certificate', c._id, err);
        }
      }, i * 1500);
    }
  };

  const currentSubscription = subscriptions.find((item) => item.status === 'active')
    || subscriptions.find((item) =>
    ['awaiting_placement', 'placed', 'paused'].includes(item.status)
  ) || subscriptions.find((item) =>
    !item.renewalOf && ['pending_payment', 'payment_review'].includes(item.status)
  ) || subscriptions.find((item) =>
    item.status === 'completed'
  ) || null;
  const renewalSubscription = subscriptions.find((item) =>
    String(item.renewalOf?._id || item.renewalOf || '') === String(currentSubscription?._id || '')
    && ['pending_payment', 'payment_review', 'renewal_queued'].includes(item.status)
  ) || null;

  useEffect(() => {
    if (!subscriptionsLoaded || defaultStudentTabRef.current) return;
    defaultStudentTabRef.current = true;
  }, [subscriptionsLoaded]);

  if (!ready) return null;

  const now = new Date();
  const upcomingTrials = trials
    .filter((session) => session.status === 'accepted' && new Date(session.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const pendingTrials = trials.filter((session) => session.status === 'pending');
  const completedTrials = trials
    .filter((session) => session.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt || b.scheduledAt) - new Date(a.updatedAt || a.scheduledAt));
  const trialAllowance = stats.trialAllowance || {
    limit: 3,
    used: trials.filter((session) => ['pending', 'accepted', 'completed'].includes(session.status)).length,
    remaining: Math.max(0, 3 - trials.filter((session) => ['pending', 'accepted', 'completed'].includes(session.status)).length),
  };
  const trialRemaining = Number(trialAllowance.remaining || 0);
  const requestedPostTrialId = searchParams.get('postTrial');
  const postTrialSession = completedTrials.find((session) => String(session._id) === String(requestedPostTrialId || ''))
    || completedTrials[0]
    || null;
  const upcomingSessions = sessions
    .filter((session) => session.status === 'accepted' && new Date(session.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const pendingSessions = sessions.filter((session) => session.status === 'pending');

  const nextActiveSession = [...upcomingSessions, ...upcomingTrials]
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;
  const studentName = profile?.user?.name || user?.name || '';
  const studentFirstName = studentName.trim().split(/\s+/)[0] || (locale === 'ar' ? 'طالبنا' : 'Student');
  const dateLocale = locale === 'id' ? 'id-ID' : locale === 'ar' ? 'ar-EG' : 'en-US';
  const nextSessionTeacherName = nextActiveSession?.teacher?.user?.name
    || nextActiveSession?.teacher?.personalInfo?.fullName
    || nextActiveSession?.teacher?.name
    || (locale === 'ar' ? 'معلم الأكاديمية' : 'Quran Tutor');
  const nextSessionDate = nextActiveSession ? new Date(nextActiveSession.scheduledAt) : null;
  const currentSubscriptionTeacherName = currentSubscription?.preferredTeacher?.personalInfo?.fullName
    || currentSubscription?.preferredTeacher?.user?.name
    || '';
  const subscriptionStatusCopy = currentSubscription ? ({
    pending_payment: {
      ar: 'اختر المعلم وارفع إثبات التحويل لإكمال الاشتراك.',
      en: 'Choose your tutor and upload the transfer proof to continue.',
    },
    payment_review: {
      ar: 'تم رفع التحويل وهو الآن قيد مراجعة الإدارة.',
      en: 'Your transfer proof is under admin review.',
    },
    awaiting_placement: {
      ar: 'تم اعتماد الدفع. الإدارة تعمل الآن على تسكينك مع المعلم الذي اخترته.',
      en: 'Payment approved. Administration is placing you with your selected tutor.',
    },
    placed: {
      ar: 'تم تسكينك في الجروب. الإدارة تحدد المواعيد وتبدأ الحلقة بعد اكتمال العدد، دون خصم أثناء الانتظار.',
      en: 'You have been placed in the group. Administration will set the schedule and start the circle after its minimum size is reached. Waiting does not consume credits.',
    },
    active: {
      ar: 'اشتراكك نشط والحلقة جاهزة.',
      en: 'Your subscription is active and the circle is ready.',
    },
    paused: {
      ar: 'اشتراكك متوقف مؤقتًا. تواصل مع الإدارة للمساعدة.',
      en: 'Your subscription is temporarily paused. Contact administration for help.',
    },
    completed: {
      ar: 'انتهى رصيد الباقة. يمكنك تجديد نفس الجروب والمعلم بسهولة.',
      en: 'Your package balance is finished. You can easily renew the same group and tutor.',
    },
  }[currentSubscription.status] || {
    ar: currentSubscription.status,
    en: currentSubscription.status,
  }) : null;

  const renewSubscription = async (subscription) => {
    if (!subscription?._id) return;
    setRenewingSubscription(true);
    try {
      const result = await api.post(
        '/api/subscriptions/' + encodeURIComponent(subscription._id) + '/renew',
        { sessionCount: Number(renewalSessionCount) },
        { auth: true }
      );
      const renewal = result.subscription;
      toast.success(locale === 'ar'
        ? 'تم إنشاء التجديد بنفس الجروب والمعلم. أكمل التحويل.'
        : 'Renewal created for the same group and tutor. Complete the transfer.');
      if (renewal?._id) {
        navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(renewal._id));
      }
    } catch (error) {
      if (error.code === 'RENEWAL_ALREADY_EXISTS' && error.data?.subscription?._id) {
        navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(error.data.subscription._id));
        return;
      }
      toast.error(error.message || (locale === 'ar' ? 'تعذر إنشاء التجديد' : 'Could not create renewal'));
    } finally {
      setRenewingSubscription(false);
    }
  };

  const loadTeacherUpdateVideo = async (updateId, index) => {
    const key = `${updateId}-${index}`;
    if (teacherUpdateVideoUrls[key]) return;

    try {
      const result = await api.post(`/api/teacher-updates/${updateId}/videos/${index}/access`, {}, { auth: true });
      setTeacherUpdateVideoUrls((current) => ({
        ...current,
        [key]: apiUrl(result.streamUrl),
      }));
    } catch (error) {
      toast.error(error.message || (locale === 'ar' ? 'تعذر فتح فيديو المعلم' : 'Could not open tutor video'));
    }
  };

  const handleStudentRsvp = async (sessionId, status, reason = '') => {
    if (!sessionId) return;
    setSubmittingRsvp(true);
    try {
      const res = await api.post(`/api/sessions/${sessionId}/rsvp`, {
        status,
        excuseReason: reason,
      }, { auth: true });
      toast.success(res.message || (status === 'confirmed'
        ? (locale === 'ar' ? 'تم تأكيد حضورك للحصة بنجاح' : 'Attendance confirmed')
        : (locale === 'ar' ? 'تم تسجيل اعتذارك عن الحصة' : 'Excuse recorded')));
      setStudentExcuseModal(null);
      setStudentExcuseReason('');
      await syncSessions();
    } catch (err) {
      toast.error(err.message || (locale === 'ar' ? 'تعذر تحديث حالة الحضور' : 'Failed to update RSVP'));
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const deleteHomeworkSubmission = async (hw) => {
    try {
      const endpoint = hw.isTask
        ? `/api/homework/tasks/${hw._id}/submission`
        : `/api/homework/submissions/${hw.submissionId || hw._id}`;
      await api.delete(endpoint, { auth: true });
      toast.success(locale === 'ar' ? 'تم فتح الواجب لإعادة التسجيل أو رفع ملف جديد' : 'Submission cleared for re-upload');
      await load();
    } catch (err) {
      toast.error(err.message || (locale === 'ar' ? 'تعذر إعادة فتح الواجب' : 'Could not reset homework'));
    }
  };

  const shareStudentEvaluationViaWhatsApp = (s, reportSurah, reportFromAyah, reportToAyah, ev, reportNotes) => {
    const tName = s.teacher?.user?.name || s.teacher?.personalInfo?.fullName || 'المعلم';
    const text = `🌟 *بطاقة تقييم حلقة القرآن الكريم — أكاديمية وَحْيٌ وَنَمَاء* 🌟\n`
      + `👤 *الطالب:* ${studentName || 'طالب الأكاديمية'}\n`
      + `🎓 *المعلم:* ${tName}\n`
      + (reportSurah ? `📖 *السورة:* ${reportSurah} (${reportFromAyah || 1} - ${reportToAyah || 'آخرها'})\n` : '')
      + `⭐ *الحفظ:* ${ev.memorization ?? '—'}/5 · *التجويد:* ${ev.tajweed ?? '—'}/5\n`
      + (reportNotes ? `💬 *ملاحظات المعلم:* ${reportNotes}\n` : '');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const submitHomework = async (homeworkId, file, sessionId) => {
    if (!file) return;
    try {
      const storageFile = await uploadFileDirect(file, 'homework');
      await api.post(`/api/homework/${homeworkId}/submit`, {
        storageFile,
        sessionId,
      }, { auth: true });
      toast.success(locale === 'id' ? 'Tugas berhasil diunggah' : locale === 'ar' ? 'تم تسليم التلاوة للشيخ بنجاح' : 'Homework uploaded successfully');
      load();
    } catch (e) {
      toast.error(e.message || (locale === 'id' ? 'Gagal mengunggah tugas' : locale === 'ar' ? 'فشل رفع الواجب' : 'Failed to upload homework'));
    }
  };

  const startVoiceRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const actualMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      setAudioBlob(null);
      setAudioUrl(null);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= 600) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 600;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error('يرجى السماح بالوصول إلى الميكروفون لتسجيل تلاوتك');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resetVoiceRecording = () => {
    if (isRecording) {
      stopVoiceRecording();
    }
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordSeconds(0);
  };

  const sendVoiceRecording = async () => {
    if (!audioBlob || !recordModalHw) return;
    setSubmittingVoice(true);
    const mime = audioBlob.type || 'audio/webm';
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `recitation-${Date.now()}.${ext}`, { type: mime });
    try {
      await submitHomework(recordModalHw._id, file, recordModalHw.sessionId);
      setRecordModalHw(null);
      resetVoiceRecording();
    } finally {
      setSubmittingVoice(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const openReview = (session) => {
    setReviewModal(session);
    setReviewForm(emptyReview);
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    try {
      await api.post('/api/reviews', {
        teacherId: reviewModal.teacher?._id,
        sessionId: reviewModal._id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      }, { auth: true });
      await api.put(`/api/sessions/${reviewModal._id}/feedback`, {
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        wouldContinue: reviewForm.wouldContinue,
      }, { auth: true });
      toast.success(locale === 'id' ? 'Ulasan Anda berhasil dikirim' : locale === 'ar' ? 'تم إرسال تقييمك' : 'Review submitted successfully');
      setReviewModal(null);
      load();
    } catch (e) {
      toast.error(e.message || (locale === 'id' ? 'Gagal mengirim ulasan' : locale === 'ar' ? 'فشل إرسال التقييم' : 'Failed to submit review'));
    }
  };

  const openBook = async (teacher) => {
    setBookModal(teacher);
    setBookForm(emptyBook);
    setBookAvailability({
      loading: true,
      configured: false,
      teacherTimezone: '',
      slots: [],
    });

    try {
      const availability = await api.get(`/api/sessions/available-slots/${teacher._id}?days=14`);
      setBookAvailability({
        loading: false,
        configured: Boolean(availability?.configured),
        teacherTimezone: availability?.teacherTimezone || '',
        slots: Array.isArray(availability?.slots) ? availability.slots : [],
      });
    } catch {
      setBookAvailability({
        loading: false,
        configured: false,
        teacherTimezone: '',
        slots: [],
      });
    }
  };

  const bookRegular = async (e) => {
    e.preventDefault();
    if (!bookModal || !bookForm.date || !bookForm.time) return;
    setBooking(true);
    try {
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const scheduledAt = bookAvailability.configured
        ? bookForm.time
        : `${bookForm.date}T${bookForm.time}:00`;

      await api.post('/api/sessions/regular', {
        teacherId: bookModal._id,
        scheduledAt,
        timezone: localTimezone,
        notes: bookForm.notes,
      }, { auth: true });
      toast.success(locale === 'id' ? 'Permintaan sesi berhasil dikirim ke guru' : locale === 'ar' ? 'تم إرسال طلب الحصة للمعلم' : 'Session request sent to tutor');
      setBookModal(null);
      load();
    } catch (err) {
      toast.error(err.message || (locale === 'id' ? 'Gagal memesan sesi' : locale === 'ar' ? 'فشل الحجز' : 'Failed to book session'));
    } finally {
      setBooking(false);
    }
  };

  const refreshGuardianLinks = async () => {
    try {
      const result = await api.get('/api/students/dashboard/guardian-invitations', { auth: true });
      setGuardianInvitations(result.invitations || []);
      setLinkedGuardians(result.linkedGuardians || []);
    } catch {
      // Keep the last known link state during transient failures.
    }
  };

  const submitGuardianInvitation = async (event) => {
    event.preventDefault();
    if (!guardianInviteForm.guardianPhone.trim()) return;

    setSavingGuardianInvite(true);
    try {
      await api.post('/api/students/dashboard/guardian-invitations', {
        guardianPhone: guardianInviteForm.guardianPhone.trim(),
        relationship: guardianInviteForm.relationship,
      }, { auth: true });

      toast.success(locale === 'ar'
        ? 'تم إنشاء طلب الربط. سيظهر لولي الأمر عند تسجيل الدخول بنفس الرقم.'
        : 'Guardian invitation created.');
      setGuardianInviteForm((current) => ({ ...current, guardianPhone: '' }));
      await refreshGuardianLinks();
    } catch (error) {
      toast.error(error.message || (locale === 'ar' ? 'تعذر إنشاء طلب الربط' : 'Could not create guardian invitation'));
    } finally {
      setSavingGuardianInvite(false);
    }
  };

  const cancelGuardianInvitation = async (invitationId) => {
    try {
      await api.delete(`/api/students/dashboard/guardian-invitations/${invitationId}`, { auth: true });
      toast.success(locale === 'ar' ? 'تم إلغاء طلب الربط' : 'Guardian invitation cancelled');
      await refreshGuardianLinks();
    } catch (error) {
      toast.error(error.message || (locale === 'ar' ? 'تعذر إلغاء طلب الربط' : 'Could not cancel invitation'));
    }
  };

  const copyInvitationCode = async (code) => {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    toast.success(locale === 'ar' ? 'تم نسخ كود الربط' : 'Link code copied');
  };

  const copyGuardianLinkCode = async () => {
    const code = profile?.user?.guardianLinkCode;
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    toast.success(locale === 'ar' ? 'تم نسخ كود ربط ولي الأمر' : 'Guardian link code copied');
  };

  const rotateGuardianLinkCode = async () => {
    try {
      const result = await api.post('/api/students/dashboard/guardian-link-code/rotate', {}, { auth: true });
      setProfile((current) => ({
        ...current,
        user: { ...current?.user, guardianLinkCode: result.guardianLinkCode }
      }));
      toast.success(locale === 'ar' ? 'تم إنشاء كود ربط جديد وإلغاء الكود السابق' : 'A new guardian link code was created');
    } catch (error) {
      toast.error(error.message || (locale === 'ar' ? 'تعذر تغيير كود الربط' : 'Could not rotate link code'));
    }
  };

  const hasReviewed = (sessionId) => reviews.some((r) => r.session === sessionId || r.session?._id === sessionId);

  const bookingTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const bookingDateKey = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: bookingTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const bookAvailableDates = bookAvailability.configured
    ? [...new Set(bookAvailability.slots.map((slot) => bookingDateKey(slot.startsAt)))]
    : [];
  const bookSlotsForDate = bookAvailability.configured
    ? bookAvailability.slots.filter((slot) => bookingDateKey(slot.startsAt) === bookForm.date)
    : [];

  const primaryNavItems = [
    { id: 'overview', label: locale === 'id' ? 'Beranda' : locale === 'ar' ? 'الرئيسية' : 'Overview', icon: Sparkles },
    { id: 'discover', label: locale === 'id' ? 'Cari Guru' : locale === 'ar' ? 'اختر معلمك' : 'Find a Tutor', icon: BookOpen },
    { id: 'trials', label: locale === 'id' ? 'Uji Coba' : locale === 'ar' ? 'التجريبية' : 'Trials', icon: Clock, badge: pendingTrials.length + upcomingTrials.length },
    { id: 'sessions', label: locale === 'id' ? 'Sesi' : locale === 'ar' ? 'حصصي' : 'Sessions', icon: Calendar, badge: upcomingSessions.length + pendingSessions.length },
    { id: 'homework', label: locale === 'id' ? 'Tugas' : locale === 'ar' ? 'واجباتي' : 'Homework', icon: FileText, badge: stats.homeworkPending || 0 },
  ].filter((item) => !(teacherLock && item.id === 'discover'));

  const secondaryNavItems = [
    {
      id: 'teacher-updates',
      label: locale === 'ar' ? 'رسائل المعلم' : 'Tutor updates',
      icon: Megaphone,
      badge: teacherUpdates.length,
      description: locale === 'ar' ? 'فيديوهات وكلمات من معلمك' : 'Video messages from your tutor',
    },
    {
      id: 'evaluations',
      label: locale === 'id' ? 'Evaluasi' : locale === 'ar' ? 'التقييمات' : 'Evaluations',
      icon: Star,
      description: locale === 'ar' ? 'ملاحظات المعلم وتقييماتك' : 'Tutor feedback and evaluations',
    },
    {
      id: 'recordings',
      label: locale === 'id' ? 'Rekaman' : locale === 'ar' ? 'التسجيلات' : 'Recordings',
      icon: Mic,
      description: locale === 'ar' ? 'تسجيلات الحصص والتلاوة' : 'Session and recitation recordings',
    },
    {
      id: 'certificates',
      label: locale === 'id' ? 'Sertifikat' : locale === 'ar' ? 'الشهادات' : 'Certificates',
      icon: Award,
      description: locale === 'ar' ? 'شهاداتك المعتمدة' : 'Your earned certificates',
    },
    {
      id: 'achievements',
      label: locale === 'id' ? 'Pencapaian' : locale === 'ar' ? 'الإنجازات' : 'Achievements',
      icon: Trophy,
      description: locale === 'ar' ? 'النقاط والشارات والتقدم' : 'Points, badges, and progress',
    },
    {
      id: 'referral',
      label: locale === 'id' ? 'Afiliasi' : locale === 'ar' ? 'السفراء' : 'Referral',
      icon: Gift,
      description: locale === 'ar' ? 'شارك الخير واكسب نقاطاً' : 'Invite friends and earn points',
    },
    {
      id: 'account',
      label: locale === 'id' ? 'Akun' : locale === 'ar' ? 'حسابي' : 'Account',
      icon: UserRound,
      description: locale === 'ar' ? 'بياناتك ومعلموك ودوراتك' : 'Profile, tutors, and courses',
    },
    { id: 'support', label: locale === 'ar' ? 'تواصل مع الإدارة' : 'Support', icon: Send, description: locale === 'ar' ? 'رسائلك مع إدارة الأكاديمية' : 'Messages with the academy' },
  ];

  return (
    <DashboardLayout title={locale === 'id' ? 'Dasbor Siswa' : locale === 'ar' ? 'لوحة الطالب' : 'Student Dashboard'} user={user} onLogout={logout}>
      <SupportLauncher onOpen={() => setTab('support')} />
      {loading ? (
        <div className="space-y-4 py-6" role="status" aria-live="polite">
          <span className="sr-only">{locale === 'ar' ? 'جاري تحميل لوحة الطالب...' : 'Loading student dashboard...'}</span>
          <Skeleton className="h-36 w-full rounded-2xl" />
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
          {tab !== 'support' && <>
          <StudentInspirationStrip
            studentFirstName={studentFirstName}
            locale={locale}
            streak={gameStats?.streak?.current || profile?.studentProfile?.streak || 0}
            totalPoints={gameStats?.points?.total || profile?.studentProfile?.points || 0}
            completedSessions={stats.completedSessions || 0}
            homeworkSubmitted={stats.homeworkSubmitted || 0}
            homeworkPending={stats.homeworkPending || 0}
            subscription={currentSubscription}
          />
          {subscriptionsLoaded && !currentSubscription && <section className="wn-student-welcome">
            <div className="wn-student-welcome__content">
              <span className="wn-student-welcome__eyebrow">
                <Sparkles size={15} />
                {locale === 'id' ? 'Perjalanan Quran Anda' : locale === 'ar' ? 'رحلتك مع القرآن' : 'Your Quran journey'}
              </span>
              <h2 className="wn-student-welcome__title">
                {locale === 'ar' ? `السلام عليكم، ${studentFirstName}` : locale === 'id' ? `Assalamu’alaikum, ${studentFirstName}` : `Assalamu alaikum, ${studentFirstName}`}
              </h2>
              <p className="wn-student-welcome__lead">
                {nextActiveSession
                  ? (locale === 'ar'
                    ? `حلقتك القادمة مع ${nextSessionTeacherName}. كل ما تحتاجه للحصة والمتابعة موجود هنا.`
                    : `Your next session is with ${nextSessionTeacherName}. Everything you need is here.`)
                  : pendingTrials.length
                    ? (locale === 'ar' ? 'طلبك التجريبي قيد المراجعة من المعلم. سننبهك فور الرد.' : 'Your trial request is waiting for tutor confirmation.')
                    : postTrialSession
                      ? (locale === 'ar'
                        ? (trialRemaining > 0
                          ? `أكملت التجريبية. اشترك للاستمرار مع معلمك، أو لديك ${trialRemaining} تجريبية متبقية لاختيار معلم آخر.`
                          : 'أكملت التجريبيات المتاحة. اشترك الآن للاستمرار مع معلمك.')
                        : (trialRemaining > 0
                          ? `Your trial is complete. Subscribe to continue, or use ${trialRemaining} remaining trial(s).`
                          : 'Your trials are complete. Subscribe to continue with your tutor.'))
                      : (locale === 'ar' ? 'ابدأ بخطوة واضحة: اختر المعلم المناسب واحجز حصتك التجريبية.' : 'Start with one clear step: choose a tutor and book your trial.')}
              </p>

              <div className="wn-student-welcome__actions">
                <button
                  type="button"
                  onClick={() => {
                    if (nextActiveSession) {
                      setTab(nextActiveSession.type === 'trial' ? 'trials' : 'sessions');
                    } else if (currentSubscription?.status === 'pending_payment') {
                      navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(currentSubscription._id));
                    } else if (currentSubscription) {
                      setTab('account');
                    } else if (postTrialSession?.teacher) {
                      navigate(lp('/plans'));
                    } else {
                      setTab('discover');
                    }
                  }}
                  className="wn-student-primary-action"
                >
                  {nextActiveSession
                    ? (locale === 'ar' ? 'عرض الحصة القادمة' : 'View next session')
                    : currentSubscription
                      ? (currentSubscription.status === 'pending_payment'
                          ? (locale === 'ar' ? 'إكمال التحويل' : 'Complete transfer')
                          : (locale === 'ar' ? 'متابعة الاشتراك' : 'Track subscription'))
                      : postTrialSession
                        ? (locale === 'ar' ? 'اشتراك والاستمرار' : 'Subscribe & continue')
                        : (locale === 'ar' ? 'اختر معلمك' : 'Find your tutor')}
                </button>
                <button type="button" onClick={() => setTab('homework')} className="wn-student-secondary-action">
                  <FileText size={16} />
                  {locale === 'ar'
                    ? `واجباتي${stats.homeworkPending ? ` (${stats.homeworkPending})` : ''}`
                    : `Homework${stats.homeworkPending ? ` (${stats.homeworkPending})` : ''}`}
                </button>
              </div>
            </div>

            <div className="wn-student-welcome__summary">
              <div className="wn-student-welcome__metric">
                <Calendar size={18} />
                <div>
                  <small>{locale === 'ar' ? 'الحصة القادمة' : 'Next session'}</small>
                  <strong>
                    {nextSessionDate
                      ? nextSessionDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
                      : (locale === 'ar' ? 'لا يوجد موعد' : 'No session')}
                  </strong>
                </div>
              </div>
              <div className="wn-student-welcome__metric">
                <FileText size={18} />
                <div>
                  <small>{locale === 'ar' ? 'واجبات مطلوبة' : 'Homework due'}</small>
                  <strong>{stats.homeworkPending || 0}</strong>
                </div>
              </div>
              <div className="wn-student-welcome__metric">
                <Trophy size={18} />
                <div>
                  <small>{locale === 'ar' ? 'نقاطك' : 'Your points'}</small>
                  <strong>{gameStats?.points?.total || 0}</strong>
                </div>
              </div>
            </div>
          </section>}

          {!subscriptionsLoaded && <section className="wn-dashboard-surface" role="status">
            <p>{locale === 'ar' ? 'تعذر تأكيد حالة اشتراكك. أعد المحاولة لعرض باقتك.' : 'Could not confirm your subscription. Retry to load your package.'}</p>
            <button className="wn-btn wn-btn--secondary mt-3" onClick={refreshSubscriptions}>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
          </section>}

          {currentSubscription && (
            <section className="wn-student-next-step wn-student-subscription" aria-label={locale === 'ar' ? 'حالة الاشتراك' : 'Subscription status'}>
              <div>
                <span className="wn-student-next-step__eyebrow">
                  {locale === 'ar' ? 'اشتراكك الحالي' : 'Your current package'}
                </span>
                <h3>
                  {currentSubscription.pricingSnapshot?.nameAr
                    ? (locale === 'ar'
                        ? currentSubscription.pricingSnapshot.nameAr
                        : currentSubscription.pricingSnapshot.nameEn || currentSubscription.pricingSnapshot.nameAr)
                    : (locale === 'ar' ? 'اشتراك الأكاديمية' : 'Academy subscription')}
                </h3>
                <p>{locale === 'ar' ? subscriptionStatusCopy?.ar : subscriptionStatusCopy?.en}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                    <CreditCard size={14} />
                    {locale === 'ar'
                      ? `الباقة: ${currentSubscription.sessionCount} حصص · المستخدم: ${currentSubscription.sessionsUsed || 0} · المتبقي: ${currentSubscription.sessionsRemaining}`
                      : `Package: ${currentSubscription.sessionCount} sessions · Used: ${currentSubscription.sessionsUsed || 0} · Remaining: ${currentSubscription.sessionsRemaining}`}
                  </span>
                  {currentSubscriptionTeacherName ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                      <UserRound size={14} />
                      {locale === 'ar' ? `المعلم: ${currentSubscriptionTeacherName}` : `Tutor: ${currentSubscriptionTeacherName}`}
                    </span>
                  ) : null}
                  {currentSubscription.circle?.name ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">
                      <Users size={14} />
                      {locale === 'ar' ? `الجروب: ${currentSubscription.circle.name}` : `Group: ${currentSubscription.circle.name}`}
                    </span>
                  ) : null}
                </div>
                {teacherLock ? (
                  <p className="mt-3 text-xs font-semibold text-slate-600" data-testid="teacher-lock-note">
                    {locale === 'ar'
                      ? 'تم اعتماد معلمك لهذه الرحلة. لتغيير المعلم تواصل مع إدارة الأكاديمية.'
                      : 'Your tutor is confirmed for this journey. To change tutor, contact the academy.'}
                    {' '}
                    <button type="button" onClick={() => setTab('support')} className="font-bold text-emerald-700 underline">
                      {locale === 'ar' ? 'تواصل مع الإدارة' : 'Contact support'}
                    </button>
                  </p>
                ) : null}
              <div className="mt-4 space-y-3" data-testid="subscription-details">
                <p className="text-sm font-semibold">{locale === 'ar' ? 'سعر الحصة:' : 'Price per lesson:'} {Number(currentSubscription.pricePerSessionMinor || 0) / 100} {currentSubscription.currency || 'EGP'}</p>
                <progress className="w-full" value={currentSubscription.sessionsUsed || 0} max={currentSubscription.sessionCount} aria-label={locale === 'ar' ? 'الحصص المستخدمة' : 'Used sessions'} />
                {currentSubscription.circle && <p className="text-sm">{locale === 'ar' ? 'طلاب المجموعة:' : 'Group learners:'} {currentSubscription.circle.students?.length || 0}/{currentSubscription.circle.capacity || '—'}</p>}
                {(currentSubscription.circle?.schedule || []).length > 0 && <div className="text-sm">
                  <strong>{locale === 'ar' ? 'جدول الحلقة' : 'Circle schedule'} — {currentSubscription.circle.timezone || 'Africa/Cairo'}</strong>
                  {(currentSubscription.circle.schedule || []).map((row, index) => <p key={index}>{(locale === 'ar' ? { Saturday: 'السبت', Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة' }[row.day] : row.day) || row.day}: {row.startTime}–{row.endTime}</p>)}
                </div>}
                {currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining) <= 2 && !renewalSubscription && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" data-testid="low-balance-alert">
                  {locale === 'ar' ? `متبقي لك ${currentSubscription.sessionsRemaining} حصة في باقتك. جدّد اشتراكك للاستمرار مع نفس المعلم والمجموعة.` : `You have ${currentSubscription.sessionsRemaining} lessons left. Renew to continue with the same tutor and group.`}
                </div>}
              </div>
              </div>
              <div className="wn-student-next-step__actions">
                {currentSubscription.status === 'pending_payment' ? (
                  <button
                    type="button"
                    onClick={() => navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(currentSubscription._id))}
                    className="wn-student-primary-action"
                  >
                    <CreditCard size={17} />
                    {locale === 'ar' ? 'إكمال التحويل' : 'Complete transfer'}
                  </button>
                ) : null}
                {currentSubscription.status === 'payment_review' ? (
                  <span className="text-xs font-semibold text-amber-700">
                    {locale === 'ar' ? 'بانتظار مراجعة الإدارة' : 'Waiting for admin review'}
                  </span>
                ) : null}
                {currentSubscription.status === 'awaiting_placement' ? (
                  <span className="text-xs font-semibold text-blue-700">
                    {locale === 'ar' ? 'الدفع معتمد — بانتظار التسكين' : 'Payment approved — awaiting placement'}
                  </span>
                ) : null}
                {currentSubscription.status === 'placed' ? (
                  <span className="text-xs font-semibold text-blue-700">
                    {locale === 'ar' ? (currentSubscription.circle?.status === 'ready' ? 'اكتمل العدد — بانتظار تحديد المواعيد والبدء' : 'تم التسكين — الجروب قيد الاكتمال') : (currentSubscription.circle?.status === 'ready' ? 'Group ready — awaiting schedule and start' : 'Placed — group forming')}
                  </span>
                ) : null}
                {currentSubscription.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setTab('sessions')}
                    className="wn-student-primary-action"
                  >
                    <Calendar size={17} />
                    {locale === 'ar' ? 'عرض حصصي' : 'View sessions'}
                  </button>
                ) : null}

                {renewalSubscription ? (
                  renewalSubscription.status === 'pending_payment' ? (
                    <button
                      type="button"
                      onClick={() => navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(renewalSubscription._id))}
                      className="wn-student-primary-action"
                    >
                      <CreditCard size={17} />
                      {locale === 'ar' ? 'إكمال دفع التجديد' : 'Complete renewal payment'}
                    </button>
                  ) : renewalSubscription.status === 'payment_review' ? (
                    <span className="text-xs font-semibold text-amber-700">
                      {locale === 'ar' ? 'تجديدك قيد مراجعة التحويل' : 'Renewal payment under review'}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">
                      {locale === 'ar'
                        ? `التجديد مدفوع وجاهز: ${renewalSubscription.sessionCount} حصة تبدأ تلقائيًا بعد انتهاء الرصيد الحالي`
                        : `Renewal paid and ready: ${renewalSubscription.sessionCount} sessions will activate automatically`}
                    </span>
                  )
                ) : (
                  ((currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining || 0) <= 2)
                    || currentSubscription.status === 'completed') ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={renewalSessionCount}
                        onChange={(event) => setRenewalSessionCount(Number(event.target.value))}
                        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800"
                        aria-label={locale === 'ar' ? 'عدد حصص التجديد' : 'Renewal sessions'}
                      >
                        {[4, 8, 12, 24].map((count) => (
                          <option key={count} value={count}>{count} {locale === 'ar' ? 'حصص' : 'sessions'}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={renewingSubscription}
                        onClick={() => renewSubscription(currentSubscription)}
                        className="wn-student-primary-action"
                      >
                        <RotateCcw size={17} />
                        {renewingSubscription
                          ? (locale === 'ar' ? 'جاري إنشاء التجديد...' : 'Creating renewal...')
                          : (locale === 'ar' ? 'تجديد الاشتراك' : 'Renew subscription')}
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}

          {subscriptionsLoaded && postTrialSession && !currentSubscription && (
            <section className="wn-student-next-step">
              <div>
                <span className="wn-student-next-step__eyebrow">{locale === 'ar' ? 'خطوتك التالية' : 'Next step'}</span>
                <h3>{locale === 'ar' ? 'أكملت الحصة التجريبية بنجاح' : 'Your trial session is complete'}</h3>
                <p>
                  {locale === 'ar'
                    ? `اشترك للاستمرار مع ${postTrialSession.teacher?.user?.name || postTrialSession.teacher?.personalInfo?.fullName || 'المعلم'}. لديك 3 حصص تجريبية إجمالاً، والمتبقي الآن ${trialRemaining}.`
                    : `Subscribe to continue with this tutor. You have 3 trial sessions in total, with ${trialRemaining} remaining.`}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  <Clock size={14} />
                  {locale === 'ar'
                    ? `التجريبيات: ${trialAllowance.used || 0} مستخدمة من ${trialAllowance.limit || 3} · ${trialRemaining} متبقية`
                    : `Trials: ${trialAllowance.used || 0} used of ${trialAllowance.limit || 3} · ${trialRemaining} remaining`}
                </div>
              </div>
              <div className="wn-student-next-step__actions">
                <button type="button" onClick={() => navigate(lp('/plans'))} className="wn-student-primary-action">
                  <CreditCard size={17} />
                  {locale === 'ar' ? 'اشتراك' : 'Subscribe'}
                </button>
                {trialRemaining > 0 ? (
                  <button type="button" onClick={() => setTab('discover')} className="wn-student-secondary-action">
                    {locale === 'ar' ? 'استخدم تجريبية أخرى' : 'Use another trial'}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">
                    {locale === 'ar' ? 'استخدمت الحصص التجريبية الثلاث' : 'All three trials have been used'}
                  </span>
                )}
              </div>
            </section>
          )}

          </>}
          <div className="wn-dashboard-surface wn-student-surface">
            <StudentCommandBar
              primaryItems={primaryNavItems}
              secondaryItems={secondaryNavItems}
              active={tab}
              onChange={setTab}
              locale={locale}
            />

            {tab === 'support' && <SupportChat />}

            {tab === 'overview' && subscriptionsLoaded && (
              <div className="wn-student-overview">
                {currentSubscription && (
                  <section className="wn-student-active-subscription-card rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-5 shadow-sm mb-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white text-xs font-bold px-3 py-1">
                            <Sparkles size={13} />
                            {locale === 'ar' ? 'اشتراك نشط' : 'Active Subscription'}
                          </span>
                          <span className="rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-semibold px-2.5 py-0.5">
                            {locale === 'ar' ? subscriptionStatusCopy?.ar : subscriptionStatusCopy?.en}
                          </span>
                        </div>
                        <h3 className="mt-2 text-xl font-black text-slate-900">
                          {currentSubscription.pricingSnapshot?.nameAr
                            ? (locale === 'ar'
                                ? currentSubscription.pricingSnapshot.nameAr
                                : currentSubscription.pricingSnapshot.nameEn || currentSubscription.pricingSnapshot.nameAr)
                            : (locale === 'ar' ? 'باقة الأكاديمية' : 'Academy Package')}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {currentSubscriptionTeacherName
                            ? (locale === 'ar' ? `مع المعلم ${currentSubscriptionTeacherName}` : `With tutor ${currentSubscriptionTeacherName}`)
                            : (locale === 'ar' ? 'معلم معتمد من الأكاديمية' : 'Approved Academy tutor')}
                          {currentSubscription.circle?.name ? ` · ${locale === 'ar' ? 'حلقة:' : 'Circle:'} ${currentSubscription.circle.name}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTab('sessions')}
                          className="wn-student-primary-action text-sm"
                        >
                          <Calendar size={16} />
                          {locale === 'ar' ? 'عرض حصصي' : 'My Sessions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab('homework')}
                          className="wn-student-secondary-action text-sm"
                        >
                          <FileText size={16} />
                          {locale === 'ar' ? 'الواجبات' : 'Homework'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-emerald-100/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/80 p-3 border border-emerald-100">
                        <span className="text-xs text-slate-500 block mb-1">
                          {locale === 'ar' ? 'الحصص المتبقية' : 'Remaining Sessions'}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <strong className="text-2xl font-black text-emerald-800">
                            {currentSubscription.sessionsRemaining}
                          </strong>
                          <span className="text-xs text-slate-500">
                            / {currentSubscription.sessionCount} {locale === 'ar' ? 'حصة' : 'sessions'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/80 p-3 border border-emerald-100">
                        <span className="text-xs text-slate-500 block mb-1">
                          {locale === 'ar' ? 'الحصص المنجزة' : 'Completed Sessions'}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <strong className="text-2xl font-black text-slate-800">
                            {currentSubscription.sessionsUsed || 0}
                          </strong>
                          <span className="text-xs text-slate-500">
                            {locale === 'ar' ? 'حصة مستخدمة' : 'used'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/80 p-3 border border-emerald-100">
                        <span className="text-xs text-slate-500 block mb-1">
                          {locale === 'ar' ? 'نسبة الاستهلاك' : 'Progress'}
                        </span>
                        <div className="flex flex-col justify-center h-full">
                          <progress
                            className="w-full h-2.5 rounded-full overflow-hidden accent-emerald-600"
                            value={currentSubscription.sessionsUsed || 0}
                            max={currentSubscription.sessionCount || 1}
                            aria-label={locale === 'ar' ? 'الحصص المستخدمة' : 'Used sessions'}
                          />
                          <span className="text-[11px] text-slate-500 mt-1 font-semibold text-end">
                            {Math.round(((currentSubscription.sessionsUsed || 0) / (currentSubscription.sessionCount || 1)) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining) <= 2 && !renewalSubscription && (
                      <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm font-semibold text-amber-900 flex items-center justify-between flex-wrap gap-2" data-testid="low-balance-alert-overview">
                        <span>
                          {locale === 'ar'
                            ? `متبقي لك ${currentSubscription.sessionsRemaining} حصة فقط في باقتك. جدّد الآن لضمان استمرار الحلقات دون انقطاع.`
                            : `You only have ${currentSubscription.sessionsRemaining} lessons left. Renew now to ensure uninterrupted learning.`}
                        </span>
                        <button
                          type="button"
                          onClick={() => renewSubscription(currentSubscription)}
                          disabled={renewingSubscription}
                          className="wn-student-primary-action text-xs py-1.5 px-3"
                        >
                          <RotateCcw size={14} />
                          {renewingSubscription ? (locale === 'ar' ? 'جاري التجديد...' : 'Renewing...') : (locale === 'ar' ? 'تجديد الاشتراك' : 'Renew')}
                        </button>
                      </div>
                    )}
                  </section>
                )}

                <div className="wn-student-overview__grid">
                  <section className="wn-student-session-panel">
                    <div className="wn-student-section-heading">
                      <div>
                        <span>{locale === 'ar' ? 'الأولوية الآن' : 'Up next'}</span>
                        <h3>{locale === 'ar' ? 'الحصة القادمة' : 'Your next session'}</h3>
                      </div>
                      {nextActiveSession ? (
                        <button
                          type="button"
                          onClick={() => setTab(nextActiveSession.type === 'trial' ? 'trials' : 'sessions')}
                          className="wn-student-text-action"
                        >
                          {locale === 'ar' ? 'كل الحصص' : 'All sessions'}
                        </button>
                      ) : null}
                    </div>

                    {nextActiveSession ? (
                      <div className="wn-student-session-panel__body">
                        <div className="wn-student-session-panel__date">
                          <strong>{nextSessionDate?.toLocaleDateString(dateLocale, { day: '2-digit' })}</strong>
                          <span>{nextSessionDate?.toLocaleDateString(dateLocale, { month: 'short' })}</span>
                        </div>
                        <div className="wn-student-session-panel__details">
                          <span className="wn-student-session-type">
                            {nextActiveSession.type === 'trial'
                              ? (locale === 'ar' ? 'حصة تجريبية' : 'Trial session')
                              : (locale === 'ar' ? 'حصة منتظمة' : 'Regular session')}
                          </span>
                          <h4>{nextSessionTeacherName}</h4>
                          <p>
                            <Clock size={15} />
                            {nextSessionDate?.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Link
                          to={localizedPath(getSessionLiveRoomPath(nextActiveSession), locale)}
                          className="wn-student-join-action"
                        >
                          <Video size={17} />
                          {locale === 'ar' ? 'دخول الحصة' : 'Join session'}
                        </Link>
                      </div>
                    ) : (
                      <div className="wn-student-empty-session">
                        <BookOpen size={28} />
                        <div>
                          <h4>{locale === 'ar' ? 'لا توجد حصة قادمة' : 'No upcoming session'}</h4>
                          <p>
                            {currentSubscription
                              ? (locale === 'ar'
                                ? 'سيقوم معلمك أو إدارة الأكاديمية بجدولة حصصك القادمة قريباً.'
                                : 'Your tutor or academy administration will schedule your upcoming sessions soon.')
                              : postTrialSession
                              ? (locale === 'ar'
                                ? (trialRemaining > 0 ? `اشترك للاستمرار، أو استخدم واحدة من ${trialRemaining} تجريبية متبقية.` : 'اشترك للاستمرار مع معلمك.')
                                : (trialRemaining > 0 ? `Subscribe to continue, or use one of ${trialRemaining} remaining trials.` : 'Subscribe to continue with your tutor.'))
                              : (locale === 'ar' ? 'اختر معلماً معتمداً وابدأ بحصة تجريبية.' : 'Choose an approved tutor and start with a trial.')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => currentSubscription ? setTab('sessions') : postTrialSession?.teacher ? navigate(lp('/plans')) : setTab('discover')}
                          className="wn-student-primary-action"
                        >
                          {currentSubscription
                            ? (locale === 'ar' ? 'عرض جدول الحصص' : 'View session schedule')
                            : postTrialSession
                            ? (locale === 'ar' ? 'اشتراك' : 'Subscribe')
                            : (locale === 'ar' ? 'اختر معلمك' : 'Find a tutor')}
                        </button>
                      </div>
                    )}
                  </section>

                  <aside className="wn-student-quick-panel">
                    <div className="wn-student-section-heading">
                      <div>
                        <span>{locale === 'ar' ? 'وصول سريع' : 'Quick access'}</span>
                        <h3>{locale === 'ar' ? 'ماذا تريد أن تفعل؟' : 'What do you need?'}</h3>
                      </div>
                    </div>
                    <div className="wn-student-quick-grid">
                      {!teacherLock && (
                        <button type="button" onClick={() => setTab('discover')} className="wn-student-quick-card">
                          <Users size={20} />
                          <span>{locale === 'ar' ? 'اختر معلمك' : 'Find tutor'}</span>
                        </button>
                      )}
                      <button type="button" onClick={() => setTab('sessions')} className="wn-student-quick-card">
                        <Calendar size={20} />
                        <span>{locale === 'ar' ? 'حصصي' : 'My sessions'}</span>
                      </button>
                      <button type="button" onClick={() => setTab('homework')} className="wn-student-quick-card">
                        <FileText size={20} />
                        <span>{locale === 'ar' ? 'واجباتي' : 'Homework'}</span>
                      </button>
                      <button type="button" onClick={() => setTab(teacherUpdates.length ? 'teacher-updates' : 'achievements')} className="wn-student-quick-card">
                        {teacherUpdates.length ? <Megaphone size={20} /> : <Trophy size={20} />}
                        <span>
                          {teacherUpdates.length
                            ? (locale === 'ar' ? 'رسائل المعلم' : 'Tutor updates')
                            : (locale === 'ar' ? 'إنجازاتي' : 'Achievements')}
                        </span>
                      </button>
                    </div>
                  </aside>
                </div>

                <div className="wn-student-stat-grid">
                  <StatCard label={locale === 'ar' ? 'حصص قادمة' : 'Upcoming sessions'} value={stats.upcomingSessions || 0} icon={Calendar} />
                  {currentSubscription ? (
                    <StatCard
                      label={locale === 'ar' ? 'حصص متبقية بالباقة' : 'Remaining package sessions'}
                      value={currentSubscription.sessionsRemaining ?? 0}
                      icon={Clock}
                    />
                  ) : (
                    <StatCard label={locale === 'ar' ? 'تجريبيات متبقية' : 'Trials remaining'} value={trialRemaining} icon={Clock} />
                  )}
                  <StatCard label={locale === 'ar' ? 'حصص مكتملة' : 'Completed sessions'} value={stats.completedSessions || 0} icon={CheckCircle} />
                  <StatCard label={locale === 'ar' ? 'واجبات تم تسليمها' : 'Homework submitted'} value={stats.homeworkSubmitted || 0} icon={FileText} />
                </div>

                {teacherUpdates[0] && (
                  <section className="wn-student-teacher-update-preview">
                    <span className="wn-student-teacher-update-preview__icon"><Megaphone size={20} /></span>
                    <div>
                      <span>{locale === 'ar' ? 'رسالة جديدة من معلمك' : 'New tutor update'}</span>
                      <h3>{teacherUpdates[0].title}</h3>
                      <p>{teacherUpdates[0].message || (locale === 'ar' ? 'أرسل لك معلمك فيديو جديدًا.' : 'Your tutor shared a new video.')}</p>
                    </div>
                    <button type="button" onClick={() => setTab('teacher-updates')} className="wn-student-primary-action">
                      {locale === 'ar' ? 'مشاهدة الرسالة' : 'View update'}
                    </button>
                  </section>
                )}

                <div className="wn-student-overview__lower">
                  <section className="wn-student-journey-card">
                    <div className="wn-student-section-heading">
                      <div>
                        <span>{locale === 'ar' ? 'ملخص رحلتك' : 'Journey snapshot'}</span>
                        <h3>{locale === 'ar' ? 'تقدمك في مكان واحد' : 'Your progress in one place'}</h3>
                      </div>
                    </div>
                    <div className="wn-student-journey-list">
                      <button type="button" onClick={() => setTab('sessions')}>
                        <span>{locale === 'ar' ? 'الحصص المكتملة' : 'Completed sessions'}</span>
                        <strong>{stats.completedSessions || 0}</strong>
                      </button>
                      <button type="button" onClick={() => setTab('homework')}>
                        <span>{locale === 'ar' ? 'الواجبات المسلمة' : 'Submitted homework'}</span>
                        <strong>{stats.homeworkSubmitted || 0}</strong>
                      </button>
                      <button type="button" onClick={() => setTab('account')}>
                        <span>{locale === 'ar' ? 'الدورات المسجلة' : 'Enrolled courses'}</span>
                        <strong>{courses.length}</strong>
                      </button>
                      <button type="button" onClick={() => setTab('account')}>
                        <span>{locale === 'ar' ? 'المعلمون في رحلتك' : 'Your tutors'}</span>
                        <strong>{myTeachers.length}</strong>
                      </button>
                    </div>
                  </section>

                  {referral?.code ? (
                    <section className="wn-student-referral-card">
                      <Gift size={24} />
                      <span>{locale === 'ar' ? 'برنامج السفراء' : 'Referral program'}</span>
                      <h3>{locale === 'ar' ? 'شارك الخير واكسب نقاطاً' : 'Invite a friend and earn points'}</h3>
                      <p>{locale === 'ar' ? `جمعت ${referral.stats?.totalPoints || 0} نقطة حتى الآن.` : `You have earned ${referral.stats?.totalPoints || 0} points so far.`}</p>
                      <div className="wn-student-referral-card__code">
                        <code>{referral.code}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(referral.link || referral.code);
                            toast.success(locale === 'ar' ? 'تم نسخ رابط الإحالة' : 'Referral link copied');
                          }}
                        >
                          <Copy size={15} />
                          {locale === 'ar' ? 'نسخ' : 'Copy'}
                        </button>
                      </div>
                      <button type="button" onClick={() => setTab('referral')} className="wn-student-text-action">
                        {locale === 'ar' ? 'عرض التفاصيل' : 'View details'}
                      </button>
                    </section>
                  ) : (
                    <section className="wn-student-referral-card is-muted">
                      <Sparkles size={24} />
                      <span>{locale === 'ar' ? 'خطوة مقترحة' : 'Suggested next step'}</span>
                      <h3>
                        {pendingTrials.length
                          ? (locale === 'ar' ? 'طلبك التجريبي في انتظار رد المعلم' : 'Your trial request is awaiting a response')
                          : stats.homeworkPending
                            ? (locale === 'ar' ? 'لديك واجب يحتاج إلى التسليم' : 'You have homework waiting')
                            : teacherLock
                              ? (locale === 'ar' ? 'تابع حصصك مع معلمك' : 'Follow your sessions with your tutor')
                              : (locale === 'ar' ? 'استكشف المعلمين واختر الأنسب لك' : 'Explore tutors and find your match')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTab(pendingTrials.length ? 'trials' : stats.homeworkPending ? 'homework' : teacherLock ? 'sessions' : 'discover')}
                        className="wn-student-primary-action"
                      >
                        {locale === 'ar' ? 'ابدأ الآن' : 'Continue'}
                      </button>
                    </section>
                  )}
                </div>
              </div>
            )}

            {tab === 'discover' && (
              <StudentTeacherMarketplace teachers={discoverTeachers} locale={locale} loadFailed={Boolean(loadErrors.discover)} onRetry={load} />
            )}

            {tab === 'account' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                  <h3 className="font-bold mb-3">{locale === 'id' ? 'Selamat datang,' : locale === 'ar' ? 'مرحباً،' : 'Welcome,'} {profile?.user?.name || user?.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <InfoRow label={locale === 'id' ? 'Email' : locale === 'ar' ? 'البريد' : 'Email'} value={profile?.user?.email || user?.email} />
                    <InfoRow label={locale === 'id' ? 'Telepon' : locale === 'ar' ? 'الهاتف' : 'Phone'} value={profile?.user?.phone} />
                    <InfoRow label={locale === 'id' ? 'Sesi Selesai' : locale === 'ar' ? 'حصص مكتملة' : 'Completed Sessions'} value={profile?.summary?.completedSessions || 0} />
                    <InfoRow label={locale === 'ar' ? 'مستواي المبدئي' : 'My starting level'} value={learnerLevelLabel(profile?.user?.currentLevel || user?.currentLevel, locale)} />
                    <InfoRow label={locale === 'ar' ? 'المسار التعليمي' : 'Learning track'} value={(profile?.user?.onboarding?.trackSelected || user?.onboarding?.trackSelected) ? learnerTrackLabel(profile?.user?.preferredTrack || user?.preferredTrack, locale) : (locale === 'ar' ? 'لم يتم الاختيار' : 'Not selected')} />
                  </div>
                  <p className="mt-3 text-xs text-slate-600">{locale === 'ar' ? 'المستوى مبدئي، ويتأكد المعلم منه داخل الحصة التجريبية.' : 'Your tutor verifies your level during the trial lesson.'}</p>
                  <Link className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100" to={lp('/profile/setup')}>{locale === 'ar' ? 'تعديل بياناتي ومستواي' : 'Edit my profile and level'}</Link>
                </div>

                <section className="wn-student-guardian-link">
                  <div className="wn-student-guardian-link__heading">
                    <div>
                      <span>{locale === 'ar' ? 'ولي الأمر' : 'Guardian'}</span>
                      <h3>{locale === 'ar' ? 'ربط حساب ولي الأمر' : 'Guardian account linking'}</h3>
                      <p>
                        {locale === 'ar'
                          ? 'الربط لا يتم تلقائيًا بمجرد كتابة الرقم. ولي الأمر يجب أن يوافق من حسابه، أو يستخدم كود الربط.'
                          : 'Entering a phone number never links an account automatically. The guardian must confirm or use the link code.'}
                      </p>
                    </div>
                    <Users size={24} />
                  </div>

                  {linkedGuardians.length > 0 && (
                    <div className="wn-student-guardian-linked">
                      {linkedGuardians.map((guardian) => (
                        <div key={guardian.id}>
                          <span className="wn-student-guardian-avatar">{guardian.name?.slice(0, 1) || 'و'}</span>
                          <span>
                            <strong>{guardian.name}</strong>
                            <small>{guardianRelationshipLabel(guardian.relationship, locale)} · {locale === 'ar' ? 'مرتبط' : 'Linked'}</small>
                          </span>
                          <CheckCircle size={18} />
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={submitGuardianInvitation} className="wn-student-guardian-form">
                    <div>
                      <label>{locale === 'ar' ? 'رقم ولي الأمر' : 'Guardian phone'}</label>
                      <input
                        type="tel"
                        className="input-field w-full"
                        placeholder="+20 10 0000 0000"
                        value={guardianInviteForm.guardianPhone}
                        onChange={(event) => setGuardianInviteForm((current) => ({ ...current, guardianPhone: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label>{locale === 'ar' ? 'صلة القرابة' : 'Relationship'}</label>
                      <select
                        className="input-field w-full"
                        value={guardianInviteForm.relationship}
                        onChange={(event) => setGuardianInviteForm((current) => ({ ...current, relationship: event.target.value }))}
                      >
                        <option value="father">{locale === 'ar' ? 'أب' : 'Father'}</option>
                        <option value="mother">{locale === 'ar' ? 'أم' : 'Mother'}</option>
                        <option value="guardian">{locale === 'ar' ? 'ولي أمر / وصي' : 'Guardian'}</option>
                        <option value="other">{locale === 'ar' ? 'صلة أخرى' : 'Other'}</option>
                      </select>
                    </div>
                    <button type="submit" disabled={savingGuardianInvite || !guardianInviteForm.guardianPhone.trim()}>
                      {savingGuardianInvite
                        ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                        : (locale === 'ar' ? 'إنشاء طلب ربط' : 'Create invitation')}
                    </button>
                  </form>

                  {guardianInvitations.length > 0 && (
                    <div className="wn-student-guardian-invitations">
                      <h4>{locale === 'ar' ? 'طلبات الربط' : 'Link requests'}</h4>
                      {guardianInvitations.slice(0, 8).map((invitation) => (
                        <div key={invitation._id} className={`is-${invitation.status}`}>
                          <span>
                            <strong>{guardianRelationshipLabel(invitation.relationship, locale)}</strong>
                            <small>
                              {invitation.phoneMasked || '—'} · {guardianInvitationStatus(invitation.status, locale)}
                            </small>
                          </span>
                          {invitation.status === 'pending' && (
                            <div>
                              <button type="button" onClick={() => copyInvitationCode(invitation.linkCode)}>
                                <Copy size={14} />
                                {invitation.linkCode}
                              </button>
                              <button type="button" onClick={() => cancelGuardianInvitation(invitation._id)}>
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {guardianInvitations.every((invitation) => invitation.status !== 'pending') && profile?.user?.guardianLinkCode && (
                    <div className="wn-student-guardian-fallback">
                      <span>{locale === 'ar' ? 'كود احتياطي قديم' : 'Legacy fallback code'}</span>
                      <button type="button" onClick={copyGuardianLinkCode}>
                        <Copy size={14} />
                        {profile.user.guardianLinkCode}
                      </button>
                    </div>
                  )}
                </section>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5">
                    <Trophy className="text-emerald-600 mb-2" size={28} />
                    <p className="text-2xl font-bold text-emerald-700">{gameStats?.points?.total || 0} {locale === 'id' ? 'poin' : locale === 'ar' ? 'نقطة' : 'points'}</p>
                    <p className="text-sm text-slate-600">
                      {locale === 'id' ? `Level ${gameStats?.points?.level || 1}` : locale === 'ar' ? `المستوى ${gameStats?.points?.level || 1}` : `Level ${gameStats?.points?.level || 1}`} — 🔥 {gameStats?.streaks?.current || 0} {locale === 'id' ? 'hari' : locale === 'ar' ? 'يوم' : 'days'}
                    </p>
                    {(badges.unlocked || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {badges.unlocked.slice(0, 4).map((b) => (
                          <span key={b._id} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            {b.badge?.name?.ar || b.badge?.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border rounded-xl p-5">
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><BookOpen size={16} /> {locale === 'id' ? 'Kursus Saya' : locale === 'ar' ? 'دوراتي' : 'My Courses'} ({courses.length})</h3>
                    {courses.length === 0 ? (
                      <Link to={lp('/courses')} className="text-sm text-emerald-600 hover:underline">{locale === 'id' ? 'Cari Kursus' : locale === 'ar' ? 'تصفح الدورات' : 'Browse Courses'}</Link>
                    ) : courses.slice(0, 3).map((e) => (
                      <div key={e._id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                        <span>{locale === 'id' ? (e.course?.title?.id || e.course?.title?.en) : (e.course?.title?.ar || 'دورة')}</span>
                        <button onClick={() => navigate(lp(`/courses/${e.course?.slug}/learn`))} className="text-emerald-600 text-xs">{locale === 'id' ? 'Lanjutkan' : locale === 'ar' ? 'متابعة' : 'Continue'}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold flex items-center gap-2"><Users size={18} /> {locale === 'id' ? 'Guru Saya' : locale === 'ar' ? 'معلمي' : 'My Tutors'} ({myTeachers.length})</h3>
                    {!teacherLock && (
                      <Link to={lp('/teachers')} className="text-sm text-emerald-600 hover:underline">{locale === 'id' ? 'Cari Guru' : locale === 'ar' ? 'ابحث عن معلم' : 'Find a Tutor'}</Link>
                    )}
                  </div>
                  {myTeachers.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">{locale === 'id' ? 'Pesan sesi uji coba gratis dari halaman guru' : locale === 'ar' ? 'احجز حصة تجريبية من صفحة المعلمين' : 'Book a trial session from the teachers page'}</p>
                  ) : myTeachers.map((t) => (
                    <div key={t._id} className="border rounded-lg p-4 mb-2 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <h4 className="font-bold">{t.name}</h4>
                        <p className="text-xs text-gray-500">
                          {t.country} — {t.sessionCount} {locale === 'id' ? 'sesi' : locale === 'ar' ? 'حصة' : 'sessions'} — ⭐ {Number(t.ratingCount || 0) > 0
                            ? Number(t.rating || 0).toFixed(1)
                            : (locale === 'ar' ? 'بدون تقييم بعد' : 'No ratings yet')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(lp(`/teachers/${t._id}`))} className="px-3 py-1.5 border rounded-lg text-sm">{locale === 'id' ? 'Profil' : locale === 'ar' ? 'الملف' : 'Profile'}</button>
                        {t.canBookRegular && (
                          <button onClick={() => openBook(t)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">{locale === 'id' ? 'Pesan Sesi' : locale === 'ar' ? 'حجز حصة' : 'Book Session'}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'trials' && (
              <div className="space-y-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">{locale === 'id' ? 'Permintaan sesi uji coba dengan guru' : locale === 'ar' ? 'طلبات الحصة التجريبية مع المعلمين' : 'Trial session requests with tutors'}</p>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                    {locale === 'ar'
                      ? `${trialRemaining} من 3 تجريبيات متبقية`
                      : `${trialRemaining} of 3 trials remaining`}
                  </span>
                </div>
                {trials.length === 0 && loadErrors.trials ? (
                  <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center">
                    <p className="font-bold text-red-800">{locale === 'ar' ? 'تعذر تحميل طلباتك التجريبية' : 'We could not load your trial requests'}</p>
                    <p className="mt-1 text-sm text-red-700">{locale === 'ar' ? 'قد تكون لديك طلبات بالفعل. أعد المحاولة بعد لحظات.' : 'You may already have requests. Please try again in a moment.'}</p>
                    <button type="button" onClick={load} className="btn-primary mt-3 inline-block text-sm">{locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}</button>
                  </div>
                ) : trials.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-3">{locale === 'id' ? 'Tidak ada permintaan uji coba' : locale === 'ar' ? 'لم تحجز حصة تجريبية بعد' : 'You have not booked a trial yet'}</p>
                    {!teacherLock && (
                      <button type="button" onClick={() => setTab('discover')} className="btn-primary inline-block text-sm">{locale === 'id' ? 'Pesan Sesi Uji Coba' : locale === 'ar' ? 'اختر معلمًا واحجز تجريبيتك' : 'Choose a tutor and book a trial'}</button>
                    )}
                  </div>
                ) : trials.map((s) => (
                  <SessionCard key={s._id} session={s} onReview={openReview} hasReviewed={hasReviewed(s._id)} onChat={setChatSession} onRsvp={(sess, st) => st === 'excused' ? setStudentExcuseModal(sess) : handleStudentRsvp(sess._id, 'confirmed')} currentUserId={user?._id || user?.id} />
                ))}
              </div>
            )}

            {tab === 'sessions' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 mb-2">{locale === 'id' ? 'Sesi kelas reguler Anda setelah guru menyetujui' : locale === 'ar' ? (currentSubscription ? 'حصص اشتراكك ومواعيد حلقتك' : 'حصصك المنتظمة بعد الموافقة على المعلم') : 'Your regular sessions after tutor approval'}</p>
                {sessions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">{locale === 'id' ? 'Tidak ada sesi reguler — Selesaikan kelas uji coba terlebih dahulu, lalu pesan dari menu akun' : locale === 'ar' ? (currentSubscription ? (currentSubscription.status === 'active' ? 'لا توجد حصص مجدولة حتى الآن. ستظهر هنا بعد جدولة الإدارة أو المعلم.' : subscriptionStatusCopy?.ar) : 'لا حصص منتظمة — أكمل تجريبية ثم احجز من «حسابي»') : (currentSubscription ? (currentSubscription.status === 'active' ? 'No lessons scheduled yet. They will appear after your tutor or administration schedules them.' : subscriptionStatusCopy?.en) : 'No regular sessions — complete a trial first, then book from your account tab')}</p>
                ) : sessions.map((s) => (
                  <SessionCard key={s._id} session={s} onReview={openReview} hasReviewed={hasReviewed(s._id)} onChat={setChatSession} onRsvp={(sess, st) => st === 'excused' ? setStudentExcuseModal(sess) : handleStudentRsvp(sess._id, 'confirmed')} currentUserId={user?._id || user?.id} />
                ))}
              </div>
            )}

            {tab === 'homework' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 mb-2">{locale === 'id' ? 'Tugas hafalan, murajaah, dan rekaman audio' : locale === 'ar' ? 'واجبات الحفظ والمراجعة والتسجيل الصوتي' : 'Memorization, revision, and audio assignments'}</p>
                {homework.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">{locale === 'id' ? 'Tidak ada tugas saat ini' : locale === 'ar' ? 'لا واجبات حالياً' : 'No assignments currently'}</p>
                ) : homework.map((hw) => {
                  const st = getHwStatus(hw.status, locale);
                  return (
                    <div key={hw._id} className="border rounded-lg p-4 flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-emerald-600" />
                          <h3 className="font-bold">{hw.title}</h3>
                          {hw.type && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{taskTypeLabel(hw.type)}</span>
                          )}
                        </div>
                        {hw.description && <p className="text-sm text-gray-600 mt-1">{hw.description}</p>}
                        {hw.teacherFeedback && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <strong>{locale === 'ar' ? 'ملاحظة المعلم:' : 'Tutor feedback:'}</strong> {hw.teacherFeedback}
                          </div>
                        )}
                        {hw.dueDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            {locale === 'id' ? `Batas waktu: ${new Date(hw.dueDate).toLocaleDateString('id-ID')}` : locale === 'ar' ? `موعد: ${new Date(hw.dueDate).toLocaleDateString('ar-EG')}` : `Due: ${new Date(hw.dueDate).toLocaleDateString('en-US')}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${st.cls}`}>{st.label}</span>
                        {hw.status === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => deleteHomeworkSubmission(hw)}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold transition"
                          >
                            <RotateCcw size={13} />
                            <span>{locale === 'ar' ? 'إعادة التسليم / استبدال الملف' : 'Replace submission'}</span>
                          </button>
                        )}
                        {hw.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                resetVoiceRecording();
                                setRecordModalHw(hw);
                              }}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                            >
                              <Mic size={14} className="text-amber-300" />
                              <span>{locale === 'id' ? 'Rekam Suara 🎙️' : locale === 'ar' ? 'سجّل تلاوتك الآن 🎙️' : 'Record Audio 🎙️'}</span>
                            </button>
                            <input type="file" accept="audio/*,application/pdf,image/jpeg,image/png,image/webp" className="hidden" id={`hw-${hw._id}`}
                              onChange={(e) => submitHomework(hw._id, e.target.files?.[0], hw.sessionId)} />
                            <label htmlFor={`hw-${hw._id}`} className="cursor-pointer flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg">
                              <Upload size={13} /> {locale === 'id' ? 'Unggah File' : locale === 'ar' ? 'رفع ملف' : 'Upload File'}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'certificates' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                  <p className="text-sm text-slate-600">{locale === 'id' ? 'Sertifikat kelulusan setelah menyelesaikan kursus' : locale === 'ar' ? 'شهاداتك بعد إكمال الدورات' : 'Your certificates after completing courses'}</p>
                  {certificates.length > 0 && (
                    <button onClick={downloadAllCertificates}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <Award size={14} /> {locale === 'id' ? 'Unduh Semua PDF' : locale === 'ar' ? 'تحميل الكل PDF' : 'Download All PDFs'}
                    </button>
                  )}
                </div>
                {certificates.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500">{locale === 'id' ? 'Belum ada sertifikat' : locale === 'ar' ? 'لا شهادات بعد' : 'No certificates yet'}</p>
                    <RouterLink to={lp('/courses')} className="text-sm text-emerald-600 hover:underline mt-2 inline-block">{locale === 'id' ? 'Mulai Belajar' : locale === 'ar' ? 'ابدأ دورة' : 'Start a Course'}</RouterLink>
                  </div>
                ) : certificates.map((c) => (
                  <div key={c._id} className="border rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h3 className="font-bold">{locale === 'id' ? (c.course?.title?.id || c.course?.title?.en) : (c.course?.title?.ar || c.course?.title?.en || 'شهادة')}</h3>
                      <p className="text-xs text-gray-500">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString(locale === 'id' ? 'id-ID' : 'ar-EG') : ''}</p>
                    </div>
                    <RouterLink to={lp(`/verify-certificate/${c.certificateId || c._id}`)}
                      className="btn-primary text-sm px-4 py-2">
                      {locale === 'id' ? 'Lihat / Unduh' : locale === 'ar' ? 'عرض / تحميل' : 'View / Download'}
                    </RouterLink>
                  </div>
                ))}
              </div>
            )}

            {tab === 'recordings' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{locale === 'id' ? 'Sesi kelas yang selesai beserta rekamannya' : locale === 'ar' ? 'حصصك المكتملة وتسجيلاتها' : 'Your completed sessions and recordings'}</p>
                {recordings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">{locale === 'id' ? 'Belum ada rekaman' : locale === 'ar' ? 'لا تسجيلات بعد' : 'No recordings yet'}</p>
                ) : recordings.map((s) => (
                  <div key={s._id} className="border rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h3 className="font-bold">{s.teacher?.user?.name || 'المعلم'}</h3>
                      <p className="text-sm text-gray-600">{new Date(s.scheduledAt).toLocaleString(locale === 'id' ? 'id-ID' : 'ar-EG')}</p>
                    </div>
                    {s.recordingUrl ? (
                      <a href={s.recordingUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-sm text-emerald-600 font-semibold">
                        <Video size={16} /> {locale === 'id' ? 'Tonton' : locale === 'ar' ? 'مشاهدة' : 'Watch'}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">{locale === 'id' ? 'Rekaman tidak tersedia' : locale === 'ar' ? 'لا تسجيل متاح' : 'No recording available'}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'achievements' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 text-center">
                  <Trophy className="mx-auto text-emerald-600 mb-2" size={40} />
                  <p className="text-3xl font-bold text-emerald-700">{gameStats?.points?.total || 0}</p>
                  <p className="text-sm text-slate-600">{locale === 'id' ? 'poin' : locale === 'ar' ? 'نقطة' : 'points'} — {locale === 'id' ? `Level ${gameStats?.points?.level || 1}` : locale === 'ar' ? `المستوى ${gameStats?.points?.level || 1}` : `Level ${gameStats?.points?.level || 1}`}</p>
                  <p className="text-sm mt-1">{locale === 'id' ? `Streak harian ${gameStats?.streaks?.current || 0} hari` : locale === 'ar' ? `سلسلة ${gameStats?.streaks?.current || 0} يوم` : `Streak ${gameStats?.streaks?.current || 0} days`}</p>
                  <Link to={lp('/leaderboard')} className="inline-block mt-3 text-sm text-emerald-700 font-medium hover:underline">{locale === 'id' ? '🏆 Papan Peringkat' : locale === 'ar' ? '🏆 لوحة المتصدرين' : '🏆 Leaderboard'}</Link>
                </div>
                <h3 className="font-bold text-sm">{locale === 'id' ? 'Lencana' : locale === 'ar' ? 'الأوسمة' : 'Badges'}</h3>
                {(badges.unlocked || []).length === 0 ? (
                  <p className="text-gray-500 text-center py-6">{locale === 'id' ? 'Selesaikan kelas dan kursus untuk mendapatkan lencana' : locale === 'ar' ? 'أكمل حصصاً ودورات لكسب الأوسمة' : 'Complete sessions and courses to earn badges'}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {badges.unlocked.map((b) => (
                      <div key={b._id} className="border rounded-xl p-4 text-center bg-yellow-50">
                        <Award className="mx-auto text-yellow-600 mb-2" size={28} />
                        <p className="font-bold text-sm">{b.badge?.name?.ar || b.badge?.code}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ═══ بطاقة مسابقة الأثر النصف سنوية والجوائز ═══ */}
                <div className="mt-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center md:text-right">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-200/60 px-3 py-1 rounded-full">
                        <Trophy size={14} />
                        <span>{locale === 'ar' ? 'مسابقة براعم وحي ونماء النصف سنوية (كل 6 أشهر)' : 'Semi-Annual Kids Contest'}</span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">
                        {locale === 'ar' ? 'لوحة شرف الأبطال والجوائز الكبرى' : 'Little Champions Hall of Fame & Grand Prizes'}
                      </h4>
                      <p className="text-xs text-slate-600 max-w-xl">
                        {locale === 'ar'
                          ? 'جوائز قيمة: حقيبة طالب القرآن، المصحف الإلكتروني الناطق، درع بطل الأثر الصغير، وتاج الوقار للأبوين.'
                          : 'Prizes: Elite Quran backpack, speaking audio Mushaf, hero trophy, and Crown of Dignity for parents.'}
                      </p>
                    </div>
                    <Link
                      to={lp('/programs/kids')}
                      className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 text-white shadow-md hover:bg-amber-700 transition"
                    >
                      {locale === 'ar' ? 'استعراض المسابقة والتسجيل' : 'View Contest & Register'}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {tab === 'referral' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 text-center">
                  <Gift className="mx-auto text-orange-600 mb-3" size={40} />
                  <h3 className="font-bold text-lg mb-2">{locale === 'id' ? 'Program Afiliasi' : locale === 'ar' ? 'نظام السفراء' : 'Referral Program'}</h3>
                  <p className="text-sm text-slate-600 mb-4">{locale === 'id' ? 'Undang teman Anda dan dapatkan 50 poin untuk setiap pendaftaran' : locale === 'ar' ? 'ادعُ أصدقاءك واحصل على 50 نقطة لكل تسجيل' : 'Invite your friends and get 50 points for each registration'}</p>
                  {referral?.code && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <code className="bg-white px-4 py-2 rounded-lg font-mono text-lg border">{referral.code}</code>
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(referral.link || referral.code); toast.success(locale === 'id' ? 'Berhasil disalin' : locale === 'ar' ? 'تم النسخ' : 'Copied'); }}
                        className="flex items-center gap-1 text-sm text-orange-700 hover:underline">
                        <Copy size={14} /> {locale === 'id' ? 'Salin Tautan' : locale === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-2xl font-bold text-orange-600">{referral?.stats?.totalInvites || 0}</p>
                    <p className="text-xs text-gray-500">{locale === 'id' ? 'Undangan' : locale === 'ar' ? 'دعوات' : 'Invites'}</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-2xl font-bold text-emerald-600">{referral?.stats?.active || 0}</p>
                    <p className="text-xs text-gray-500">{locale === 'id' ? 'Aktif' : locale === 'ar' ? 'نشطة' : 'Active'}</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-2xl font-bold text-blue-600">{referral?.stats?.totalPoints || 0}</p>
                    <p className="text-xs text-gray-500">{locale === 'id' ? 'Poin Bonus' : locale === 'ar' ? 'نقاط مكافأة' : 'Bonus Points'}</p>
                  </div>
                </div>
                {(referral?.referrals || []).length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm">{locale === 'id' ? 'Undangan Terbaru' : locale === 'ar' ? 'آخر الدعوات' : 'Recent Referrals'}</h4>
                    {referral.referrals.slice(0, 10).map((r) => (
                      <div key={r._id} className="flex justify-between items-center border rounded-lg px-4 py-3 text-sm">
                        <span>{r.referee?.name || '—'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'rewarded' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {r.status === 'rewarded' ? (locale === 'id' ? 'Diberi Poin' : 'مكافأ') : r.status === 'active' ? (locale === 'id' ? 'Aktif' : 'نشط') : (locale === 'id' ? 'Tertunda' : 'معلق')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">{locale === 'id' ? 'Bagikan tautan Anda dengan teman-teman untuk mulai mendapatkan poin' : locale === 'ar' ? 'شارك رابطك مع أصدقائك لبدء كسب النقاط' : 'Share your link with friends to start earning points'}</p>
                )}
              </div>
            )}

            {tab === 'teacher-updates' && (
              <div className="wn-student-teacher-updates">
                <div className="wn-student-teacher-updates__intro">
                  <div>
                    <span>{locale === 'ar' ? 'من معلمك' : 'From your tutor'}</span>
                    <h3>{locale === 'ar' ? 'رسائل وفيديوهات تعليمية' : 'Tutor messages and videos'}</h3>
                    <p>{locale === 'ar' ? 'كلمات قصيرة، توجيهات، أو مراجعات ينشرها معلمك لك داخل الأكاديمية.' : 'Short messages, guidance, and review videos shared by your tutor.'}</p>
                  </div>
                  <Megaphone size={28} />
                </div>

                {teacherUpdates.length === 0 ? (
                  <div className="wn-student-empty-session">
                    <Megaphone size={28} />
                    <div>
                      <h4>{locale === 'ar' ? 'لا توجد رسائل جديدة' : 'No tutor updates yet'}</h4>
                      <p>{locale === 'ar' ? 'عندما ينشر معلمك رسالة أو فيديو ستظهر هنا.' : 'New tutor messages will appear here.'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="wn-student-teacher-update-list">
                    {teacherUpdates.map((update) => {
                      const teacherName = update.teacher?.personalInfo?.fullName
                        || update.teacher?.user?.name
                        || (locale === 'ar' ? 'المعلم' : 'Tutor');

                      return (
                        <article key={update._id}>
                          <div className="wn-student-teacher-update-list__head">
                            <span className="wn-student-teacher-update-list__avatar">{teacherName.slice(0, 1)}</span>
                            <div>
                              <span>{teacherName}</span>
                              <h4>{update.title}</h4>
                              <small>{new Date(update.publishedAt || update.createdAt).toLocaleString(dateLocale)}</small>
                            </div>
                          </div>
                          {update.message ? <p className="wn-student-teacher-update-list__message">{update.message}</p> : null}
                          <div className="wn-student-teacher-update-videos">
                            {(update.videos || []).map((video, index) => {
                              const key = `${update._id}-${index}`;
                              return (
                                <div key={key}>
                                  {teacherUpdateVideoUrls[key] ? (
                                    <video src={teacherUpdateVideoUrls[key]} controls preload="metadata" />
                                  ) : (
                                    <button type="button" onClick={() => loadTeacherUpdateVideo(update._id, index)}>
                                      <Video size={22} />
                                      <span>
                                        <strong>{locale === 'ar' ? `تشغيل الفيديو ${index + 1}` : `Play video ${index + 1}`}</strong>
                                        <small>{video.name || (locale === 'ar' ? 'فيديو المعلم' : 'Tutor video')}</small>
                                      </span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'evaluations' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">{locale === 'id' ? 'Evaluasi dari guru setelah setiap kelas selesai' : locale === 'ar' ? 'تقييمات معلمك بعد كل حصة مكتملة' : 'Tutor evaluations after each completed session'}</p>
                {evaluations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">{locale === 'id' ? 'Belum ada evaluasi — akan muncul setelah kelas selesai' : locale === 'ar' ? 'لا تقييمات بعد — ستظهر بعد إكمال حصة' : 'No evaluations yet — they will appear after completing a session'}</p>
                ) : evaluations.map((s) => {
                  const ev = s.teacherEvaluation || {};
                  const legacyReport = (s.studentReports || []).find((report) => (
                    !report.student || String(report.student?._id || report.student) === String(user?._id || user?.id)
                  )) || {};
                  const reportSurah = ev.surahRecited || legacyReport.surahRecited;
                  const reportFromAyah = ev.fromAyah || legacyReport.fromAyah;
                  const reportToAyah = ev.toAyah || legacyReport.toAyah;
                  const reportNextHomework = ev.nextHomework || legacyReport.nextHomework;
                  const reportNotes = ev.overallNotes || legacyReport.notes;
                  return (
                    <div key={s._id} className="border rounded-xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold">{s.teacher?.user?.name || 'المعلم'}</h3>
                          <p className="text-xs text-gray-500">
                            {formatSessionDateTime(
                              s,
                              locale === 'id' ? 'id-ID' : locale === 'ar' ? 'ar-EG' : 'en-US',
                              { dateStyle: 'medium', timeStyle: 'short' },
                            )} · {sessionTimeZone(s)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => shareStudentEvaluationViaWhatsApp(s, reportSurah, reportFromAyah, reportToAyah, ev, reportNotes)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100 transition"
                          >
                            {locale === 'ar' ? 'مشاركة التقييم 📲' : 'Share 📲'}
                          </button>
                          {!hasReviewed(s._id) && (
                            <button onClick={() => openReview(s)} className="text-sm text-orange-600 hover:underline">{locale === 'id' ? 'Beri Nilai Guru' : locale === 'ar' ? 'قيّم المعلم' : 'Rate Teacher'}</button>
                          )}
                        </div>
                        {false && !hasReviewed(s._id) && (
                          <button onClick={() => openReview(s)} className="text-sm text-orange-600 hover:underline">{locale === 'id' ? 'Beri Nilai Guru' : locale === 'ar' ? 'قيّم المعلم' : 'Rate Teacher'}</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        {[
                          ['attendance', locale === 'id' ? 'Kehadiran' : locale === 'ar' ? 'الحضور' : 'Attendance'],
                          ['memorization', locale === 'id' ? 'Hafalan' : locale === 'ar' ? 'الحفظ' : 'Memorization'],
                          ['tajweed', locale === 'id' ? 'Tajwid' : locale === 'ar' ? 'التجويد' : 'Tajweed'],
                          ['behavior', locale === 'id' ? 'Sikap' : locale === 'ar' ? 'السلوك' : 'Behavior'],
                          ['commitment', locale === 'id' ? 'Komitmen' : locale === 'ar' ? 'الالتزام' : 'Commitment'],
                        ].map(([k, label]) => (
                          <div key={k} className="bg-slate-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="font-bold text-emerald-700">{ev[k] ?? '—'}/5</p>
                          </div>
                        ))}
                      </div>
                      {(reportSurah || reportFromAyah || reportToAyah || reportNextHomework || reportNotes) && (
                        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-700">
                          <p className="mb-2 font-bold text-emerald-900">{locale === 'ar' ? 'تقرير الحصة' : 'Session report'}</p>
                          {reportSurah ? (
                            <p><strong>{locale === 'ar' ? 'السورة / المقطع:' : 'Surah / passage:'}</strong> {reportSurah}</p>
                          ) : null}
                          {(reportFromAyah || reportToAyah) ? (
                            <p>
                              <strong>{locale === 'ar' ? 'الآيات:' : 'Ayahs:'}</strong>{' '}
                              {reportFromAyah || '—'} {locale === 'ar' ? 'إلى' : 'to'} {reportToAyah || '—'}
                            </p>
                          ) : null}
                          {reportNextHomework ? (
                            <p><strong>{locale === 'ar' ? 'الهدف / الواجب القادم:' : 'Next goal / homework:'}</strong> {reportNextHomework}</p>
                          ) : null}
                          {reportNotes ? (
                            <p><strong>{locale === 'ar' ? 'ملاحظات المعلم:' : 'Tutor notes:'}</strong> {reportNotes}</p>
                          ) : null}
                        </div>
                      )}
                      {ev.assignedHomework?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">{locale === 'id' ? 'Tugas dari Sesi:' : locale === 'ar' ? 'واجبات من الحصة:' : 'Assigned homework from session:'}</p>
                          {ev.assignedHomework.map((h, i) => (
                            <p key={i} className="text-sm text-gray-600">• {h.description}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {reviews.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-bold mb-3 flex items-center gap-2"><Star size={18} /> {locale === 'id' ? 'Evaluasi Anda untuk Guru' : locale === 'ar' ? 'تقييماتك للمعلمين' : 'Your Tutor Reviews'}</h3>
                    {reviews.map((r) => (
                      <div key={r._id} className="border rounded-lg p-3 mb-2">
                        <p className="font-semibold text-sm">{r.teacher?.personalInfo?.fullName || r.teacher?.user?.name || 'معلم'}</p>
                        <div className="flex gap-0.5 my-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={12} className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-gray-600">{r.comment}</p>}
                      </div>
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
          locale={locale}
          viewerRole="student"
          onClose={() => {
            setChatSession(null);
            const next = new URLSearchParams(searchParams);
            next.delete('session');
            navigate(`${lp('/student/dashboard')}${next.toString() ? `?${next.toString()}` : ''}`, { replace: true });
          }}
        />
      )}

      {reviewModal && (
        <Modal title={locale === 'id' ? `Evaluasi ${reviewModal.teacher?.user?.name || 'Guru'}` : locale === 'ar' ? `تقييم ${reviewModal.teacher?.user?.name || 'المعلم'}` : `Rate ${reviewModal.teacher?.user?.name || 'Tutor'}`} onClose={() => setReviewModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{locale === 'id' ? 'Penilaian (1-5)' : locale === 'ar' ? 'التقييم (1-5)' : 'Rating (1-5)'}</label>
              <input type="range" min={1} max={5} value={reviewForm.rating}
                onChange={(e) => setReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                className="w-full" />
              <span className="text-emerald-600 font-bold">{reviewForm.rating}</span>
            </div>
            <div>
              <label className="text-sm font-medium">{locale === 'id' ? 'Komentar Anda' : locale === 'ar' ? 'تعليقك' : 'Your Comment'}</label>
              <textarea className="input-field w-full mt-1" rows={3} value={reviewForm.comment}
                onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reviewForm.wouldContinue}
                onChange={(e) => setReviewForm((p) => ({ ...p, wouldContinue: e.target.checked }))} />
              {locale === 'id' ? 'Saya ingin melanjutkan kelas dengan guru ini' : locale === 'ar' ? 'أرغب في الاستمرار مع هذا المعلم' : 'I want to continue learning with this tutor'}
            </label>
            <button onClick={submitReview} className="btn-primary w-full">{locale === 'id' ? 'Kirim Evaluasi' : locale === 'ar' ? 'إرسال التقييم' : 'Submit Review'}</button>
          </div>
        </Modal>
      )}

      {bookModal && (
        <Modal title={locale === 'id' ? `Pesan Sesi Kelas — ${bookModal.name}` : locale === 'ar' ? `حجز حصة — ${bookModal.name}` : `Book Session — ${bookModal.name}`} onClose={() => setBookModal(null)}>
          <form onSubmit={bookRegular} className="space-y-3">
            {bookAvailability.loading ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                {locale === 'ar' ? 'جاري تحميل مواعيد المعلم المتاحة...' : 'Loading tutor availability...'}
              </div>
            ) : bookAvailability.configured ? (
              <>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
                  {locale === 'ar'
                    ? `المواعيد التالية متاحة فعليًا في جدول المعلم، وتظهر بتوقيت جهازك (${bookingTimezone}).`
                    : `These slots are currently available and shown in your timezone (${bookingTimezone}).`}
                </div>
                <select
                  required
                  className="input-field w-full"
                  value={bookForm.date}
                  onChange={(event) => setBookForm((current) => ({ ...current, date: event.target.value, time: '' }))}
                >
                  <option value="">{locale === 'ar' ? 'اختر اليوم' : 'Choose a date'}</option>
                  {bookAvailableDates.map((date) => {
                    const representative = bookAvailability.slots.find((slot) => bookingDateKey(slot.startsAt) === date);
                    return (
                      <option key={date} value={date}>
                        {new Date(representative.startsAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en', {
                          timeZone: bookingTimezone,
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </option>
                    );
                  })}
                </select>
                <select
                  required
                  disabled={!bookForm.date}
                  className="input-field w-full"
                  value={bookForm.time}
                  onChange={(event) => setBookForm((current) => ({ ...current, time: event.target.value }))}
                >
                  <option value="">{locale === 'ar' ? 'اختر الوقت' : 'Choose a time'}</option>
                  {bookSlotsForDate.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {new Date(slot.startsAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en', {
                        timeZone: bookingTimezone,
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
                  {locale === 'ar'
                    ? 'المعلم لم يحدد جدول توفر بعد؛ أرسل موعدًا مقترحًا وسيؤكده أو يقترح بديلًا.'
                    : 'The tutor has not configured availability yet. Send a preferred time for confirmation.'}
                </div>
                <input type="date" required className="input-field w-full" value={bookForm.date}
                  onChange={(e) => setBookForm((p) => ({ ...p, date: e.target.value }))} />
                <input type="time" required className="input-field w-full" value={bookForm.time}
                  onChange={(e) => setBookForm((p) => ({ ...p, time: e.target.value }))} />
              </>
            )}
            <textarea className="input-field w-full" rows={2} placeholder={locale === 'id' ? 'Catatan (opsional)' : locale === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
              value={bookForm.notes} onChange={(e) => setBookForm((p) => ({ ...p, notes: e.target.value }))} />
            <button type="submit" disabled={booking} className="btn-primary w-full">
              {booking ? (locale === 'id' ? 'Mengirim...' : 'جاري الإرسال...') : (locale === 'id' ? 'Kirim Permintaan Sesi' : locale === 'ar' ? 'إرسال طلب الحصة' : 'Send Session Request')}
            </button>
          </form>
        </Modal>
      )}

      {/* IN-BROWSER AUDIO RECORDER MODAL */}
      {recordModalHw && (
        <Modal 
          title={locale === 'id' ? 'Studio Rekaman Suara Al-Quran 🎙️' : locale === 'ar' ? 'استوديو التسميع الصوتي المباشر 🎙️' : 'Live Quran Recitation Studio 🎙️'} 
          onClose={() => { resetVoiceRecording(); setRecordModalHw(null); }}
        >
          <div className="space-y-4 font-arabic">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-sm text-emerald-900">
              <p className="font-bold">{recordModalHw.title}</p>
              {recordModalHw.description && <p className="text-xs text-emerald-700 mt-1">{recordModalHw.description}</p>}
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center space-y-4">
              <div className="flex justify-center items-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                    : audioBlob 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Mic size={36} />
                </div>
              </div>

              {/* Timer & Status */}
              <div>
                <p className="text-3xl font-black font-mono text-stone-800">
                  {Math.floor(recordSeconds / 60).toString().padStart(2, '0')}:{(recordSeconds % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {isRecording 
                    ? (locale === 'id' ? 'Sedang merekam bacaan Anda...' : locale === 'ar' ? 'جاري تسجيل تلاوتك بصوت نقي... رتّل بهدوء ومراعاة للأحكام' : 'Recording your recitation clearly...') 
                    : audioBlob 
                    ? (locale === 'id' ? 'Rekaman selesai — Dengarkan sebelum mengirim' : locale === 'ar' ? 'تم إنهاء التسجيل — استمع لتلاوتك قبل إرسالها للشيخ' : 'Recording finished — listen before sending') 
                    : (locale === 'id' ? 'Klik tombol di bawah untuk mulai merekam' : locale === 'ar' ? 'انقر على زر البدء لتسجيل تلاوتك مباشرة من جهازك' : 'Click start to record directly from your mic')}
                </p>
              </div>

              {/* Audio Playback Preview */}
              {audioUrl && (
                <div className="pt-2">
                  <audio src={audioUrl} controls className="w-full rounded-lg" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {!isRecording && !audioBlob && (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-sm active:scale-95"
                  >
                    <Mic size={16} />
                    <span>{locale === 'id' ? 'Mulai Rekam' : locale === 'ar' ? 'ابدأ تسجيل التلاوة' : 'Start Recording'}</span>
                  </button>
                )}

                {isRecording && (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="px-6 py-2.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-sm active:scale-95"
                  >
                    <Square size={16} />
                    <span>{locale === 'id' ? 'Hentikan & Simpan' : locale === 'ar' ? 'إيقاف التسجيل وتثبيته' : 'Stop & Preview'}</span>
                  </button>
                )}

                {audioBlob && !isRecording && (
                  <>
                    <button
                      type="button"
                      onClick={resetVoiceRecording}
                      className="px-4 py-2.5 border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold rounded-xl text-sm transition flex items-center gap-1.5"
                    >
                      <RotateCcw size={16} />
                      <span>{locale === 'id' ? 'Ulangi' : locale === 'ar' ? 'إعادة التسجيل' : 'Re-record'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={submittingVoice}
                      onClick={sendVoiceRecording}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50 active:scale-95"
                    >
                      <Send size={16} />
                      <span>{submittingVoice ? (locale === 'id' ? 'Mengirim...' : 'جاري الإرسال...') : (locale === 'id' ? 'Kirim ke Guru 🚀' : locale === 'ar' ? 'إرسال التلاوة للشيخ 🚀' : 'Send to Tutor 🚀')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
      {studentExcuseModal && (
        <Modal
          title={locale === 'ar' ? 'الاعتذار المسبق عن حضور الحصة' : 'Advance Session Excuse'}
          onClose={() => { setStudentExcuseModal(null); setStudentExcuseReason(''); }}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {locale === 'ar'
                ? 'تقديم الاعتذار قبل موعد الحصة بـ 6 ساعات على الأقل يحفظ حقك في حصة تعويضية مجانية دون خصم من رصيدك.'
                : 'Submitting an excuse at least 6 hours before the session preserves your free makeup session.'}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'سبب الاعتذار (اختياري)' : 'Excuse reason (optional)'}
              </label>
              <textarea
                rows={3}
                value={studentExcuseReason}
                onChange={(e) => setStudentExcuseReason(e.target.value)}
                placeholder={locale === 'ar' ? 'مثال: ظرف طارئ، اختبار، سفر...' : 'Reason...'}
                className="input-field w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setStudentExcuseModal(null); setStudentExcuseReason(''); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600"
              >
                {locale === 'ar' ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={submittingRsvp}
                onClick={() => handleStudentRsvp(studentExcuseModal._id, 'excused', studentExcuseReason)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submittingRsvp ? (locale === 'ar' ? 'جاري التسجيل...' : 'Saving...') : (locale === 'ar' ? 'تأكيد الاعتذار' : 'Confirm Excuse')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}

function SessionCard({ session, onReview, hasReviewed, onChat, onRsvp, currentUserId }) {
  const studentAttendanceEntry = (session.attendance || []).find(
    (entry) => String(entry.student?._id || entry.student || '') === String(currentUserId || '')
  );
  const studentRsvpStatus = studentAttendanceEntry?.status || '';
  const { locale } = useI18n();
  const teacherName = session.teacher?.user?.name || session.teacher?.personalInfo?.fullName || (locale === 'id' ? 'Guru' : locale === 'ar' ? 'المعلم' : 'Tutor');
  const isTrial = session.type === 'trial';
  const isGroup = session.type === 'group_circle';
  const durationMinutes = Number(session.duration || 60);
  const durationLabel = locale === 'ar'
    ? (durationMinutes === 120 ? 'ساعتان' : durationMinutes === 90 ? 'ساعة ونصف' : durationMinutes === 60 ? 'ساعة' : durationMinutes + ' دقيقة')
    : (durationMinutes === 60 ? '1 hour' : durationMinutes + ' minutes');
  const joinWindow = session.status === 'accepted'
    ? (session.lifecycle
      ? { phase: session.lifecycle.joinPhase, within: session.lifecycle.joinOpen }
      : sessionJoinWindow(session))
    : null;
  const acceptedExpired = joinWindow?.phase === 'expired';
  const acceptedEarly = joinWindow?.phase === 'early';
  const canJoin = Boolean((session.meetingLink || session.roomId || session._id) && session.status === 'accepted' && (session.lifecycle?.joinOpen ?? joinWindow?.within));
  const statusText = acceptedExpired
    ? (locale === 'ar' ? 'انتهى موعد الدخول — بانتظار التقرير' : locale === 'id' ? 'Waktu masuk selesai — menunggu laporan' : 'Join window ended — awaiting report')
    : getStatusLabel(session.status, locale);

  return (
    <div className="border rounded-lg p-4 flex flex-wrap justify-between items-start gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold">{isGroup ? (session.circle?.name || teacherName) : teacherName}</h3>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
            {isTrial
              ? (locale === 'id' ? 'Uji Coba' : 'تجريبية')
              : isGroup
                ? (locale === 'ar' ? 'حلقة جماعية' : 'Group circle')
                : (locale === 'id' ? 'Reguler' : 'منتظمة')}
          </span>
        </div>
        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
          <Clock size={14} /> {formatSessionDateTime(session, locale === 'id' ? 'id-ID' : locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })} — {durationLabel} · {sessionTimeZone(session)}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
          session.status === 'accepted' ? 'bg-green-100 text-green-700'
            : session.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
            : session.status === 'completed' ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {statusText}
        </span>
        {session.status === 'pending' && (
          <p className="text-xs text-amber-600 mt-1">{locale === 'id' ? 'Menunggu persetujuan guru' : locale === 'ar' ? 'بانتظار موافقة المعلم' : 'Awaiting teacher approval'}</p>
        )}
        {acceptedEarly && (
          <p className="text-xs text-slate-500 mt-1">
            {locale === 'ar' ? 'يفتح الدخول قبل الموعد بـ 30 دقيقة.' : locale === 'id' ? 'Akses dibuka 30 menit sebelum sesi.' : 'Joining opens 30 minutes before the session.'}
          </p>
        )}
        {acceptedExpired && (
          <p className="text-xs text-rose-700 mt-1">
            {locale === 'ar' ? 'انتهى وقت الدخول لهذه الحصة. سيظهر التقرير بعد أن يغلق المعلم الحصة.' : locale === 'id' ? 'Waktu masuk sesi telah berakhir.' : 'The join window has ended. The report will appear after the tutor closes the session.'}
          </p>
        )}
        {canJoin && (
          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href={localizedPath(getSessionLiveRoomPath(session), locale)}
              className="text-sm text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Video size={15} />
              {locale === 'id' ? 'Masuk Kelas' : locale === 'ar' ? 'انضم للحصة' : 'Join Session'}
            </a>
            {session.meetingLink && /^https?:\/\//i.test(session.meetingLink) ? (
              <a
                href={localizeInternalHref(session.meetingLink, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-600 font-semibold hover:underline inline-flex items-center gap-1"
              >
                {locale === 'ar' ? 'الرابط الخارجي الاحتياطي' : 'External fallback link'}
              </a>
            ) : null}
            <Link to={localizedPath(`/meeting/${session._id}`, locale)}
              className="text-sm text-purple-600 font-semibold hover:underline flex items-center gap-1">
              🌐 {locale === 'id' ? 'Dengan Terjemahan' : locale === 'ar' ? 'مع ترجمة' : 'With Translation'}
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {session.status === 'accepted' && !acceptedExpired && onRsvp && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {studentRsvpStatus === 'confirmed' ? (
              <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                {locale === 'ar' ? '✓ مؤكد الحضور' : '✓ Confirmed'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRsvp(session, 'confirmed')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                {locale === 'ar' ? 'تأكيد الحضور' : 'Confirm Attendance'}
              </button>
            )}
            {studentRsvpStatus === 'excused' ? (
              <span className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                {locale === 'ar' ? 'معتذر عن الحصة' : 'Excused'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRsvp(session, 'excused')}
                className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition"
              >
                {locale === 'ar' ? 'اعتذار مسبق' : 'Advance Excuse'}
              </button>
            )}
          </div>
        )}
        {!['rejected', 'cancelled'].includes(session.status) && (
          <button
            type="button"
            onClick={() => onChat?.(session)}
            className="px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50"
          >
            {locale === 'id' ? 'Chat' : locale === 'ar' ? 'محادثة' : 'Chat'}
          </button>
        )}
        {session.status === 'completed' && !hasReviewed && (
          <button onClick={() => onReview(session)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm">
            {locale === 'id' ? 'Beri Nilai Guru' : locale === 'ar' ? 'قيّم المعلم' : 'Rate Teacher'}
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 dark:text-slate-100 dark:border dark:border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg p-3">
      <span className="text-slate-500 text-xs">{label}</span>
      <p className="font-semibold">{value || '—'}</p>
    </div>
  );
}

function taskTypeLabel(t) {
  return TASK_TYPES.find((x) => x.id === t)?.label || t;
}


