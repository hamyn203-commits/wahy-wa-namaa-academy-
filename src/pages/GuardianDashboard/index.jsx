import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, TrendingUp, BookOpen, Award, Bell, FileText, CalendarCheck, 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, MessageCircle, 
  Phone, ShieldCheck, Star, UserPlus, Sparkles, Check, ChevronLeft, ArrowRight, Share2,
  CreditCard, Wallet, RefreshCw
} from 'lucide-react';
import DashboardLayout, { StatCard, TabBar } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import GuardianOverviewCenter from './GuardianOverviewCenter';
import Skeleton from '../../components/shared/Skeleton';

function relationshipLabel(value) {
  const labels = { father: 'ابن / ابنة', mother: 'ابن / ابنة', guardian: 'تحت الرعاية', other: 'تحت الرعاية' };
  return labels[value] || 'ابن / ابنة';
}

function taskStatusLabel(status) {
  const labels = { pending: 'مطلوب', submitted: 'تم التسليم — قيد التصحيح', done: 'تم الاعتماد' };
  return labels[status] || status;
}

function invitationRelationshipLabel(value) {
  const labels = { father: 'طلب ربط كأب', mother: 'طلب ربط كأم', guardian: 'طلب ربط كولي أمر', other: 'طلب ربط' };
  return labels[value] || 'طلب ربط';
}

