import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Eye, EyeOff, History, Loader2, MonitorPlay,
  Plus, RefreshCw, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { localizeInternalHref } from '../../lib/navigation';
import { formatMsg } from './adminFormat';
import AdminAuditTab from './AdminAuditTab';
import AdminAnalyticsTab from './AdminAnalyticsTab';
import AdminBlogTab from './AdminBlogTab';
import AdminCoursesTab from './AdminCoursesTab';
import AdminDashboardShell from './AdminDashboardShell';
import AdminExecutiveHome from './AdminExecutiveHome';
import AdminGrowthTab from './AdminGrowthTab';
import AdminGuardianLinksPanel from './AdminGuardianLinksPanel';
import AdminMessagesTab from './AdminMessagesTab';
import AdminPeopleDirectory from './AdminPeopleDirectory';
import AdminPeopleSearch from './AdminPeopleSearch';
import AdminSessionControl from './AdminSessionControl';
import AdminWithdrawalsTab from './AdminWithdrawalsTab';
import Family360Dossier from './Family360Dossier';
import LaunchReadinessPanel from './LaunchReadinessPanel';
import Student360Dossier from './Student360Dossier';
import TeacherReviewDossier from './TeacherReviewDossier';
import TeacherReviewQueue from './TeacherReviewQueue';
import TeacherInviteLinksPanel from './TeacherInviteLinksPanel';
import TeacherSafeActionModal from './TeacherSafeActionModal';

const ALLOWED_TABS = [
  'overview', 'analytics', 'people', 'sessions', 'system',
  'messages', 'teachers', 'withdrawals', 'courses', 'blog', 'growth', 'audit',
];

