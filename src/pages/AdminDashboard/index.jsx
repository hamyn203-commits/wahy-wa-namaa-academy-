import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, BookOpen, Calendar, DollarSign, CheckCircle, XCircle, Eye,
  Mail, MessageSquare, Plus, Trash2, Upload, Video, Edit3, Send,
  TrendingUp, BriefcaseBusiness, MonitorPlay, ShieldCheck,
  History,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { StatCard } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import TeacherReviewQueue from './TeacherReviewQueue';
import TeacherReviewDossier from './TeacherReviewDossier';
import AdminPeopleSearch from './AdminPeopleSearch';
import AdminPeopleDirectory from './AdminPeopleDirectory';
import Student360Dossier from './Student360Dossier';
import Family360Dossier from './Family360Dossier';
import AdminDashboardShell from './AdminDashboardShell';
import AdminExecutiveHome from './AdminExecutiveHome';
import AdminSessionControl from './AdminSessionControl';
import AdminGuardianLinksPanel from './AdminGuardianLinksPanel';
import LaunchReadinessPanel from './LaunchReadinessPanel';
import AdminSupportInbox from './AdminSupportInbox';

const STATUS_LABEL = { new: 'جديدة', read: 'مقروءة', replied: 'تم الرد', closed: 'مغلقة' };
const STATUS_COLOR = { new: 'bg-blue-100 text-blue-700', read: 'bg-gray-100', replied: 'bg-green-100 text-green-700', closed: 'bg-gray-200' };

function Empty({ text }) {
  return <p className="text-center text-gray-500 py-10">{text}</p>;
}