const subscriptionStatusLabels = {
  active: { label: 'نشط', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  placed: { label: 'مُسكّن بالحلقة', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  awaiting_placement: { label: 'بانتظار التسكين', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  pending_payment: { label: 'بانتظار السداد', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  payment_review: { label: 'قيد مراجعة التحويل', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  renewal_queued: { label: 'في طابور التجديد', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  paused: { label: 'موقوف مؤقتاً', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  completed: { label: 'مكتمل', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  expired: { label: 'منتهي الصلاحية', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  cancelled: { label: 'ملغي', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};

const planLabels = {
  community: 'حلقة عامة',
  group: 'حلقة مجموعات (باقة 5-10 طلاب)',
  focused: 'حلقة مركزة (باقة 3-5 طلاب)',
  mini: 'حلقة مصغرة (باقة 2-3 طلاب)',
  private: 'حلقة خاصة (فردية 1:1)',
};

export default function GuardianDashboard() {
  const { user, ready, logout } = useRequireAuth(['guardian']);
  const toast = useToast();
  const { locale } = useI18n();

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('family');
  const [familyOverview, setFamilyOverview] = useState({
    summary: { totalChildren: 0, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
    children: [],
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [homeworkTasks, setHomeworkTasks] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [invitationMessage, setInvitationMessage] = useState('');
  const [respondingInvitationId, setRespondingInvitationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const shareReportViaWhatsApp = async (rep, childName) => {
    const text = `🌸 *تقرير إنجاز الطالب في حلقة القرآن الكريم* 🌸\n` +
      `🏛️ *أكاديمية وَحْيٌ وَنَمَاء للقرآن الكريم*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 *الطالب:* ${childName || 'المجتهد'}\n` +
      (rep.surahRecited ? `📖 *السورة والمقدار:* سورة ${rep.surahRecited} (الآيات ${rep.fromAyah || 1} - ${rep.toAyah || 'آخر السورة'})\n` : '') +
      `⭐ *درجة الحفظ:* ${rep.memorizationScore ?? 10}/10\n` +
      `✨ *درجة التجويد:* ${rep.tajweedScore ?? 10}/10\n` +
      (rep.nextHomework ? `📝 *الواجب القادم:* ${rep.nextHomework}\n` : '') +
      (rep.notes ? `💬 *ملاحظات المعلم:* ${rep.notes}\n` : '') +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌱 *نتعلم القرآن، نحفظه، وننمو به.*`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `تقرير إنجاز ${childName || 'الطالب'} - أكاديمية وَحْيٌ وَنَمَاء`,
          text,
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Link Child Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [relationship, setRelationship] = useState('father');
  const [linking, setLinking] = useState(false);

  // RSVP Excuse Modal State
  const [excuseModalSession, setExcuseModalSession] = useState(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  // Fetch the family summary once. Child switching is local and must not
  // refetch the whole dashboard for every sibling selection.
  const loadDashboardData = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const [childrenRes, familyRes, sessionsRes, invitationRes] = await Promise.all([
        api.get('/api/guardian/children', { auth: true }).catch(() => ({ children: [] })),
        api.get('/api/guardian/family-overview', { auth: true }).catch(() => ({
          summary: { totalChildren: 0, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
          children: [],
        })),
        api.get('/api/guardian/upcoming-sessions', { auth: true }).catch(() => ({ sessions: [] })),
        api.get('/api/guardian/invitations', { auth: true }).catch(() => ({ invitations: [], message: '' })),
      ]);

      const kidsList = childrenRes.children || [];
      setChildren(kidsList);
      setFamilyOverview({
        summary: familyRes.summary || { totalChildren: kidsList.length, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
        children: familyRes.children || [],
      });
      setUpcomingSessions(sessionsRes.sessions || []);
      setPendingInvitations(invitationRes.invitations || []);
      setInvitationMessage(invitationRes.message || '');

      setSelectedChildId((current) => {
        if (!kidsList.length) return 'family';
        if (current && current !== 'family' && kidsList.some((child) => String(child.studentId) === String(current))) {
          return current;
        }
        return kidsList.length > 1 ? 'family' : String(kidsList[0].studentId);
      });
    } catch (err) {
      console.error('Failed to load guardian dashboard:', err);
      toast.error('حدث خطأ أثناء تحميل بيانات لوحة ولي الأمر');
    } finally {
      setLoading(false);
    }
  }, [ready, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const syncUpcomingSessions = useCallback(async () => {
    if (!ready) return;
    try {
      const sessionsRes = await api.get('/api/guardian/upcoming-sessions', { auth: true });
      setUpcomingSessions(sessionsRes.sessions || []);
    } catch {
      // Preserve the last known guardian view during transient connectivity failures.
    }
  }, [ready]);

  const refreshFamilyOverview = useCallback(async () => {
    if (!ready) return;
    try {
      const familyRes = await api.get('/api/guardian/family-overview', { auth: true });
      setFamilyOverview({
        summary: familyRes.summary || { totalChildren: children.length, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
        children: familyRes.children || [],
      });
    } catch {
      // Preserve the last known family summary during transient failures.
    }
  }, [ready, children.length]);

  useEffect(() => {
    if (!ready) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        syncUpcomingSessions();
        refreshFamilyOverview();
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
  }, [ready, syncUpcomingSessions, refreshFamilyOverview]);

  useEffect(() => {
    if (!ready) return undefined;

    const onRealtimeNotification = (event) => {
      const type = event?.detail?.type;
      if ([
        'session-accepted',
        'session-rejected',
        'session-rescheduled',
        'session-completed',
        'session-reminder',
      ].includes(type)) {
        syncUpcomingSessions();
        refreshFamilyOverview();
      }

      if (type === 'homework-assigned') {
        refreshFamilyOverview();
        if (selectedChildId && selectedChildId !== 'family') {
          api.get(`/api/guardian/homework/${selectedChildId}`, { auth: true })
            .then((res) => setHomeworkTasks(res.tasks || []))
            .catch(() => {});
        }
      }

      if (type === 'system') {
        loadDashboardData();
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, syncUpcomingSessions, refreshFamilyOverview, selectedChildId, loadDashboardData]);

  // Fetch only the selected child's private data. Family mode never mixes
  // reports or homework between siblings.
  useEffect(() => {
    if (!ready || !selectedChildId || selectedChildId === 'family') {
      setReports([]);
      setHomeworkTasks([]);
      return;
    }

    api.get(`/api/guardian/reports/${selectedChildId}`, { auth: true })
      .then((res) => setReports(res.reports || []))
      .catch(() => setReports([]));

    api.get(`/api/guardian/homework/${selectedChildId}`, { auth: true })
      .then((res) => setHomeworkTasks(res.tasks || []))
      .catch(() => setHomeworkTasks([]));
  }, [ready, selectedChildId]);

  // Link child handler
  const respondToInvitation = async (invitationId, action) => {
    setRespondingInvitationId(invitationId);
    try {
      await api.post(`/api/guardian/invitations/${invitationId}/respond`, { action }, { auth: true });
      toast.success(action === 'accept' ? 'تم ربط الابن بحسابك' : 'تم رفض طلب الربط');
      await loadDashboardData();
    } catch (error) {
      toast.error(error.message || 'تعذر تحديث طلب الربط');
    } finally {
      setRespondingInvitationId('');
    }
  };

  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (!linkInput.trim()) {
      toast.error('يرجى إدخال كود ربط الطالب');
      return;
    }

    setLinking(true);
    try {
      const payload = {
        relationship,
        studentCode: linkInput.trim()
      };

      const res = await api.post('/api/guardian/link-child', payload, { auth: true });
      toast.success(res.message || 'تم ربط الطالب بنجاح!');
      setShowLinkModal(false);
      setLinkInput('');
      await loadDashboardData();
    } catch (err) {
      toast.error(err.message || 'فشل ربط الطالب، تأكد من صحة كود الربط');
    } finally {
      setLinking(false);
    }
  };

  // RSVP Submission (Confirm or Excuse)
  const handleRsvp = async (sessionId, status, reason = '', targetStudentId = null) => {
    const studentIdToUse = targetStudentId || selectedChildId;
    if (!studentIdToUse) return;
    setSubmittingRsvp(true);
    try {
      const res = await api.post(`/api/sessions/${sessionId}/rsvp`, {
        studentId: studentIdToUse,
        status,
        excuseReason: reason
      }, { auth: true });

      toast.success(res.message || (status === 'confirmed' ? 'تم تأكيد الحضور بنجاح' : 'تم تسجيل الاعتذار'));
      setExcuseModalSession(null);
      setExcuseReason('');

      // Refresh upcoming sessions
      const sessionsRes = await api.get('/api/guardian/upcoming-sessions', { auth: true });
      setUpcomingSessions(sessionsRes.sessions || []);
    } catch (err) {
      toast.error(err.message || 'فشل تحديث حالة الحضور');
    } finally {
      setSubmittingRsvp(false);
    }
  };

  if (!ready) return null;

  const isFamilyMode = selectedChildId === 'family';
  const currentChild = isFamilyMode
    ? null
    : children.find((child) => String(child.studentId) === String(selectedChildId)) || null;
  const selectedChildSessions = isFamilyMode
    ? []
    : upcomingSessions.filter((session) => {
        const childId = session.child?.id || session.childId;
        return String(childId || '') === String(selectedChildId);
      });
  const nextChildSession = selectedChildSessions[0] || null;
  const familyChildById = new Map(
    (familyOverview.children || []).map((child) => [String(child.studentId), child])
  );

  return (
    <DashboardLayout title="لوحة متابعة ولي الأمر" user={user} onLogout={logout}>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-full max-w-5xl space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="grid gap-4 md:grid-cols-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
          <p className="text-gray-500 font-medium font-arabic">جاري تحميل بيانات الأبناء وحلقات القرآن...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Children Selector Top Bar */}
          <div className="wn-dashboard-hero-card rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="text-emerald-400" size={20} />
                  <span className="text-emerald-200 text-sm font-arabic">بوابة أولياء الأمور</span>
                </div>
                <h2 className="text-2xl font-bold font-arabic">
                  مرحباً بك، {user?.name || 'ولي الأمر الكريم'}
                </h2>
                <p className="text-emerald-100/80 text-sm mt-1 font-arabic">
                  تابع تقدم أبنائك في حفظ القرآن الكريم وأحكام التجويد، والحصص المباشرة والتقارير الدورية
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all shadow-md active:scale-95 text-sm"
              >
                <UserPlus size={18} />
                <span>ربط ابن جديد</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 relative z-10">
              <Link
                to={localizedPath('/free-trial', locale)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-50 border border-white/20 text-xs font-bold transition"
              >
                <Sparkles size={14} className="text-amber-300" />
                <span>حجز حصة تجريبية لابن جديد</span>
              </Link>
            </div>
            {/* Child Selector Pills */}
            {children.length > 0 && (
              <div className="mt-6 pt-5 border-t border-emerald-700/60 flex flex-wrap items-center gap-3">
                <span className="text-xs text-emerald-200/90 font-medium font-arabic">الأبناء المسجلون:</span>
                {children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedChildId('family'); setTab('overview'); }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-arabic transition-all ${
                      isFamilyMode
                        ? 'bg-white text-emerald-900 font-bold shadow-md ring-2 ring-emerald-300'
                        : 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700/80'
                    }`}
                  >
                    <Users size={15} />
                    <span>كل الأبناء</span>
                    <b className="min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] grid place-items-center">{children.length}</b>
                  </button>
                )}
                {children.map((child) => {
                  const isSelected = String(child.studentId) === String(selectedChildId);
                  return (
                    <button
                      key={child.studentId}
                      type="button"
                      onClick={() => { setSelectedChildId(String(child.studentId)); setTab('overview'); }}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-arabic transition-all ${
                        isSelected
                          ? 'bg-white text-emerald-900 font-bold shadow-md scale-105 ring-2 ring-emerald-300'
                          : 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700/80'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                        {child.name?.charAt(0) || 'ط'}
                      </div>
                      <span>{child.name}</span>
                      {child.circle && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {child.circle.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pendingInvitations.length > 0 && (
            <section className="wn-guardian-invitations">
              <div className="wn-guardian-invitations__heading">
                <div>
                  <span>طلبات ربط جديدة</span>
                  <h3>أبناء استخدموا رقمك كولي أمر</h3>
                  <p>راجع الاسم ثم وافق أو ارفض. لن تظهر بيانات الطالب الكاملة قبل الموافقة.</p>
                </div>
                <b>{pendingInvitations.length}</b>
              </div>

              <div className="wn-guardian-invitations__list">
                {pendingInvitations.map((invitation) => (
                  <article key={invitation._id}>
                    <span className="wn-guardian-child-avatar">
                      {invitation.student?.name?.charAt(0) || 'ط'}
                    </span>
                    <div>
                      <span>{invitationRelationshipLabel(invitation.relationship)}</span>
                      <h4>{invitation.student?.name || 'طالب'}</h4>
                      <small>الرقم المطابق: {invitation.phoneMasked || '—'}</small>
                    </div>
                    <div className="wn-guardian-invitations__actions">
                      <button
                        type="button"
                        onClick={() => respondToInvitation(invitation._id, 'accept')}
                        disabled={respondingInvitationId === invitation._id}
                        className="is-accept"
                      >
                        <Check size={15} />
                        تأكيد
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToInvitation(invitation._id, 'reject')}
                        disabled={respondingInvitationId === invitation._id}
                        className="is-reject"
                      >
                        <XCircle size={15} />
                        رفض
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {!pendingInvitations.length && invitationMessage && (
            <div className="wn-guardian-invitation-note">
              <ShieldCheck size={17} />
              <span>{invitationMessage}</span>
            </div>
          )}

          {/* Family command center or selected child metrics */}
          {isFamilyMode && children.length > 0 ? (
            <div className="wn-guardian-family-hub">
              <div className="wn-guardian-family-summary">
                <div>
                  <span>نظرة عامة</span>
                  <strong>{familyOverview.summary?.totalChildren || children.length}</strong>
                  <small>أبناء مرتبطون</small>
                </div>
                <div>
                  <span>الحصص القادمة</span>
                  <strong>{familyOverview.summary?.upcomingSessions || 0}</strong>
                  <small>لكل الأبناء</small>
                </div>
                <div>
                  <span>واجبات معلقة</span>
                  <strong>{familyOverview.summary?.pendingHomework || 0}</strong>
                  <small>تحتاج متابعة</small>
                </div>
                <div className={(familyOverview.summary?.needsAttention || 0) > 0 ? 'is-alert' : ''}>
                  <span>تحتاج انتباهك</span>
                  <strong>{familyOverview.summary?.needsAttention || 0}</strong>
                  <small>طلبات أو واجبات</small>
                </div>
              </div>

              {children.length > 1 && (
                <section className="mb-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-700">مقارنة شاملة</span>
                      <h3 className="text-base font-black text-slate-900">مقارنة تقدم الأبناء</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                          <th className="py-2.5 px-3">الابن / الابنة</th>
                          <th className="py-2.5 px-3">نسبة الحضور</th>
                          <th className="py-2.5 px-3">آخر تقييم حفظ</th>
                          <th className="py-2.5 px-3">الواجبات المعلقة</th>
                          <th className="py-2.5 px-3">النقاط</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {children.map((child) => {
                          const familyChild = familyChildById.get(String(child.studentId)) || {};
                          const attRate = child.attendance?.rate;
                          const memScore = familyChild.latestReport?.memorizationScore;
                          return (
                            <tr key={child.studentId} className="hover:bg-emerald-50/40">
                              <td className="py-3 px-3 font-bold text-slate-900">{child.name}</td>
                              <td className="py-3 px-3">
                                {attRate != null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-20 overflow-hidden rounded-full bg-emerald-100">
                                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, Number(attRate))}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-emerald-800">{attRate}%</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-3 font-bold text-emerald-700">{memScore != null ? `${memScore}/10` : '—'}</td>
                              <td className="py-3 px-3">{familyChild.pendingHomework ?? 0}</td>
                              <td className="py-3 px-3 font-bold text-amber-700">{child.studentProfile?.points || 0} ⭐</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <div className="wn-guardian-family-grid">
                {children.map((child) => {
                  const familyChild = familyChildById.get(String(child.studentId)) || {};
                  const next = familyChild.nextSession;
                  return (
                    <button
                      type="button"
                      key={child.studentId}
                      onClick={() => { setSelectedChildId(String(child.studentId)); setTab('overview'); }}
                      className="wn-guardian-child-card"
                    >
                      <div className="wn-guardian-child-card__top">
                        <span className="wn-guardian-child-avatar">{child.name?.charAt(0) || 'ط'}</span>
                        <div>
                          <strong>{child.name}</strong>
                          <small>{relationshipLabel(child.relationship)}</small>
                        </div>
                        {(familyChild.attentionCount || 0) > 0 ? <b>{familyChild.attentionCount}</b> : null}
                      </div>

                      <div className="wn-guardian-child-card__metrics">
                        <div><span>الحصة القادمة</span><strong>{next ? new Date(next.scheduledAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '—'}</strong></div>
                        <div><span>واجبات معلقة</span><strong>{familyChild.pendingHomework ?? '—'}</strong></div>
                        <div><span>آخر حفظ</span><strong>{familyChild.latestReport?.memorizationScore != null ? familyChild.latestReport.memorizationScore + '/10' : '—'}</strong></div>
                      </div>

                      {next ? (
                        <div className="wn-guardian-child-card__next">
                          <Clock size={14} />
                          <span>{new Date(next.scheduledAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} · {next.teacherName}</span>
                        </div>
                      ) : (
                        <div className="wn-guardian-child-card__next is-empty">
                          <CalendarCheck size={14} />
                          <span>لا توجد حصة قادمة</span>
                        </div>
                      )}

                      <span className="wn-guardian-child-card__open">فتح متابعة {child.name} <ChevronLeft size={15} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : currentChild ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-arabic">نسبة الحضور</p>
                  <p className="text-xl font-bold text-gray-800">{currentChild.attendance?.rate != null ? `${currentChild.attendance.rate}%` : '—'}</p>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    {currentChild.attendance?.attended || 0} من {currentChild.attendance?.total || 0} حصة
                  </span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-arabic">نقاط التحفيز والأوسمة</p>
                  <p className="text-xl font-bold text-gray-800">{currentChild.studentProfile?.points || 0}</p>
                  <span className="text-[11px] text-amber-600 font-medium">🔥 {currentChild.studentProfile?.streak || 0} أيام متتالية</span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-arabic">المسار التعليمي</p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {currentChild.studentProfile?.plan || 'غير محدد'}
                  </p>
                  <span className="text-[11px] text-blue-600 font-medium">
                    المستوى: {currentChild.studentProfile?.level || 'غير محدد'}
                  </span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-arabic">السورة الحالية</p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {currentChild.studentProfile?.currentSurah || 'غير محددة'}
                  </p>
                  <span className="text-[11px] text-purple-600 font-medium">
                    {currentChild.circle ? currentChild.circle.name : 'لم تُحدد حلقة بعد'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <Users className="mx-auto text-amber-500 mb-2" size={36} />
              <h3 className="font-bold text-gray-800 text-lg">لم يتم ربط أي طالب بحسابك بعد</h3>
              <p className="text-sm text-gray-600 mt-1">اضغط على زر &quot;ربط ابن جديد&quot; وأدخل كود الطالب للبدء بمتابعة دراسته، أو احجز حصة تجريبية مجانية لابن جديد.</p>
              <div className="mt-3">
                <Link
                  to={localizedPath('/free-trial', locale)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold text-xs hover:bg-emerald-50 transition"
                >
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>حجز حصة تجريبية لابن جديد</span>
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition"
              >
                <UserPlus size={16} />
                <span>ربط الطالب الآن</span>
              </button>
            </div>
          )}

          {currentChild && (
            <GuardianOverviewCenter child={currentChild} nextSession={nextChildSession} />
          )}

          {/* Child-specific navigation */}
          {currentChild && (
          <div className="wn-dashboard-surface">
            <TabBar
              tabs={[
                { id: 'overview', label: 'الحصص والمتابعة' },
                { id: 'homework', label: 'الواجبات' },
                { id: 'reports', label: 'تقارير الحفظ والتجويد' },
                { id: 'attendance', label: 'الحضور والصلاحيات' }
              ]}
              active={tab}
              onChange={setTab}
            />

            {/* TAB 1: OVERVIEW & UPCOMING SESSIONS */}
            {tab === 'overview' && (
              <div className="space-y-6 mt-4">

                {/* Student Subscription & Session Balance Card */}
                {(() => {
                  const childSub = currentChild?.subscription;
                  const sessionsRemaining = childSub?.sessionsRemaining ?? 0;
                  const sessionsUsed = childSub?.sessionsUsed ?? 0;
                  const totalSessionsCount = childSub?.sessionCount ?? (sessionsRemaining + sessionsUsed || 8);
                  const isLowBalance = childSub ? (sessionsRemaining <= 2 && childSub.status !== 'completed') : true;

                  const subStatusInfo = (childSub?.status && subscriptionStatusLabels[childSub.status]) || {
                    label: childSub ? 'قيد المتابعة' : 'لا يوجد اشتراك نشط',
                    bg: 'bg-slate-50',
                    text: 'text-slate-600',
                    border: 'border-slate-200'
                  };

                  const planName = (childSub?.planKey && planLabels[childSub.planKey])
                    || currentChild?.studentProfile?.plan
                    || 'حلقات القرآن الكريم';

                  return (
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 p-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-base font-arabic">
                                اشتراك وحصص الطالب {currentChild?.name}
                              </h4>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${subStatusInfo.bg} ${subStatusInfo.text} ${subStatusInfo.border}`}>
                                {subStatusInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 font-arabic">
                              الباقة: <strong className="text-gray-700">{planName}</strong>
                              {currentChild?.circle ? ` · ${currentChild.circle.name}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center flex-wrap gap-2">
                          <Link
                            to={localizedPath(`/plans?student=${currentChild?.studentId}${childSub && ['active', 'completed'].includes(childSub.status) ? `&renew=${childSub._id}` : ''}`, locale)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-sm active:scale-95"
                          >
                            <RefreshCw size={15} />
                            <span>تجديد أو شحن الحصص</span>
                          </Link>
                          <Link
                            to={childSub?._id && ['pending_payment', 'payment_review'].includes(childSub.status) ? localizedPath(`/payment/manual?student=${currentChild?.studentId}&subscription=${childSub._id}`, locale) : localizedPath(`/plans?student=${currentChild?.studentId}`, locale)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                          >
                            <Wallet size={14} />
                            <span>{childSub?._id && ['pending_payment', 'payment_review'].includes(childSub.status) ? 'إتمام سداد الاشتراك المختار' : 'التحويل البنكي المباشر'}</span>
                          </Link>
                        </div>
                      </div>

                      {/* Balance breakdown */}
                      <div className="mt-4 pt-4 border-t border-emerald-100/60 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-white/80 rounded-xl p-3 border border-emerald-100/60">
                          <span className="text-[11px] text-gray-500 block font-arabic">الحصص المتبقية</span>
                          <span className="text-2xl font-black text-emerald-700">{sessionsRemaining}</span>
                          <span className="text-[11px] text-gray-400 mr-1 font-arabic">حصة</span>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-emerald-100/60">
                          <span className="text-[11px] text-gray-500 block font-arabic">الحصص المستهلكة</span>
                          <span className="text-2xl font-black text-gray-800">{sessionsUsed}</span>
                          <span className="text-[11px] text-gray-400 mr-1 font-arabic">حصة</span>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-emerald-100/60 col-span-2 sm:col-span-1">
                          <span className="text-[11px] text-gray-500 block font-arabic">إجمالي باقة الاشتراك</span>
                          <span className="text-2xl font-black text-slate-700">{totalSessionsCount}</span>
                          <span className="text-[11px] text-gray-400 mr-1 font-arabic">حصة</span>
                        </div>
                      </div>

                      {/* Low balance alert */}
                      {isLowBalance && (
                        <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                          <AlertCircle size={16} className="text-amber-600 shrink-0" />
                          <span>
                            {sessionsRemaining === 0
                              ? 'رصيد الحصص نفد بالكامل. يرجى التجديد وشحن الحصص لاستمرار الحلقات دون انقطاع.'
                              : `رصيد الحصص قارب على الانتهاء (${sessionsRemaining} حصة متبقية). يرجى التجديد لضمان حجز المواعيد القادمة.`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Upcoming Quran Sessions Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 font-arabic">
                      <Calendar className="text-emerald-600" size={20} />
                      <span>الحصص والحلقات القادمة وتأكيد الحضور (RSVP)</span>
                    </h3>
                    <span className="text-xs text-gray-400 font-arabic">
                      * تذكير: يمكنك الاعتذار قبل 6 ساعات على الأقل للحصول على حصة تعويضية
                    </span>
                  </div>

                  {selectedChildSessions.length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
                      <CalendarCheck className="mx-auto text-gray-400 mb-2" size={32} />
                      <p className="text-gray-600 font-medium">لا توجد حصص قادمة مجدولة حالياً</p>
                      <p className="text-xs text-gray-400 mt-1">سيتم إشعارك فور إدراج الحصة القادمة في الجدول.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedChildSessions.map((session) => {
                        const dateObj = new Date(session.scheduledAt);
                        const rsvpVal = typeof session.rsvp === 'object' ? session.rsvp?.status : session.rsvp;
                        const isConfirmed = rsvpVal === 'confirmed';
                        const isExcused = rsvpVal === 'excused';
                        const sessionChildId = session.child?.id || session.childId || selectedChildId;

                        return (
                          <div key={session.instanceKey || `${session._id}:${sessionChildId}`} className="border border-emerald-100/80 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-1">
                                  {session.circleName}
                                </span>
                                <h4 className="font-bold text-gray-800 text-base">
                                  حلقة الطالب: {session.child?.name || currentChild?.name || 'الطالب'}
                                </h4>
                              </div>

                              {isConfirmed && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                  <Check size={14} />
                                  مؤكد الحضور
                                </span>
                              )}
                              {isExcused && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                                  <AlertCircle size={14} />
                                  معتذر (مستحق للتعويض)
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 mb-4 bg-gray-50/70 p-3 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-emerald-600 shrink-0" />
                                <span>{dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span className="font-bold text-gray-800 mr-2">
                                  الساعة {dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users size={16} className="text-gray-400 shrink-0" />
                                  <span>المعلم: <strong className="text-gray-800">{session.teacher?.name || 'معلم الحلقة'}</strong></span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                                  <MessageCircle size={13} />
                                  الشات الداخلي قريبًا
                                </span>
                              </div>
                            </div>

                            {/* RSVP Action Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                              {!isConfirmed && !isExcused ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleRsvp(session._id, 'confirmed', '', sessionChildId)}
                                    disabled={submittingRsvp}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-sm active:scale-95"
                                  >
                                    <Check size={16} />
                                    <span>تأكيد الحضور</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExcuseModalSession(session)}
                                    disabled={submittingRsvp}
                                    className="inline-flex items-center justify-center gap-1 py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                                  >
                                    <span>اعتذار مسبق</span>
                                  </button>
                                </>
                              ) : (
                                <div className="w-full flex items-center justify-between text-xs text-gray-500">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span>{isConfirmed ? 'تم تأكيد الحضور في سجل الحلقة' : 'تم تسجيل الاعتذار في سجل الحلقة'}</span>
                                    {isConfirmed && (
                                      <button
                                        type="button"
                                        onClick={() => setExcuseModalSession(session)}
                                        disabled={submittingRsvp}
                                        className="text-red-600 hover:text-red-700 font-bold underline"
                                      >
                                        اعتذار طارئ؟
                                      </button>
                                    )}
                                  </div>
                                  {(session.meetingLink || session.meetingUrl || session._id) ? (
                                    <Link
                                      to={typeof session.meetingLink === 'string' && session.meetingLink.startsWith('/live/')
                                        ? localizedPath(session.meetingLink, locale)
                                        : localizedPath(`/live/${session.roomId || session._id}`, locale)}
                                      className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                                    >
                                      <span>دخول الغرفة كمراقب صامت</span>
                                      <ArrowRight size={14} />
                                    </Link>
                                  ) : (
                                    <span className="text-slate-400">تتاح غرفة المتابعة عند بدء الحصة</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Latest Evaluation Report Card */}
                {currentChild?.latestEvaluation && (
                  <div className="border border-emerald-100 rounded-2xl p-6 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 text-base font-arabic">
                            بطاقة تقييم آخر حلقة تسميع
                          </h4>
                          <p className="text-xs text-gray-500">
                            بتاريخ: {new Date(currentChild.latestEvaluation.date).toLocaleDateString('ar-EG', { dateStyle: 'full' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => shareReportViaWhatsApp({
                            surahRecited: currentChild.latestEvaluation.surahRecited,
                            fromAyah: currentChild.latestEvaluation.fromAyah,
                            toAyah: currentChild.latestEvaluation.toAyah,
                            memorizationScore: currentChild.latestEvaluation.memorizationScore,
                            tajweedScore: currentChild.latestEvaluation.tajweedScore,
                            nextHomework: currentChild.latestEvaluation.nextHomework,
                            notes: currentChild.latestEvaluation.notes
                          }, currentChild.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                          title="مشاركة التقرير عبر واتساب"
                        >
                          <Share2 size={13} className="text-amber-300" />
                          <span>مشاركة عبر واتساب 📲</span>
                        </button>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                          <MessageCircle size={14} />
                          تم الإرسال على واتساب
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-400 mb-1">درجة الحفظ</p>
                        <p className="text-2xl font-black text-emerald-600">
                          {currentChild.latestEvaluation.memorizationScore} <span className="text-sm font-normal text-gray-400">/ 10</span>
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-400 mb-1">درجة التجويد والإتقان</p>
                        <p className="text-2xl font-black text-teal-600">
                          {currentChild.latestEvaluation.tajweedScore} <span className="text-sm font-normal text-gray-400">/ 10</span>
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-400 mb-1">السورة والمقدار</p>
                        <p className="text-sm font-bold text-gray-800">
                          {currentChild.latestEvaluation.surahRecited || 'سورة مسمّعة'}
                        </p>
                        <span className="text-[11px] text-gray-500">
                          الآيات [{currentChild.latestEvaluation.fromAyah || 1} - {currentChild.latestEvaluation.toAyah || 'نهاية السورة'}]
                        </span>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-400 mb-1">الواجب القادم</p>
                        <p className="text-sm font-bold text-emerald-800 truncate" title={currentChild.latestEvaluation.nextHomework}>
                          {currentChild.latestEvaluation.nextHomework || 'مراجعة الورد السابق'}
                        </p>
                      </div>
                    </div>

                    {currentChild.latestEvaluation.notes && (
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-sm text-gray-700">
                        <strong className="text-emerald-800">توجيهات المعلم لولي الأمر: </strong>
                        <span>{currentChild.latestEvaluation.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* HOMEWORK */}
            {tab === 'homework' && (
              <div className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-emerald-700">متابعة الواجب</span>
                    <h3 className="font-bold text-gray-800 text-lg font-arabic">واجبات {currentChild?.name}</h3>
                  </div>
                  <span className="text-xs text-gray-500">
                    {homeworkTasks.filter((task) => task.status === 'pending').length} مطلوب · {homeworkTasks.filter((task) => task.status === 'submitted').length} قيد التصحيح
                  </span>
                </div>

                {homeworkTasks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <BookOpen className="mx-auto text-gray-300 mb-3" size={38} />
                    <p className="text-gray-500 font-medium">لا توجد واجبات لهذا الطالب حتى الآن</p>
                  </div>
                ) : (
                  <div className="wn-guardian-homework-list">
                    {homeworkTasks.map((task) => (
                      <article key={task._id} className={`wn-guardian-homework-card is-${task.status}`}>
                        <div>
                          <span>{taskStatusLabel(task.status)}</span>
                          <h4>{task.title}</h4>
                          <p>{task.description || 'بدون تعليمات إضافية'}</p>
                        </div>
                        <div className="wn-guardian-homework-card__meta">
                          <span><Users size={14} /> {task.teacherName || 'معلم الأكاديمية'}</span>
                          <span><Calendar size={14} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'بدون موعد تسليم'}</span>
                        </div>
                        {task.teacherFeedback ? (
                          <div className="wn-guardian-homework-feedback">
                            <MessageCircle size={15} />
                            <div><strong>ملاحظة المعلم</strong><p>{task.teacherFeedback}</p></div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ALL REPORTS (WHATSAPP ARCHIVE) */}
            {tab === 'reports' && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-lg font-arabic">
                    سجل تقارير {currentChild?.name || 'الطالب'} المُرسلة للواتساب
                  </h3>
                  <span className="text-xs text-gray-500 font-arabic">
                    إجمالي التقارير: {reports.length}
                  </span>
                </div>

                {reports.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <FileText className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="text-gray-500 font-medium">لا توجد تقارير مسجلة لهذا الطالب حتى الآن</p>
                    <p className="text-xs text-gray-400 mt-1">يتم إنشاء التقرير تلقائياً فور انتهاء المعلم من حلقة التسميع.</p>
                  </div>
                ) : (
                  reports.map((rep, idx) => (
                    <div key={rep.sessionId || idx} className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:border-emerald-200 transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 pb-3 border-b border-gray-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-base">
                              {rep.surahRecited ? `سورة ${rep.surahRecited}` : 'جلسة تسميع'}
                            </span>
                            {rep.fromAyah && rep.toAyah && (
                              <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-arabic">
                                من الآية {rep.fromAyah} إلى {rep.toAyah}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            المعلم: {rep.teacherName} • {new Date(rep.scheduledAt).toLocaleDateString('ar-EG', { dateStyle: 'full' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <span className="block text-[11px] text-gray-400">الحفظ</span>
                            <span className="font-black text-emerald-600 text-base">{rep.memorizationScore}/10</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[11px] text-gray-400">التجويد</span>
                            <span className="font-black text-teal-600 text-base">{rep.tajweedScore}/10</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => shareReportViaWhatsApp(rep, currentChild?.name)}
                            className="p-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition"
                            title="مشاركة في واتساب"
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        {rep.nextHomework && (
                          <p>
                            <strong className="text-gray-800">📖 الواجب المطلوب: </strong>
                            {rep.nextHomework}
                          </p>
                        )}
                        {rep.notes && (
                          <p>
                            <strong className="text-gray-800">📝 ملاحظات المعلم: </strong>
                            {rep.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: ATTENDANCE & MAKEUP SESSIONS */}
            {tab === 'attendance' && (
              <div className="space-y-6 mt-4">
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-5">
                  <h4 className="font-bold text-emerald-900 text-base mb-2 font-arabic">
                    سياسة الحضور والحصص التعويضية في أكاديمية وَحْيٌ وَنَمَاء
                  </h4>
                  <ul className="text-sm text-emerald-800/90 space-y-1.5 list-disc list-inside">
                    <li>يتم إرسال تذكير بالحصة قبل 24 ساعة عبر الواتساب لتأكيد الحضور أو تقديم اعتذار.</li>
                    <li>في حال تم تقديم الاعتذار قبل موعد الحصة بـ <strong>6 ساعات على الأقل</strong>، يحفظ للطالب حقه في حصة تعويضية مجانية.</li>
                    <li>الغياب المفاجئ دون اعتذار مسبق يُسجل كغياب وتُعطى الأولوية للطلاب الحاضرين.</li>
                  </ul>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-700">إعدادات الربط والرقابة</span>
                      <h4 className="font-bold text-gray-800 text-base font-arabic">
                        صلاحيات المتابعة المفعلة لحساب {currentChild?.name || 'الطالب'}
                      </h4>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <ShieldCheck size={14} />
                      حساب مرتبط وموثق
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                    {[
                      { key: 'viewProgress', label: 'متابعة الحفظ والتقدم', enabled: currentChild?.permissions?.viewProgress !== false },
                      { key: 'viewGrades', label: 'الاطلاع على تقييمات التسميع', enabled: currentChild?.permissions?.viewGrades !== false },
                      { key: 'viewAttendance', label: 'سجل الحضور والاعتذارات', enabled: currentChild?.permissions?.viewAttendance !== false },
                      { key: 'receiveNotifications', label: 'إشعارات الحصص والتقارير', enabled: currentChild?.permissions?.receiveNotifications !== false },
                      { key: 'approveEnrollments', label: 'إدارة الاشتراكات والتجديد', enabled: currentChild?.permissions?.approveEnrollments !== false },
                    ].map((perm) => (
                      <div
                        key={perm.key}
                        className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                          perm.enabled ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        <span className="font-bold">{perm.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${perm.enabled ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {perm.enabled ? 'مفعّل' : 'مقيد'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-green-200 bg-green-50/50 rounded-xl p-4 text-center">
                    <CheckCircle className="mx-auto text-green-600 mb-2" size={28} />
                    <p className="text-sm text-green-800 font-arabic">الحصص المكتملة</p>
                    <p className="text-2xl font-black text-green-700 mt-1">
                      {currentChild?.attendance?.attended || 0}
                    </p>
                  </div>

                  <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 text-center">
                    <AlertCircle className="mx-auto text-amber-600 mb-2" size={28} />
                    <p className="text-sm text-amber-800 font-arabic">اعتذارات معتمدة للتعويض</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">
                      {currentChild?.attendance?.excused || 0}
                    </p>
                  </div>

                  <div className="border border-red-200 bg-red-50/50 rounded-xl p-4 text-center">
                    <XCircle className="mx-auto text-red-600 mb-2" size={28} />
                    <p className="text-sm text-red-800 font-arabic">حالات الغياب غير المعتذر عنها</p>
                    <p className="text-2xl font-black text-red-700 mt-1">
                      {currentChild?.attendance?.absent || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
          )}

        </div>
      )}

      {/* LINK CHILD MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 font-arabic">
                <UserPlus className="text-emerald-600" size={20} />
                <span>ربط حساب طالب بولي الأمر</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4 font-arabic">
              اطلب كود ربط ولي الأمر من حساب الطالب ثم أدخله هنا. يمكنك تكرار العملية لأي عدد من الأبناء، وكل ابن له كود مستقل:
            </p>

            <form onSubmit={handleLinkChild} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  كود ربط الطالب
                </label>
                <input
                  type="text"
                  placeholder="مثال: WN-7F3A91C2"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  صلة القرابة
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="father">أب</option>
                  <option value="mother">أم</option>
                  <option value="guardian">ولي أمر / وصي</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={linking}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50"
                >
                  {linking ? 'جاري الربط...' : 'تأكيد الربط'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="py-2.5 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RSVP EXCUSE MODAL */}
      {excuseModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 font-arabic text-red-600">
                <AlertCircle size={20} />
                <span>الاعتذار عن حضور حلقة القرآن</span>
              </h3>
              <button
                type="button"
                onClick={() => setExcuseModalSession(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
              {excuseModalSession.canExcuseWithCompensation ? (
                <p>
                  ✅ تم تقديم الاعتذار قبل الموعد بأكثر من 6 ساعات ({excuseModalSession.hoursUntilSession} ساعة متبقية). 
                  <strong> يحق لك الحصول على حصة تعويضية مجانية!</strong>
                </p>
              ) : (
                <p>
                  ⚠️ تبقى أقل من 6 ساعات على موعد الحصة. وفقاً للائحة الأكاديمية لا يمكن ضمان حصة تعويضية في حال الاعتذار المتأخر.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  سبب الاعتذار (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={excuseReason}
                  onChange={(e) => setExcuseReason(e.target.value)}
                  placeholder="مثال: ظرف طارئ، مرض، اختبارات مدرسية..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleRsvp(excuseModalSession._id, 'excused', excuseReason, excuseModalSession.child?.id || excuseModalSession.childId || selectedChildId)}
                  disabled={submittingRsvp}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50"
                >
                  {submittingRsvp ? 'جاري التسجيل...' : 'تأكيد الاعتذار'}
                </button>
                <button
                  type="button"
                  onClick={() => setExcuseModalSession(null)}
                  className="py-2.5 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

