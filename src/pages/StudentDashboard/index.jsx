import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, CheckCircle, FileText, Star, Trophy, BookOpen,
  Upload, Clock, Users, X, Award, Video, Gift, Copy, CreditCard,
  Mic, Square, RotateCcw, Send, Sparkles, MoreHorizontal, UserRound, Megaphone,
  Loader2, RefreshCw
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
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { localizeInternalHref } from '../../lib/navigation';
import { apiUrl } from '../../config';
import StudentTeacherMarketplace from './TeacherMarketplace';
import SessionChatModal from '../../components/session/SessionChatModal';
import SupportChat, { SupportLauncher } from '../../components/support/SupportChat';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { StudentInspirationStrip, getDailyQuranicDua } from '../../components/dashboard/QuranJourneyWidgets';
import { sessionJoinWindow, formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { teacherLockFromSubscriptions } from '../../lib/studentTeacherLock';
import PostTrialRecommendationCard from './PostTrialRecommendationCard';
import QuranProgressSummary from '../../components/dashboard/QuranProgressSummary';
import { StudentVoiceFeedbackPlayer } from '../../components/homework/VoiceFeedbackControls';

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

function guardianRelationshipLabel(value, sd = {}) {
  const map = sd.guardianRel || {};
  return map[value] || map.guardian || 'Guardian';
}

function learnerLevelLabel(level, ps = {}, acc = {}) {
  const levels = ps.levels || {};
  return levels[level] || acc.notSet || 'Not set';
}

function learnerTrackLabel(track, ps = {}, acc = {}) {
  const tracks = ps.tracks || {};
  return tracks[track] || acc.notSelected || 'Not selected';
}

function guardianInvitationStatus(status, sd = {}) {
  const map = sd.guardianStatus || {};
  return map[status] || status;
}

function StudentCommandBar({ primaryItems, secondaryItems, active, onChange }) {
  const { t } = useI18n();
  const sd = t?.student?.dashboard || {};
  const common = t?.common || {};
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActiveItem = secondaryItems.find((item) => item.id === active);

  const selectItem = (id) => {
    onChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="wn-student-command-shell">
      <nav className="wn-student-command" aria-label={sd.navAria || 'Student dashboard navigation'}>
        <div className="wn-student-command__identity" aria-hidden="true">
          <span className="wn-student-command__identity-icon"><Sparkles size={17} /></span>
          <div>
            <strong>{sd.spaceTitle || 'Your learning space'}</strong>
            <small>{sd.spaceSubtitle || 'Your journey in one place'}</small>
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
                <span className="wn-student-command__item-icon"><Icon size={18} aria-hidden="true" /></span>
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
            <span className="wn-student-command__item-icon"><MoreHorizontal size={19} aria-hidden="true" /></span>
            <span className="wn-student-command__item-copy">
              <strong>{sd.more || 'More'}</strong>
              {secondaryActiveItem ? <small>{secondaryActiveItem.label}</small> : null}
            </span>
          </button>

          {moreOpen && (
            <div className="wn-student-command__more-panel" role="menu">
              <div className="wn-student-command__more-heading">
                <div>
                  <span>{sd.moreToolsTitle || 'More tools'}</span>
                  <strong>{sd.moreToolsSubtitle || 'Everything else you need'}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label={common.close || 'Close'}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                >
                  <X size={17} aria-hidden="true" />
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
                      <span className="wn-student-command__more-icon"><Icon size={18} aria-hidden="true" /></span>
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

const getStatusLabel = (status, sd = {}) => {
  const labels = sd.status || {};
  return labels[status] || status;
};

const getHwStatus = (status, sd = {}) => {
  const labels = sd.hwStatus || {};
  const map = {
    pending: { label: labels.pending || 'Pending', cls: 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border-strong)]' },
    submitted: { label: labels.submitted || 'Submitted', cls: 'bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)] border border-[var(--wn-border-mint)]' },
    done: { label: labels.done || 'Approved', cls: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)]' },
  };
  return map[status] || map.pending;
};

function pickLocalizedTitle(obj, locale, fallback = '') {
  if (!obj) return fallback;
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.en || obj.ar || fallback;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, logout } = useRequireAuth(['student']);
  const { locale, t } = useI18n();
  const lp = (path) => localizedPath(path, locale);
  const toast = useToast();
  const { stats: gameStats, badges } = useGamificationApi();

  const st = t?.student || {};
  const sd = st.dashboard || {};
  const ov = sd.overview || {};
  const acc = sd.account || {};
  const trT = sd.trials || {};
  const sessT = sd.sessionsTab || {};
  const hwT = sd.homeworkTab || {};
  const evT = sd.evaluationsTab || {};
  const certT = sd.certificatesTab || {};
  const recT = sd.recordingsTab || {};
  const achT = sd.achievementsTab || {};
  const refT = sd.referralTab || {};
  const updT = sd.teacherUpdatesTab || {};
  const modT = sd.modals || {};
  const scT = sd.sessionCard || {};
  const errT = st.errors || {};
  const actT = st.actions || {};
  const psT = st.profileSetup || {};
  const qwT = st.quranWidgets || {};
  const tabsT = st.tabs || {};
  const common = t?.common || {};
  const intlLocale = resolveIntlLocale(locale);

  const [requestedTab, setTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [trials, setTrials] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [homework, setHomework] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [discoverTeachers, setDiscoverTeachers] = useState([]);
  const [loadErrors, setLoadErrors] = useState({});
  const [evaluations, setEvaluations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [courses, setCourses] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoaded, setCertificatesLoaded] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recordingsLoaded, setRecordingsLoaded] = useState(false);
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
  const [guardianPhoneError, setGuardianPhoneError] = useState('');
  const [savingGuardianInvite, setSavingGuardianInvite] = useState(false);
  const [cancelInviteModal, setCancelInviteModal] = useState(null);
  const [cancellingInviteId, setCancellingInviteId] = useState('');
  const [loading, setLoading] = useState(true);

  const teacherLock = teacherLockFromSubscriptions(subscriptions);
  const tab = teacherLock && requestedTab === 'discover' ? 'overview' : requestedTab;
  const myTeachers = teacherLock
    ? teachers.filter((item) => String(item._id) === teacherLock.teacherId)
    : teachers;

  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState(emptyReview);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [bookModal, setBookModal] = useState(null);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [bookError, setBookError] = useState('');
  const [bookAvailability, setBookAvailability] = useState({
    loading: false,
    configured: false,
    teacherTimezone: '',
    slots: [],
  });
  const [chatSession, setChatSession] = useState(null);
  const [unreadChatSessionIds, setUnreadChatSessionIds] = useState(() => new Set());
  const consumedChatSessionRef = useRef(null);
  const consumedRateSessionRef = useRef(null);
  const [booking, setBooking] = useState(false);
  const [studentExcuseModal, setStudentExcuseModal] = useState(null);
  const [studentExcuseReason, setStudentExcuseReason] = useState('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [actionSessionId, setActionSessionId] = useState('');
  const [cancelPendingModal, setCancelPendingModal] = useState(null);
  const [deleteHwModal, setDeleteHwModal] = useState(null);
  const [deletingHwId, setDeletingHwId] = useState('');
  const [uploadingHwId, setUploadingHwId] = useState('');
  const [downloadingAll, setDownloadingAll] = useState(false);

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

      if (profRes.status === 'fulfilled' && profRes.value) setProfile(profRes.value);
      if (stRes.status === 'fulfilled' && stRes.value) setStats(stRes.value);
      if (trRes.status === 'fulfilled' && trRes.value) setTrials(trRes.value.sessions || []);
      if (sessRes.status === 'fulfilled' && sessRes.value) {
        setSessions((sessRes.value.sessions || []).filter((item) => item.type !== 'trial'));
      }
      if (hwRes.status === 'fulfilled' && hwRes.value) setHomework(hwRes.value.homework || []);
      if (tchRes.status === 'fulfilled' && tchRes.value) setTeachers(tchRes.value.teachers || []);
      if (discRes.status === 'fulfilled' && discRes.value) setDiscoverTeachers(discRes.value.teachers || []);
      if (evRes.status === 'fulfilled' && evRes.value) setEvaluations(evRes.value.evaluations || []);
      if (revRes.status === 'fulfilled' && revRes.value) {
        const rev = revRes.value;
        setReviews(Array.isArray(rev) ? rev : rev.reviews || []);
      }
      if (enrollRes.status === 'fulfilled' && enrollRes.value) {
        setCourses(Array.isArray(enrollRes.value) ? enrollRes.value : []);
      }
      if (refRes.status === 'fulfilled' && refRes.value) setReferral(refRes.value);
      if (updRes.status === 'fulfilled' && updRes.value) setTeacherUpdates(updRes.value.updates || []);
      if (guardRes.status === 'fulfilled' && guardRes.value) {
        setGuardianInvitations(guardRes.value.invitations || []);
        setLinkedGuardians(guardRes.value.linkedGuardians || []);
      }
      if (subRes.status === 'fulfilled' && subRes.value) setSubscriptions(subRes.value.subscriptions || []);

      setSubscriptionsLoaded(subRes.status === 'fulfilled');
      setLoadErrors((prev) => ({
        ...prev,
        discover: discRes.status === 'rejected',
        trials: trRes.status === 'rejected',
        sessions: sessRes.status === 'rejected',
        homework: hwRes.status === 'rejected',
        evaluations: evRes.status === 'rejected',
        teacherUpdates: updRes.status === 'rejected',
        courses: enrollRes.status === 'rejected',
        referral: refRes.status === 'rejected',
      }));

      if (profRes.status === 'rejected' && stRes.status === 'rejected') {
        toast.error(errT.loadFailed || 'Failed to load student dashboard data');
      }
    } catch {
      toast.error(errT.loadFailed || 'Failed to load student dashboard data');
    } finally {
      setLoading(false);
    }
  }, [toast, errT.loadFailed]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const loadCertificatesTab = useCallback(async () => {
    setLoadErrors((prev) => ({ ...prev, certificates: false }));
    try {
      const data = await api.get('/api/lms/my-certificates', { auth: true });
      setCertificates(Array.isArray(data) ? data : data?.certificates || []);
      setCertificatesLoaded(true);
    } catch {
      setLoadErrors((prev) => ({ ...prev, certificates: true }));
    }
  }, []);

  const loadRecordingsTab = useCallback(async () => {
    setLoadErrors((prev) => ({ ...prev, recordings: false }));
    try {
      const d = await api.get('/api/students/dashboard/recordings', { auth: true });
      setRecordings(d?.sessions || []);
      setRecordingsLoaded(true);
    } catch {
      setLoadErrors((prev) => ({ ...prev, recordings: true }));
    }
  }, []);

  const loadReferralTab = useCallback(async () => {
    setLoadErrors((prev) => ({ ...prev, referral: false }));
    try {
      const data = await api.get('/api/referrals/my', { auth: true });
      setReferral(data || { code: '', stats: {}, referrals: [] });
    } catch {
      setLoadErrors((prev) => ({ ...prev, referral: true }));
    }
  }, []);

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

  const openSessionChat = useCallback((session) => {
    if (!session) return;
    setChatSession(session);
    setUnreadChatSessionIds((current) => {
      if (!current.has(String(session._id))) return current;
      const next = new Set(current);
      next.delete(String(session._id));
      return next;
    });
  }, []);

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
      const detail = event?.detail;
      const type = detail?.type;
      if ([
        'session-accepted',
        'session-rejected',
        'session-rescheduled',
        'session-completed',
        'session-chat-message',
      ].includes(type)) {
        syncSessions();
      }
      if (type === 'session-completed') {
        const completedId = String(detail?.data?.rateSessionId || detail?.data?.session || '');
        api.get('/api/sessions/my-sessions?limit=100', { auth: true })
          .then((result) => {
            const all = result?.sessions || [];
            setTrials(all.filter((item) => item.type === 'trial'));
            setSessions(all.filter((item) => item.type !== 'trial'));
            if (completedId && consumedRateSessionRef.current !== completedId) {
              const targetSess = all.find((item) => String(item._id) === completedId);
              if (targetSess && !targetSess.myFeedback) {
                consumedRateSessionRef.current = completedId;
                setReviewForm(emptyReview);
                setReviewModal(targetSess);
              }
            }
          })
          .catch(() => {});
        api.get('/api/students/dashboard/evaluations', { auth: true })
          .then((result) => setEvaluations(result.evaluations || []))
          .catch(() => {});
        api.get('/api/students/dashboard/stats', { auth: true })
          .then((result) => setStats(result || {}))
          .catch(() => {});
      }
      if (['homework-assigned', 'homework-reviewed'].includes(type)) {
        api.get('/api/homework/student', { auth: true })
          .then((result) => setHomework(result.homework || []))
          .catch(() => {});
        api.get('/api/students/dashboard/stats', { auth: true })
          .then((result) => setStats(result || {}))
          .catch(() => {});
      }
      if (type === 'session-chat-message') {
        const incomingSessionId = detail?.data?.session;
        if (incomingSessionId && String(chatSession?._id || '') !== String(incomingSessionId)) {
          setUnreadChatSessionIds((current) => {
            const next = new Set(current);
            next.add(String(incomingSessionId));
            return next;
          });
        }
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
  }, [ready, syncSessions, refreshSubscriptions, chatSession?._id]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = ['overview', 'discover', 'trials', 'sessions', 'homework', 'teacher-updates', 'evaluations', 'recordings', 'certificates', 'achievements', 'referral', 'account', 'support'];
    if (requestedTab && allowedTabs.includes(requestedTab)) {
      setTab(requestedTab);
    }

    const requestedRateSessionId = searchParams.get('rateSession');
    if (requestedRateSessionId && consumedRateSessionRef.current !== String(requestedRateSessionId)) {
      const rateTarget = [...trials, ...sessions].find((item) => String(item._id) === String(requestedRateSessionId));
      if (rateTarget) {
        consumedRateSessionRef.current = String(requestedRateSessionId);
        const alreadyRated = Boolean(rateTarget.myFeedback) || reviews.some(
          (r) => String(r.session?._id || r.session || '') === String(rateTarget._id)
        );
        if (!alreadyRated) {
          setReviewForm(emptyReview);
          setReviewModal(rateTarget);
        }
      }
    }

    const requestedSessionId = searchParams.get('session');
    if (!requestedSessionId) return;
    if (consumedChatSessionRef.current === String(requestedSessionId)) return;
    const found = [...trials, ...sessions].find((item) => String(item._id) === String(requestedSessionId));
    if (found) {
      consumedChatSessionRef.current = String(requestedSessionId);
      openSessionChat(found);
    }
  }, [searchParams, trials, sessions, reviews, openSessionChat]);

  useEffect(() => {
    if (!ready) return;
    if (tab === 'certificates' && !certificatesLoaded && !loadErrors.certificates) {
      loadCertificatesTab();
    }
    if (tab === 'recordings' && !recordingsLoaded && !loadErrors.recordings) {
      loadRecordingsTab();
    }
    if (tab === 'referral' && !referral && !loadErrors.referral) {
      loadReferralTab();
    }
  }, [tab, ready, certificatesLoaded, recordingsLoaded, referral, loadErrors.certificates, loadErrors.recordings, loadErrors.referral, loadCertificatesTab, loadRecordingsTab, loadReferralTab]);

  const downloadAllCertificates = async () => {
    if (downloadingAll || !certificates.length) return;
    setDownloadingAll(true);
    toast.success(certT.downloadingAll || 'Preparing certificates…');

    try {
      const { downloadCertificatePdf } = await import('../../lib/certificatePdf');
      for (let i = 0; i < certificates.length; i += 1) {
        const c = certificates[i];
        const certWithStudent = {
          ...c,
          student: c.student || { name: user.name },
        };
        try {
          await downloadCertificatePdf({ certificate: certWithStudent, locale });
        } catch (err) {
          console.error('Failed to download certificate', c._id, err);
        }
      }
    } catch {
      toast.error(errT.loadFailed || 'Could not download certificates');
    } finally {
      setDownloadingAll(false);
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
    // Subscribers land on their sessions and circle schedule by default.
    if (currentSubscription && !searchParams.get('tab')) setTab('sessions');
  }, [subscriptionsLoaded, currentSubscription, searchParams]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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
  const studentFirstName = studentName.trim().split(/\s+/)[0] || (t?.lms?.leaderboard?.studentFallback || 'Student');
  const nextSessionTeacherName = nextActiveSession?.teacher?.user?.name
    || nextActiveSession?.teacher?.personalInfo?.fullName
    || nextActiveSession?.teacher?.name
    || (scT.tutorFallback || 'Quran Tutor');
  const nextSessionDate = nextActiveSession ? new Date(nextActiveSession.scheduledAt) : null;
  const currentSubscriptionTeacherName = currentSubscription?.preferredTeacher?.personalInfo?.fullName
    || currentSubscription?.preferredTeacher?.user?.name
    || '';
  const subStatusCopy = currentSubscription
    ? ((sd.subStatus || {})[currentSubscription.status] || currentSubscription.status)
    : '';

  const copyTextSafely = async (text, successMsg) => {
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast.success(successMsg);
    } catch {
      toast.error(errT.referralCopyFailed || refT.copyError || 'Could not copy to clipboard.');
    }
  };

  const renewSubscription = async (subscription) => {
    if (!subscription?._id || renewingSubscription) return;
    setRenewingSubscription(true);
    try {
      const result = await api.post(
        '/api/subscriptions/' + encodeURIComponent(subscription._id) + '/renew',
        { sessionCount: Number(renewalSessionCount) },
        { auth: true }
      );
      const renewal = result.subscription;
      toast.success(modT.renewalCreated || 'Renewal created with your tutor and group. Complete transfer.');
      if (renewal?._id) {
        navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(renewal._id));
      }
    } catch (error) {
      if (error.code === 'RENEWAL_ALREADY_EXISTS' && error.data?.subscription?._id) {
        navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(error.data.subscription._id));
        return;
      }
      toast.error(error.message || errT.renewalFailed || 'Could not create renewal');
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
      toast.error(error.message || errT.videoOpenFailed || 'Could not open tutor video');
    }
  };

  const handleStudentRsvp = async (sessionId, status, reason = '') => {
    if (!sessionId || submittingRsvp) return;
    setSubmittingRsvp(true);
    try {
      const res = await api.post(`/api/sessions/${sessionId}/rsvp`, {
        status,
        excuseReason: reason,
      }, { auth: true });
      toast.success(res.message || (status === 'confirmed'
        ? (modT.statusUpdated || 'Attendance confirmed')
        : (modT.excuseRecorded || 'Excuse recorded')));
      setStudentExcuseModal(null);
      setStudentExcuseReason('');
      await syncSessions();
    } catch (err) {
      toast.error(err.message || errT.rsvpFailed || 'Failed to update RSVP');
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const acceptRescheduledSession = async (session) => {
    if (!session?._id || actionSessionId) return;
    setActionSessionId(session._id);
    try {
      const res = await api.post(`/api/sessions/${session._id}/accept-reschedule`, {}, { auth: true });
      toast.success(res.message || modT.rescheduleConfirmed || 'New session time confirmed');
      await syncSessions();
    } catch (err) {
      toast.error(err.message || errT.rescheduleFailed || 'Could not confirm rescheduled time');
    } finally {
      setActionSessionId('');
    }
  };

  const confirmCancelPendingRequest = async () => {
    if (!cancelPendingModal?._id || actionSessionId) return;
    setActionSessionId(cancelPendingModal._id);
    try {
      const res = await api.post(`/api/sessions/${cancelPendingModal._id}/cancel-request`, {}, { auth: true });
      toast.success(res.message || modT.requestCancelled || 'Request cancelled');
      setCancelPendingModal(null);
      await load();
    } catch (err) {
      toast.error(err.message || errT.cancelRequestFailed || 'Could not cancel request');
    } finally {
      setActionSessionId('');
    }
  };

  const deleteHomeworkSubmission = async (hw) => {
    if (!hw?._id || deletingHwId) return;
    setDeletingHwId(hw._id);
    try {
      const endpoint = hw.isTask
        ? `/api/homework/tasks/${hw._id}/submission`
        : `/api/homework/submissions/${hw.submissionId || hw._id}`;
      await api.delete(endpoint, { auth: true });
      toast.success(hwT.deleteSuccess || 'Submission cleared for re-upload');
      setDeleteHwModal(null);
      await load();
    } catch (err) {
      toast.error(err.message || errT.homeworkDeleteFailed || hwT.deleteError || 'Could not reset submission');
    } finally {
      setDeletingHwId('');
    }
  };

  const shareStudentEvaluationViaWhatsApp = (s, reportSurah, reportFromAyah, reportToAyah, ev, reportNotes) => {
    const tName = s.teacher?.user?.name || s.teacher?.personalInfo?.fullName || scT.tutorFallback || 'Tutor';
    const text = `🌟 ${evT.subtitle || 'Session Evaluation'} 🌟\n`
      + `👤 ${studentName || studentFirstName}\n`
      + `🎓 ${tName}\n`
      + (reportSurah ? `📖 ${evT.surahLabel || 'Surah:'} ${reportSurah} (${reportFromAyah || 1} - ${reportToAyah || '—'})\n` : '')
      + `⭐ ${evT.memScore || 'Memorization'}: ${ev.memorization ?? '—'}/5 · ${evT.tajweedScore || 'Tajweed'}: ${ev.tajweed ?? '—'}/5\n`
      + (reportNotes ? `💬 ${evT.notesLabel || 'Notes:'} ${reportNotes}\n` : '');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const submitHomework = async (homeworkId, file, sessionId) => {
    if (!file || uploadingHwId) return;
    setUploadingHwId(homeworkId);
    try {
      const storageFile = await uploadFileDirect(file, 'homework');
      await api.post(`/api/homework/${homeworkId}/submit`, {
        storageFile,
        sessionId,
      }, { auth: true });
      toast.success(hwT.uploadSuccess || 'Homework submitted successfully');
      await load();
    } catch (e) {
      toast.error(e.message || errT.homeworkUploadFailed || hwT.uploadError || 'Could not upload homework file.');
    } finally {
      setUploadingHwId('');
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
      toast.error(st.voiceFeedback?.micError || 'Please allow microphone access to record.');
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
    if (!audioBlob || !recordModalHw || submittingVoice) return;
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

  const openReview = (session) => {
    setReviewModal(session);
    setReviewForm(emptyReview);
  };

  const submitReview = async () => {
    if (!reviewModal || submittingReview) return;
    setSubmittingReview(true);
    try {
      try {
        await api.post('/api/reviews', {
          teacherId: reviewModal.teacher?._id,
          sessionId: reviewModal._id,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          wouldContinue: reviewForm.wouldContinue,
        }, { auth: true });
      } catch (revErr) {
        if (!String(revErr?.message || '').toLowerCase().includes('already reviewed')) {
          throw revErr;
        }
      }
      await api.put(`/api/sessions/${reviewModal._id}/feedback`, {
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        wouldContinue: reviewForm.wouldContinue,
      }, { auth: true });
      toast.success(modT.reviewSubmitted || 'Thank you for your review!');
      setReviewModal(null);
      await load();
    } catch (e) {
      toast.error(e.message || errT.reviewSubmitFailed || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const openBook = async (teacher) => {
    setBookModal(teacher);
    setBookForm(emptyBook);
    setBookError('');
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
    if (!bookModal || booking) return;
    if (!bookForm.date || !bookForm.time) {
      setBookError(psT.validationRequired || 'Please select both date and time.');
      return;
    }
    setBookError('');
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
      toast.success(t?.student?.booking?.submitSuccess || 'Session request sent to tutor');
      setBookModal(null);
      await load();
    } catch (err) {
      toast.error(err.message || t?.student?.booking?.submitError || 'Failed to book session');
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
    if (savingGuardianInvite) return;
    const cleanPhone = guardianInviteForm.guardianPhone.trim();
    if (!cleanPhone) {
      setGuardianPhoneError(psT.validationRequired || 'Please enter guardian phone number.');
      return;
    }

    setGuardianPhoneError('');
    setSavingGuardianInvite(true);
    try {
      await api.post('/api/students/dashboard/guardian-invitations', {
        guardianPhone: cleanPhone,
        relationship: guardianInviteForm.relationship,
      }, { auth: true });

      toast.success(modT.guardianInviteSuccess || 'Guardian link request created');
      setGuardianInviteForm((current) => ({ ...current, guardianPhone: '' }));
      await refreshGuardianLinks();
    } catch (error) {
      toast.error(error.message || errT.guardianInviteFailed || 'Could not create guardian invitation.');
    } finally {
      setSavingGuardianInvite(false);
    }
  };

  const cancelGuardianInvitation = async (invitationId) => {
    if (!invitationId || cancellingInviteId) return;
    setCancellingInviteId(invitationId);
    try {
      await api.delete(`/api/students/dashboard/guardian-invitations/${invitationId}`, { auth: true });
      toast.success(modT.guardianCancelSuccess || 'Link request cancelled');
      setCancelInviteModal(null);
      await refreshGuardianLinks();
    } catch (error) {
      toast.error(error.message || errT.guardianCancelFailed || 'Could not cancel link request.');
    } finally {
      setCancellingInviteId('');
    }
  };

  const copyInvitationCode = async (code) => {
    await copyTextSafely(code, common.copied || 'Copied');
  };

  const copyGuardianLinkCode = async () => {
    const code = profile?.user?.guardianLinkCode;
    await copyTextSafely(code, common.copied || 'Copied');
  };

  const _rotateGuardianLinkCode = async () => {
    try {
      const result = await api.post('/api/students/dashboard/guardian-link-code/rotate', {}, { auth: true });
      setProfile((current) => ({
        ...current,
        user: { ...current?.user, guardianLinkCode: result.guardianLinkCode },
      }));
      toast.success(common.copied || 'Updated');
    } catch (error) {
      toast.error(error.message || errT.guardianInviteFailed || 'Could not rotate link code');
    }
  };

  const hasReviewed = (sessionId, sessionObj = null) =>
    Boolean(sessionObj?.myFeedback) ||
    reviews.some((r) => String(r.session?._id || r.session || '') === String(sessionId));

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
    { id: 'overview', label: tabsT.overview || 'Overview', icon: Sparkles },
    { id: 'discover', label: tabsT.discover || 'Discover Tutors', icon: BookOpen },
    { id: 'trials', label: tabsT.trials || 'Trial Sessions', icon: Clock, badge: pendingTrials.length + upcomingTrials.length },
    { id: 'sessions', label: tabsT.sessions || 'Sessions', icon: Calendar, badge: upcomingSessions.length + pendingSessions.length },
    { id: 'homework', label: tabsT.homework || 'Homework', icon: FileText, badge: stats.homeworkPending || 0 },
  ].filter((item) => !(teacherLock && item.id === 'discover'));

  const secondaryNavItems = [
    {
      id: 'teacher-updates',
      label: tabsT.teacherUpdates || 'Tutor Updates',
      icon: Megaphone,
      badge: teacherUpdates.length,
      description: updT.subtitle || 'Messages from your tutor',
    },
    {
      id: 'evaluations',
      label: tabsT.evaluations || 'Evaluations',
      icon: Star,
      description: evT.subtitle || 'Tutor evaluations',
    },
    {
      id: 'recordings',
      label: tabsT.recordings || 'Recordings',
      icon: Mic,
      description: recT.subtitle || 'Session recordings',
    },
    {
      id: 'certificates',
      label: tabsT.certificates || 'Certificates',
      icon: Award,
      description: certT.subtitle || 'Your earned certificates',
    },
    {
      id: 'achievements',
      label: tabsT.achievements || 'Achievements',
      icon: Trophy,
      description: achT.badgesTitle || 'Points and badges',
    },
    {
      id: 'referral',
      label: tabsT.referral || 'Referrals',
      icon: Gift,
      description: refT.subtitle || 'Invite friends and earn points',
    },
    {
      id: 'account',
      label: tabsT.account || 'Account',
      icon: UserRound,
      description: acc.editProfile || 'Profile and tutors',
    },
    {
      id: 'support',
      label: tabsT.support || 'Support',
      icon: Send,
      description: ov.contactSupport || 'Contact academy support',
    },
  ];

  const dailyDua = getDailyQuranicDua(locale, qwT);
  const hasAnyTrialActivity = pendingTrials.length > 0 || upcomingTrials.length > 0 || completedTrials.length > 0;
  const hasCompletedTrial = completedTrials.length > 0;
  const isBrandNewStudent = !currentSubscription
    && (stats.completedSessions || 0) === 0
    && (stats.upcomingSessions || 0) === 0
    && (stats.homeworkSubmitted || 0) === 0;
  const onboardingSteps = [
    {
      key: 'account',
      done: true,
      title: t?.student?.journey?.steps?.account || 'Account',
      subtitle: ov.activeSubscriptionBadge || 'Active',
    },
    {
      key: 'tutor',
      done: hasAnyTrialActivity,
      title: ov.findTutor || 'Find your tutor',
      subtitle: `${trialRemaining || 3} ${(ov.trialsRemainingStat || 'تجريبيات متبقية')}`,
    },
    {
      key: 'trial',
      done: hasCompletedTrial,
      title: ov.subscribeContinue || 'Subscribe & continue',
      subtitle: hasCompletedTrial
        ? (ov.trialCompleteTitle || 'Your trial session is complete')
        : (ov.trialCompleteDesc || 'Subscribe to continue with your tutor'),
    },
  ];
  const completedOnboardingCount = onboardingSteps.filter((step) => step.done).length;

  return (
    <DashboardLayout title={st.dashboardTitle || 'Student Dashboard'} user={user} onLogout={logout}>
      {loading ? (
        <div className="space-y-4 py-6" role="status" aria-live="polite">
          <span className="sr-only">{st.loading || 'Loading student data…'}</span>
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
          {tab === 'overview' && (Boolean(currentSubscription) || (stats.completedSessions || 0) > 0) && (
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
          )}
          {subscriptionsLoaded && !currentSubscription && tab === 'overview' && <section className="wn-student-welcome">
            <div className="wn-student-welcome__content">
              <span className="wn-student-welcome__eyebrow">
                <Sparkles size={15} aria-hidden="true" />
                {qwT.blessedJourney || 'Blessed Quran journey'}
              </span>
              <h2 className="wn-student-welcome__title">
                {acc.welcome || 'Welcome,'} {studentFirstName}
              </h2>
              <p className="wn-student-welcome__lead">
                {nextActiveSession
                  ? `${ov.withTutorPrefix || 'With tutor'} ${nextSessionTeacherName}`
                  : pendingTrials.length
                    ? (ov.pendingTrialStep || 'Your trial request is awaiting a response')
                    : postTrialSession
                      ? (trialRemaining > 0
                        ? (ov.trialCompleteDesc || 'Subscribe to continue with your tutor, or use your remaining free trial sessions.')
                        : (ov.allTrialsUsed || 'All three trials have been used'))
                      : (ov.noUpcomingDiscover || 'Choose an approved tutor and start with a trial.')}
              </p>

              <blockquote className="my-3 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-emerald-50/95">
                <p className={`${locale === 'ar' ? 'font-arabic ' : ''}text-sm font-bold leading-relaxed text-white`}>{dailyDua.text}</p>
                <footer className="mt-0.5 text-[11px] font-semibold text-amber-200/90">{dailyDua.source}</footer>
              </blockquote>

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
                    ? (ov.viewNextSession || 'View next session')
                    : currentSubscription
                      ? (currentSubscription.status === 'pending_payment'
                          ? (ov.completeTransfer || 'Complete transfer')
                          : (ov.trackSubscription || 'Track subscription'))
                      : postTrialSession
                        ? (ov.subscribeContinue || 'Subscribe & continue')
                        : (ov.findTutor || 'Find your tutor')}
                </button>
                {((stats.homeworkPending || 0) > 0 || (stats.completedSessions || 0) > 0) && (
                  <button type="button" onClick={() => setTab('homework')} className="wn-student-secondary-action">
                    <FileText size={16} aria-hidden="true" />
                    {ov.homework || 'Homework'}{stats.homeworkPending ? ` (${stats.homeworkPending})` : ''}
                  </button>
                )}
              </div>
            </div>

            <div className="wn-student-welcome__summary" data-testid="student-onboarding-checklist">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-emerald-100">
                <span>{ov.gettingStarted || 'Getting started'}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] text-amber-200">
                  {completedOnboardingCount} / 3 {ov.doneOfThree || 'done'}
                </span>
              </div>
              {onboardingSteps.map((step) => (
                <div key={step.key} className="wn-student-welcome__metric">
                  {step.done ? (
                    <CheckCircle size={18} className="text-emerald-300 shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock size={18} className="text-amber-200/80 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <strong className="block text-sm">{step.title}</strong>
                    <small className="opacity-85">{step.subtitle}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>}

          {!subscriptionsLoaded && <section className="wn-dashboard-surface" role="status">
            <p className="text-[var(--wn-text-primary)]">{errT.subscriptionLoadFailed || 'Could not confirm your subscription. Retry to load your package.'}</p>
            <button type="button" className="wn-btn wn-btn--secondary mt-3 min-h-[44px]" onClick={refreshSubscriptions}>
              {sd.retry || common.retry || 'Try again'}
            </button>
          </section>}

          {currentSubscription && (
            <section className="wn-student-next-step wn-student-subscription" aria-label={ov.currentPackage || 'اشتراكك الحالي'}>
              <div>
                <span className="wn-student-next-step__eyebrow">
                  {ov.currentPackage || 'اشتراكك الحالي'}
                </span>
                <h3>
                  {currentSubscription.pricingSnapshot?.nameAr
                    ? (locale === 'ar'
                        ? currentSubscription.pricingSnapshot.nameAr
                        : currentSubscription.pricingSnapshot.nameEn || currentSubscription.pricingSnapshot.nameAr)
                    : (ov.academySubscription || 'Academy subscription')}
                </h3>
                <p>{subStatusCopy}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3 py-1.5 text-[var(--wn-badge-emerald-text)]">
                    <CreditCard size={14} aria-hidden="true" />
                    {ov.packageLabel || 'Package:'} {currentSubscription.sessionCount} · {ov.usedLabel || 'Used:'} {currentSubscription.sessionsUsed || 0} · {ov.remainingLabel || 'Remaining:'} {currentSubscription.sessionsRemaining}
                  </span>
                  {currentSubscriptionTeacherName ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-1.5 text-[var(--wn-text-primary)]">
                      <UserRound size={14} aria-hidden="true" />
                      {ov.tutorPrefix || 'Tutor:'} {currentSubscriptionTeacherName}
                    </span>
                  ) : null}
                  {currentSubscription.circle?.name ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-mint-soft)] px-3 py-1.5 text-[var(--wn-teal-dark)]">
                      <Users size={14} aria-hidden="true" />
                      {ov.groupPrefix || 'Group:'} {currentSubscription.circle.name}
                    </span>
                  ) : null}
                </div>
                {teacherLock ? (
                  <p className="mt-3 text-xs font-semibold text-[var(--wn-text-secondary)]" data-testid="teacher-lock-note">
                    {ov.teacherLockNote || 'Your tutor is confirmed for this journey. To change tutor, contact academy support.'}
                    {' '}
                    <button
                      type="button"
                      onClick={() => setTab('support')}
                      className="min-h-[44px] inline-flex items-center font-bold text-[var(--wn-link)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                    >
                      {ov.contactSupport || 'Contact support'}
                    </button>
                  </p>
                ) : null}
              <div className="mt-4 space-y-3" data-testid="subscription-details">
                <p className="text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ov.pricePerLesson || 'Price per lesson:'} {Number(currentSubscription.pricePerSessionMinor || 0) / 100} {currentSubscription.currency || 'EGP'}
                </p>
                <progress className="w-full" value={currentSubscription.sessionsUsed || 0} max={currentSubscription.sessionCount} aria-label={ov.usedSessionsAria || 'Used sessions'} />
                {currentSubscription.circle && (
                  <p className="text-sm text-[var(--wn-text-primary)]">
                    {ov.groupLearners || 'Group learners:'} {currentSubscription.circle.students?.length || 0}/{currentSubscription.circle.capacity || '—'}
                  </p>
                )}
                {(currentSubscription.circle?.schedule || []).length > 0 && (
                  <div className="text-sm text-[var(--wn-text-primary)]">
                    <strong>{ov.circleSchedule || 'Circle schedule'} — {currentSubscription.circle.timezone || 'Africa/Cairo'}</strong>
                    {(currentSubscription.circle.schedule || []).map((row, index) => (
                      <p key={index}>{row.day}: {row.startTime}–{row.endTime}</p>
                    ))}
                  </div>
                )}
                {currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining) <= 2 && !renewalSubscription && (
                  <div role="status" className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3 text-sm font-semibold text-[var(--wn-text-primary)]" data-testid="low-balance-alert">
                    {ov.lowBalanceAlert || 'Your package balance is running low — renew to continue with the same tutor and group.'} ({currentSubscription.sessionsRemaining})
                  </div>
                )}
              </div>
              </div>
              <div className="wn-student-next-step__actions">
                {currentSubscription.status === 'pending_payment' ? (
                  <button
                    type="button"
                    onClick={() => navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(currentSubscription._id))}
                    className="wn-student-primary-action"
                  >
                    <CreditCard size={17} aria-hidden="true" />
                    {ov.completeTransfer || 'Complete transfer'}
                  </button>
                ) : null}
                {currentSubscription.status === 'payment_review' ? (
                  <span className="text-xs font-semibold text-[var(--wn-text-gold)]">
                    {sd.subStatus?.payment_review || 'بانتظار مراجعة الإدارة'}
                  </span>
                ) : null}
                {currentSubscription.status === 'awaiting_placement' ? (
                  <span className="text-xs font-semibold text-[var(--wn-link)]">
                    {sd.subStatus?.awaiting_placement || 'الدفع معتمد — بانتظار التسكين'}
                  </span>
                ) : null}
                {currentSubscription.status === 'placed' ? (
                  <span className="text-xs font-semibold text-[var(--wn-link)]">
                    {sd.subStatus?.placed || 'تم التسكين — الجروب قيد الاكتمال'}
                  </span>
                ) : null}
                {currentSubscription.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setTab('sessions')}
                    className="wn-student-primary-action"
                  >
                    <Calendar size={17} aria-hidden="true" />
                    {ov.mySessions || 'My Sessions'}
                  </button>
                ) : null}

                {renewalSubscription ? (
                  renewalSubscription.status === 'pending_payment' ? (
                    <button
                      type="button"
                      onClick={() => navigate(lp('/payment/manual') + '?subscription=' + encodeURIComponent(renewalSubscription._id))}
                      className="wn-student-primary-action"
                    >
                      <CreditCard size={17} aria-hidden="true" />
                      {ov.completeRenewalPayment || 'Complete renewal payment'}
                    </button>
                  ) : renewalSubscription.status === 'payment_review' ? (
                    <span className="text-xs font-semibold text-[var(--wn-text-gold)]">
                      {ov.renewalUnderReview || 'Renewal payment under review'}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--wn-link)]">
                      {ov.renewalPaidReady || 'Renewal paid and ready'} ({renewalSubscription.sessionCount})
                    </span>
                  )
                ) : (
                  ((currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining || 0) <= 2)
                    || currentSubscription.status === 'completed') ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={renewalSessionCount}
                        onChange={(event) => setRenewalSessionCount(Number(event.target.value))}
                        className="min-h-[44px] rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3 py-2 text-sm font-bold text-[var(--wn-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                        aria-label={ov.renewalSessionsAria || 'Renewal sessions'}
                      >
                        {[4, 8, 12, 24].map((count) => (
                          <option key={count} value={count}>{count} {qwT.sessionsUnit || 'sessions'}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={renewingSubscription}
                        onClick={() => renewSubscription(currentSubscription)}
                        className="wn-student-primary-action"
                      >
                        {renewingSubscription ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
                        {renewingSubscription
                          ? (ov.renewing || 'Creating renewal…')
                          : (ov.renewSubscription || 'تجديد الاشتراك')}
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}

          {subscriptionsLoaded && postTrialSession && !currentSubscription && (
            <div className="space-y-4">
              <section className="wn-student-next-step">
                <div>
                  <span className="wn-student-next-step__eyebrow">{ov.nextStepEyebrow || 'Next step'}</span>
                  <h3>{ov.trialCompleteTitle || 'Your trial session is complete'}</h3>
                  <p>
                    {ov.trialCompleteDesc || 'Subscribe to continue with your tutor, or use your remaining free trial sessions.'} ({trialRemaining})
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3 py-1.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                    <Clock size={14} aria-hidden="true" />
                    {trialAllowance.used || 0} / {trialAllowance.limit || 3} · {trialRemaining} {ov.trialsRemainingStat || 'تجريبيات متبقية'}
                  </div>
                </div>
                <div className="wn-student-next-step__actions">
                  <button type="button" onClick={() => navigate(lp('/plans'))} className="wn-student-primary-action">
                    <CreditCard size={17} aria-hidden="true" />
                    {ov.subscribe || 'اشتراك'}
                  </button>
                  {trialRemaining > 0 ? (
                    <button type="button" onClick={() => setTab('discover')} className="wn-student-secondary-action">
                      {ov.useAnotherTrial || 'Use another trial'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--wn-text-secondary)]">
                      {ov.allTrialsUsed || 'All three trials have been used'}
                    </span>
                  )}
                </div>
              </section>
              <PostTrialRecommendationCard
                session={postTrialSession}
                locale={locale}
                onSubscribe={() => navigate(lp('/plans'))}
              />
            </div>
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
                  <section className="wn-student-active-subscription-card rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-5 shadow-sm mb-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold px-3 py-1">
                            <Sparkles size={13} aria-hidden="true" />
                            {ov.activeSubscriptionBadge || 'Active Subscription'}
                          </span>
                          <span className="rounded-full bg-[var(--wn-surface)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] text-xs font-semibold px-2.5 py-0.5">
                            {subStatusCopy}
                          </span>
                        </div>
                        <h3 className="mt-2 text-xl font-black text-[var(--wn-heading)]">
                          {currentSubscription.pricingSnapshot?.nameAr
                            ? (locale === 'ar'
                                ? currentSubscription.pricingSnapshot.nameAr
                                : currentSubscription.pricingSnapshot.nameEn || currentSubscription.pricingSnapshot.nameAr)
                            : (ov.academyPackage || 'Academy Package')}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                          {currentSubscriptionTeacherName
                            ? `${ov.withTutorPrefix || 'With tutor'} ${currentSubscriptionTeacherName}`
                            : (ov.approvedTutorFallback || 'Approved Academy tutor')}
                          {currentSubscription.circle?.name ? ` · ${ov.circlePrefix || 'Circle:'} ${currentSubscription.circle.name}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTab('sessions')}
                          className="wn-student-primary-action text-sm"
                        >
                          <Calendar size={16} aria-hidden="true" />
                          {ov.mySessions || 'My Sessions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab('homework')}
                          className="wn-student-secondary-action text-sm"
                        >
                          <FileText size={16} aria-hidden="true" />
                          {ov.homework || 'Homework'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--wn-border-mint)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl bg-[var(--wn-surface)] p-3 border border-[var(--wn-border)]">
                        <span className="text-xs text-[var(--wn-text-secondary)] block mb-1">
                          {ov.remainingSessions || 'Remaining Sessions'}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <strong className="text-2xl font-black text-[var(--wn-link)]">
                            {currentSubscription.sessionsRemaining}
                          </strong>
                          <span className="text-xs text-[var(--wn-text-secondary)]">
                            / {currentSubscription.sessionCount} {qwT.sessionsUnit || 'sessions'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[var(--wn-surface)] p-3 border border-[var(--wn-border)]">
                        <span className="text-xs text-[var(--wn-text-secondary)] block mb-1">
                          {ov.completedSessions || 'Completed Sessions'}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <strong className="text-2xl font-black text-[var(--wn-text-primary)]">
                            {currentSubscription.sessionsUsed || 0}
                          </strong>
                          <span className="text-xs text-[var(--wn-text-secondary)]">
                            {ov.usedUnit || 'used'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[var(--wn-surface)] p-3 border border-[var(--wn-border)]">
                        <span className="text-xs text-[var(--wn-text-secondary)] block mb-1">
                          {ov.progress || 'Progress'}
                        </span>
                        <div className="flex flex-col justify-center h-full">
                          <progress
                            className="w-full h-2.5 rounded-full overflow-hidden accent-[var(--wn-emerald)]"
                            value={currentSubscription.sessionsUsed || 0}
                            max={currentSubscription.sessionCount || 1}
                            aria-label={ov.usedSessionsAria || 'Used sessions'}
                          />
                          <span className="text-[11px] text-[var(--wn-text-secondary)] mt-1 font-semibold text-end">
                            {Math.round(((currentSubscription.sessionsUsed || 0) / (currentSubscription.sessionCount || 1)) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentSubscription.status === 'active' && Number(currentSubscription.sessionsRemaining) <= 2 && !renewalSubscription && (
                      <div role="status" className="mt-3 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3 text-xs sm:text-sm font-semibold text-[var(--wn-text-primary)] flex items-center justify-between flex-wrap gap-2" data-testid="low-balance-alert-overview">
                        <span>
                          {ov.lowBalanceAlert || 'Your package balance is running low — renew to continue with the same tutor and group.'} ({currentSubscription.sessionsRemaining})
                        </span>
                        <button
                          type="button"
                          onClick={() => renewSubscription(currentSubscription)}
                          disabled={renewingSubscription}
                          className="wn-student-primary-action text-xs py-1.5 px-3"
                        >
                          {renewingSubscription ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
                          {renewingSubscription ? (ov.renewing || 'Creating renewal…') : (ov.renewSubscription || 'Renew subscription')}
                        </button>
                      </div>
                    )}
                  </section>
                )}

                <div className="wn-student-overview__grid">
                  <section className="wn-student-session-panel">
                    <div className="wn-student-section-heading">
                      <div>
                        <span>{ov.upNext || 'Up next'}</span>
                        <h3>{ov.nextSession || 'Your next session'}</h3>
                      </div>
                      {nextActiveSession ? (
                        <button
                          type="button"
                          onClick={() => setTab(nextActiveSession.type === 'trial' ? 'trials' : 'sessions')}
                          className="wn-student-text-action"
                        >
                          {ov.allSessions || 'All sessions'}
                        </button>
                      ) : null}
                    </div>

                    {nextActiveSession ? (() => {
                      const nextJoinWindow = nextActiveSession.lifecycle
                        ? { phase: nextActiveSession.lifecycle.joinPhase, within: nextActiveSession.lifecycle.joinOpen }
                        : sessionJoinWindow(nextActiveSession);
                      const canJoinNext = Boolean(nextActiveSession.lifecycle?.joinOpen ?? nextJoinWindow?.within);
                      const currentUid = String(user?._id || user?.id || '');
                      const nextAttendance = (nextActiveSession.attendance || []).find(
                        (entry) => String(entry.student?._id || entry.student || '') === currentUid
                      );
                      const isGroupNext = nextActiveSession.type === 'group_circle';
                      return (
                        <div className="wn-student-session-panel__body">
                          <div className="wn-student-session-panel__date">
                            <strong>{nextSessionDate?.toLocaleDateString(intlLocale, { day: '2-digit' })}</strong>
                            <span>{nextSessionDate?.toLocaleDateString(intlLocale, { month: 'short' })}</span>
                          </div>
                          <div className="wn-student-session-panel__details">
                            <span className="wn-student-session-type">
                              {nextActiveSession.type === 'trial'
                                ? (ov.trialSession || 'Trial session')
                                : isGroupNext
                                  ? (ov.groupCircle || 'حلقة جماعية')
                                  : (ov.regularSession || 'Regular session')}
                            </span>
                            <h4>{isGroupNext ? (nextActiveSession.circle?.name || nextSessionTeacherName) : nextSessionTeacherName}</h4>
                            <p>
                              <Clock size={15} aria-hidden="true" />
                              {nextSessionDate?.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })} · {sessionTimeZone(nextActiveSession)}
                            </p>
                          </div>
                          {canJoinNext ? (
                            <Link
                              to={localizedPath(getSessionLiveRoomPath(nextActiveSession), locale)}
                              className="wn-student-join-action"
                            >
                              <Video size={17} aria-hidden="true" />
                              {ov.joinSession || 'Join session'}
                            </Link>
                          ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="rounded-lg bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold text-[var(--wn-text-secondary)]">
                                {nextJoinWindow?.phase === 'early'
                                  ? (ov.joinOpensEarly || 'Join opens 30m before')
                                  : (ov.joinWindowEnded || 'Join window ended')}
                              </span>
                              {nextAttendance?.status === 'confirmed' ? (
                                <span className="text-xs font-bold text-[var(--wn-link)]">
                                  {ov.confirmedBadge || '✓ Confirmed'}
                                </span>
                              ) : nextAttendance?.status !== 'excused' && nextJoinWindow?.phase === 'early' ? (
                                <button
                                  type="button"
                                  disabled={submittingRsvp}
                                  onClick={() => handleStudentRsvp(nextActiveSession._id, 'confirmed')}
                                  className="min-h-[44px] inline-flex items-center rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-3.5 py-2 text-xs font-bold text-[var(--wn-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-50"
                                >
                                  {ov.confirmAttendance || 'Confirm attendance'}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="wn-student-empty-session">
                        <BookOpen size={28} aria-hidden="true" />
                        <div>
                          <h4>{ov.noUpcomingSession || 'No upcoming session'}</h4>
                          <p>
                            {currentSubscription
                              ? (ov.noUpcomingSub || 'Your tutor or academy administration will schedule your upcoming sessions soon.')
                              : postTrialSession
                                ? (ov.noUpcomingTrial || 'Subscribe to continue with your tutor or use a remaining trial.')
                                : (ov.noUpcomingDiscover || 'Choose an approved tutor and start with a trial.')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => currentSubscription ? setTab('sessions') : postTrialSession?.teacher ? navigate(lp('/plans')) : setTab('discover')}
                          className="wn-student-primary-action"
                        >
                          {currentSubscription
                            ? (ov.viewSchedule || 'View session schedule')
                            : postTrialSession
                              ? (ov.subscribe || 'Subscribe')
                              : (ov.findTutor || 'Find a tutor')}
                        </button>
                      </div>
                    )}
                  </section>

                  <aside className="wn-student-quick-panel">
                    <div className="wn-student-section-heading">
                      <div>
                        <span>{ov.quickAccess || 'Quick access'}</span>
                        <h3>{ov.whatToDo || 'What do you need?'}</h3>
                      </div>
                    </div>
                    <div className="wn-student-quick-grid">
                      {!teacherLock && (
                        <button type="button" onClick={() => setTab('discover')} className="wn-student-quick-card">
                          <Users size={20} aria-hidden="true" />
                          <span>{ov.findTutor || 'Find tutor'}</span>
                        </button>
                      )}
                      <button type="button" onClick={() => setTab('sessions')} className="wn-student-quick-card">
                        <Calendar size={20} aria-hidden="true" />
                        <span>{ov.mySessions || 'My sessions'}</span>
                      </button>
                      <button type="button" onClick={() => setTab('homework')} className="wn-student-quick-card">
                        <FileText size={20} aria-hidden="true" />
                        <span>{ov.homework || 'Homework'}</span>
                      </button>
                      <button type="button" onClick={() => setTab(teacherUpdates.length ? 'teacher-updates' : 'achievements')} className="wn-student-quick-card">
                        {teacherUpdates.length ? <Megaphone size={20} aria-hidden="true" /> : <Trophy size={20} aria-hidden="true" />}
                        <span>
                          {teacherUpdates.length
                            ? (tabsT.teacherUpdates || 'Tutor updates')
                            : (tabsT.achievements || 'Achievements')}
                        </span>
                      </button>
                    </div>
                  </aside>
                </div>

                {!isBrandNewStudent && (
                  <div className="wn-student-stat-grid">
                    <StatCard label={ov.upcomingStat || 'Upcoming sessions'} value={stats.upcomingSessions || 0} icon={Calendar} />
                    {currentSubscription ? (
                      <StatCard
                        label={ov.remainingStat || 'Remaining package sessions'}
                        value={currentSubscription.sessionsRemaining ?? 0}
                        icon={Clock}
                      />
                    ) : (
                      <StatCard label={ov.trialsRemainingStat || 'تجريبيات متبقية'} value={trialRemaining} icon={Clock} />
                    )}
                    <StatCard label={ov.completedStat || 'Completed sessions'} value={stats.completedSessions || 0} icon={CheckCircle} />
                    <StatCard label={ov.homeworkStat || 'Homework submitted'} value={stats.homeworkSubmitted || 0} icon={FileText} />
                  </div>
                )}

                {teacherUpdates[0] && (
                  <section className="wn-student-teacher-update-preview">
                    <span className="wn-student-teacher-update-preview__icon"><Megaphone size={20} aria-hidden="true" /></span>
                    <div>
                      <span>{ov.newTutorUpdate || 'New tutor update'}</span>
                      <h3>{teacherUpdates[0].title}</h3>
                      <p>{teacherUpdates[0].message || (ov.newTutorVideoFallback || 'Your tutor shared a new video.')}</p>
                    </div>
                    <button type="button" onClick={() => setTab('teacher-updates')} className="wn-student-primary-action">
                      {ov.viewUpdate || 'View update'}
                    </button>
                  </section>
                )}

                <div className="wn-student-overview__lower">
                  {!isBrandNewStudent && (
                    <section className="wn-student-journey-card">
                      <div className="wn-student-section-heading">
                        <div>
                          <span>{ov.journeySnapshot || 'Journey snapshot'}</span>
                          <h3>{ov.progressInOnePlace || 'Your progress in one place'}</h3>
                        </div>
                      </div>
                      <div className="wn-student-journey-list">
                        <button type="button" onClick={() => setTab('sessions')}>
                          <span>{ov.completedStat || 'Completed sessions'}</span>
                          <strong>{stats.completedSessions || 0}</strong>
                        </button>
                        <button type="button" onClick={() => setTab('homework')}>
                          <span>{ov.submittedHwStat || 'Submitted homework'}</span>
                          <strong>{stats.homeworkSubmitted || 0}</strong>
                        </button>
                        <button type="button" onClick={() => setTab('account')}>
                          <span>{ov.enrolledCoursesStat || 'Enrolled courses'}</span>
                          <strong>{courses.length}</strong>
                        </button>
                        <button type="button" onClick={() => setTab('account')}>
                          <span>{ov.yourTutorsStat || 'Your tutors'}</span>
                          <strong>{myTeachers.length}</strong>
                        </button>
                      </div>
                    </section>
                  )}

                  {referral?.code ? (
                    <section className="wn-student-referral-card">
                      <Gift size={24} aria-hidden="true" />
                      <span>{ov.referralProgram || 'Referral program'}</span>
                      <h3>{ov.inviteEarnTitle || 'Invite a friend and earn points'}</h3>
                      <p>{referral.stats?.totalPoints || 0} {acc.pointsUnit || 'points'}</p>
                      <div className="wn-student-referral-card__code">
                        <code>{referral.code}</code>
                        <button
                          type="button"
                          onClick={() => copyTextSafely(referral.link || referral.code, refT.copiedSuccess || 'Referral link copied')}
                        >
                          <Copy size={15} aria-hidden="true" />
                          {common.copy || 'Copy'}
                        </button>
                      </div>
                      <button type="button" onClick={() => setTab('referral')} className="wn-student-text-action">
                        {ov.viewDetails || 'View details'}
                      </button>
                    </section>
                  ) : (
                    <section className="wn-student-referral-card is-muted">
                      <Sparkles size={24} aria-hidden="true" />
                      <span>{ov.suggestedNextStep || 'Suggested next step'}</span>
                      <h3>
                        {pendingTrials.length
                          ? (ov.pendingTrialStep || 'Your trial request is awaiting a response')
                          : stats.homeworkPending
                            ? (ov.homeworkWaitingStep || 'You have homework waiting')
                            : teacherLock
                              ? (ov.followTutorStep || 'Follow your sessions with your tutor')
                              : (ov.exploreTutorsStep || 'Explore tutors and find your match')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTab(pendingTrials.length ? 'trials' : stats.homeworkPending ? 'homework' : teacherLock ? 'sessions' : 'discover')}
                        className="wn-student-primary-action"
                      >
                        {ov.continueBtn || 'Continue'}
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
                <div className="bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-xl p-5">
                  <h3 className="font-bold text-[var(--wn-heading)] mb-3">
                    {acc.welcome || 'Welcome,'} {profile?.user?.name || user?.name}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <InfoRow label={acc.email || 'Email'} value={profile?.user?.email || user?.email} />
                    <InfoRow label={acc.phone || 'Phone'} value={profile?.user?.phone} />
                    <InfoRow label={acc.completedSessions || 'Completed Sessions'} value={profile?.summary?.completedSessions || 0} />
                    <InfoRow label={acc.startingLevel || 'My starting level'} value={learnerLevelLabel(profile?.user?.currentLevel || user?.currentLevel, psT, acc)} />
                    <InfoRow
                      label={acc.learningTrack || 'Learning track'}
                      value={(profile?.user?.onboarding?.trackSelected || user?.onboarding?.trackSelected)
                        ? learnerTrackLabel(profile?.user?.preferredTrack || user?.preferredTrack, psT, acc)
                        : (acc.notSelected || 'Not selected')}
                    />
                  </div>
                  <p className="mt-3 text-xs text-[var(--wn-text-secondary)]">
                    {acc.levelNote || 'Your tutor verifies your level during the trial lesson.'}
                  </p>
                  <Link
                    className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[var(--wn-emerald)] px-4 py-2 text-sm font-bold text-[var(--wn-link)] hover:bg-[var(--wn-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    to={lp('/profile/setup')}
                  >
                    {acc.editProfile || 'Edit my profile and level'}
                  </Link>
                </div>

                <section className="wn-student-guardian-link">
                  <div className="wn-student-guardian-link__heading">
                    <div>
                      <span>{acc.guardianEyebrow || 'Guardian'}</span>
                      <h3>{acc.guardianTitle || 'Guardian account linking'}</h3>
                      <p>
                        {acc.guardianDesc || 'Entering a phone number never links an account automatically. The guardian must confirm or use the link code.'}
                      </p>
                    </div>
                    <Users size={24} aria-hidden="true" />
                  </div>

                  {linkedGuardians.length > 0 && (
                    <div className="wn-student-guardian-linked">
                      {linkedGuardians.map((guardian) => (
                        <div key={guardian.id}>
                          <span className="wn-student-guardian-avatar">{guardian.name?.slice(0, 1) || 'G'}</span>
                          <span>
                            <strong>{guardian.name}</strong>
                            <small>{guardianRelationshipLabel(guardian.relationship, sd)} · {acc.linkedBadge || 'Linked'}</small>
                          </span>
                          <CheckCircle size={18} aria-hidden="true" />
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={submitGuardianInvitation} className="wn-student-guardian-form" noValidate>
                    <div>
                      <label htmlFor="guardian-invite-phone">{acc.guardianPhone || 'Guardian phone'}</label>
                      <input
                        id="guardian-invite-phone"
                        type="tel"
                        className="input-field w-full min-h-[44px]"
                        placeholder="+20 10 0000 0000"
                        value={guardianInviteForm.guardianPhone}
                        aria-invalid={Boolean(guardianPhoneError)}
                        aria-describedby={guardianPhoneError ? 'guardian-invite-phone-err' : undefined}
                        onChange={(event) => {
                          if (guardianPhoneError) setGuardianPhoneError('');
                          setGuardianInviteForm((current) => ({ ...current, guardianPhone: event.target.value }));
                        }}
                      />
                      {guardianPhoneError && (
                        <p id="guardian-invite-phone-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">
                          {guardianPhoneError}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="guardian-invite-rel">{acc.relationship || 'Relationship'}</label>
                      <select
                        id="guardian-invite-rel"
                        className="input-field w-full min-h-[44px]"
                        value={guardianInviteForm.relationship}
                        onChange={(event) => setGuardianInviteForm((current) => ({ ...current, relationship: event.target.value }))}
                      >
                        <option value="father">{sd.guardianRel?.father || 'Father'}</option>
                        <option value="mother">{sd.guardianRel?.mother || 'Mother'}</option>
                        <option value="guardian">{sd.guardianRel?.guardian || 'Guardian'}</option>
                        <option value="other">{sd.guardianRel?.other || 'Other'}</option>
                      </select>
                    </div>
                    <button type="submit" disabled={savingGuardianInvite || !guardianInviteForm.guardianPhone.trim()}>
                      {savingGuardianInvite ? (acc.saving || 'Saving…') : (acc.createInvite || 'Create invitation')}
                    </button>
                  </form>

                  {guardianInvitations.length > 0 && (
                    <div className="wn-student-guardian-invitations">
                      <h4>{acc.linkRequests || 'Link requests'}</h4>
                      {guardianInvitations.slice(0, 8).map((invitation) => (
                        <div key={invitation._id} className={`is-${invitation.status}`}>
                          <span>
                            <strong>{guardianRelationshipLabel(invitation.relationship, sd)}</strong>
                            <small>
                              {invitation.phoneMasked || '—'} · {guardianInvitationStatus(invitation.status, sd)}
                            </small>
                          </span>
                          {invitation.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => copyInvitationCode(invitation.linkCode)}
                                className="min-h-[44px]"
                              >
                                <Copy size={14} aria-hidden="true" />
                                {invitation.linkCode}
                              </button>
                              <button
                                type="button"
                                disabled={cancellingInviteId === invitation._id}
                                aria-label={common.cancel || 'Cancel'}
                                onClick={() => setCancelInviteModal(invitation)}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                              >
                                {cancellingInviteId === invitation._id
                                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                  : <X size={14} aria-hidden="true" />}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {guardianInvitations.every((invitation) => invitation.status !== 'pending') && profile?.user?.guardianLinkCode && (
                    <div className="wn-student-guardian-fallback">
                      <span>{acc.legacyCode || 'Backup link code'}</span>
                      <button type="button" onClick={copyGuardianLinkCode} className="min-h-[44px]">
                        <Copy size={14} aria-hidden="true" />
                        {profile.user.guardianLinkCode}
                      </button>
                    </div>
                  )}
                </section>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-xl p-5">
                    <Trophy className="text-[var(--wn-link)] mb-2" size={28} aria-hidden="true" />
                    <p className="text-2xl font-bold text-[var(--wn-heading)]">
                      {gameStats?.points?.total || 0} {acc.pointsUnit || 'points'}
                    </p>
                    <p className="text-sm text-[var(--wn-text-secondary)]">
                      {acc.levelLabel || 'Level'} {gameStats?.points?.level || 1} — {gameStats?.streaks?.current || 0} {acc.daysUnit || 'days'}
                    </p>
                    {(badges.unlocked || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {badges.unlocked.slice(0, 4).map((b) => (
                          <span key={b._id} className="text-xs bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border-strong)] px-2 py-0.5 rounded-full">
                            {pickLocalizedTitle(b.badge?.name, locale, b.badge?.code)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-xl p-5">
                    <h3 className="font-bold text-sm text-[var(--wn-heading)] mb-2 flex items-center gap-2">
                      <BookOpen size={16} aria-hidden="true" /> {acc.myCourses || 'My Courses'} ({courses.length})
                    </h3>
                    {loadErrors.courses ? (
                      <div role="alert" className="text-xs text-[var(--wn-text-danger)] space-y-2">
                        <p>{errT.loadFailed || 'Could not load data.'}</p>
                        <button type="button" onClick={load} className="min-h-[44px] inline-flex items-center gap-1 underline font-bold">
                          <RefreshCw size={13} aria-hidden="true" /> {common.retry || 'Try again'}
                        </button>
                      </div>
                    ) : courses.length === 0 ? (
                      <Link
                        to={lp('/courses')}
                        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--wn-link)] hover:underline"
                      >
                        {acc.browseCourses || 'Browse Courses'}
                      </Link>
                    ) : courses.slice(0, 3).map((e) => (
                      <div key={e._id} className="flex justify-between items-center gap-2 text-sm py-1.5 border-b border-[var(--wn-border)] last:border-0">
                        <span className="text-[var(--wn-text-primary)]">{pickLocalizedTitle(e.course?.title, locale, certT.certFallback || 'Course')}</span>
                        <button
                          type="button"
                          onClick={() => navigate(lp(`/courses/${e.course?.slug}/learn`))}
                          className="min-h-[44px] px-2 text-[var(--wn-link)] text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                        >
                          {acc.continueBtn || 'Continue'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
                      <Users size={18} aria-hidden="true" /> {acc.myTutors || 'My Tutors'} ({myTeachers.length})
                    </h3>
                    {!teacherLock && (
                      <Link
                        to={lp('/teachers')}
                        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--wn-link)] hover:underline"
                      >
                        {acc.findTutor || 'Find a Tutor'}
                      </Link>
                    )}
                  </div>
                  {myTeachers.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title={acc.noTutorsNote || 'Book a trial session from the teachers page'}
                    />
                  ) : myTeachers.map((tutorItem) => (
                    <div key={tutorItem._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4 mb-2 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <h4 className="font-bold text-[var(--wn-text-primary)]">{tutorItem.name}</h4>
                        <p className="text-xs text-[var(--wn-text-secondary)]">
                          {tutorItem.country} — {tutorItem.sessionCount} {acc.sessionsUnit || 'sessions'} — ⭐{' '}
                          {Number(tutorItem.ratingCount || 0) > 0
                            ? Number(tutorItem.rating || 0).toFixed(1)
                            : (acc.noRatingsYet || 'No ratings yet')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(lp(`/teachers/${tutorItem._id}`))}
                          className="min-h-[44px] px-3.5 py-2 border border-[var(--wn-border)] text-[var(--wn-text-primary)] rounded-lg text-sm font-semibold hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                        >
                          {acc.profileBtn || 'Profile'}
                        </button>
                        {tutorItem.canBookRegular && (
                          <button
                            type="button"
                            onClick={() => openBook(tutorItem)}
                            className="min-h-[44px] px-3.5 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                          >
                            {acc.bookSessionBtn || 'Book Session'}
                          </button>
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
                  <p className="text-sm text-[var(--wn-text-secondary)]">{trT.subtitle || 'Trial session requests with tutors'}</p>
                  <span className="rounded-full bg-[var(--wn-emerald-soft)] px-3 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                    {trialRemaining} / {trialAllowance.limit || 3} {ov.trialsRemainingStat || 'تجريبيات متبقية'}
                  </span>
                </div>
                {trials.length === 0 && loadErrors.trials ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{trT.loadErrorTitle || errT.trialsLoadFailed || 'We could not load your trial requests'}</p>
                    <p className="text-sm text-[var(--wn-text-secondary)]">{trT.loadErrorDesc || 'Please try again in a moment.'}</p>
                    <button type="button" onClick={load} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : trials.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={trT.empty || 'You have not booked a trial yet'}
                    action={!teacherLock ? (
                      <button type="button" onClick={() => setTab('discover')} className="btn-primary min-h-[44px] inline-flex items-center text-sm">
                        {trT.bookTrialCta || 'Choose a tutor and book a trial'}
                      </button>
                    ) : undefined}
                  />
                ) : trials.map((s) => (
                  <SessionCard
                    key={s._id}
                    session={s}
                    onReview={openReview}
                    hasReviewed={hasReviewed(s._id, s)}
                    onChat={openSessionChat}
                    onRsvp={(sess, rsvpSt) => rsvpSt === 'excused' ? setStudentExcuseModal(sess) : handleStudentRsvp(sess._id, 'confirmed')}
                    onAcceptReschedule={acceptRescheduledSession}
                    onCancelPending={setCancelPendingModal}
                    busySessionId={actionSessionId}
                    submittingRsvp={submittingRsvp}
                    hasUnreadChat={unreadChatSessionIds.has(String(s._id))}
                    currentUserId={user?._id || user?.id}
                  />
                ))}
              </div>
            )}

            {tab === 'sessions' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--wn-text-secondary)] mb-2">
                  {sessT.subtitle || 'Your regular and subscription sessions'}
                </p>
                {sessions.length === 0 && loadErrors.sessions ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={load} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : sessions.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={currentSubscription
                      ? (currentSubscription.status === 'active' ? (sessT.activeEmpty || 'No lessons scheduled yet.') : subStatusCopy)
                      : (sessT.noSubEmpty || 'No regular sessions — complete a trial first, then subscribe from your account')}
                  />
                ) : sessions.map((s) => (
                  <SessionCard
                    key={s._id}
                    session={s}
                    onReview={openReview}
                    hasReviewed={hasReviewed(s._id, s)}
                    onChat={openSessionChat}
                    onRsvp={(sess, rsvpSt) => rsvpSt === 'excused' ? setStudentExcuseModal(sess) : handleStudentRsvp(sess._id, 'confirmed')}
                    onAcceptReschedule={acceptRescheduledSession}
                    onCancelPending={setCancelPendingModal}
                    busySessionId={actionSessionId}
                    submittingRsvp={submittingRsvp}
                    hasUnreadChat={unreadChatSessionIds.has(String(s._id))}
                    currentUserId={user?._id || user?.id}
                  />
                ))}
              </div>
            )}

            {tab === 'homework' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--wn-text-secondary)] mb-2">{hwT.subtitle || 'Memorization, revision, and audio assignments'}</p>
                {homework.length === 0 && loadErrors.homework ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={load} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : homework.length === 0 ? (
                  <EmptyState icon={FileText} title={hwT.empty || 'No assignments currently'} />
                ) : homework.map((hw) => {
                  const hwSt = getHwStatus(hw.status, sd);
                  const isUploadingThis = uploadingHwId === hw._id;
                  const isDeletingThis = deletingHwId === hw._id;
                  return (
                    <div key={hw._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4 flex flex-wrap justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText size={16} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
                          <h3 className="font-bold text-[var(--wn-text-primary)]">{hw.title}</h3>
                          {hw.type && (
                            <span className="text-xs bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)] px-2 py-0.5 rounded">
                              {taskTypeLabel(hw.type)}
                            </span>
                          )}
                          {hw.circleName && (
                            <span className="text-xs bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] px-2 py-0.5 rounded font-semibold">
                              {hw.circleName}
                            </span>
                          )}
                        </div>
                        {hw.description && <p className="text-sm text-[var(--wn-text-secondary)] mt-1">{hw.description}</p>}
                        {hw.teacherFeedback && (
                          <div className="mt-2 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] px-3 py-2 text-xs text-[var(--wn-text-primary)]">
                            <strong>{hwT.tutorFeedback || 'Tutor feedback:'}</strong> {hw.teacherFeedback}
                          </div>
                        )}
                        {hw.hasTeacherFeedbackAudio && (
                          <StudentVoiceFeedbackPlayer
                            taskId={hw._id}
                            duration={hw.teacherFeedbackDuration}
                            locale={locale}
                          />
                        )}
                        {hw.dueDate && (
                          <p className="text-xs text-[var(--wn-text-tertiary)] mt-1">
                            {hwT.duePrefix || 'Due:'} {new Date(hw.dueDate).toLocaleDateString(intlLocale)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded font-semibold ${hwSt.cls}`}>{hwSt.label}</span>
                        {hw.status === 'submitted' && (
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => setDeleteHwModal(hw)}
                            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] hover:opacity-90 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55"
                          >
                            {isDeletingThis ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}
                            <span>{hwT.replaceSubmission || 'Replace submission'}</span>
                          </button>
                        )}
                        {hw.status === 'pending' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={Boolean(uploadingHwId)}
                              onClick={() => {
                                resetVoiceRecording();
                                setRecordModalHw(hw);
                              }}
                              className="min-h-[44px] px-3.5 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55"
                            >
                              <Mic size={14} className="text-[var(--wn-gold)]" aria-hidden="true" />
                              <span>{hwT.recordAudio || 'Record Audio'}</span>
                            </button>
                            <input
                              type="file"
                              accept="audio/*,application/pdf,image/jpeg,image/png,image/webp"
                              className="hidden"
                              id={`hw-${hw._id}`}
                              disabled={Boolean(uploadingHwId)}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) submitHomework(hw._id, file, hw.sessionId);
                              }}
                            />
                            <label
                              htmlFor={`hw-${hw._id}`}
                              className={`min-h-[44px] inline-flex items-center gap-1.5 text-xs px-3.5 py-2 border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] rounded-lg font-semibold ${
                                isUploadingThis || uploadingHwId ? 'pointer-events-none opacity-55' : 'cursor-pointer'
                              }`}
                            >
                              {isUploadingThis ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Upload size={13} aria-hidden="true" />}
                              <span>{isUploadingThis ? (hwT.uploadProgress || common.uploading || 'Uploading…') : (hwT.uploadFile || 'Upload File')}</span>
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
                  <p className="text-sm text-[var(--wn-text-secondary)]">{certT.subtitle || 'Your certificates after completing courses'}</p>
                  {certificates.length > 0 && (
                    <button
                      type="button"
                      disabled={downloadingAll}
                      onClick={downloadAllCertificates}
                      className="btn-primary min-h-[44px] text-xs px-3.5 py-2 inline-flex items-center gap-1.5 disabled:opacity-55"
                    >
                      {downloadingAll ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Award size={14} aria-hidden="true" />}
                      <span>{downloadingAll ? (certT.downloadingAll || common.downloading || 'Preparing…') : (certT.downloadAll || 'Download All PDFs')}</span>
                    </button>
                  )}
                </div>
                {certificates.length === 0 && loadErrors.certificates ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={loadCertificatesTab} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : certificates.length === 0 ? (
                  <EmptyState
                    icon={Award}
                    title={certT.empty || 'No certificates yet'}
                    action={
                      <RouterLink to={lp('/courses')} className="btn-primary min-h-[44px] inline-flex items-center text-sm">
                        {certT.startCourse || 'Start a Course'}
                      </RouterLink>
                    }
                  />
                ) : certificates.map((c) => (
                  <div key={c._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--wn-text-primary)]">{pickLocalizedTitle(c.course?.title, locale, certT.certFallback || 'Certificate')}</h3>
                      <p className="text-xs text-[var(--wn-text-secondary)]">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString(intlLocale) : ''}</p>
                    </div>
                    <RouterLink
                      to={lp(`/verify-certificate/${c.certificateId || c._id}`)}
                      className="btn-primary min-h-[44px] inline-flex items-center text-sm px-4 py-2"
                    >
                      {certT.viewDownload || 'View / Download'}
                    </RouterLink>
                  </div>
                ))}
              </div>
            )}

            {tab === 'recordings' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--wn-text-secondary)]">{recT.subtitle || 'Your completed sessions and recordings'}</p>
                {recordings.length === 0 && loadErrors.recordings ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={loadRecordingsTab} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : recordings.length === 0 ? (
                  <EmptyState icon={Video} title={recT.empty || 'No recordings yet'} />
                ) : recordings.map((s) => (
                  <div key={s._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--wn-text-primary)]">{s.teacher?.user?.name || recT.tutorFallback || 'Tutor'}</h3>
                      <p className="text-sm text-[var(--wn-text-secondary)]">{new Date(s.scheduledAt).toLocaleString(intlLocale)}</p>
                    </div>
                    {(/^https:\/\//i.test(String(s.recordingUrl || '').trim()) || String(s.recordingUrl || '').trim().startsWith('/api/')) ? (
                      <a
                        href={String(s.recordingUrl).trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 text-sm text-[var(--wn-link)] font-semibold hover:underline"
                      >
                        <Video size={16} aria-hidden="true" /> {recT.watch || 'Watch'}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--wn-text-tertiary)]">{recT.unavailable || 'No recording available'}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'achievements' && (
              <div className="space-y-4">
                <div className="bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-xl p-6 text-center">
                  <Trophy className="mx-auto text-[var(--wn-link)] mb-2" size={40} aria-hidden="true" />
                  <p className="text-3xl font-bold text-[var(--wn-heading)]">{gameStats?.points?.total || 0}</p>
                  <p className="text-sm text-[var(--wn-text-secondary)]">
                    {achT.pointsLabel || 'points'} — {achT.levelLabel || 'Level'} {gameStats?.points?.level || 1}
                  </p>
                  <p className="text-sm text-[var(--wn-text-primary)] mt-1">
                    {achT.streakLabel || 'Streak'} {gameStats?.streaks?.current || 0} {achT.daysUnit || 'days'}
                  </p>
                  <Link
                    to={lp('/leaderboard')}
                    className="inline-flex min-h-[44px] items-center mt-2 px-3 text-sm text-[var(--wn-link)] font-bold hover:underline"
                  >
                    🏆 {achT.leaderboardLink || 'Leaderboard'}
                  </Link>
                </div>
                <h3 className="font-bold text-sm text-[var(--wn-heading)]">{achT.badgesTitle || 'Badges'}</h3>
                {(badges.unlocked || []).length === 0 ? (
                  <EmptyState icon={Award} title={achT.noBadges || 'Complete sessions and courses to earn badges'} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {badges.unlocked.map((b) => (
                      <div key={b._id} className="border border-[var(--wn-border-strong)] rounded-xl p-4 text-center bg-[var(--wn-gold-soft)]">
                        <Award className="mx-auto text-[var(--wn-text-gold)] mb-2" size={28} aria-hidden="true" />
                        <p className="font-bold text-sm text-[var(--wn-text-primary)]">{pickLocalizedTitle(b.badge?.name, locale, b.badge?.code)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center md:text-start">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-text-gold)] bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] px-3 py-1 rounded-full">
                        <Trophy size={14} aria-hidden="true" />
                        <span>{achT.contestBadge || 'Semi-Annual Kids Contest'}</span>
                      </div>
                      <h4 className="text-lg font-bold text-[var(--wn-heading)]">
                        {achT.contestTitle || 'Little Champions Hall of Fame & Grand Prizes'}
                      </h4>
                      <p className="text-xs text-[var(--wn-text-secondary)] max-w-xl">
                        {achT.contestDesc || 'Motivating prizes and recognition for top learners in memorization and recitation.'}
                      </p>
                    </div>
                    <Link
                      to={lp('/programs/kids')}
                      className="shrink-0 min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-xl font-bold text-xs bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] shadow-md transition"
                    >
                      {achT.contestCta || 'View Contest & Register'}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {tab === 'referral' && (
              <div className="space-y-6">
                {loadErrors.referral && !referral?.code ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={loadReferralTab} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] rounded-xl p-6 text-center">
                      <Gift className="mx-auto text-[var(--wn-text-gold)] mb-3" size={40} aria-hidden="true" />
                      <h3 className="font-bold text-lg text-[var(--wn-heading)] mb-2">{refT.title || 'Referral Program'}</h3>
                      <p className="text-sm text-[var(--wn-text-secondary)] mb-4">{refT.subtitle || 'Invite your friends and earn 50 points per registration'}</p>
                      {referral?.code && (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <code className="bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-4 py-2 rounded-lg font-mono text-lg border border-[var(--wn-border)]">{referral.code}</code>
                          <button
                            type="button"
                            onClick={() => copyTextSafely(referral.link || referral.code, refT.copiedSuccess || 'Referral link copied')}
                            className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[var(--wn-link)] hover:bg-[var(--wn-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                          >
                            <Copy size={14} aria-hidden="true" /> {refT.copyLink || 'Copy Link'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-xl p-4">
                        <p className="text-2xl font-bold text-[var(--wn-text-gold)]">{referral?.stats?.totalInvites || 0}</p>
                        <p className="text-xs text-[var(--wn-text-secondary)]">{refT.invitesStat || 'Invites'}</p>
                      </div>
                      <div className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-xl p-4">
                        <p className="text-2xl font-bold text-[var(--wn-link)]">{referral?.stats?.active || 0}</p>
                        <p className="text-xs text-[var(--wn-text-secondary)]">{refT.activeStat || 'Active'}</p>
                      </div>
                      <div className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-xl p-4">
                        <p className="text-2xl font-bold text-[var(--wn-heading)]">{referral?.stats?.totalPoints || 0}</p>
                        <p className="text-xs text-[var(--wn-text-secondary)]">{refT.bonusPointsStat || 'Bonus Points'}</p>
                      </div>
                    </div>
                    {(referral?.referrals || []).length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm text-[var(--wn-heading)]">{refT.recentReferrals || 'Recent Referrals'}</h4>
                        {referral.referrals.slice(0, 10).map((r) => (
                          <div key={r._id} className="flex justify-between items-center border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg px-4 py-3 text-sm">
                            <span className="text-[var(--wn-text-primary)]">{r.referee?.name || '—'}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              r.status === 'rewarded'
                                ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                                : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]'
                            }`}>
                              {r.status === 'rewarded'
                                ? (refT.statusRewarded || 'Rewarded')
                                : r.status === 'active'
                                  ? (refT.statusActive || 'Active')
                                  : (refT.statusPending || 'Pending')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={Gift} title={refT.emptyHint || 'Share your link with friends to start earning points'} />
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'teacher-updates' && (
              <div className="wn-student-teacher-updates">
                <div className="wn-student-teacher-updates__intro">
                  <div>
                    <span>{updT.eyebrow || 'From your tutor'}</span>
                    <h3>{updT.title || 'Tutor messages and videos'}</h3>
                    <p>{updT.subtitle || 'Short messages, guidance, and review videos shared by your tutor.'}</p>
                  </div>
                  <Megaphone size={28} aria-hidden="true" />
                </div>

                {teacherUpdates.length === 0 && loadErrors.teacherUpdates ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={load} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : teacherUpdates.length === 0 ? (
                  <EmptyState
                    icon={Megaphone}
                    title={updT.emptyTitle || 'No tutor updates yet'}
                    description={updT.emptyDesc || 'New tutor messages will appear here.'}
                  />
                ) : (
                  <div className="wn-student-teacher-update-list">
                    {teacherUpdates.map((update) => {
                      const teacherName = update.teacher?.personalInfo?.fullName
                        || update.teacher?.user?.name
                        || (scT.tutorFallback || 'Tutor');

                      return (
                        <article key={update._id}>
                          <div className="wn-student-teacher-update-list__head">
                            <span className="wn-student-teacher-update-list__avatar">{teacherName.slice(0, 1)}</span>
                            <div>
                              <span>{teacherName}</span>
                              <h4>{update.title}</h4>
                              <small>{new Date(update.publishedAt || update.createdAt).toLocaleString(intlLocale)}</small>
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
                                    <button type="button" onClick={() => loadTeacherUpdateVideo(update._id, index)} className="min-h-[44px]">
                                      <Video size={22} aria-hidden="true" />
                                      <span>
                                        <strong>{updT.playVideo || 'Play video'} {index + 1}</strong>
                                        <small>{video.name || updT.videoFallback || 'Lesson video'}</small>
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
                <p className="text-sm text-[var(--wn-text-secondary)]">{evT.subtitle || 'Tutor evaluations of your session performance'}</p>
                {evaluations.length > 0 && (
                  <QuranProgressSummary evaluations={evaluations} locale={locale} variant="student" />
                )}
                {evaluations.length === 0 && loadErrors.evaluations ? (
                  <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-6 text-center space-y-2">
                    <p className="font-bold text-[var(--wn-text-danger)]">{errT.loadFailed || 'Could not load data. Please try again.'}</p>
                    <button type="button" onClick={load} className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 text-sm">
                      <RefreshCw size={14} aria-hidden="true" /> {common.retry || 'Try again'}
                    </button>
                  </div>
                ) : evaluations.length === 0 ? (
                  <EmptyState icon={Star} title={evT.empty || 'No evaluations recorded yet'} />
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
                    <div key={s._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-xl p-5">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[var(--wn-text-primary)]">{s.teacher?.user?.name || scT.tutorFallback || 'Tutor'}</h3>
                            {(s.type === 'group_circle' || s.circle?.name) && (
                              <span className="text-xs bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] px-2 py-0.5 rounded-full font-semibold">
                                {s.circle?.name || scT.circleBadge || 'Group circle'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--wn-text-secondary)]">
                            {formatSessionDateTime(s, intlLocale, { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(s)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => shareStudentEvaluationViaWhatsApp(s, reportSurah, reportFromAyah, reportToAyah, ev, reportNotes)}
                            className="min-h-[44px] inline-flex items-center text-xs px-3 py-2 rounded-lg bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] font-bold hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                          >
                            {evT.shareWhatsApp || 'Share on WhatsApp'}
                          </button>
                          {!hasReviewed(s._id) && (
                            <button
                              type="button"
                              onClick={() => openReview(s)}
                              className="min-h-[44px] inline-flex items-center px-3 py-2 text-sm font-bold text-[var(--wn-text-gold)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded-lg"
                            >
                              {evT.rateTeacher || 'Rate Tutor'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        {[
                          ['attendance', scT.confirmed || 'Attendance'],
                          ['memorization', evT.memScore || 'Memorization'],
                          ['tajweed', evT.tajweedScore || 'Tajweed'],
                          ['behavior', achT.levelLabel || 'Behavior'],
                          ['commitment', achT.streakLabel || 'Commitment'],
                        ].map(([k, label]) => (
                          <div key={k} className="bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] rounded-lg p-2 text-center">
                            <p className="text-xs text-[var(--wn-text-secondary)]">{label}</p>
                            <p className="font-bold text-[var(--wn-link)]">{ev[k] ?? '—'}/5</p>
                          </div>
                        ))}
                      </div>
                      {(reportSurah || reportFromAyah || reportToAyah || reportNextHomework || reportNotes) && (
                        <div className="mt-3 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-4 text-sm text-[var(--wn-text-primary)] space-y-1">
                          <p className="mb-2 font-bold text-[var(--wn-heading)]">{qwT.generalEvaluation || 'Session report'}</p>
                          {reportSurah ? (
                            <p><strong>{evT.surahLabel || 'Surah / passage:'}</strong> {reportSurah}</p>
                          ) : null}
                          {(reportFromAyah || reportToAyah) ? (
                            <p>
                              <strong>{evT.surahLabel || 'Ayahs:'}</strong>{' '}
                              {reportFromAyah || '—'} – {reportToAyah || '—'}
                            </p>
                          ) : null}
                          {reportNextHomework ? (
                            <p><strong>{evT.homeworkLabel || 'Next homework:'}</strong> {reportNextHomework}</p>
                          ) : null}
                          {reportNotes ? (
                            <p><strong>{evT.notesLabel || 'Notes:'}</strong> {reportNotes}</p>
                          ) : null}
                        </div>
                      )}
                      {ev.assignedHomework?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">{ov.homework || 'Homework'}</p>
                          {ev.assignedHomework.map((h, i) => (
                            <p key={i} className="text-sm text-[var(--wn-text-secondary)]">• {h.description}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {reviews.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-bold text-[var(--wn-heading)] mb-3 flex items-center gap-2">
                      <Star size={18} aria-hidden="true" /> {evT.rateTeacher || 'Your Tutor Reviews'}
                    </h3>
                    {reviews.map((r) => (
                      <div key={r._id} className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-3 mb-2">
                        <p className="font-semibold text-sm text-[var(--wn-text-primary)]">{r.teacher?.personalInfo?.fullName || r.teacher?.user?.name || scT.tutorFallback || 'Tutor'}</p>
                        <div className="flex gap-0.5 my-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={12} className={i < r.rating ? 'text-[var(--wn-gold)] fill-current' : 'text-[var(--wn-text-tertiary)]'} aria-hidden="true" />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-[var(--wn-text-secondary)]">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tab !== 'support' && (
        <div className="mt-6">
          <SupportLauncher onOpen={() => setTab('support')} />
        </div>
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

      <Modal
        isOpen={Boolean(reviewModal)}
        disableClose={submittingReview}
        title={`${modT.reviewTitle || 'Rate Session & Tutor'} — ${reviewModal?.teacher?.personalInfo?.fullName || reviewModal?.teacher?.user?.name || reviewModal?.circle?.name || scT.tutorFallback || ''}`}
        onClose={() => { if (!submittingReview) setReviewModal(null); }}
      >
        <div className="space-y-4">
          <div>
            <p className="block text-sm font-medium text-[var(--wn-text-primary)] mb-2">
              {modT.ratingLabel || 'Overall rating'}
            </p>
            <div className="flex items-center gap-2" role="radiogroup" aria-label={modT.ratingLabel || 'Overall rating'}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= reviewForm.rating;
                return (
                  <button
                    key={star}
                    type="button"
                    disabled={submittingReview}
                    role="radio"
                    aria-checked={reviewForm.rating === star}
                    aria-label={`${star} / 5`}
                    onClick={() => setReviewForm((p) => ({ ...p, rating: star }))}
                    className={`min-h-[44px] min-w-[44px] rounded-xl border transition inline-flex items-center justify-center cursor-pointer ${
                      active
                        ? 'border-[var(--wn-gold)] bg-[var(--wn-gold-soft)] text-[var(--wn-gold)]'
                        : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-tertiary)]'
                    }`}
                  >
                    <Star size={22} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                );
              })}
              <span className="ms-2 text-[var(--wn-link)] font-bold">{reviewForm.rating} / 5</span>
            </div>
          </div>
          <div>
            <label htmlFor="review-comment" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
              {modT.commentLabel || 'Your comment (optional)'}
            </label>
            <textarea
              id="review-comment"
              className="input-field w-full mt-1"
              rows={3}
              disabled={submittingReview}
              placeholder={modT.commentPlaceholder || 'Share your feedback about the session…'}
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
            />
          </div>
          <label htmlFor="review-continue" className="flex items-center gap-2 text-sm text-[var(--wn-text-primary)] min-h-[44px] cursor-pointer">
            <input
              id="review-continue"
              type="checkbox"
              disabled={submittingReview}
              checked={reviewForm.wouldContinue}
              onChange={(e) => setReviewForm((p) => ({ ...p, wouldContinue: e.target.checked }))}
              className="h-4 w-4 accent-[var(--wn-emerald)]"
            />
            <span>{modT.wouldContinue || 'I would like to continue with this tutor'}</span>
          </label>
          <button
            type="button"
            disabled={submittingReview}
            onClick={submitReview}
            className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-55"
          >
            {submittingReview && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{submittingReview ? (modT.submitting || 'Submitting…') : (modT.submitReview || 'Submit Review')}</span>
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(bookModal)}
        disableClose={booking}
        title={`${acc.bookSessionBtn || 'Book Session'} — ${bookModal?.name || ''}`}
        onClose={() => { if (!booking) setBookModal(null); }}
      >
        <form onSubmit={bookRegular} className="space-y-3" noValidate>
          {bookAvailability.loading ? (
            <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-3 text-sm text-[var(--wn-text-primary)]">
              {t?.student?.booking?.loadingSlots || 'Loading booking slots…'}
            </div>
          ) : bookAvailability.configured ? (
            <>
              <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-3 text-xs text-[var(--wn-text-primary)]">
                {t?.student?.booking?.availabilityFromSchedule || 'These slots come directly from the tutor schedule.'} ({bookingTimezone})
              </div>
              <div>
                <label htmlFor="book-modal-date" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                  {t?.student?.booking?.dateLabel || 'Date'}
                </label>
                <select
                  id="book-modal-date"
                  required
                  className="input-field w-full min-h-[44px]"
                  value={bookForm.date}
                  aria-invalid={Boolean(bookError && !bookForm.date)}
                  onChange={(event) => {
                    if (bookError) setBookError('');
                    setBookForm((current) => ({ ...current, date: event.target.value, time: '' }));
                  }}
                >
                  <option value="">{t?.student?.booking?.chooseDate || 'Choose a date'}</option>
                  {bookAvailableDates.map((date) => {
                    const representative = bookAvailability.slots.find((slot) => bookingDateKey(slot.startsAt) === date);
                    return (
                      <option key={date} value={date}>
                        {new Date(representative.startsAt).toLocaleDateString(intlLocale, {
                          timeZone: bookingTimezone,
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="book-modal-time" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                  {t?.student?.booking?.timeLabel || 'Time'}
                </label>
                <select
                  id="book-modal-time"
                  required
                  disabled={!bookForm.date}
                  className="input-field w-full min-h-[44px]"
                  value={bookForm.time}
                  aria-invalid={Boolean(bookError && !bookForm.time)}
                  onChange={(event) => {
                    if (bookError) setBookError('');
                    setBookForm((current) => ({ ...current, time: event.target.value }));
                  }}
                >
                  <option value="">{t?.student?.booking?.chooseTime || 'Choose a time'}</option>
                  {bookSlotsForDate.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {new Date(slot.startsAt).toLocaleTimeString(intlLocale, {
                        timeZone: bookingTimezone,
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3 text-xs text-[var(--wn-text-primary)]">
                {t?.student?.booking?.availabilityPending || 'The tutor has not configured availability yet.'}
              </div>
              <div>
                <label htmlFor="book-modal-date-raw" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                  {t?.student?.booking?.dateLabel || 'Date'}
                </label>
                <input
                  id="book-modal-date-raw"
                  type="date"
                  required
                  className="input-field w-full min-h-[44px]"
                  value={bookForm.date}
                  onChange={(e) => {
                    if (bookError) setBookError('');
                    setBookForm((p) => ({ ...p, date: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label htmlFor="book-modal-time-raw" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                  {t?.student?.booking?.timeLabel || 'Time'}
                </label>
                <input
                  id="book-modal-time-raw"
                  type="time"
                  required
                  className="input-field w-full min-h-[44px]"
                  value={bookForm.time}
                  onChange={(e) => {
                    if (bookError) setBookError('');
                    setBookForm((p) => ({ ...p, time: e.target.value }));
                  }}
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="book-modal-notes" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
              {t?.student?.booking?.notesLabel || 'Notes for the teacher (optional)'}
            </label>
            <textarea
              id="book-modal-notes"
              className="input-field w-full"
              rows={2}
              placeholder={t?.student?.booking?.notesPlaceholder || 'Notes'}
              value={bookForm.notes}
              onChange={(e) => setBookForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          {bookError && (
            <p role="alert" className="text-xs font-semibold text-[var(--wn-text-danger)]">{bookError}</p>
          )}
          <button
            type="submit"
            disabled={booking}
            className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-55"
          >
            {booking && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{booking ? (t?.student?.booking?.sending || 'Sending…') : (t?.student?.booking?.confirmBtn || 'Confirm request')}</span>
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(recordModalHw)}
        disableClose={submittingVoice}
        title={modT.recordTitle || 'Live Quran Recitation Recording'}
        onClose={() => { if (!submittingVoice) { resetVoiceRecording(); setRecordModalHw(null); } }}
      >
        <div className="space-y-4">
          <div className="bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-xl p-3.5 text-sm text-[var(--wn-text-primary)]">
            <p className="font-bold">{recordModalHw?.title}</p>
            {recordModalHw?.description && <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{recordModalHw.description}</p>}
          </div>

          <div className="bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] rounded-2xl p-6 text-center space-y-4">
            <div className="flex justify-center items-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] animate-pulse'
                  : audioBlob
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                    : 'bg-[var(--wn-emerald-soft)] text-[var(--wn-link)]'
              }`}>
                <Mic size={36} aria-hidden="true" />
              </div>
            </div>

            <div>
              <p className="text-3xl font-black font-mono text-[var(--wn-text-primary)]">
                {Math.floor(recordSeconds / 60).toString().padStart(2, '0')}:{(recordSeconds % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                {isRecording
                  ? (modT.recordingLive || 'Recording your recitation…')
                  : audioBlob
                    ? (modT.recordingDone || 'Recording complete — preview before sending to your tutor')
                    : (modT.recordingIdle || 'Click start below to record your recitation directly')}
              </p>
            </div>

            {audioUrl && (
              <div className="pt-2">
                <audio src={audioUrl} controls className="w-full rounded-lg" />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!isRecording && !audioBlob && (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="min-h-[44px] px-6 py-2.5 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] font-bold rounded-xl text-sm transition inline-flex items-center gap-2 shadow-sm"
                >
                  <Mic size={16} aria-hidden="true" />
                  <span>{modT.startRec || 'Start Recording'}</span>
                </button>
              )}

              {isRecording && (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="min-h-[44px] px-6 py-2.5 bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] font-bold rounded-xl text-sm transition inline-flex items-center gap-2 shadow-sm"
                >
                  <Square size={16} aria-hidden="true" />
                  <span>{modT.stopRec || 'Stop & Preview'}</span>
                </button>
              )}

              {audioBlob && !isRecording && (
                <>
                  <button
                    type="button"
                    disabled={submittingVoice}
                    onClick={resetVoiceRecording}
                    className="min-h-[44px] px-4 py-2.5 border border-[var(--wn-border)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface)] font-bold rounded-xl text-sm transition inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    <span>{modT.rerecord || 'Re-record'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={submittingVoice}
                    onClick={sendVoiceRecording}
                    className="min-h-[44px] px-6 py-2.5 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-bold rounded-xl text-sm transition inline-flex items-center gap-2 shadow-md disabled:opacity-55"
                  >
                    {submittingVoice ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    <span>{submittingVoice ? (modT.sending || 'Sending…') : (modT.sendToTutor || 'Send to Tutor')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(studentExcuseModal)}
        disableClose={submittingRsvp}
        title={modT.excuseTitle || 'Advance Session Excuse'}
        onClose={() => { if (!submittingRsvp) { setStudentExcuseModal(null); setStudentExcuseReason(''); } }}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3 text-xs text-[var(--wn-text-primary)]">
            {modT.excusePolicy || 'Submitting an excuse at least 6 hours before the session preserves your balance for a make-up session.'}
          </div>
          <div>
            <label htmlFor="student-excuse-reason" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
              {modT.excuseLabel || 'Excuse reason (optional)'}
            </label>
            <textarea
              id="student-excuse-reason"
              rows={3}
              disabled={submittingRsvp}
              value={studentExcuseReason}
              onChange={(e) => setStudentExcuseReason(e.target.value)}
              placeholder={modT.excusePlaceholder || 'e.g., Emergency, exam, travel…'}
              className="input-field w-full"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={submittingRsvp}
              onClick={() => { setStudentExcuseModal(null); setStudentExcuseReason(''); }}
              className="min-h-[44px] px-4 py-2 border border-[var(--wn-border)] rounded-lg text-sm font-semibold text-[var(--wn-text-secondary)]"
            >
              {modT.cancel || common.cancel || 'Cancel'}
            </button>
            <button
              type="button"
              disabled={submittingRsvp}
              onClick={() => handleStudentRsvp(studentExcuseModal._id, 'excused', studentExcuseReason)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold disabled:opacity-55"
            >
              {submittingRsvp && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>{submittingRsvp ? (modT.saving || 'Saving…') : (modT.confirmExcuse || 'Confirm Excuse')}</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cancelPendingModal)}
        disableClose={Boolean(actionSessionId)}
        title={modT.cancelReqTitle || 'Confirm Cancel Request'}
        onClose={() => { if (!actionSessionId) setCancelPendingModal(null); }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {modT.cancelReqDesc || 'Do you want to cancel this pending request? You can book another time whenever you like.'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actionSessionId)}
              onClick={() => setCancelPendingModal(null)}
              className="min-h-[44px] px-4 py-2 border border-[var(--wn-border)] rounded-lg text-sm font-semibold text-[var(--wn-text-secondary)]"
            >
              {modT.keepRequest || 'Keep request'}
            </button>
            <button
              type="button"
              disabled={Boolean(actionSessionId)}
              onClick={confirmCancelPendingRequest}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold disabled:opacity-55"
            >
              {actionSessionId && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>{actionSessionId ? (modT.cancelling || 'Cancelling…') : (modT.confirmCancelReq || 'Cancel request')}</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteHwModal)}
        disableClose={Boolean(deletingHwId)}
        title={hwT.deleteConfirmTitle || actT.deleteHomework || 'Confirm Resetting Submission'}
        onClose={() => { if (!deletingHwId) setDeleteHwModal(null); }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {hwT.deleteConfirmDesc || actT.confirmDeleteHomework || 'Are you sure you want to remove this submission so you can re-upload?'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(deletingHwId)}
              onClick={() => setDeleteHwModal(null)}
              className="min-h-[44px] px-4 py-2 border border-[var(--wn-border)] rounded-lg text-sm font-semibold text-[var(--wn-text-secondary)]"
            >
              {common.cancel || 'Cancel'}
            </button>
            <button
              type="button"
              disabled={Boolean(deletingHwId)}
              onClick={() => deleteHomeworkSubmission(deleteHwModal)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold disabled:opacity-55"
            >
              {deletingHwId && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>{deletingHwId ? (common.deleting || 'Deleting…') : (actT.confirmDeleteHomeworkBtn || 'Confirm Delete')}</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cancelInviteModal)}
        disableClose={Boolean(cancellingInviteId)}
        title={modT.cancelInviteConfirmTitle || 'Confirm Cancelling Guardian Link Request'}
        onClose={() => { if (!cancellingInviteId) setCancelInviteModal(null); }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {modT.cancelInviteConfirmDesc || 'Are you sure you want to cancel this pending link request?'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(cancellingInviteId)}
              onClick={() => setCancelInviteModal(null)}
              className="min-h-[44px] px-4 py-2 border border-[var(--wn-border)] rounded-lg text-sm font-semibold text-[var(--wn-text-secondary)]"
            >
              {modT.keepRequest || 'Keep request'}
            </button>
            <button
              type="button"
              disabled={Boolean(cancellingInviteId)}
              onClick={() => cancelGuardianInvitation(cancelInviteModal._id)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold disabled:opacity-55"
            >
              {cancellingInviteId && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>{cancellingInviteId ? (modT.cancelling || 'Cancelling…') : (modT.confirmCancelReq || 'Cancel request')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function SessionCard({
  session,
  onReview,
  hasReviewed,
  onChat,
  onRsvp,
  onAcceptReschedule,
  onCancelPending,
  busySessionId = '',
  submittingRsvp = false,
  hasUnreadChat = false,
  currentUserId,
}) {
  const studentAttendanceEntry = (session.attendance || []).find(
    (entry) => String(entry.student?._id || entry.student || '') === String(currentUserId || '')
  );
  const studentRsvpStatus = studentAttendanceEntry?.status || '';
  const { locale, t } = useI18n();
  const sd = t?.student?.dashboard || {};
  const scT = sd.sessionCard || {};
  const intlLocale = resolveIntlLocale(locale);

  const teacherName = session.teacher?.user?.name || session.teacher?.personalInfo?.fullName || scT.tutorFallback || 'Quran Tutor';
  const isTrial = session.type === 'trial';
  const isGroup = session.type === 'group_circle';
  const isBusy = busySessionId === session._id;
  const durationMinutes = Number(session.duration || 60);
  const durationLabel = durationMinutes === 120
    ? (scT.durationTwoHours || '2 hours')
    : durationMinutes === 90
      ? (scT.durationHourHalf || '1.5 hours')
      : durationMinutes === 60
        ? (scT.durationHour || '1 hour')
        : `${durationMinutes} ${scT.durationMinutesUnit || 'min'}`;
  const joinWindow = session.status === 'accepted'
    ? (session.lifecycle
      ? { phase: session.lifecycle.joinPhase, within: session.lifecycle.joinOpen }
      : sessionJoinWindow(session))
    : null;
  const acceptedExpired = joinWindow?.phase === 'expired';
  const acceptedEarly = joinWindow?.phase === 'early';
  const canJoin = Boolean((session.meetingLink || session.roomId || session._id) && session.status === 'accepted' && (session.lifecycle?.joinOpen ?? joinWindow?.within));
  const statusText = acceptedExpired
    ? (scT.joinWindowEnded || 'Join window ended — awaiting report')
    : getStatusLabel(session.status, sd);

  return (
    <div className="border border-[var(--wn-border)] bg-[var(--wn-surface)] rounded-lg p-4 flex flex-wrap justify-between items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-[var(--wn-text-primary)]">{isGroup ? (session.circle?.name || teacherName) : teacherName}</h3>
          <span className="text-xs bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)] px-2 py-0.5 rounded">
            {isTrial
              ? (scT.trialBadge || 'Trial')
              : isGroup
                ? (scT.circleBadge || 'Group circle')
                : (scT.regularBadge || 'Regular')}
          </span>
        </div>
        <p className="text-sm text-[var(--wn-text-secondary)] flex items-center gap-1 mt-1">
          <Clock size={14} aria-hidden="true" /> {formatSessionDateTime(session, intlLocale, { dateStyle: 'medium', timeStyle: 'short' })} — {durationLabel} · {sessionTimeZone(session)}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block font-semibold ${
          session.status === 'accepted'
            ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
            : session.status === 'pending'
              ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)]'
              : session.status === 'completed'
                ? 'bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)]'
                : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]'
        }`}>
          {statusText}
        </span>
        {session.status === 'pending' && session.rescheduledFrom && (
          <div className="mt-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3 text-xs text-[var(--wn-text-primary)] space-y-2 max-w-md">
            <p className="font-bold">
              {scT.rescheduledNotice || 'Your tutor proposed this new time for your session'}
            </p>
            <p className="text-[var(--wn-text-secondary)]">
              {scT.previousTime || 'Previous time:'}{' '}
              {new Date(session.rescheduledFrom).toLocaleString(intlLocale, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <div className="flex flex-wrap gap-2">
              {onAcceptReschedule && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAcceptReschedule(session)}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-bold disabled:opacity-50"
                >
                  {isBusy ? (scT.confirming || 'Confirming…') : (scT.acceptNewTime || 'Accept new time')}
                </button>
              )}
              {onCancelPending && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onCancelPending(session)}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[var(--wn-danger)] bg-[var(--wn-surface)] text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] font-semibold disabled:opacity-50"
                >
                  {scT.cancelRequest || 'Cancel request'}
                </button>
              )}
            </div>
          </div>
        )}
        {session.status === 'pending' && !session.rescheduledFrom && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs text-[var(--wn-text-gold)]">{scT.awaitingTutor || 'Awaiting tutor approval'}</p>
            {onCancelPending && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onCancelPending(session)}
                className="min-h-[44px] inline-flex items-center px-2 text-xs font-semibold text-[var(--wn-text-danger)] hover:underline disabled:opacity-50"
              >
                {scT.cancelRequest || 'Cancel request'}
              </button>
            )}
          </div>
        )}
        {acceptedEarly && (
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
            {scT.joinOpensEarly || 'Joining opens 30 minutes before start.'}
          </p>
        )}
        {acceptedExpired && (
          <p className="text-xs text-[var(--wn-text-danger)] mt-1">
            {scT.joinWindowClosedDetail || 'Join window ended. The report will appear after your tutor closes the session.'}
          </p>
        )}
        {canJoin && (
          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href={localizedPath(getSessionLiveRoomPath(session), locale)}
              className="min-h-[44px] inline-flex items-center gap-1 px-2 text-sm text-[var(--wn-link)] font-semibold hover:underline"
            >
              <Video size={15} aria-hidden="true" />
              {scT.joinSession || 'Join Session'}
            </a>
            {session.meetingLink && /^https?:\/\//i.test(session.meetingLink) ? (
              <a
                href={localizeInternalHref(session.meetingLink, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center gap-1 px-2 text-xs text-[var(--wn-text-secondary)] font-semibold hover:underline"
              >
                {scT.externalFallback || 'External fallback link'}
              </a>
            ) : null}
            <Link
              to={localizedPath(`/meeting/${session._id}`, locale)}
              className="min-h-[44px] inline-flex items-center gap-1 px-2 text-sm text-[var(--wn-link)] font-semibold hover:underline"
            >
              🌐 {scT.withTranslation || 'With Translation'}
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {session.status === 'accepted' && !acceptedExpired && onRsvp && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {studentRsvpStatus === 'confirmed' ? (
              <span className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-lg bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] text-xs font-bold">
                {scT.confirmed || '✓ Confirmed'}
              </span>
            ) : (
              <button
                type="button"
                disabled={submittingRsvp || isBusy}
                onClick={() => onRsvp(session, 'confirmed')}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-xs font-bold transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {scT.confirmAttendance || 'Confirm Attendance'}
              </button>
            )}
            {studentRsvpStatus === 'excused' ? (
              <span className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-lg bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border-strong)] text-xs font-bold">
                {scT.excused || 'Excused'}
              </span>
            ) : (
              <button
                type="button"
                disabled={submittingRsvp || isBusy}
                onClick={() => onRsvp(session, 'excused')}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[var(--wn-danger)] text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] text-xs font-semibold transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {scT.advanceExcuse || 'Advance Excuse'}
              </button>
            )}
          </div>
        )}
        {!['rejected', 'cancelled'].includes(session.status) && (
          <button
            type="button"
            onClick={() => onChat?.(session)}
            className="relative min-h-[44px] px-4 py-2 border border-[var(--wn-border-mint)] text-[var(--wn-link)] rounded-lg text-sm font-semibold hover:bg-[var(--wn-emerald-soft)] inline-flex items-center gap-1.5"
          >
            {scT.chat || 'Chat'}
            {hasUnreadChat ? (
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--wn-danger)]" aria-label={scT.unreadMessage || 'Unread message'} />
            ) : null}
          </button>
        )}
        {session.status === 'completed' && !hasReviewed && (
          <button
            type="button"
            onClick={() => onReview(session)}
            className="min-h-[44px] px-4 py-2 bg-[var(--wn-gold)] text-[var(--wn-text-primary)] font-bold rounded-lg text-sm hover:opacity-90"
          >
            {scT.rateTeacher || 'Rate Teacher'}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border)] rounded-lg p-3">
      <span className="text-[var(--wn-text-secondary)] text-xs">{label}</span>
      <p className="font-semibold">{value || '—'}</p>
    </div>
  );
}

function taskTypeLabel(t) {
  return TASK_TYPES.find((x) => x.id === t)?.label || t;
}