export default function AdminDashboard() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const supportStudent = searchParams.get('student') || '';
  const setSupportStudent = (studentId) => navigate(`?tab=messages&student=${encodeURIComponent(studentId)}`);
  const [loading, setLoading] = useState(true);
  const focus = searchParams.get('focus') || '';

  const [stats, setStats] = useState({});
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [pendingProfileChanges, setPendingProfileChanges] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lessons, setLessons] = useState([]);

  const [replyText, setReplyText] = useState({});
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', phone: '', country: 'مصر', city: 'القاهرة', gender: 'male', hourlyRate: 50 });
  const [payoutModal, setPayoutModal] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);
  const [reviewPromptModal, setReviewPromptModal] = useState(null);
  const [courseForm, setCourseForm] = useState({ titleAr: '', slug: '', instructorId: '', price: 0, descAr: '', programs: [] });
  const [lessonForm, setLessonForm] = useState({ titleAr: '', type: 'video', videoUrl: '', youtubeUrl: '', duration: 10 });
  const [blogForm, setBlogForm] = useState({ slug: '', titleAr: '', excerptAr: '', contentAr: '' });
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  const loadPendingTeachers = useCallback(async () => {
    const result = await api.get('/api/admin/teachers/pending', { auth: true });
    setPending(Array.isArray(result) ? result : (result.teachers || []));
  }, []);

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
      throw new Error('تعذر تحميل طلبات المعلمين المعلقة');
    }
  }, []);

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
    const result = await api.get('/api/admin/audit?limit=150', { auth: true });
    setAuditEntries(result.entries || []);
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

    const legacy = (legacyResult.withdrawals || []).map((item) => ({
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

  const loadLessons = async (courseId) => {
    const r = await api.get(`/api/admin/courses/${courseId}/lessons`, { auth: true });
    setLessons(Array.isArray(r) ? r : []);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (['overview', 'teachers', 'courses', 'system'].includes(tab)) await loadCore();
      if (tab === 'messages') await loadMessages();
      if (tab === 'courses') await loadCourses();
      if (tab === 'blog') await loadBlog();
      if (tab === 'withdrawals') await loadWithdrawals();
      if (tab === 'growth') await loadGrowth();
      if (tab === 'audit') await loadAudit();
    } catch (e) {
      toast.error(e.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [tab, loadCore, loadMessages, loadCourses, loadBlog, loadWithdrawals, loadGrowth, loadAudit, toast]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowed = ['overview', 'people', 'sessions', 'system', 'messages', 'teachers', 'withdrawals', 'courses', 'blog', 'growth', 'audit'];
    if (requestedTab && allowed.includes(requestedTab)) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!ready || !['overview', 'teachers'].includes(tab)) return undefined;

    const refreshQueue = () => {
      if (document.visibilityState === 'visible') {
        loadPendingTeachers().catch(() => {});
      }
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
      if (actionUrl.includes('tab=teachers')) loadPendingTeachers().catch(() => {});
      if (actionUrl.includes('tab=withdrawals')) loadWithdrawals().catch(() => {});
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, loadPendingTeachers, loadWithdrawals]);

    if (!ready) return null;

  const review = async (id, action, note = '') => {
    let reviewNote = note;

    if (['request-changes', 'reject'].includes(action) && !reviewNote) {
      setReviewPromptModal({ kind: 'teacher-review', id, action, note: '' });
      return;
    }
    if (false) {
      reviewNote = window.prompt(
        action === 'reject' ? 'اكتب سبب رفض الطلب:' : 'اكتب المطلوب من المعلم استكماله أو تعديله:',
        ''
      ) ?? '';
      if (!reviewNote.trim()) return;
    }

    try {
      await api.put(`/api/teachers/admin/${id}/review`, { action, note: reviewNote }, { auth: true });
      const labels = {
        approve: 'تم قبول المعلم وفتح الحساب',
        reject: 'تم رفض الطلب',
        'request-changes': 'تم إرسال طلب الاستكمال للمعلم',
      };
      toast.success(labels[action] || 'تم تحديث الطلب');
      setTeacherDossier(null);
      await loadCore();
    } catch (error) {
      toast.error(error.message || 'فشلت العملية');
    }
  };

  const openTeacherDossier = async (teacherId) => {
    setTeacherDossierLoading(true);
    setTeacherDossier({ teacher: { _id: teacherId } });
    try {
      const result = await api.get(`/api/teachers/admin/${teacherId}/review-dossier`, { auth: true });
      setTeacherDossier(result);
    } catch (error) {
      setTeacherDossier(null);
      toast.error(error.message || 'تعذر تحميل ملف المعلم الكامل');
    } finally {
      setTeacherDossierLoading(false);
    }
  };

  const updateTeacherChecklist = async (teacherId, key, status, note = '') => {
    try {
      await api.put(
        `/api/teachers/admin/${teacherId}/review-checklist/${key}`,
        { status, note },
        { auth: true }
      );
      toast.success(status === 'approved' ? 'تم اعتماد بند المراجعة' : 'تم تحديث بند المراجعة');
      await openTeacherDossier(teacherId);
      await loadPendingTeachers();
    } catch (error) {
      toast.error(error.message || 'تعذر تحديث قائمة المراجعة');
    }
  };

  const openStudentDossier = async (studentId) => {
    if (!studentId) return;
    setFamilyDossier(null);
    setStudentDossierLoading(true);
    setStudentDossier({ student: { _id: studentId } });
    try {
      const result = await api.get(`/api/admin/people/students/${studentId}`, { auth: true });
      setStudentDossier(result);
    } catch (error) {
      setStudentDossier(null);
      toast.error(error.message || 'تعذر تحميل ملف الطالب الكامل');
    } finally {
      setStudentDossierLoading(false);
    }
  };

  const openFamilyDossier = async (guardianId) => {
    if (!guardianId) return;
    setStudentDossier(null);
    setFamilyDossierLoading(true);
    setFamilyDossier({ guardian: { _id: guardianId } });
    try {
      const result = await api.get(`/api/admin/people/guardians/${guardianId}`, { auth: true });
      setFamilyDossier(result);
    } catch (error) {
      setFamilyDossier(null);
      toast.error(error.message || 'تعذر تحميل ملف الأسرة');
    } finally {
      setFamilyDossierLoading(false);
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
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      toast.error(error.message || 'تعذر فتح تسليم الطالب');
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
        throw new Error('تعذر الحصول على رابط تشغيل آمن للفيديو.');
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

  const openTeacherProfileChangeMedia = (teacherId, kind) =>
    kind === 'profilePhoto'
      ? fetchTeacherReviewAsset(`/api/teachers/admin/${teacherId}/profile-change/media/${kind}?reason=profile-change-review`)
      : fetchTeacherPlayback(
        `/api/teachers/admin/${teacherId}/profile-change/media-playback/${kind}`,
        `/api/teachers/admin/${teacherId}/profile-change/media/${kind}?reason=profile-change-review`
      );

  const reviewTeacherProfileChange = async (teacherId, action, suppliedNote = '') => {
    let note = suppliedNote;
    if (action === 'reject' && !note) {
      setReviewPromptModal({ kind: 'profile-change', id: teacherId, action, note: '' });
      return;
    }
    if (false) {
      note = window.prompt('اكتب سبب رفض التعديل أو المطلوب من المعلم:', '') ?? '';
      if (!note.trim()) return;
    }

    try {
      await api.put(
        `/api/teachers/admin/${teacherId}/profile-change/review`,
        { action, note: note.trim() },
        { auth: true }
      );
      toast.success(action === 'approve' ? 'تم اعتماد ونشر تعديل ملف المعلم' : 'تم رفض التعديل وإبلاغ المعلم');
      setPendingProfileChanges((current) => current.filter((item) => String(item.teacher?._id || item.teacher) !== String(teacherId)));
      await openTeacherDossier(teacherId);
      await loadCore();
    } catch (error) {
      toast.error(error.message || 'تعذر مراجعة تعديل الملف');
    }
  };

  const sendReply = async (id) => {
    const reply = replyText[id];
    if (!reply?.trim()) return toast.error('اكتب الرد أولاً');
    try {
      await api.put(`/api/contact/${id}/reply`, { reply }, { auth: true });
      toast.success('تم إرسال الرد');
      setReplyText((p) => ({ ...p, [id]: '' }));
      loadMessages();
    } catch (e) { toast.error(e.message); }
  };

  const seedDemoCourse = async () => {
    setSeeding(true);
    try {
      const r = await api.post('/api/lms/seed-demo', {}, { auth: true });
      toast.success(r.message || 'تم إنشاء الدورة التجريبية');
      await loadCourses();
    } catch (e) {
      toast.error(e.message || 'فشل إنشاء الدورة');
    } finally {
      setSeeding(false);
    }
  };

  const addTeacher = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/teachers', { ...teacherForm, autoApprove: false }, { auth: true });
      toast.success('تم إنشاء ملف المعلم وإرساله إلى مركز المراجعة');
      setTeacherForm({ name: '', email: '', password: '', phone: '', country: 'مصر', city: 'القاهرة', gender: 'male', hourlyRate: 50 });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const addCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/courses', courseForm, { auth: true });
      toast.success('تم إنشاء الدورة');
      setCourseForm({ titleAr: '', slug: '', instructorId: '', price: 0, descAr: '', programs: [] });
      loadCourses();
    } catch (e) { toast.error(e.message); }
  };

  const addLesson = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    try {
      await api.post(`/api/admin/courses/${selectedCourse}/lessons`, lessonForm, { auth: true });
      toast.success('تم إضافة الدرس');
      setLessonForm({ titleAr: '', type: 'video', videoUrl: '', youtubeUrl: '', duration: 10 });
      loadLessons(selectedCourse);
    } catch (e) { toast.error(e.message); }
  };

  const uploadVideo = async (e, lessonField = 'videoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageFile = await uploadFileDirect(file, 'course-media');
      const r = await api.post('/api/admin/upload', { storageFile }, { auth: true });
      setLessonForm((p) => ({ ...p, [lessonField]: r.url }));
      toast.success('تم رفع الفيديو');
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const addBlog = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/blog', blogForm, { auth: true });
      toast.success('تم نشر المقال');
      setBlogForm({ slug: '', titleAr: '', excerptAr: '', contentAr: '' });
      loadBlog();
    } catch (e) { toast.error(e.message); }
  };

  const updateTeacherAdminSettings = async (teacherId, settings) => {
    try {
      await api.put(`/api/admin/teachers/${teacherId}`, {
        ...settings,
        adminReason: 'تحديث إعدادات المعلم (أجر الساعة / القسم / التمييز)',
      }, { auth: true });
      toast.success('تم تحديث إعدادات المعلم بنجاح');
      await openTeacherDossier(teacherId);
      await loadCore();
    } catch (e) {
      toast.error(e.message || 'تعذر تحديث إعدادات المعلم');
    }
  };

  const updateStudentAdminProfile = async (studentId, settings) => {
    try {
      await api.put(`/api/admin/people/students/${studentId}`, {
        ...settings,
        adminReason: 'تحديث بيانات وحالة الطالب من Student 360',
      }, { auth: true });
      toast.success('تم تحديث بيانات الطالب وحالة حسابه بنجاح');
      await openStudentDossier(studentId);
    } catch (e) {
      toast.error(e.message || 'تعذر تحديث بيانات الطالب');
    }
  };

  const toggleCourseStatus = async (course) => {
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    try {
      await api.put(`/api/admin/courses/${course._id}`, { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'published' ? 'تم نشر الدورة' : 'تم تحويل الدورة إلى مسودة');
      loadCourses();
    } catch (e) { toast.error(e.message); }
  };

  const toggleBlogStatus = async (post) => {
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      await api.put(`/api/admin/blog/${post._id}`, { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'published' ? 'تم نشر المقال' : 'تم تحويل المقال إلى مسودة');
      loadBlog();
    } catch (e) { toast.error(e.message); }
  };

  const submitPayoutDecision = async (e) => {
    e.preventDefault();
    if (!payoutModal) return;
    const { withdrawal, action, referenceNumber, notes } = payoutModal;
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
      toast.success(action === 'approve' ? 'تم اعتماد تحويل المبلغ وتسجيل المرجع' : 'تم رفض طلب السحب');
      setPayoutModal(null);
      loadWithdrawals();
      loadCore();
    } catch (err) { toast.error(err.message); }
  };

  const reviewWithdraw = (withdrawal, action) => {
    setPayoutModal({ withdrawal, action, referenceNumber: '', notes: '' });
  };

  const executeDeleteItem = async (type, id) => {
    const paths = { course: `/api/admin/courses/${id}`, lesson: `/api/admin/lessons/${id}`, blog: `/api/admin/blog/${id}`, message: `/api/contact/${id}` };
    try {
      await api.delete(paths[type], { auth: true });
      toast.success('تم الحذف بنجاح');
      setConfirmDeleteModal(null);
      if (type === 'lesson') loadLessons(selectedCourse);
      else if (type === 'course') loadCourses();
      else if (type === 'blog') loadBlog();
      else load();
    } catch (e) { toast.error(e.message); }
  };

  const deleteItem = async (type, id, label = '') => {
    setConfirmDeleteModal({ type, id, label });
  };
  /*
    try {
      if (withdrawal.source === 'ledger') {
        await api.put(`/api/finance/admin/payouts/${withdrawal._id}/process`, {
          action,
        }, { auth: true });
      } else {
        await api.patch(`/api/admin/withdrawals/${withdrawal._id}`, { action }, { auth: true });
      }
      toast.success(action === 'approve' ? 'تم اعتماد تحويل المبلغ' : 'تم رفض الطلب');
      loadWithdrawals();
    } catch (e) { toast.error(e.message); }
    }
  };
    } catch (e) { toast.error(e.message); }
  };

  const executeDeleteItem = async (type, id) => {
    const paths = { course: `/api/admin/courses/${id}`, lesson: `/api/admin/lessons/${id}`, blog: `/api/admin/blog/${id}`, message: `/api/contact/${id}` };
    try {
      await api.delete(paths[type], { auth: true });
      toast.success('تم الحذف بنجاح');
      setConfirmDeleteModal(null);
      if (type === 'lesson') loadLessons(selectedCourse);
      else if (type === 'course') loadCourses();
      else if (type === 'blog') loadBlog();
      else load();
    } catch (e) { toast.error(e.message); }
    }
  };
    } catch (e) { toast.error(e.message); }
  };

  const deleteItem = async (type, id, label = '') => {
    setConfirmDeleteModal({ type, id, label });
    if (false) {
    if (!confirm('هل أنت متأكد؟')) return;
    const paths = { course: `/api/admin/courses/${id}`, lesson: `/api/admin/lessons/${id}`, blog: `/api/admin/blog/${id}`, message: `/api/contact/${id}` };
    try {
      await api.delete(paths[type], { auth: true });
      toast.success('تم الحذف');
      if (type === 'lesson') loadLessons(selectedCourse);
      else load();
    } catch (e) { toast.error(e.message); }
    }
  };
    } catch (e) { toast.error(e.message); }
  };

  */
  const COLORS = ['#d5a83d', '#2563eb', '#16a56f', '#7c3aed'];

  const donationPieData = Object.entries(growthSummary.donationsByCategory || {}).map(([name, value]) => ({
    name: name === 'student' ? 'كفالة طالب' : name === 'teacher' ? 'كفالة معلم' : name === 'halaqa' ? 'كفالة حلقة' : 'تبرع عام',
    value
  }));

  const regsData = (growthSummary.monthlyRegs || []).map(r => ({
    name: r.month,
    'الطلاب': r.count
  }));

  const enrollmentsData = (growthSummary.enrollmentsByCourse || []).map(e => ({
    name: e.name.length > 20 ? e.name.slice(0, 20) + '...' : e.name,
    'الاشتراكات': e.count
  }));

  const selectAdminTab = (nextTab, nextFocus = '') => {
    setTab(nextTab);
    const query = new URLSearchParams();
    query.set('tab', nextTab);
    if (nextFocus) query.set('focus', nextFocus);
    navigate(`/admin?${query.toString()}`);
  };

  const filteredApprovedTeachers = approved.filter((teacher) => {
    const term = teacherQuery.trim().toLocaleLowerCase();
    if (!term) return true;
    return [
      teacher.user?.name, teacher.personalInfo?.fullName,
      teacher.user?.email, teacher.personalInfo?.country,
      teacher.personalInfo?.city,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term));
  });

  const previewPublicTeacher = (teacherId) => {
    if (!teacherId) return;
    window.open(`/teachers/${encodeURIComponent(teacherId)}`, '_blank', 'noopener,noreferrer');
  };

  const [peopleRole, setPeopleRole] = useState('all');

  const adminSearch = (
    <AdminPeopleSearch
      onOpenStudent={openStudentDossier}
      onOpenGuardian={openFamilyDossier}
      onOpenTeacher={openTeacherDossier}
      onOpenPayments={() => navigate('/admin/payments')}
    />
  );

  return (
    <AdminDashboardShell
      user={user}
      active={tab}
      onChange={selectAdminTab}
      onNavigate={navigate}
      onLogout={logout}
      search={adminSearch}
    >

      {loading && tab !== 'overview' ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
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
              onNavigate={navigate}
              onSelectTab={selectAdminTab}
            />
          )}

          {tab === 'people' && (
            <>
              {focus === 'guardian-links' ? (
                <AdminGuardianLinksPanel onOpenStudent={openStudentDossier} />
              ) : null}
              <AdminPeopleDirectory selectedRole={peopleRole} onOpenStudent={openStudentDossier} onOpenGuardian={openFamilyDossier} />
              <section className="wn-admin-people-home">
              <div className="wn-admin-people-home__intro">
                <span>STUDENT & FAMILY INTELLIGENCE</span>
                <h2>الطلاب والأسر من نقطة واحدة</h2>
                <p>استخدم البحث الشامل أعلى اللوحة للوصول إلى Student 360 أو Family 360 بالاسم أو البريد أو الهاتف أو الـID.</p>
              </div>
              <div className="wn-admin-people-home__cards">
                <button type="button" onClick={() => { setPeopleRole('student'); document.querySelector('[aria-label="دليل الطلاب والأسر"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} aria-label="عرض الطلاب">
                  <Users size={22} />
                  <strong>Student 360</strong>
                  <p>افتح دليل الطلاب، ثم ملف الطالب الكامل بالحصص والحضور والواجبات والمدفوعات.</p>
                </button>
                <button type="button" onClick={() => { setPeopleRole('guardian'); document.querySelector('[aria-label="دليل الطلاب والأسر"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} aria-label="عرض أولياء الأمور">
                  <ShieldCheck size={22} />
                  <strong>Family 360</strong>
                  <p>افتح دليل أولياء الأمور وملف الأسرة، مع بيانات الأبناء وطلبات الربط.</p>
                </button>
                <button type="button" onClick={() => selectAdminTab('audit')} aria-label="فتح سجل الإدارة">
                  <History size={22} />
                  <strong>Audit Trail</strong>
                  <p>افتح سجل أنشطة الإدارة ومراجعة العمليات الحساسة.</p>
                </button>
              </div>
            </section>
            </>
          )}

          {tab === 'sessions' && (
            <AdminSessionControl
              initialFocus={['overdue', 'missing-reports'].includes(focus) ? focus : 'all'}
              onOpenStudent={openStudentDossier}
              onOpenTeacher={openTeacherDossier}
              onFocusChange={(nextFocus) => selectAdminTab('sessions', nextFocus)}
            />
          )}

          {tab === 'system' && (
            <div className="wn-admin-system-center">
              <section className="wn-admin-system-center__hero">
                <div>
                  <span>SYSTEM & LAUNCH CONTROL</span>
                  <h2><MonitorPlay size={20} /> النظام وجاهزية الإطلاق</h2>
                  <p>حالة الخدمات الأساسية وLaunch Readiness من مكان واحد.</p>
                </div>
                <strong>{health?.version ? `v${health.version}` : '—'}</strong>
              </section>

              {health ? (
                <section className="wn-admin-system-center__features">
                  {Object.entries(health.features || {}).map(([key, enabled]) => (
                    <div key={key} className={enabled ? 'is-on' : 'is-off'}>
                      <span>{enabled ? '✓' : '!'}</span>
                      <strong>{key}</strong>
                      <small>{enabled ? 'الخدمة متاحة' : 'تحتاج مراجعة'}</small>
                    </div>
                  ))}
                </section>
              ) : null}

              <LaunchReadinessPanel />
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-4">
              <AdminSupportInbox selectedStudent={supportStudent} onSelect={setSupportStudent} />
              <h2 className="text-lg font-bold">رسائل نموذج التواصل</h2>
              {messages.length === 0 ? <Empty text="لا رسائل" /> : messages.map((m) => (
                <div key={m._id} className="wn-dashboard-surface">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Mail size={16} className="text-emerald-600" />
                        <span className="font-bold">{m.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                      </div>
                      <p className="text-sm text-gray-500">{m.email} {m.phone && `— ${m.phone}`}</p>
                      <p className="font-semibold mt-2">{m.subject}</p>
                      <p className="text-gray-700 mt-1 whitespace-pre-wrap">{m.message}</p>
                      {m.adminReply && (
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-sm">
                          <strong>ردك:</strong> {m.adminReply}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteItem('message', m._id)} className="text-red-500 p-1"><Trash2 size={16} /></button>
                  </div>
                  {m.status !== 'replied' && (
                    <div className="flex gap-2 mt-3">
                      <input
                        value={replyText[m._id] || ''}
                        onChange={(e) => setReplyText((p) => ({ ...p, [m._id]: e.target.value }))}
                        placeholder="اكتب ردك..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <button onClick={() => sendReply(m._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1">
                        <Send size={14} /> رد
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'teachers' && (
            <div className="space-y-6">
              {pendingProfileChanges.length > 0 && (
                <section className="wn-dashboard-surface border-amber-200 bg-amber-50/40">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-bold text-amber-950">طلبات تعديل ملفات المعلمين ({pendingProfileChanges.length})</h3>
                      <p className="text-xs text-amber-800 mt-1">لن تظهر أي تعديلات للطلاب قبل اعتمادها من الإدارة.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pendingProfileChanges.map((request) => {
                      const teacher = request.teacher || {};
                      return (
                        <article key={request._id} className="rounded-xl border border-amber-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <strong className="block">{teacher.personalInfo?.fullName || teacher.user?.name || 'معلم'}</strong>
                            <small className="block text-slate-500">{teacher.user?.email || ''}</small>
                            <small className="block text-slate-500 mt-1">{(request.changedFields || []).length} تعديل · {request.createdAt ? new Date(request.createdAt).toLocaleString('ar-EG') : ''}</small>
                          </div>
                          <button type="button" className="wn-btn wn-btn--primary" onClick={() => openTeacherDossier(teacher._id)}>
                            مراجعة التعديلات
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

              <div className="grid lg:grid-cols-2 gap-6">
              <form onSubmit={addTeacher} className="wn-dashboard-surface space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> إضافة معلم جديد</h3>
                {['name', 'email', 'password', 'phone'].map((f) => (
                  <input key={f} required={f !== 'phone'} type={f === 'password' ? 'password' : f === 'email' ? 'email' : 'text'}
                    placeholder={{ name: 'الاسم', email: 'البريد', password: 'كلمة المرور', phone: 'الهاتف' }[f]}
                    value={teacherForm[f]} onChange={(e) => setTeacherForm((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="الدولة" value={teacherForm.country} onChange={(e) => setTeacherForm((p) => ({ ...p, country: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="المدينة" value={teacherForm.city} onChange={(e) => setTeacherForm((p) => ({ ...p, city: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={teacherForm.gender || 'male'} onChange={(e) => setTeacherForm((p) => ({ ...p, gender: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm bg-white" aria-label="النوع / القسم">
                    <option value="male">معلم (ذكر)</option>
                    <option value="female">معلمة (أنثى)</option>
                  </select>
                  <input type="number" min="10" max="1000" placeholder="أجر الساعة (ج.م)" value={teacherForm.hourlyRate ?? 50} onChange={(e) => setTeacherForm((p) => ({ ...p, hourlyRate: Number(e.target.value) }))} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm">إنشاء ملف للمراجعة</button>
              </form>
              <div className="wn-dashboard-surface wn-admin-teachers-list">
                <div className="wn-admin-teachers-list__head">
                  <div>
                    <h3>المعلمون المعتمدون ({approved.length})</h3>
                    <p>فتح ملف Teacher 360 داخل الإدارة، مع معاينة مستقلة للملف العام عند الحاجة.</p>
                  </div>
                  <button type="button" className="wn-btn wn-btn--secondary" onClick={loadCore}>تحديث القائمة</button>
                </div>
                <label className="wn-admin-teachers-list__search">
                  <span>البحث في المعلمين</span>
                  <input
                    type="search"
                    value={teacherQuery}
                    onChange={(event) => setTeacherQuery(event.target.value)}
                    placeholder="اسم المعلم أو البريد أو المدينة"
                    aria-label="البحث عن معلم معتمد"
                  />
                </label>
                {approved.length === 0 ? (
                  <Empty text="لا يوجد معلمون معتمدون حاليًا" />
                ) : filteredApprovedTeachers.length === 0 ? (
                  <Empty text="لا توجد نتائج مطابقة للبحث" />
                ) : (
                  <div className="wn-admin-teachers-list__rows">
                    {filteredApprovedTeachers.map((teacher) => (
                      <article key={teacher._id} className="wn-admin-teachers-list__row">
                        <div>
                          <strong>{teacher.user?.name || teacher.personalInfo?.fullName || 'معلم'}</strong>
                          <small>{[teacher.personalInfo?.country, teacher.personalInfo?.city].filter(Boolean).join('، ') || 'الموقع غير مسجل'} · {teacher.hourlyRate ?? '—'} ج.م/س</small>
                          <small>{teacher.user?.email || 'البريد غير متاح'}</small>
                        </div>
                        <div className="wn-admin-teachers-list__actions">
                          <button type="button" className="is-primary" onClick={() => openTeacherDossier(teacher._id)}>إدارة المعلم</button>
                          <button type="button" className="is-secondary" onClick={() => previewPublicTeacher(teacher._id)}>الملف العام</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <section className="wn-dashboard-surface">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-bold flex items-center gap-2"><History size={18} /> سجل الإدارة</h3>
                  <p className="text-xs text-slate-500 mt-1">يسجل القرارات والوصول إلى المستندات والوسائط الحساسة.</p>
                </div>
                <button type="button" onClick={loadAudit} className="wn-btn">تحديث</button>
              </div>

              {auditEntries.length === 0 ? <Empty text="لا توجد أحداث إدارية مسجلة" /> : (
                <div className="wn-admin-audit-list">
                  {auditEntries.map((entry) => (
                    <div key={entry._id}>
                      <span>
                        <strong>{entry.actor?.name || 'الإدارة'}</strong>
                        <small>{new Date(entry.createdAt).toLocaleString('ar-EG')}</small>
                      </span>
                      <span>
                        <strong>{entry.action}</strong>
                        <small>{entry.entityType} · {entry.entityId}</small>
                      </span>
                      <span>
                        <strong>{entry.reason || 'بدون ملاحظة'}</strong>
                        <small>{entry.request?.path || ''}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'courses' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-l from-emerald-50 to-white border border-emerald-100 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-emerald-900">دورة LMS تجريبية</h3>
                  <p className="text-sm text-slate-600 mt-1">إنشاء دورة «تحفيظ القرآن للمبتدئين» مع دروس واختبار — كما في README</p>
                </div>
                <button type="button" onClick={seedDemoCourse} disabled={seeding}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-60">
                  {seeding ? 'جاري الإنشاء...' : 'إنشاء دورة تجريبية'}
                </button>
              </div>
              <form onSubmit={addCourse} className="wn-dashboard-surface grid md:grid-cols-2 gap-3">
                <h3 className="font-bold md:col-span-2 flex items-center gap-2"><BookOpen size={18} /> دورة جديدة</h3>
                <input required placeholder="عنوان الدورة (عربي)" value={courseForm.titleAr} onChange={(e) => setCourseForm((p) => ({ ...p, titleAr: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                <input required placeholder="slug (مثال: quran-kids)" value={courseForm.slug} onChange={(e) => setCourseForm((p) => ({ ...p, slug: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                <select required value={courseForm.instructorId} onChange={(e) => setCourseForm((p) => ({ ...p, instructorId: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">اختر المعلم</option>
                  {approved.map((t) => <option key={t._id} value={t._id}>{t.user?.name || t.personalInfo?.fullName}</option>)}
                </select>
                <input type="number" placeholder="السعر" value={courseForm.price} onChange={(e) => setCourseForm((p) => ({ ...p, price: Number(e.target.value) }))} className="border rounded-lg px-3 py-2 text-sm" />
                <textarea placeholder="وصف الدورة" value={courseForm.descAr} onChange={(e) => setCourseForm((p) => ({ ...p, descAr: e.target.value }))} className="md:col-span-2 border rounded-lg px-3 py-2 text-sm" rows={2} />
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  {['kids', 'reverts', 'women', 'general'].map((prog) => (
                    <label key={prog} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={courseForm.programs.includes(prog)}
                        onChange={(e) => setCourseForm((p) => ({
                          ...p,
                          programs: e.target.checked ? [...p.programs, prog] : p.programs.filter((x) => x !== prog),
                        }))} />
                      {prog}
                    </label>
                  ))}
                </div>
                <button type="submit" className="md:col-span-2 py-2 bg-indigo-600 text-white rounded-lg text-sm">إنشاء الدورة</button>
              </form>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="wn-dashboard-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="font-bold">الدورات ({courses.filter((c) => courseProgramFilter === 'all' || (c.programs || []).includes(courseProgramFilter)).length})</h3>
                    <select value={courseProgramFilter} onChange={(e) => setCourseProgramFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
                      <option value="all">كل البرامج</option>
                      {['kids', 'reverts', 'women', 'general'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {courses.length === 0 ? <Empty text="لا دورات" /> : courses.filter((c) => courseProgramFilter === 'all' || (c.programs || []).includes(courseProgramFilter)).map((c) => (
                    <div key={c._id} className={`border rounded-lg p-3 mb-2 cursor-pointer transition ${selectedCourse === c._id ? 'border-emerald-500 bg-emerald-50' : ''}`}
                      onClick={() => { setSelectedCourse(c._id); loadLessons(c._id); }}>
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">{c.title?.ar}</p>
                          <p className="text-xs text-gray-500">{c.slug} — {c.status} — {c.price}$ {(c.programs || []).length ? `[${c.programs.join(',')}]` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleCourseStatus(c); }} className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700">
                            {c.status === 'published' ? 'تحويل لمسودة' : 'نشر'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteItem('course', c._id, c.title?.ar); }} className="text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedCourse && (
                  <div className="wn-dashboard-surface">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Video size={18} /> دروس الدورة</h3>
                    <form onSubmit={addLesson} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                      <input required placeholder="عنوان الدرس" value={lessonForm.titleAr} onChange={(e) => setLessonForm((p) => ({ ...p, titleAr: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                      <select value={lessonForm.type} onChange={(e) => setLessonForm((p) => ({ ...p, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="video">فيديو</option>
                        <option value="text">نص</option>
                      </select>
                      {lessonForm.type === 'video' && (
                        <>
                          <input placeholder="رابط YouTube (embed)" value={lessonForm.youtubeUrl} onChange={(e) => setLessonForm((p) => ({ ...p, youtubeUrl: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                          <div className="flex gap-2 items-center">
                            <label className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm bg-white hover:bg-gray-50">
                              <Upload size={16} /> {uploading ? 'جاري الرفع...' : 'رفع فيديو'}
                              <input type="file" accept="video/*" className="hidden" onChange={uploadVideo} disabled={uploading} />
                            </label>
                            {lessonForm.videoUrl && <span className="text-xs text-green-600 truncate max-w-[120px]">✓ مرفوع</span>}
                          </div>
                        </>
                      )}
                      <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm">+ إضافة درس</button>
                    </form>
                    {lessons.map((l) => (
                      <div key={l._id} className="border rounded p-2 mb-2 flex justify-between text-sm">
                        <span>{l.order}. {l.title?.ar} ({l.type})</span>
                        <button onClick={() => deleteItem('lesson', l._id)} className="text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'blog' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form onSubmit={addBlog} className="wn-dashboard-surface space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Edit3 size={18} /> مقال جديد</h3>
                <input required placeholder="slug" value={blogForm.slug} onChange={(e) => setBlogForm((p) => ({ ...p, slug: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input required placeholder="العنوان" value={blogForm.titleAr} onChange={(e) => setBlogForm((p) => ({ ...p, titleAr: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="مقتطف" value={blogForm.excerptAr} onChange={(e) => setBlogForm((p) => ({ ...p, excerptAr: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                <textarea required placeholder="المحتوى" rows={6} value={blogForm.contentAr} onChange={(e) => setBlogForm((p) => ({ ...p, contentAr: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm">نشر</button>
              </form>
              <div className="wn-dashboard-surface">
                <h3 className="font-bold mb-4 flex items-center gap-2"><MessageSquare size={18} /> المقالات ({blogPosts.length})</h3>
                {blogPosts.length === 0 ? <Empty text="لا مقالات" /> : blogPosts.map((p) => (
                  <div key={p._id} className="border rounded-lg p-3 mb-2 flex justify-between">
                    <div>
                      <p className="font-semibold">{p.title?.ar}</p>
                      <p className="text-xs text-gray-500">{p.slug} — {p.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleBlogStatus(p)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700">
                        {p.status === 'published' ? 'تحويل لمسودة' : 'نشر'}
                      </button>
                      <button onClick={() => deleteItem('blog', p._id, p.title?.ar)} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="space-y-3">
              {withdrawals.length === 0 ? <Empty text="لا طلبات سحب" /> : withdrawals.map((w) => (
                <div key={w._id} className="wn-dashboard-surface flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="font-bold">{w.teacher?.user?.name || w.teacher?.personalInfo?.fullName || 'معلم'}</p>
                    <p className="text-sm text-gray-500">{w.teacher?.user?.email}</p>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{w.amount} {w.currency || 'EGP'} — {w.method}</p>
                    <p className="text-[11px] text-slate-400">{w.source === 'ledger' ? 'السجل المالي الموحد' : 'طلب قديم قيد الترحيل'}</p>
                    <p className="text-sm text-gray-600">{w.accountInfo}</p>
                    {w.referenceNumber ? <p className="text-xs text-emerald-700 font-semibold mt-1">مرجع التحويل: {w.referenceNumber}</p> : null}
                    {w.notes ? <p className="text-xs text-slate-500 mt-0.5">ملاحظات: {w.notes}</p> : null}
                    <p className="text-xs text-gray-400 mt-1">{new Date(w.createdAt).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      ['approved', 'completed'].includes(w.status) ? 'bg-green-100 text-green-700'
                        : w.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : w.status === 'processing' ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {['approved', 'completed'].includes(w.status)
                        ? 'تم التحويل'
                        : w.status === 'rejected'
                          ? 'مرفوض'
                          : w.status === 'processing'
                            ? 'جاري التحويل'
                            : 'قيد المراجعة'}
                    </span>
                    {w.status === 'pending' && (
                      <>
                        <button onClick={() => reviewWithdraw(w, 'approve')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">موافقة</button>
                        <button onClick={() => reviewWithdraw(w, 'reject')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">رفض</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'growth' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="تبرعات" value={growthSummary.donations?.pledged?.count || 0} icon={TrendingUp} color="orange" />
                <StatCard label="طلبات توظيف" value={growthSummary.newApplications || 0} icon={BriefcaseBusiness} color="blue" />
                <StatCard label="فيديوهات" value={growthSummary.publishedVideos || 0} icon={MonitorPlay} color="purple" />
                <StatCard label="إحالات" value={growthSummary.totalReferrals || 0} icon={Users} color="emerald" />
              </div>

              {/* Visual Analytics Charts */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
                
                {/* Monthly Registrations Area Chart */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col text-right-rtl">
                  <h4 className="font-bold text-gray-800 mb-4 text-right">نمو تسجيل الطلاب (آخر 6 أشهر)</h4>
                  <div className="h-64 w-full">
                    {regsData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">لا بيانات كافية للرسم البياني</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={regsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none' }} />
                          <Area type="monotone" dataKey="الطلاب" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRegs)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Course Enrollments Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col text-right-rtl">
                  <h4 className="font-bold text-gray-800 mb-4 text-right">توزيع الاشتراكات حسب الدورة</h4>
                  <div className="h-64 w-full">
                    {enrollmentsData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">لا اشتراكات نشطة حالياً</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={enrollmentsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none' }} />
                          <Bar dataKey="الاشتراكات" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                            {enrollmentsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Donation Categories Donut Chart */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col text-right-rtl">
                  <h4 className="font-bold text-gray-800 mb-4 text-right">حصص فئات التبرعات (نسب مئوية)</h4>
                  <div className="h-64 w-full relative">
                    {donationPieData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">لا تبرعات مسجلة بعد</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donationPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {donationPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

              </div>

              <div className="wn-dashboard-surface">
                <h3 className="font-bold mb-4">التبرعات ({donations.length})</h3>
                {donations.length === 0 ? <Empty text="لا تبرعات" /> : donations.slice(0, 10).map((d) => (
                  <div key={d._id} className="flex flex-wrap justify-between items-center border rounded-lg p-3 mb-2 gap-2">
                    <div>
                      <p className="font-semibold">{d.isAnonymous ? 'متبرع مجهول' : d.name}</p>
                      <p className="text-xs text-gray-500">{d.amount} {d.currency} — {d.category}</p>
                    </div>
                    <select value={d.status} onChange={async (e) => {
                      await api.put(`/api/donations/${d._id}/status`, { status: e.target.value }, { auth: true });
                      loadGrowth();
                    }} className="text-sm border rounded-lg px-2 py-1">
                      {['pledged', 'confirmed', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="wn-dashboard-surface">
                <h3 className="font-bold mb-4">طلبات التوظيف ({applications.length})</h3>
                {applications.length === 0 ? <Empty text="لا طلبات" /> : applications.slice(0, 10).map((a) => (
                  <div key={a._id} className="flex flex-wrap justify-between items-center border rounded-lg p-3 mb-2 gap-2">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.position} — {a.email}</p>
                    </div>
                    <select value={a.status} onChange={async (e) => {
                      await api.put(`/api/careers/applications/${a._id}/status`, { status: e.target.value }, { auth: true });
                      loadGrowth();
                    }} className="text-sm border rounded-lg px-2 py-1">
                      {['new', 'reviewing', 'interview', 'hired', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.post('/api/videos', videoForm, { auth: true });
                    toast.success('تم إضافة الفيديو');
                    setVideoForm({ title: '', category: 'quran', videoUrl: '', duration: 600 });
                    loadGrowth();
                  } catch (err) { toast.error(err.message); }
                }} className="wn-dashboard-surface space-y-3">
                  <h3 className="font-bold">فيديو جديد</h3>
                  <input required placeholder="العنوان" className="w-full border rounded-lg px-3 py-2 text-sm" value={videoForm.title} onChange={(e) => setVideoForm((p) => ({ ...p, title: e.target.value }))} />
                  <input required placeholder="رابط YouTube embed" className="w-full border rounded-lg px-3 py-2 text-sm" value={videoForm.videoUrl} onChange={(e) => setVideoForm((p) => ({ ...p, videoUrl: e.target.value }))} />
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={videoForm.category} onChange={(e) => setVideoForm((p) => ({ ...p, category: e.target.value }))}>
                    {['quran', 'tajweed', 'arabic', 'seerah', 'kids'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm">إضافة</button>
                </form>
                <div className="wn-dashboard-surface">
                  <h3 className="font-bold mb-4">المكتبة ({videos.length})</h3>
                  {videos.slice(0, 8).map((v) => (
                    <div key={v._id} className="flex justify-between items-center border rounded-lg p-2 mb-2 text-sm">
                      <span>{v.title}</span>
                      <button type="button" onClick={async () => { await api.delete(`/api/videos/${v._id}`, { auth: true }); loadGrowth(); }} className="text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {teacherDossier && (
        <TeacherReviewDossier
          dossier={teacherDossier}
          loading={teacherDossierLoading}
          onClose={() => setTeacherDossier(null)}
          onChecklist={updateTeacherChecklist}
          onReview={review}
          onOpenDocument={openTeacherDocument}
          onOpenMedia={openTeacherMedia}
          onOpenProfileChangeMedia={openTeacherProfileChangeMedia}
          onProfileChangeReview={reviewTeacherProfileChange}
          onPreviewPublic={previewPublicTeacher}
          onUpdateAdminSettings={updateTeacherAdminSettings}
        />
      )}

      {studentDossier && (
        <Student360Dossier
          dossier={studentDossier}
          loading={studentDossierLoading}
          onClose={() => setStudentDossier(null)}
          onOpenGuardian={openFamilyDossier}
          onOpenTeacher={openTeacherDossier}
          onOpenHomeworkAudio={openStudentHomeworkAudio}
          onMessageStudent={(studentId) => { setStudentDossier(null); setSupportStudent(studentId); setTab('messages'); }}
          onUpdateStudent={updateStudentAdminProfile}
        />
      )}

      {familyDossier && (
        <Family360Dossier
          dossier={familyDossier}
          loading={familyDossierLoading}
          onClose={() => setFamilyDossier(null)}
          onOpenStudent={openStudentDossier}
        />
      )}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <form onSubmit={submitPayoutDecision} className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">
                {payoutModal.action === 'approve' ? 'اعتماد تحويل مستحقات المعلم' : 'رفض طلب سحب الأرباح'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {payoutModal.withdrawal.teacher?.user?.name || payoutModal.withdrawal.teacher?.personalInfo?.fullName || 'معلم'} — {payoutModal.withdrawal.amount} {payoutModal.withdrawal.currency || 'EGP'} ({payoutModal.withdrawal.method})
              </p>
              {payoutModal.withdrawal.accountInfo ? (
                <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2">
                  بيانات الحساب: {payoutModal.withdrawal.accountInfo}
                </p>
              ) : null}
            </div>
            <div className="p-4 space-y-3">
              {payoutModal.action === 'approve' ? (
                <label className="block text-xs font-semibold text-slate-700 space-y-1">
                  <span>رقم مرجع التحويل (فودافون كاش / إنستاباي / بنك):</span>
                  <input
                    required
                    type="text"
                    value={payoutModal.referenceNumber}
                    onChange={(e) => setPayoutModal({ ...payoutModal, referenceNumber: e.target.value })}
                    placeholder="مثال: TXN-98451203"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </label>
              ) : null}
              <label className="block text-xs font-semibold text-slate-700 space-y-1">
                <span>{payoutModal.action === 'approve' ? 'ملاحظات للمعلم (اختياري):' : 'سبب رفض طلب السحب (مطلوب):'}</span>
                <textarea
                  required={payoutModal.action === 'reject'}
                  rows={3}
                  value={payoutModal.notes}
                  onChange={(e) => setPayoutModal({ ...payoutModal, notes: e.target.value })}
                  placeholder={payoutModal.action === 'approve' ? 'تم التحويل بنجاح...' : 'اكتب سبب الرفض بوضوح للمعلم...'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setPayoutModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">إلغاء</button>
              <button
                type="submit"
                className={`px-4 py-2 text-sm text-white font-semibold rounded-lg ${payoutModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {payoutModal.action === 'approve' ? 'تأكيد التحويل' : 'تأكيد الرفض'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">تأكيد الحذف</h3>
            </div>
            <div className="p-4 text-sm text-slate-600">
              <p>هل أنت متأكد من حذف هذا العنصر نهائيًا{confirmDeleteModal.label ? ` (${confirmDeleteModal.label})` : ''}؟</p>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setConfirmDeleteModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">إلغاء</button>
              <button
                type="button"
                onClick={() => executeDeleteItem(confirmDeleteModal.type, confirmDeleteModal.id)}
                className="px-4 py-2 text-sm text-white font-semibold rounded-lg bg-rose-600 hover:bg-rose-700"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
      {reviewPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const noteVal = reviewPromptModal.note?.trim();
              if (!noteVal) return;
              const current = reviewPromptModal;
              setReviewPromptModal(null);
              if (current.kind === 'teacher-review') {
                await review(current.id, current.action, noteVal);
              } else {
                await reviewTeacherProfileChange(current.id, current.action, noteVal);
              }
            }}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200"
          >
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">
                {reviewPromptModal.kind === 'profile-change'
                  ? 'رفض تعديل ملف المعلم'
                  : reviewPromptModal.action === 'reject'
                    ? 'رفض طلب تسجيل المعلم'
                    : 'طلب استكمال أو تعديل بيانات المعلم'}
              </h3>
            </div>
            <div className="p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {reviewPromptModal.action === 'reject'
                  ? 'اكتب سبب الرفض ليصل للمعلم بوضوح:'
                  : 'اكتب المطلوب من المعلم استكماله أو تعديله:'}
              </label>
              <textarea
                required
                autoFocus
                rows={3}
                value={reviewPromptModal.note}
                onChange={(e) => setReviewPromptModal({ ...reviewPromptModal, note: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                placeholder="اكتب الملاحظات التوجيهية للمعلم..."
              />
            </div>
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setReviewPromptModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">إلغاء</button>
              <button type="submit" className="px-4 py-2 text-sm text-white font-semibold rounded-lg bg-rose-600 hover:bg-rose-700">
                تأكيد الإرسال
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminDashboardShell>
  );
}