export default function AdminDashboard() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const { locale, isRTL, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const toastRef = useRef(toast);
  const formId = useId();
  const peopleDirectoryRef = useRef(null);
  const pendingRefreshInFlightRef = useRef(false);
  const lastPendingRefreshAtRef = useRef(0);
  const pendingRateLimitedUntilRef = useRef(0);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const ta = t.adminPortal;
  const tc = ta.common;
  const tt = ta.toasts;
  const te = ta.errors;
  const intlLocale = resolveIntlLocale(locale);

  const [tab, setTab] = useState('overview');
  const [peopleRole, setPeopleRole] = useState('all');
  const supportStudent = searchParams.get('student') || '';
  const setSupportStudent = (studentId) => {
    navigate(`${localizedPath('/admin', locale)}?tab=messages&student=${encodeURIComponent(studentId)}`);
  };

  const [loading, setLoading] = useState(true);
  const [tabError, setTabError] = useState('');
  const focus = searchParams.get('focus') || '';

  const [stats, setStats] = useState({});
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [archivedTeachers, setArchivedTeachers] = useState([]);
  const [teacherDirectoryCounts, setTeacherDirectoryCounts] = useState({});
  const [teachersSubTab, setTeachersSubTab] = useState('active');
  const [showGuardianLinks, setShowGuardianLinks] = useState(false);
  const [pendingProfileChanges, setPendingProfileChanges] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherGenderFilter, setTeacherGenderFilter] = useState('all');
  const [messages, setMessages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lessons, setLessons] = useState([]);

  const [replyText, setReplyText] = useState({});
  const [teacherForm, setTeacherForm] = useState({
    name: '', email: '', password: '', phone: '', country: '', city: '', gender: 'male', hourlyRate: 50, isPublic: true,
  });
  const [teacherFiles, setTeacherFiles] = useState({ profilePhoto: null, recitationVideo: null });
  const [payoutModal, setPayoutModal] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);
  const [teacherSafeModal, setTeacherSafeModal] = useState(null);
  const [reviewPromptModal, setReviewPromptModal] = useState(null);

  const [courseForm, setCourseForm] = useState({ titleAr: '', slug: '', instructorId: '', price: 0, priceEgp: '', descAr: '', programs: [] });
  const [lessonForm, setLessonForm] = useState({ titleAr: '', type: 'video', videoUrl: '', youtubeUrl: '', duration: 10 });
  const [blogForm, setBlogForm] = useState({ slug: '', titleAr: '', excerptAr: '', contentAr: '' });

  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedingCatalog, setSeedingCatalog] = useState(false);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState(null);
  const [togglingTeacherPublicId, setTogglingTeacherPublicId] = useState(null);
  const [creatingBlog, setCreatingBlog] = useState(false);
  const [togglingBlogId, setTogglingBlogId] = useState(null);
  const [sendingReplyId, setSendingReplyId] = useState(null);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const [submittingReviewPrompt, setSubmittingReviewPrompt] = useState(false);
  const [refreshingAudit, setRefreshingAudit] = useState(false);
  const [refreshingTeachers, setRefreshingTeachers] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const [growthSummary, setGrowthSummary] = useState({});
  const [donations, setDonations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoForm, setVideoForm] = useState({ title: '', category: 'quran', videoUrl: '', duration: 600 });
  const [courseProgramFilter, setCourseProgramFilter] = useState('all');
  const [health, setHealth] = useState(null);
  const [commandCenter, setCommandCenter] = useState({ summary: {}, actions: [], recentTeachers: [], recentAudit: [] });
  const [auditEntries, setAuditEntries] = useState([]);
  const [teacherDossier, setTeacherDossier] = useState(null);
  const [teacherDossierLoading, setTeacherDossierLoading] = useState(false);
  const [studentDossier, setStudentDossier] = useState(null);
  const [studentDossierLoading, setStudentDossierLoading] = useState(false);
  const [familyDossier, setFamilyDossier] = useState(null);
  const [familyDossierLoading, setFamilyDossierLoading] = useState(false);
  const teacherDossierReqRef = useRef(0);
  const studentDossierReqRef = useRef(0);
  const familyDossierReqRef = useRef(0);

  const closeTeacherDossier = useCallback(() => {
    teacherDossierReqRef.current += 1;
    setTeacherDossier(null);
    setTeacherDossierLoading(false);
  }, []);

  const closeStudentDossier = useCallback(() => {
    studentDossierReqRef.current += 1;
    setStudentDossier(null);
    setStudentDossierLoading(false);
  }, []);

  const closeFamilyDossier = useCallback(() => {
    familyDossierReqRef.current += 1;
    setFamilyDossier(null);
    setFamilyDossierLoading(false);
  }, []);

  const navigateAdmin = useCallback((target) => {
    if (typeof target !== 'string') return;
    navigate(target.startsWith('/') ? localizeInternalHref(target, locale) : target);
  }, [navigate, locale]);

  const formatPendingLoadError = useCallback((reason) => {
    if (reason?.status === 429) {
      return `${tt.pendingLoadFailed} (${locale === 'ar' ? 'طلبات كثيرة مؤقتاً — انتظر قليلاً ثم أعد المحاولة' : 'Too many requests — please wait a moment and retry'})`;
    }
    const detail = typeof reason?.message === 'string' ? reason.message.trim() : '';
    if (detail && !/^HTTP \d+$/.test(detail)) {
      return `${tt.pendingLoadFailed}: ${detail}`;
    }
    return tt.pendingLoadFailed;
  }, [tt.pendingLoadFailed, locale]);

  const loadPendingTeachers = useCallback(async (options) => {
    const silent = Boolean(options && typeof options === 'object' && options.silent === true);
    if (pendingRefreshInFlightRef.current) return false;
    pendingRefreshInFlightRef.current = true;
    try {
      const result = await api.get('/api/admin/teachers/pending', { auth: true });
      setPending(Array.isArray(result) ? result : (result.teachers || []));
      lastPendingRefreshAtRef.current = Date.now();
      pendingRateLimitedUntilRef.current = 0;
      setTabError((current) => (current && current.startsWith(tt.pendingLoadFailed) ? '' : current));
      return true;
    } catch (error) {
      if (error?.status === 429) {
        pendingRateLimitedUntilRef.current = Date.now() + 60000;
      }
      if (!silent) {
        const message = formatPendingLoadError(error);
        setTabError(message);
        toastRef.current.error(message);
      }
      return false;
    } finally {
      pendingRefreshInFlightRef.current = false;
    }
  }, [formatPendingLoadError, tt.pendingLoadFailed]);

  const loadApprovedTeachers = useCallback(async () => {
    try {
      const dirResult = await api.get('/api/admin/teachers/directory?status=approved&limit=100', { auth: true });
      if (Array.isArray(dirResult?.teachers)) {
        setApproved(dirResult.teachers);
        if (dirResult.counts) setTeacherDirectoryCounts(dirResult.counts);
        return;
      }
    } catch {
      // Fallback to legacy endpoint if directory route is unavailable.
    }
    const value = await api.get('/api/admin/teachers/approved', { auth: true });
    setApproved(Array.isArray(value) ? value : (value?.teachers || []));
  }, []);

  const loadHealth = useCallback(async () => {
    const value = await api.get('/api/health');
    setHealth(value);
  }, []);

  const loadTeachersTab = useCallback(async () => {
    const [pendingResult, approvedDirResult, archivedDirResult, profileChangesResult] = await Promise.allSettled([
      api.get('/api/admin/teachers/pending', { auth: true }),
      api.get('/api/admin/teachers/directory?status=approved&limit=100', { auth: true }),
      api.get('/api/admin/teachers/directory?status=archived&limit=60', { auth: true }),
      api.get('/api/teachers/admin/profile-changes/pending', { auth: true }),
    ]);

    if (pendingResult.status === 'fulfilled') {
      const value = pendingResult.value;
      setPending(Array.isArray(value) ? value : (value?.teachers || []));
      lastPendingRefreshAtRef.current = Date.now();
      pendingRateLimitedUntilRef.current = 0;
    }
    if (approvedDirResult.status === 'fulfilled') {
      const value = approvedDirResult.value;
      setApproved(Array.isArray(value) ? value : (value?.teachers || []));
      if (value?.counts) setTeacherDirectoryCounts(value.counts);
    } else {
      await loadApprovedTeachers().catch(() => {});
    }
    if (archivedDirResult.status === 'fulfilled') {
      setArchivedTeachers(archivedDirResult.value?.teachers || []);
    }
    if (profileChangesResult.status === 'fulfilled') {
      setPendingProfileChanges(profileChangesResult.value?.requests || []);
    }

    if (pendingResult.status === 'rejected') {
      if (pendingResult.reason?.status === 429) {
        pendingRateLimitedUntilRef.current = Date.now() + 60000;
      }
      throw new Error(formatPendingLoadError(pendingResult.reason));
    }
  }, [formatPendingLoadError, loadApprovedTeachers]);

  const loadCore = useCallback(async () => {
    const [statsResult, pendingResult, approvedResult, healthResult, commandResult, profileChangesResult] = await Promise.allSettled([
      api.get('/api/admin/stats', { auth: true }),
      api.get('/api/admin/teachers/pending', { auth: true }),
      api.get('/api/admin/teachers/approved', { auth: true }),
      api.get('/api/health'),
      api.get('/api/admin/command-center', { auth: true }),
      api.get('/api/teachers/admin/profile-changes/pending', { auth: true }),
    ]);

    if (statsResult.status === 'fulfilled') setStats(statsResult.value || {});
    if (pendingResult.status === 'fulfilled') {
      const value = pendingResult.value;
      setPending(Array.isArray(value) ? value : (value?.teachers || []));
      lastPendingRefreshAtRef.current = Date.now();
      pendingRateLimitedUntilRef.current = 0;
    }
    if (approvedResult.status === 'fulfilled') {
      const value = approvedResult.value;
      setApproved(Array.isArray(value) ? value : (value?.teachers || []));
    }
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (commandResult.status === 'fulfilled') {
      setCommandCenter(commandResult.value || { summary: {}, actions: [], recentTeachers: [], recentAudit: [] });
    }
    if (profileChangesResult.status === 'fulfilled') setPendingProfileChanges(profileChangesResult.value?.requests || []);

    if (pendingResult.status === 'rejected') {
      if (pendingResult.reason?.status === 429) {
        pendingRateLimitedUntilRef.current = Date.now() + 60000;
      }
      throw new Error(formatPendingLoadError(pendingResult.reason));
    }
  }, [formatPendingLoadError]);

  const loadMessages = useCallback(async () => {
    const r = await api.get('/api/contact', { auth: true });
    setMessages(r.messages || []);
  }, []);

  const loadCourses = useCallback(async () => {
    const r = await api.get('/api/admin/courses', { auth: true });
    setCourses(Array.isArray(r) ? r : []);
  }, []);

  const loadBlog = useCallback(async () => {
    const r = await api.get('/api/admin/blog', { auth: true });
    setBlogPosts(Array.isArray(r) ? r : []);
  }, []);

  const loadAudit = useCallback(async () => {
    setRefreshingAudit(true);
    try {
      const result = await api.get('/api/admin/audit?limit=150', { auth: true });
      setAuditEntries(result.entries || []);
    } finally {
      setRefreshingAudit(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async () => {
    const [ledgerResult, legacyResult] = await Promise.all([
      api.get('/api/finance/admin/payouts?status=all', { auth: true }),
      api.get('/api/admin/withdrawals?status=all', { auth: true }),
    ]);

    const ledger = (ledgerResult.payouts || []).map((item) => ({
      ...item,
      source: 'ledger',
      method: item.payoutMethod,
      accountInfo:
        item.payoutDetails?.ipaAddress
        || item.payoutDetails?.phone
        || [item.payoutDetails?.bankName, item.payoutDetails?.bankAccountNumber].filter(Boolean).join(' — ')
        || item.payoutDetails?.paypalEmail
        || '',
    }));

    const seenIds = new Set(ledger.map((item) => String(item._id || '')));
    const legacy = (legacyResult.withdrawals || [])
      .filter((item) => !seenIds.has(String(item._id || '')))
      .map((item) => ({
        ...item,
        source: 'legacy',
      }));

    setWithdrawals([...ledger, ...legacy].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }, []);

  const loadGrowth = useCallback(async () => {
    const [sum, don, apps, vids] = await Promise.all([
      api.get('/api/admin/growth/summary', { auth: true }),
      api.get('/api/donations', { auth: true }),
      api.get('/api/careers/applications', { auth: true }),
      api.get('/api/videos?limit=50', { auth: true }),
    ]);
    setGrowthSummary(sum);
    setDonations(don.donations || []);
    setApplications(apps.applications || []);
    setVideos(vids.videos || []);
  }, []);

  const loadLessons = useCallback(async (courseId) => {
    setLoadingLessons(true);
    setLessons([]);
    try {
      const r = await api.get(`/api/admin/courses/${courseId}/lessons`, { auth: true });
      setLessons(Array.isArray(r) ? r : []);
    } catch (e) {
      toastRef.current.error(e.message || tt.loadFailed);
    } finally {
      setLoadingLessons(false);
    }
  }, [tt.loadFailed]);

  const refreshAudit = useCallback(async () => {
    try {
      await loadAudit();
    } catch (e) {
      toastRef.current.error(e.message || tt.loadFailed);
    }
  }, [loadAudit, tt.loadFailed]);

  const refreshTeachersSection = useCallback(async () => {
    if (refreshingTeachers) return;
    setRefreshingTeachers(true);
    setTabError('');
    try {
      await loadTeachersTab();
    } catch (e) {
      const message = e.message || tt.loadFailed;
      setTabError(message);
      toastRef.current.error(message);
    } finally {
      setRefreshingTeachers(false);
    }
  }, [refreshingTeachers, loadTeachersTab, tt.loadFailed]);

  const load = useCallback(async () => {
    setLoading(true);
    setTabError('');
    try {
      if (tab === 'overview') await loadCore();
      if (tab === 'teachers') await loadTeachersTab();
      if (tab === 'people') loadApprovedTeachers().catch(() => {});
      if (tab === 'system') await loadHealth();
      if (tab === 'messages') await loadMessages();
      if (tab === 'courses') await Promise.all([loadApprovedTeachers().catch(() => {}), loadCourses()]);
      if (tab === 'blog') await loadBlog();
      if (tab === 'withdrawals') await loadWithdrawals();
      if (tab === 'growth') await loadGrowth();
      if (tab === 'audit') await loadAudit();
    } catch (e) {
      const message = e.message || tt.loadFailed;
      setTabError(message);
      toastRef.current.error(message);
    } finally {
      setLoading(false);
    }
  }, [tab, loadCore, loadTeachersTab, loadHealth, loadApprovedTeachers, loadMessages, loadCourses, loadBlog, loadWithdrawals, loadGrowth, loadAudit, tt.loadFailed]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && ALLOWED_TABS.includes(requestedTab)) {
      setTab(requestedTab);
    } else if (!requestedTab) {
      setTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!ready || !['overview', 'teachers'].includes(tab)) return undefined;

    const refreshQueue = () => {
      const now = Date.now();
      if (
        document.visibilityState !== 'visible'
        || pendingRefreshInFlightRef.current
        || now < pendingRateLimitedUntilRef.current
        || now - lastPendingRefreshAtRef.current < 10000
      ) {
        return;
      }
      loadPendingTeachers({ silent: true }).catch(() => {});
    };

    const interval = window.setInterval(refreshQueue, 12000);
    const onFocus = () => refreshQueue();
    const onVisibility = () => refreshQueue();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ready, tab, loadPendingTeachers]);

  useEffect(() => {
    if (!ready) return undefined;

    const onRealtimeNotification = (event) => {
      const actionUrl = String(event?.detail?.data?.actionUrl || '');
      if (actionUrl.includes('tab=teachers')) loadPendingTeachers({ silent: true }).catch(() => {});
      if (actionUrl.includes('tab=withdrawals')) loadWithdrawals().catch(() => {});
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, loadPendingTeachers, loadWithdrawals]);

  if (!ready) return null;

  const review = async (id, action, note = '') => {
    if (['request-changes', 'reject'].includes(action) && !note) {
      setReviewPromptModal({ kind: 'teacher-review', id, action, note: '' });
      return false;
    }

    try {
      await api.put(`/api/teachers/admin/${id}/review`, { action, note }, { auth: true });
      const labels = {
        approve: tt.teacherApproved,
        reject: tt.teacherRejected,
        'request-changes': tt.teacherChangesRequested,
      };
      toast.success(labels[action] || tt.teacherUpdated);
      closeTeacherDossier();
      await loadCore();
      return true;
    } catch (error) {
      toast.error(error.message || tt.teacherCreateFailed);
      return false;
    }
  };

  const openTeacherDossier = async (teacherId) => {
    if (!teacherId) return;
    const reqId = ++teacherDossierReqRef.current;
    setTeacherDossierLoading(true);
    setTeacherDossier({ teacher: { _id: teacherId } });
    try {
      const result = await api.get(`/api/teachers/admin/${teacherId}/review-dossier`, { auth: true });
      if (teacherDossierReqRef.current === reqId) {
        setTeacherDossier(result);
      }
    } catch (error) {
      if (teacherDossierReqRef.current === reqId) {
        setTeacherDossier(null);
        toast.error(error.message || tt.dossierLoadFailed);
      }
    } finally {
      if (teacherDossierReqRef.current === reqId) {
        setTeacherDossierLoading(false);
      }
    }
  };

  const updateTeacherChecklist = async (teacherId, key, status, note = '') => {
    try {
      await api.put(
        `/api/teachers/admin/${teacherId}/review-checklist/${key}`,
        { status, note },
        { auth: true }
      );
      toast.success(status === 'approved' ? tt.checklistApproved : tt.checklistUpdated);
      await openTeacherDossier(teacherId);
      await loadPendingTeachers();
      return true;
    } catch (error) {
      toast.error(error.message || tt.checklistFailed);
      return false;
    }
  };

  const openStudentDossier = async (studentId) => {
    if (!studentId) return;
    closeFamilyDossier();
    const reqId = ++studentDossierReqRef.current;
    setStudentDossierLoading(true);
    setStudentDossier({ student: { _id: studentId } });
    try {
      const result = await api.get(`/api/admin/people/students/${studentId}`, { auth: true });
      if (studentDossierReqRef.current === reqId) {
        setStudentDossier(result);
      }
    } catch (error) {
      if (studentDossierReqRef.current === reqId) {
        setStudentDossier(null);
        toast.error(error.message || tt.dossierLoadFailed);
      }
    } finally {
      if (studentDossierReqRef.current === reqId) {
        setStudentDossierLoading(false);
      }
    }
  };

  const openFamilyDossier = async (guardianId) => {
    if (!guardianId) return;
    closeStudentDossier();
    const reqId = ++familyDossierReqRef.current;
    setFamilyDossierLoading(true);
    setFamilyDossier({ guardian: { _id: guardianId } });
    try {
      const result = await api.get(`/api/admin/people/guardians/${guardianId}`, { auth: true });
      if (familyDossierReqRef.current === reqId) {
        setFamilyDossier(result);
      }
    } catch (error) {
      if (familyDossierReqRef.current === reqId) {
        setFamilyDossier(null);
        toast.error(error.message || tt.familyLoadFailed);
      }
    } finally {
      if (familyDossierReqRef.current === reqId) {
        setFamilyDossierLoading(false);
      }
    }
  };

  const openStudentHomeworkAudio = async (taskId) => {
    try {
      const response = await api.request(
        `/api/homework/tasks/${taskId}/file?reason=student-360-review`,
        { auth: true, json: false, method: 'GET' }
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `student-homework-${taskId}`;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.message || tt.homeworkFileFailed);
    }
  };

  // Keep authorization and admin audit on existing protected endpoints.
  // Temporary preview URLs are created/revoked inside the dossier component.
  const fetchTeacherReviewAsset = async (path) => {
    const response = await api.request(path, { auth: true, json: false, method: 'GET' });
    return response.blob();
  };

  const openTeacherDocument = (teacherId, kind, index) => {
    const suffix = Number.isInteger(index) ? `/${index}` : '';
    return fetchTeacherReviewAsset(`/api/teachers/admin/${teacherId}/document/${kind}${suffix}?reason=teacher-review`);
  };

  const fetchTeacherPlayback = async (signPath, fallbackPath) => {
    try {
      // Only the signed URL reaches the native <video> element. Do not proxy
      // large media through a Vercel Function or download it all as a Blob.
      const preview = await api.get(signPath, { auth: true });
      const trustedPlaybackUrl = typeof preview?.url === 'string' && (
        preview.url.startsWith('/api/teachers/admin-media-range/') ||
        preview.url.startsWith('https://')
      );
      if (!trustedPlaybackUrl) {
        throw new Error(tt.playbackUrlFailed);
      }
      return preview;
    } catch (error) {
      // Compatibility with local filesystem and legacy private uploads.
      // Never downgrade a permission error to an unauthenticated file URL.
      if (error?.code === 'MEDIA_PREVIEW_NOT_SUPPORTED') {
        return fetchTeacherReviewAsset(fallbackPath);
      }
      throw error;
    }
  };

  const openTeacherMedia = (teacherId, kind, index) => {
    const suffix = Number.isInteger(index) ? `/${index}` : '';
    if (kind === 'profilePhoto') {
      return fetchTeacherReviewAsset(`/api/teachers/admin/${teacherId}/media/${kind}${suffix}?reason=teacher-review`);
    }
    return fetchTeacherPlayback(
      `/api/teachers/admin/${teacherId}/media-playback/${kind}${suffix}`,
      `/api/teachers/admin/${teacherId}/media/${kind}${suffix}?reason=teacher-review`
    );
  };

  const openTeacherProfileChangeMedia = (teacherId, kind) => (
    kind === 'profilePhoto'
      ? fetchTeacherReviewAsset(`/api/teachers/admin/${teacherId}/profile-change/media/${kind}?reason=profile-change-review`)
      : fetchTeacherPlayback(
        `/api/teachers/admin/${teacherId}/profile-change/media-playback/${kind}`,
        `/api/teachers/admin/${teacherId}/profile-change/media/${kind}?reason=profile-change-review`
      )
  );

  const reviewTeacherProfileChange = async (teacherId, action, suppliedNote = '') => {
    if (action === 'reject' && !suppliedNote) {
      setReviewPromptModal({ kind: 'profile-change', id: teacherId, action, note: '' });
      return false;
    }

    try {
      await api.put(
        `/api/teachers/admin/${teacherId}/profile-change/review`,
        { action, note: suppliedNote.trim() },
        { auth: true }
      );
      toast.success(action === 'approve' ? tt.profileChangeApproved : tt.profileChangeRejected);
      setPendingProfileChanges((current) => current.filter((item) => String(item.teacher?._id || item.teacher) !== String(teacherId)));
      await openTeacherDossier(teacherId);
      await loadCore();
      return true;
    } catch (error) {
      toast.error(error.message || tt.profileChangeFailed);
      return false;
    }
  };

  const sendReply = async (id) => {
    const reply = replyText[id];
    if (!reply?.trim()) {
      toast.error(tt.replyEmpty);
      return;
    }
    if (sendingReplyId) return;
    setSendingReplyId(id);
    try {
      await api.put(`/api/contact/${id}/reply`, { reply }, { auth: true });
      toast.success(tt.replySent);
      setReplyText((p) => ({ ...p, [id]: '' }));
      await loadMessages();
    } catch (e) {
      toast.error(e.message || tt.replyFailed);
    } finally {
      setSendingReplyId(null);
    }
  };

  const seedDemoCourse = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const r = await api.post('/api/lms/seed-demo', {}, { auth: true });
      toast.success(r.message || tt.demoCreated);
      await loadCourses();
    } catch (e) {
      toast.error(e.message || tt.demoFailed);
    } finally {
      setSeeding(false);
    }
  };

  const seedOfficialCatalog = async () => {
    if (seedingCatalog) return;
    setSeedingCatalog(true);
    try {
      const r = await api.post(
        '/api/admin/courses/seed-official-catalog',
        { instructorId: courseForm.instructorId || approved[0]?._id },
        { auth: true }
      );
      toast.success(r.message || (isRTL ? 'تم نشر كتالوج الدورات الرسمي' : 'Official course catalog published'));
      await loadCourses();
    } catch (e) {
      toast.error(e.message || tt.courseCreateFailed);
    } finally {
      setSeedingCatalog(false);
    }
  };

  const addTeacher = async (e) => {
    e.preventDefault();
    if (addingTeacher) return;
    setAddingTeacher(true);
    try {
      const uploadedFiles = {};
      if (teacherFiles.profilePhoto) {
        uploadedFiles.profilePhoto = await uploadFileDirect(teacherFiles.profilePhoto, 'teacher-public');
      }
      if (teacherFiles.recitationVideo) {
        uploadedFiles.recitationVideo = await uploadFileDirect(teacherFiles.recitationVideo, 'teacher-public');
      }
      const created = await api.post('/api/admin/teachers', {
        ...teacherForm,
        isPublic: teacherForm.isPublic !== false,
        uploadedFiles: Object.keys(uploadedFiles).length ? uploadedFiles : undefined,
      }, { auth: true });
      toast.success(tt.teacherCreatedReview);
      setTeacherForm({ name: '', email: '', password: '', phone: '', country: '', city: '', gender: 'male', hourlyRate: 50, isPublic: true });
      setTeacherFiles({ profilePhoto: null, recitationVideo: null });
      setTeachersSubTab('review');
      await load();
      if (created?.teacher?._id) {
        await openTeacherDossier(created.teacher._id);
      }
    } catch (e) {
      toast.error(e.message || tt.teacherCreateFailed);
    } finally {
      setAddingTeacher(false);
    }
  };

  const addCourse = async (e) => {
    e.preventDefault();
    if (creatingCourse) return;
    setCreatingCourse(true);
    try {
      const payload = {
        ...courseForm,
        priceEgp: courseForm.priceEgp === '' ? undefined : Number(courseForm.priceEgp),
      };
      await api.post('/api/admin/courses', payload, { auth: true });
      toast.success(tt.courseCreated);
      setCourseForm({ titleAr: '', slug: '', instructorId: '', price: 0, priceEgp: '', descAr: '', programs: [] });
      await loadCourses();
    } catch (e) {
      toast.error(e.message || tt.courseCreateFailed);
    } finally {
      setCreatingCourse(false);
    }
  };

  const addLesson = async (e) => {
    e.preventDefault();
    if (!selectedCourse || addingLesson) return;
    setAddingLesson(true);
    try {
      await api.post(`/api/admin/courses/${selectedCourse}/lessons`, lessonForm, { auth: true });
      toast.success(tt.lessonAdded);
      setLessonForm({ titleAr: '', type: 'video', videoUrl: '', youtubeUrl: '', duration: 10 });
      await loadLessons(selectedCourse);
    } catch (e) {
      toast.error(e.message || tt.lessonAddFailed);
    } finally {
      setAddingLesson(false);
    }
  };

  const uploadVideo = async (e, lessonField = 'videoUrl') => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const storageFile = await uploadFileDirect(file, 'course-media');
      const r = await api.post('/api/admin/upload', { storageFile }, { auth: true });
      setLessonForm((p) => ({ ...p, [lessonField]: r.url }));
      toast.success(tt.videoUploaded);
    } catch (err) {
      toast.error(err.message || tt.videoUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const addBlog = async (e) => {
    e.preventDefault();
    if (creatingBlog) return;
    setCreatingBlog(true);
    try {
      await api.post('/api/admin/blog', blogForm, { auth: true });
      toast.success(tt.blogPublished);
      setBlogForm({ slug: '', titleAr: '', excerptAr: '', contentAr: '' });
      await loadBlog();
    } catch (e) {
      toast.error(e.message || tt.blogToggleFailed);
    } finally {
      setCreatingBlog(false);
    }
  };

  const toggleTeacherPublicVisibility = async (teacher) => {
    if (!teacher?._id || togglingTeacherPublicId) return;
    const nextPublic = teacher.isPublic === false;
    setTogglingTeacherPublicId(teacher._id);
    try {
      await api.put(`/api/admin/teachers/${teacher._id}`, {
        isPublic: nextPublic,
        adminReason: nextPublic
          ? 'Admin enabled public directory visibility for teacher'
          : 'Admin hid teacher from public directory',
      }, { auth: true });
      setApproved((prev) => prev.map((item) => (
        item._id === teacher._id ? { ...item, isPublic: nextPublic } : item
      )));
      toast.success(
        nextPublic
          ? (isRTL ? 'تم إظهار المعلم للعام في صفحة المعلمين والموقع' : 'Teacher is now visible to the public')
          : (isRTL ? 'تم إخفاء المعلم عن العرض العام (يبقى نشطاً داخلياً للإدارة والطلاب المعينين)' : 'Teacher hidden from public listings (remains active internally)')
      );
    } catch (e) {
      toast.error(e.message || tt.teacherSettingsFailed);
    } finally {
      setTogglingTeacherPublicId(null);
    }
  };

  const updateTeacherAdminSettings = async (teacherId, settings) => {
    try {
      await api.put(`/api/admin/teachers/${teacherId}`, {
        ...settings,
        adminReason: 'Admin update for teacher settings (hourly rate / gender / featured / visibility)',
      }, { auth: true });
      toast.success(tt.teacherSettingsUpdated);
      await openTeacherDossier(teacherId);
      await loadCore();
    } catch (e) {
      toast.error(e.message || tt.teacherSettingsFailed);
    }
  };

  const updateStudentAdminProfile = async (studentId, settings) => {
    try {
      await api.put(`/api/admin/people/students/${studentId}`, {
        ...settings,
        adminReason: 'Admin update for student profile and account status from Student 360',
      }, { auth: true });
      toast.success(tt.studentUpdated);
      await openStudentDossier(studentId);
    } catch (e) {
      toast.error(e.message || tt.studentUpdateFailed);
    }
  };

  const toggleCourseStatus = async (course) => {
    if (togglingCourseId) return;
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    setTogglingCourseId(course._id);
    try {
      await api.put(`/api/admin/courses/${course._id}`, { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'published' ? tt.coursePublished : tt.courseDrafted);
      await loadCourses();
    } catch (e) {
      toast.error(e.message || tt.courseToggleFailed);
    } finally {
      setTogglingCourseId(null);
    }
  };

  const toggleBlogStatus = async (post) => {
    if (togglingBlogId) return;
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    setTogglingBlogId(post._id);
    try {
      await api.put(`/api/admin/blog/${post._id}`, { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'published' ? tt.blogPublished : tt.blogDrafted);
      await loadBlog();
    } catch (e) {
      toast.error(e.message || tt.blogToggleFailed);
    } finally {
      setTogglingBlogId(null);
    }
  };

  const submitPayoutDecision = async (e) => {
    e.preventDefault();
    if (!payoutModal || submittingPayout) return;
    const { withdrawal, action, referenceNumber, notes } = payoutModal;
    setSubmittingPayout(true);
    try {
      if (withdrawal.source === 'ledger') {
        await api.put(`/api/finance/admin/payouts/${withdrawal._id}/process`, {
          action,
          referenceNumber: referenceNumber?.trim() || '',
          notes: notes?.trim() || '',
        }, { auth: true });
      } else {
        await api.patch(`/api/admin/withdrawals/${withdrawal._id}`, {
          action,
          adminNote: notes?.trim() || referenceNumber?.trim() || '',
        }, { auth: true });
      }
      toast.success(action === 'approve' ? tt.payoutApproved : tt.payoutRejected);
      setPayoutModal(null);
      await loadWithdrawals();
      await loadCore();
    } catch (err) {
      toast.error(err.message || tt.payoutFailed);
    } finally {
      setSubmittingPayout(false);
    }
  };

  const reviewWithdraw = (withdrawal, action) => {
    setPayoutModal({ withdrawal, action, referenceNumber: '', notes: '' });
  };

  const executeDeleteItem = async (type, id) => {
    if (deletingItem) return;
    const paths = {
      course: `/api/admin/courses/${id}`,
      lesson: `/api/admin/lessons/${id}`,
      blog: `/api/admin/blog/${id}`,
      message: `/api/contact/${id}`,
      teacher: `/api/admin/teachers/${id}?force=true`,
      student: `/api/admin/people/students/${id}`,
    };
    setDeletingItem(true);
    try {
      await api.delete(paths[type], { auth: true });
      toast.success(tt.deleted);
      setConfirmDeleteModal(null);
      if (type === 'teacher' && String(teacherDossier?.teacher?._id) === String(id)) {
        closeTeacherDossier();
      }
      if (type === 'student' && String(studentDossier?.student?._id) === String(id)) {
        closeStudentDossier();
      }
      if (type === 'lesson') await loadLessons(selectedCourse);
      else if (type === 'course') await loadCourses();
      else if (type === 'blog') await loadBlog();
      else await load();
    } catch (e) {
      toast.error(e.message || tt.deleteFailed);
    } finally {
      setDeletingItem(false);
    }
  };

  const deleteItem = (type, id, label = '') => {
    if (type === 'teacher') {
      setTeacherSafeModal({ teacherId: id, label, mode: 'delete' });
      return;
    }
    setConfirmDeleteModal({ type, id, label });
  };

  const selectAdminTab = (nextTab, nextFocus = '') => {
    setTab(nextTab);
    const query = new URLSearchParams();
    query.set('tab', nextTab);
    if (nextFocus) query.set('focus', nextFocus);
    navigate(`${localizedPath('/admin', locale)}?${query.toString()}`);
  };

  const filteredApprovedTeachers = approved.filter((teacher) => {
    if (teacherGenderFilter !== 'all' && (teacher.personalInfo?.gender || 'male') !== teacherGenderFilter) {
      return false;
    }
    const term = teacherQuery.trim().toLocaleLowerCase();
    if (!term) return true;
    return [
      teacher.user?.name, teacher.personalInfo?.fullName,
      teacher.user?.email, teacher.personalInfo?.country,
      teacher.personalInfo?.city, teacher.personalInfo?.phone,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term));
  });

  const previewPublicTeacher = (teacherId) => {
    if (!teacherId) return;
    window.open(localizedPath(`/teachers/${encodeURIComponent(teacherId)}`, locale), '_blank', 'noopener,noreferrer');
  };

  const scrollToPeopleDirectory = (nextRole) => {
    setPeopleRole(nextRole);
    peopleDirectoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const adminSearch = (
    <AdminPeopleSearch
      onOpenStudent={openStudentDossier}
      onOpenGuardian={openFamilyDossier}
      onOpenTeacher={openTeacherDossier}
      onOpenPayments={() => navigate(localizedPath('/admin/payments', locale))}
    />
  );

  const tp = ta.people;
  const ts = ta.system;
  const tTeachers = ta.tabs.teachers;
  const twModal = ta.tabs.withdrawals.modal;
  const tModals = ta.tabs.modals;

  const teacherFormFields = [
    { key: 'name', type: 'text', required: true, label: tTeachers.fields.name },
    { key: 'phone', type: 'tel', required: !teacherForm.email?.trim(), label: tTeachers.fields.phone },
    {
      key: 'email',
      type: 'email',
      required: !teacherForm.phone?.trim(),
      label: isRTL ? 'البريد الإلكتروني (اختياري — يكفي رقم الهاتف)' : 'Email (optional — phone is enough)',
    },
    { key: 'password', type: 'password', required: true, label: tTeachers.fields.password },
  ];

  const actionCountById = Object.fromEntries(
    (commandCenter?.actions || []).map((item) => [item.id, Number(item.count || 0)])
  );
  const sidebarBadges = {
    teachers: Math.max(pending.length, actionCountById['teacher-review'] || 0) + pendingProfileChanges.length,
    payments: actionCountById['manual-payments'] || 0,
    withdrawals: actionCountById.payouts || 0,
    messages: actionCountById.messages || 0,
    trials: actionCountById['trial-requests'] || 0,
    subscriptions: actionCountById['awaiting-placement'] || 0,
    sessions: (actionCountById['overdue-sessions'] || 0) + (actionCountById['missing-session-reports'] || 0),
  };
  const statusSummary = {
    critical: Number(commandCenter?.summary?.criticalActions || 0),
    totalPending: Number(commandCenter?.summary?.totalPendingActions || 0),
  };

  return (
    <>
      <SEOHead page={{ title: ta.seo.dashboardTitle, description: ta.seo.dashboardDesc, noindex: true, canonical: false }} />
      <AdminDashboardShell
        user={user}
        active={tab}
        onChange={selectAdminTab}
        onNavigate={navigateAdmin}
        onLogout={logout}
        search={adminSearch}
        badges={sidebarBadges}
        statusSummary={statusSummary}
      >
        {loading && tab !== 'overview' ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
        ) : tabError && !['overview', 'people', 'sessions', 'teachers'].includes(tab) ? (
          <div
            role="alert"
            className="wn-dashboard-surface border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-3"
          >
            <span className="inline-flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{tabError}</span>
            </span>
            <button
              type="button"
              onClick={load}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border-strong)] text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>{te.retry}</span>
            </button>
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <AdminExecutiveHome
                stats={stats}
                commandCenter={commandCenter}
                health={health}
                pendingTeachers={pending}
                loading={loading}
                onRefreshTeachers={loadPendingTeachers}
                onOpenTeacher={openTeacherDossier}
                onNavigate={navigateAdmin}
                onSelectTab={selectAdminTab}
              />
            )}

            {tab === 'analytics' && <AdminAnalyticsTab />}

            {tab === 'people' && (
              <>
                {(focus === 'guardian-links' || showGuardianLinks) ? (
                  <AdminGuardianLinksPanel onOpenStudent={openStudentDossier} />
                ) : null}
                <div ref={peopleDirectoryRef}>
                  <AdminPeopleDirectory
                    selectedRole={peopleRole}
                    onOpenStudent={openStudentDossier}
                    onOpenGuardian={openFamilyDossier}
                    approvedTeachers={approved}
                    showingGuardianLinks={focus === 'guardian-links' || showGuardianLinks}
                    onToggleGuardianLinks={() => setShowGuardianLinks((v) => !v)}
                    pendingGuardianLinksCount={actionCountById['guardian-links'] || 0}
                  />
                </div>
                <section className="wn-admin-people-home">
                  <div className="wn-admin-people-home__intro">
                    <span>{tp.heroEyebrow}</span>
                    <h2>{tp.heroTitle}</h2>
                    <p>{tp.heroDesc}</p>
                  </div>
                  <div className="wn-admin-people-home__cards">
                    <button type="button" onClick={() => scrollToPeopleDirectory('student')} aria-label={tp.student360Aria}>
                      <Users size={22} aria-hidden="true" />
                      <strong>{tp.student360Title}</strong>
                      <p>{tp.student360Desc}</p>
                    </button>
                    <button type="button" onClick={() => scrollToPeopleDirectory('guardian')} aria-label={tp.family360Aria}>
                      <ShieldCheck size={22} aria-hidden="true" />
                      <strong>{tp.family360Title}</strong>
                      <p>{tp.family360Desc}</p>
                    </button>
                    <button type="button" onClick={() => selectAdminTab('audit')} aria-label={tp.auditAria}>
                      <History size={22} aria-hidden="true" />
                      <strong>{tp.auditTitle}</strong>
                      <p>{tp.auditDesc}</p>
                    </button>
                  </div>
                </section>
              </>
            )}

            {tab === 'sessions' && (
              <AdminSessionControl
                initialFocus={['live', 'today', 'overdue', 'pending', 'missing-reports'].includes(focus) ? focus : 'all'}
                onOpenStudent={openStudentDossier}
                onOpenTeacher={openTeacherDossier}
                onMessageStudent={(studentId) => {
                  setSupportStudent(studentId);
                  setTab('messages');
                }}
                onFocusChange={(nextFocus) => selectAdminTab('sessions', nextFocus)}
              />
            )}

            {tab === 'system' && (
              <div className="wn-admin-system-center">
                <section className="wn-admin-system-center__hero">
                  <div>
                    <span>{ts.eyebrow}</span>
                    <h2><MonitorPlay size={20} aria-hidden="true" /> {ts.title}</h2>
                    <p>{ts.desc}</p>
                  </div>
                  <strong>{health?.version ? `v${health.version}` : tc.dash}</strong>
                </section>

                {health ? (
                  <section className="wn-admin-system-center__features">
                    {Object.entries(health.features || {}).map(([key, enabled]) => (
                      <div key={key} className={enabled ? 'is-on' : 'is-off'}>
                        <span>
                          {enabled ? (
                            <CheckCircle2 size={16} aria-hidden="true" />
                          ) : (
                            <AlertTriangle size={16} aria-hidden="true" />
                          )}
                        </span>
                        <strong>{key}</strong>
                        <small>{enabled ? ts.available : ts.needsReview}</small>
                      </div>
                    ))}
                  </section>
                ) : null}

                <LaunchReadinessPanel />
              </div>
            )}

            {tab === 'messages' && (
              <AdminMessagesTab
                supportStudent={supportStudent}
                onSelectStudent={setSupportStudent}
                messages={messages}
                replyText={replyText}
                onChangeReplyText={(id, val) => setReplyText((p) => ({ ...p, [id]: val }))}
                onSendReply={sendReply}
                sendingReplyId={sendingReplyId}
                onDeleteMessage={(id, label) => deleteItem('message', id, label)}
              />
            )}

            {tab === 'teachers' && (
              <div className="space-y-6">
                {tabError ? (
                  <div
                    role="alert"
                    className="wn-dashboard-surface border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="inline-flex items-center gap-2 font-semibold text-sm">
                      <AlertTriangle size={18} aria-hidden="true" />
                      <span>{tabError}</span>
                    </span>
                    <button
                      type="button"
                      onClick={load}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border-strong)] text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                      <span>{te.retry}</span>
                    </button>
                  </div>
                ) : null}

                <div className="wn-dashboard-surface flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label={isRTL ? 'أقسام إدارة المعلمين' : 'Teacher management sections'}>
                    {[
                      {
                        id: 'active',
                        label: isRTL ? `المعلمون المعتمدون (${approved.length})` : `Approved (${approved.length})`,
                      },
                      {
                        id: 'review',
                        label: isRTL
                          ? `طابور المراجعة والتعديلات (${pending.length + pendingProfileChanges.length})`
                          : `Review Queue (${pending.length + pendingProfileChanges.length})`,
                        alert: (pending.length + pendingProfileChanges.length) > 0,
                      },
                      {
                        id: 'invites',
                        label: isRTL ? 'الدعوات والإضافة المباشرة' : 'Invites & Direct Add',
                      },
                      {
                        id: 'archived',
                        label: isRTL
                          ? `الأرشيف والموقوفون (${archivedTeachers.length || (Number(teacherDirectoryCounts.suspended || 0) + Number(teacherDirectoryCounts.rejected || 0))})`
                          : `Archived & Suspended (${archivedTeachers.length})`,
                      },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        role="tab"
                        aria-selected={teachersSubTab === sub.id}
                        onClick={() => setTeachersSubTab(sub.id)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition inline-flex items-center gap-2 ${
                          teachersSubTab === sub.id
                            ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                            : sub.alert
                              ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border-[var(--wn-status-warn-border)]'
                              : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-border-strong)]'
                        }`}
                      >
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center gap-1.5 disabled:opacity-60"
                    onClick={refreshTeachersSection}
                    disabled={refreshingTeachers || loading}
                  >
                    <RefreshCw size={14} className={refreshingTeachers ? 'animate-spin' : ''} aria-hidden="true" />
                    <span>{tTeachers.refresh}</span>
                  </button>
                </div>

                {teachersSubTab === 'review' && (
                  <div className="space-y-6">
                    {pendingProfileChanges.length > 0 && (
                      <section className="wn-dashboard-surface border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <h3 className="font-bold text-[var(--wn-heading)]">
                              {tTeachers.profileChangesTitle.replace('{count}', String(pendingProfileChanges.length))}
                            </h3>
                            <p className="text-xs text-[var(--wn-status-warn-text)] mt-1">{tTeachers.profileChangesNote}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {pendingProfileChanges.map((request) => {
                            const teacher = request.teacher || {};
                            return (
                              <article
                                key={request._id}
                                className="rounded-xl border border-[var(--wn-status-warn-border)] bg-[var(--wn-surface)] p-4 flex flex-wrap items-center justify-between gap-3"
                              >
                                <div>
                                  <strong className="block text-[var(--wn-heading)]">
                                    {teacher.personalInfo?.fullName || teacher.user?.name || ta.dossiers.reviewQueue.teacherFallback}
                                  </strong>
                                  <small className="block text-[var(--wn-text-secondary)]">{teacher.user?.email || ''}</small>
                                  <small className="block text-[var(--wn-text-secondary)] mt-1">
                                    {formatMsg(tTeachers.fieldsCount, { count: (request.changedFields || []).length })} · {request.createdAt ? new Date(request.createdAt).toLocaleString(intlLocale) : ''}
                                  </small>
                                </div>
                                <button
                                  type="button"
                                  className="wn-btn wn-btn--primary min-h-[44px]"
                                  onClick={() => openTeacherDossier(teacher._id)}
                                >
                                  {tTeachers.reviewChangesBtn}
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    <TeacherReviewQueue
                      teachers={pending}
                      loading={loading}
                      onRefresh={loadPendingTeachers}
                      onOpenDossier={openTeacherDossier}
                    />
                  </div>
                )}

                {teachersSubTab === 'invites' && (
                  <div className="space-y-6">
                    <TeacherInviteLinksPanel onOpenDossier={openTeacherDossier} />

                    <form onSubmit={addTeacher} className="wn-dashboard-surface space-y-3">
                      <div>
                        <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
                          <Plus size={18} aria-hidden="true" />
                          <span>{tTeachers.addTitle}</span>
                        </h3>
                        <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                          {isRTL
                            ? 'يدخل الحساب الجديد بوابة المراجعة (Teacher 360) تلقائياً لاستكمال أو فحص الوسائط والوثائق قبل التفعيل العام.'
                            : 'New teacher accounts enter the Teacher 360 Review Gate automatically so media and IDs can be verified before going live.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {teacherFormFields.map((field) => (
                          <div key={field.key}>
                            <label htmlFor={`${formId}-tf-${field.key}`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                              {field.label}
                            </label>
                            <input
                              id={`${formId}-tf-${field.key}`}
                              required={field.required}
                              type={field.type}
                              placeholder={field.label}
                              value={teacherForm[field.key]}
                              onChange={(e) => setTeacherForm((p) => ({ ...p, [field.key]: e.target.value }))}
                              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label htmlFor={`${formId}-tf-country`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                            {tTeachers.fields.country}
                          </label>
                          <input
                            id={`${formId}-tf-country`}
                            placeholder={tTeachers.fields.country}
                            value={teacherForm.country}
                            onChange={(e) => setTeacherForm((p) => ({ ...p, country: e.target.value }))}
                            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor={`${formId}-tf-city`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                            {tTeachers.fields.city}
                          </label>
                          <input
                            id={`${formId}-tf-city`}
                            placeholder={tTeachers.fields.city}
                            value={teacherForm.city}
                            onChange={(e) => setTeacherForm((p) => ({ ...p, city: e.target.value }))}
                            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor={`${formId}-tf-gender`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                            {tTeachers.fields.gender}
                          </label>
                          <select
                            id={`${formId}-tf-gender`}
                            value={teacherForm.gender || 'male'}
                            onChange={(e) => setTeacherForm((p) => ({ ...p, gender: e.target.value }))}
                            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                            aria-label={tTeachers.fields.gender}
                          >
                            <option value="male">{tTeachers.fields.genderMale}</option>
                            <option value="female">{tTeachers.fields.genderFemale}</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`${formId}-tf-rate`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                            {tTeachers.fields.hourlyRate}
                          </label>
                          <input
                            id={`${formId}-tf-rate`}
                            type="number"
                            min="10"
                            max="1000"
                            placeholder={tTeachers.fields.hourlyRate}
                            value={teacherForm.hourlyRate ?? 50}
                            onChange={(e) => setTeacherForm((p) => ({ ...p, hourlyRate: Number(e.target.value) }))}
                            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 text-xs">
                        <label className="block space-y-1">
                          <span className="font-bold text-[var(--wn-heading)]">
                            {isRTL ? 'الصورة الشخصية للمعلم (اختياري الآن أو من ملف 360)' : 'Profile Photo (optional)'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setTeacherFiles((p) => ({ ...p, profilePhoto: e.target.files?.[0] || null }))}
                            className="block w-full text-xs text-[var(--wn-text-secondary)]"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-bold text-[var(--wn-heading)]">
                            {isRTL ? 'فيديو التلاوة النموذجية (اختياري الآن أو من ملف 360)' : 'Recitation Video (optional)'}
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={(e) => setTeacherFiles((p) => ({ ...p, recitationVideo: e.target.files?.[0] || null }))}
                            className="block w-full text-xs text-[var(--wn-text-secondary)]"
                          />
                        </label>
                      </div>

                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-text-primary)] min-h-11 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={teacherForm.isPublic !== false}
                          onChange={(e) => setTeacherForm((p) => ({ ...p, isPublic: e.target.checked }))}
                          className="w-4 h-4 accent-[var(--wn-emerald)]"
                        />
                        <span>{isRTL ? 'يظهر للعام في صفحة المعلمين فور اكتمال اعتماده' : 'Visible in public directory once approved'}</span>
                      </label>
                      <button
                        type="submit"
                        disabled={addingTeacher}
                        className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {addingTeacher && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                        <span>{addingTeacher ? tTeachers.fields.submitting : tTeachers.fields.submitReview}</span>
                      </button>
                    </form>
                  </div>
                )}

                {teachersSubTab === 'archived' && (
                  <div className="wn-dashboard-surface space-y-4">
                    <div>
                      <h3 className="font-bold text-[var(--wn-heading)]">
                        {isRTL ? 'أرشيف المعلمين الموقوفين والمرفوضين' : 'Suspended & Rejected Teachers Archive'}
                      </h3>
                      <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                        {isRTL
                          ? 'يمكنك فتح ملف أي معلم موقوف أو مرفوض لإعادة تفعيله، أو تطهير ملفاته السحابية، أو حذفه بأمان.'
                          : 'Inspect suspended or rejected teachers to restore access, purge cloud assets, or delete safely.'}
                      </p>
                    </div>
                    {archivedTeachers.length === 0 ? (
                      <EmptyState icon={Users} title={isRTL ? 'لا يوجد معلمون موقوفون أو مرفوضون حالياً' : 'No suspended or rejected teachers'} />
                    ) : (
                      <div className="wn-admin-teachers-list__rows">
                        {archivedTeachers.map((teacher) => (
                          <article key={teacher._id} className="wn-admin-teachers-list__row">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <strong>{teacher.user?.name || teacher.personalInfo?.fullName || ta.dossiers.reviewQueue.teacherFallback}</strong>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)]">
                                  {teacher.status === 'suspended' ? (isRTL ? 'موقوف' : 'Suspended') : (isRTL ? 'مرفوض' : 'Rejected')}
                                </span>
                              </div>
                              <small>{teacher.user?.email || tTeachers.noEmail} · {teacher.personalInfo?.phone || tc.dash}</small>
                            </div>
                            <div className="wn-admin-teachers-list__actions">
                              <button type="button" className="is-primary min-h-[44px]" onClick={() => openTeacherDossier(teacher._id)}>
                                {isRTL ? 'مراجعة / استعادة من 360' : 'Inspect / Restore'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem('teacher', teacher._id, teacher.user?.name || teacher.personalInfo?.fullName || ta.dossiers.reviewQueue.teacherFallback)}
                                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] text-xs font-bold inline-flex items-center gap-1"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                                <span>{tTeachers.deleteBtn}</span>
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {teachersSubTab === 'active' && (
                  <div className="wn-dashboard-surface wn-admin-teachers-list">
                    <div className="wn-admin-teachers-list__head">
                      <div>
                        <h3>{tTeachers.approvedTitle.replace('{count}', String(approved.length))}</h3>
                        <p>{tTeachers.approvedDesc}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(pending.length + pendingProfileChanges.length) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setTeachersSubTab('review')}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border border-[var(--wn-status-warn-border)] text-xs font-bold"
                          >
                            {isRTL
                              ? `طلبات بانتظار المراجعة (${pending.length + pendingProfileChanges.length})`
                              : `Pending Reviews (${pending.length + pendingProfileChanges.length})`}
                          </button>
                        ) : null}
                        <select
                          value={teacherGenderFilter}
                          onChange={(e) => setTeacherGenderFilter(e.target.value)}
                          aria-label={tTeachers.fields.gender}
                          className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-1.5 text-xs font-semibold"
                        >
                          <option value="all">{isRTL ? 'الكل (معلمون ومعلمات)' : 'All Genders'}</option>
                          <option value="male">{isRTL ? 'المعلمون (الرجال)' : 'Male Teachers'}</option>
                          <option value="female">{isRTL ? 'المعلمات (السيدات)' : 'Female Teachers'}</option>
                        </select>
                      </div>
                    </div>
                    <label className="wn-admin-teachers-list__search">
                      <span>{tTeachers.searchLabel}</span>
                      <input
                        type="search"
                        value={teacherQuery}
                        onChange={(event) => setTeacherQuery(event.target.value)}
                        placeholder={tTeachers.searchPlaceholder}
                        aria-label={tTeachers.searchAria}
                      />
                    </label>
                    {approved.length === 0 ? (
                      <EmptyState icon={Users} title={tTeachers.empty} />
                    ) : filteredApprovedTeachers.length === 0 ? (
                      <EmptyState icon={Users} title={tTeachers.noMatches} />
                    ) : (
                      <div className="wn-admin-teachers-list__rows">
                        {filteredApprovedTeachers.map((teacher) => {
                          const isPublicTeacher = teacher.isPublic !== false;
                          const isTogglingPublic = togglingTeacherPublicId === teacher._id;
                          const ops = teacher.operationalMetrics || {};
                          return (
                            <article key={teacher._id} className="wn-admin-teachers-list__row">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong>{teacher.user?.name || teacher.personalInfo?.fullName || ta.dossiers.reviewQueue.teacherFallback}</strong>
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                      isPublicTeacher
                                        ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border-[var(--wn-border-mint)]'
                                        : 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-border-strong)]'
                                    }`}
                                  >
                                    {isPublicTeacher
                                      ? (isRTL ? 'ظاهر للعام' : 'Public')
                                      : (isRTL ? 'مخفي عن العام' : 'Hidden')}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)]">
                                    {isRTL
                                      ? `${ops.activeCirclesCount || 0} حلقات · ${ops.enrolledStudentsCount || 0} طلاب`
                                      : `${ops.activeCirclesCount || 0} circles · ${ops.enrolledStudentsCount || 0} students`}
                                  </span>
                                  {Number(ops.overdueSessionsCount || 0) > 0 || Number(ops.missingReportsCount || 0) > 0 ? (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border border-[var(--wn-status-warn-border)]">
                                      {isRTL
                                        ? `تنبيهات: ${Number(ops.overdueSessionsCount || 0) + Number(ops.missingReportsCount || 0)}`
                                        : `Alerts: ${Number(ops.overdueSessionsCount || 0) + Number(ops.missingReportsCount || 0)}`}
                                    </span>
                                  ) : null}
                                </div>
                                <small>
                                  {[teacher.personalInfo?.country, teacher.personalInfo?.city].filter(Boolean).join(', ') || tTeachers.locationMissing}
                                  {' · '}
                                  {formatMsg(tTeachers.hourlyRateUnit, { rate: teacher.hourlyRate ?? tc.dash })}
                                </small>
                                <small>{teacher.user?.email || tTeachers.noEmail}</small>
                              </div>
                              <div className="wn-admin-teachers-list__actions">
                                <button
                                  type="button"
                                  disabled={isTogglingPublic}
                                  onClick={() => toggleTeacherPublicVisibility(teacher)}
                                  className={`min-h-11 px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 ${
                                    isPublicTeacher
                                      ? 'border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]'
                                      : 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                                  }`}
                                >
                                  {isTogglingPublic ? (
                                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                  ) : isPublicTeacher ? (
                                    <EyeOff size={14} aria-hidden="true" />
                                  ) : (
                                    <Eye size={14} aria-hidden="true" />
                                  )}
                                  <span>
                                    {isPublicTeacher
                                      ? (isRTL ? 'إخفاء عن العام' : 'Hide')
                                      : (isRTL ? 'إظهار للعام' : 'Show')}
                                  </span>
                                </button>
                                <button type="button" className="is-primary min-h-[44px]" onClick={() => openTeacherDossier(teacher._id)}>
                                  {tTeachers.manageBtn}
                                </button>
                                {isPublicTeacher ? (
                                  <button type="button" className="is-secondary min-h-[44px]" onClick={() => previewPublicTeacher(teacher._id)}>
                                    {tTeachers.publicBtn}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => deleteItem('teacher', teacher._id, teacher.user?.name || teacher.personalInfo?.fullName || ta.dossiers.reviewQueue.teacherFallback)}
                                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] text-xs font-bold inline-flex items-center gap-1"
                                  title={tTeachers.deleteTitle}
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                  <span>{tTeachers.deleteBtn}</span>
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'audit' && (
              <AdminAuditTab
                auditEntries={auditEntries}
                loading={refreshingAudit}
                onRefresh={refreshAudit}
              />
            )}

            {tab === 'courses' && (
              <AdminCoursesTab
                courses={courses}
                approved={approved}
                selectedCourse={selectedCourse}
                lessons={lessons}
                loadingLessons={loadingLessons}
                courseForm={courseForm}
                setCourseForm={setCourseForm}
                lessonForm={lessonForm}
                setLessonForm={setLessonForm}
                courseProgramFilter={courseProgramFilter}
                setCourseProgramFilter={setCourseProgramFilter}
                seeding={seeding}
                seedingCatalog={seedingCatalog}
                uploading={uploading}
                creatingCourse={creatingCourse}
                addingLesson={addingLesson}
                togglingCourseId={togglingCourseId}
                onSeedDemoCourse={seedDemoCourse}
                onSeedOfficialCatalog={seedOfficialCatalog}
                onAddCourse={addCourse}
                onSelectCourse={(id) => {
                  setSelectedCourse(id);
                  loadLessons(id);
                }}
                onToggleCourseStatus={toggleCourseStatus}
                onDeleteItem={deleteItem}
                onAddLesson={addLesson}
                onUploadVideo={uploadVideo}
              />
            )}

            {tab === 'blog' && (
              <AdminBlogTab
                blogPosts={blogPosts}
                blogForm={blogForm}
                setBlogForm={setBlogForm}
                creatingBlog={creatingBlog}
                togglingBlogId={togglingBlogId}
                onAddBlog={addBlog}
                onToggleBlogStatus={toggleBlogStatus}
                onDeleteItem={deleteItem}
              />
            )}

            {tab === 'withdrawals' && (
              <AdminWithdrawalsTab withdrawals={withdrawals} onReviewWithdraw={reviewWithdraw} />
            )}

            {tab === 'growth' && (
              <AdminGrowthTab
                growthSummary={growthSummary}
                donations={donations}
                applications={applications}
                videos={videos}
                videoForm={videoForm}
                setVideoForm={setVideoForm}
                onReloadGrowth={loadGrowth}
              />
            )}
          </>
        )}

        {teacherDossier && (
          <TeacherReviewDossier
            dossier={teacherDossier}
            loading={teacherDossierLoading}
            onClose={closeTeacherDossier}
            onChecklist={updateTeacherChecklist}
            onReview={review}
            onOpenDocument={openTeacherDocument}
            onOpenMedia={openTeacherMedia}
            onOpenProfileChangeMedia={openTeacherProfileChangeMedia}
            onProfileChangeReview={reviewTeacherProfileChange}
            onPreviewPublic={previewPublicTeacher}
            onUpdateAdminSettings={updateTeacherAdminSettings}
            onDeleteTeacher={(id, label) => deleteItem('teacher', id, label)}
            onSafeSuspendTeacher={(id, label) => setTeacherSafeModal({ teacherId: id, label, mode: 'suspend' })}
            onRefreshDossier={async (id) => {
              await openTeacherDossier(id);
              await loadTeachersTab().catch(() => {});
            }}
            onOpenStudent={(sId) => {
              closeTeacherDossier();
              openStudentDossier(sId);
            }}
          />
        )}

        {studentDossier && (
          <Student360Dossier
            dossier={studentDossier}
            loading={studentDossierLoading}
            onClose={closeStudentDossier}
            onOpenGuardian={openFamilyDossier}
            onOpenTeacher={(tId) => {
              closeStudentDossier();
              openTeacherDossier(tId);
            }}
            onOpenHomeworkAudio={openStudentHomeworkAudio}
            onMessageStudent={(studentId) => { closeStudentDossier(); setSupportStudent(studentId); setTab('messages'); }}
            onUpdateStudent={updateStudentAdminProfile}
            onDeleteStudent={(id, label) => deleteItem('student', id, label)}
            onRefreshStudent={openStudentDossier}
            onNavigateSubscriptions={() => {
              closeStudentDossier();
              navigate(localizedPath('/admin/subscriptions', locale));
            }}
            approvedTeachers={approved}
          />
        )}

        {familyDossier && (
          <Family360Dossier
            dossier={familyDossier}
            loading={familyDossierLoading}
            onClose={closeFamilyDossier}
            onOpenStudent={openStudentDossier}
            onRefreshFamily={openFamilyDossier}
          />
        )}

        <TeacherSafeActionModal
          modalState={teacherSafeModal}
          onClose={() => setTeacherSafeModal(null)}
          onCompleted={async (teacherId) => {
            if (String(teacherDossier?.teacher?._id) === String(teacherId)) {
              closeTeacherDossier();
            }
            await load();
          }}
        />

        <Modal
          isOpen={Boolean(payoutModal)}
          onClose={() => setPayoutModal(null)}
          title={payoutModal?.action === 'approve' ? twModal.approveTitle : twModal.rejectTitle}
          disableClose={submittingPayout}
          maxWidth="460px"
        >
          {payoutModal && (
            <form onSubmit={submitPayoutDecision} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-[var(--wn-text-secondary)]">
                  {formatMsg(twModal.summary, {
                    name: payoutModal.withdrawal.teacher?.user?.name || payoutModal.withdrawal.teacher?.personalInfo?.fullName || ta.dossiers.reviewQueue.teacherFallback,
                    amount: payoutModal.withdrawal.amount,
                    currency: payoutModal.withdrawal.currency || 'EGP',
                    method: payoutModal.withdrawal.method,
                  })}
                </p>
                {payoutModal.withdrawal.accountInfo ? (
                  <p className="text-xs font-semibold text-[var(--wn-text-primary)] bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-lg p-2">
                    {formatMsg(twModal.accountInfo, { info: payoutModal.withdrawal.accountInfo })}
                  </p>
                ) : null}
              </div>

              {payoutModal.action === 'approve' ? (
                <div>
                  <label htmlFor={`${formId}-payout-ref`} className="block text-xs font-semibold text-[var(--wn-text-primary)] mb-1">
                    {twModal.refLabel}
                  </label>
                  <input
                    id={`${formId}-payout-ref`}
                    required
                    type="text"
                    value={payoutModal.referenceNumber}
                    onChange={(e) => setPayoutModal({ ...payoutModal, referenceNumber: e.target.value })}
                    placeholder={twModal.refPlaceholder}
                    className="w-full min-h-[44px] border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor={`${formId}-payout-notes`} className="block text-xs font-semibold text-[var(--wn-text-primary)] mb-1">
                  {payoutModal.action === 'approve' ? twModal.notesApprove : twModal.notesReject}
                </label>
                <textarea
                  id={`${formId}-payout-notes`}
                  required={payoutModal.action === 'reject'}
                  rows={3}
                  value={payoutModal.notes}
                  onChange={(e) => setPayoutModal({ ...payoutModal, notes: e.target.value })}
                  placeholder={payoutModal.action === 'approve' ? twModal.notesPlaceholderApprove : twModal.notesPlaceholderReject}
                  className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
                <button
                  type="button"
                  onClick={() => setPayoutModal(null)}
                  disabled={submittingPayout}
                  className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-lg"
                >
                  {twModal.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className={`min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-semibold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60 ${
                    payoutModal.action === 'approve'
                      ? 'bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)]'
                      : 'bg-[var(--wn-danger)] hover:opacity-90'
                  }`}
                >
                  {submittingPayout && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  <span>
                    {submittingPayout
                      ? twModal.submitting
                      : payoutModal.action === 'approve'
                        ? twModal.confirmApprove
                        : twModal.confirmReject}
                  </span>
                </button>
              </div>
            </form>
          )}
        </Modal>

        <Modal
          isOpen={Boolean(confirmDeleteModal)}
          onClose={() => setConfirmDeleteModal(null)}
          title={tModals.confirmDeleteTitle}
          disableClose={deletingItem}
          maxWidth="440px"
        >
          {confirmDeleteModal && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {confirmDeleteModal.label
                  ? formatMsg(tModals.confirmDeleteBody, { label: confirmDeleteModal.label })
                  : tModals.confirmDeleteBodyPlain}
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(null)}
                  disabled={deletingItem}
                  className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-lg"
                >
                  {tModals.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteItem(confirmDeleteModal.type, confirmDeleteModal.id)}
                  disabled={deletingItem}
                  className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-semibold rounded-lg bg-[var(--wn-danger)] hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {deletingItem && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  <span>{deletingItem ? tModals.deletingBtn : tModals.confirmDeleteBtn}</span>
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={Boolean(reviewPromptModal)}
          onClose={() => setReviewPromptModal(null)}
          title={
            reviewPromptModal?.kind === 'profile-change'
              ? tModals.profileChangeRejectTitle
              : reviewPromptModal?.action === 'reject'
                ? tModals.rejectTeacherTitle
                : tModals.requestChangesTitle
          }
          disableClose={submittingReviewPrompt}
          maxWidth="460px"
        >
          {reviewPromptModal && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const noteVal = reviewPromptModal.note?.trim();
                if (!noteVal || submittingReviewPrompt) return;
                setSubmittingReviewPrompt(true);
                try {
                  const ok = reviewPromptModal.kind === 'teacher-review'
                    ? await review(reviewPromptModal.id, reviewPromptModal.action, noteVal)
                    : await reviewTeacherProfileChange(reviewPromptModal.id, reviewPromptModal.action, noteVal);
                  if (ok) {
                    setReviewPromptModal(null);
                  }
                } finally {
                  setSubmittingReviewPrompt(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor={`${formId}-review-note`} className="block text-xs font-semibold text-[var(--wn-text-primary)] mb-1">
                  {reviewPromptModal.action === 'reject' ? tModals.rejectLabel : tModals.requestLabel}
                </label>
                <textarea
                  id={`${formId}-review-note`}
                  required
                  autoFocus
                  rows={3}
                  value={reviewPromptModal.note}
                  onChange={(e) => setReviewPromptModal({ ...reviewPromptModal, note: e.target.value })}
                  className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                  placeholder={tModals.notePlaceholder}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
                <button
                  type="button"
                  onClick={() => setReviewPromptModal(null)}
                  disabled={submittingReviewPrompt}
                  className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-lg"
                >
                  {tModals.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingReviewPrompt}
                  className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-semibold rounded-lg bg-[var(--wn-danger)] hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submittingReviewPrompt && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  <span>{submittingReviewPrompt ? tModals.submitting : tModals.submit}</span>
                </button>
              </div>
            </form>
          )}
        </Modal>
      </AdminDashboardShell>
    </>
  );
}
