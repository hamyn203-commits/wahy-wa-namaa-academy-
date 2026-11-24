import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, BookOpen, Award, FileText, CalendarCheck,
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, MessageCircle,
  ShieldCheck, UserPlus, Sparkles, Check, ChevronLeft, ChevronRight,
  ArrowLeft, ArrowRight, Share2, CreditCard, Wallet, RefreshCw,
  Loader2, Star, Flame,
} from 'lucide-react';
import DashboardLayout, { TabBar } from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';
import GuardianOverviewCenter from './GuardianOverviewCenter';
import { LinkChildModal, RsvpExcuseModal } from './GuardianModals';
import Skeleton from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';

function formatMsg(template, vars = {}) {
  let out = String(template || '');
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(val ?? ''));
  }
  return out;
}

function relationshipLabel(value, gp = {}) {
  const labels = gp.relationships || {};
  const defaults = { father: 'ابن / ابنة', mother: 'ابن / ابنة', guardian: 'تحت الرعاية', other: 'تحت الرعاية' };
  return labels[value] || defaults[value] || labels.father || defaults.father;
}

function taskStatusLabel(status, gp = {}) {
  const labels = gp.taskStatuses || {};
  const defaults = { pending: 'مطلوب', submitted: 'تم التسليم — قيد التصحيح', done: 'تم الاعتماد' };
  return labels[status] || defaults[status] || status;
}

function invitationRelationshipLabel(value, gp = {}) {
  const inv = gp.invitations || {};
  const map = {
    father: inv.relFather || 'طلب ربط كأب',
    mother: inv.relMother || 'طلب ربط كأم',
    guardian: inv.relGuardian || 'طلب ربط كولي أمر',
    other: inv.relOther || 'طلب ربط',
  };
  return map[value] || map.other;
}

const SUBSCRIPTION_STATUS_STYLES = {
  active: { defaultLabel: 'نشط', cls: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]' },
  placed: { defaultLabel: 'مُسكّن بالحلقة', cls: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]' },
  awaiting_placement: { defaultLabel: 'بانتظار التسكين', cls: 'bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)] border-[var(--wn-border-mint)]' },
  pending_payment: { defaultLabel: 'بانتظار السداد', cls: 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border-[var(--wn-border-strong)]' },
  payment_review: { defaultLabel: 'قيد مراجعة التحويل', cls: 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border-[var(--wn-border-strong)]' },
  renewal_queued: { defaultLabel: 'في طابور التجديد', cls: 'bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)] border-[var(--wn-border-mint)]' },
  paused: { defaultLabel: 'موقوف مؤقتاً', cls: 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]' },
  completed: { defaultLabel: 'مكتمل', cls: 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]' },
  expired: { defaultLabel: 'منتهي الصلاحية', cls: 'bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-[var(--wn-danger)]/30' },
  cancelled: { defaultLabel: 'ملغي', cls: 'bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-[var(--wn-danger)]/30' },
};

const DEFAULT_PLAN_LABELS = {
  community: 'حلقة عامة (تاريخية)',
  group: 'حلقة مجموعات (تاريخية)',
  focused: 'الحلقة الجماعية المركّزة (3–5 طلاب • 45 دقيقة)',
  mini: 'حلقة الإخوة والثنائية (2–3 طلاب • 45 دقيقة)',
  private: 'الباقة الفردية المركّزة (1-on-1 • 30 دقيقة)',
  private_intensive: 'الفردية المكثّفة والإجازة (1-on-1 • 60 دقيقة)',
};

export default function GuardianDashboard() {
  const { user, ready, logout } = useRequireAuth(['guardian']);
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const gp = t?.guardianPortal || {};
  const intlLocale = resolveIntlLocale(locale);

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
  const [respondingInvitation, setRespondingInvitation] = useState({ id: '', action: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [childrenLoadFailed, setChildrenLoadFailed] = useState(false);
  const [reportsError, setReportsError] = useState(false);
  const [homeworkError, setHomeworkError] = useState(false);
  const [tab, setTab] = useState('overview');

  // Link Child Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [relationship, setRelationship] = useState('father');
  const [linking, setLinking] = useState(false);

  // RSVP Excuse Modal State
  const [excuseModalSession, setExcuseModalSession] = useState(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [rsvpPendingKey, setRsvpPendingKey] = useState('');

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const invitationLockRef = useRef('');
  const linkingLockRef = useRef(false);
  const rsvpLockRef = useRef(false);

  const shareReportViaWhatsApp = async (rep, childName) => {
    const ws = gp.whatsappShare || {};
    const endOfSurahText = ws.endOfSurah || 'آخر السورة';
    const studentFallback = ws.studentFallback || 'المجتهد';
    const resolvedChildName = childName || studentFallback;

    const text =
      `🌸 *${ws.header || 'تقرير إنجاز الطالب في حلقة القرآن الكريم'}* 🌸\n` +
      `🏛️ *${ws.academy || 'أكاديمية وَحْيٌ وَنَمَاء للقرآن الكريم'}*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 *${formatMsg(ws.studentLine || 'الطالب: {name}', { name: resolvedChildName })}*\n` +
      (rep.surahRecited
        ? `📖 *${formatMsg(ws.surahLine || 'السورة والمقدار: سورة {surah} (الآيات {from} - {to})', {
            surah: rep.surahRecited,
            from: rep.fromAyah || 1,
            to: rep.toAyah || endOfSurahText,
          })}*\n`
        : '') +
      `⭐ *${formatMsg(ws.memLine || 'درجة الحفظ: {score}/10', { score: rep.memorizationScore ?? 10 })}*\n` +
      `✨ *${formatMsg(ws.tajLine || 'درجة التجويد: {score}/10', { score: rep.tajweedScore ?? 10 })}*\n` +
      (rep.nextHomework ? `📝 *${formatMsg(ws.homeworkLine || 'الواجب القادم: {homework}', { homework: rep.nextHomework })}*\n` : '') +
      (rep.notes ? `💬 *${formatMsg(ws.notesLine || 'ملاحظات المعلم: {notes}', { notes: rep.notes })}*\n` : '') +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌱 *${ws.footer || 'نتعلم القرآن، نحفظه، وننمو به.'}*`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: formatMsg(ws.shareTitle || 'تقرير إنجاز {name} - أكاديمية وَحْيٌ وَنَمَاء', {
            name: childName || gp.reports?.studentFallback || 'الطالب',
          }),
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

  // Fetch the family summary once. Child switching is local and must not
  // refetch the whole dashboard for every sibling selection.
  const loadDashboardData = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setLoadError(false);
    setChildrenLoadFailed(false);

    try {
      const results = await Promise.allSettled([
        api.get('/api/guardian/children', { auth: true }),
        api.get('/api/guardian/family-overview', { auth: true }),
        api.get('/api/guardian/upcoming-sessions', { auth: true }),
        api.get('/api/guardian/invitations', { auth: true }),
      ]);

      const [childrenResult, familyResult, sessionsResult, invitationsResult] = results;
      const anyFailed = results.some((r) => r.status === 'rejected');
      const kidsFailed = childrenResult.status === 'rejected';

      if (kidsFailed) {
        setChildrenLoadFailed(true);
      }

      if (anyFailed) {
        setLoadError(true);
        toast.error(
          tRef.current?.guardianPortal?.errors?.loadFailed
            || tRef.current?.guardianPortal?.toasts?.loadFailed
            || 'حدث خطأ أثناء تحميل بيانات لوحة ولي الأمر'
        );
      }

      if (!kidsFailed) {
        const kidsList = childrenResult.value?.children || [];
        setChildren(kidsList);
        setSelectedChildId((current) => {
          if (!kidsList.length) return 'family';
          if (current && current !== 'family' && kidsList.some((child) => String(child.studentId) === String(current))) {
            return current;
          }
          return kidsList.length > 1 ? 'family' : String(kidsList[0].studentId);
        });

        if (familyResult.status === 'fulfilled') {
          const familyRes = familyResult.value || {};
          setFamilyOverview({
            summary: familyRes.summary || { totalChildren: kidsList.length, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
            children: familyRes.children || [],
          });
        }
      } else if (familyResult.status === 'fulfilled') {
        const familyRes = familyResult.value || {};
        setFamilyOverview({
          summary: familyRes.summary || { totalChildren: 0, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
          children: familyRes.children || [],
        });
      }

      if (sessionsResult.status === 'fulfilled') {
        setUpcomingSessions(sessionsResult.value?.sessions || []);
      }

      if (invitationsResult.status === 'fulfilled') {
        setPendingInvitations(invitationsResult.value?.invitations || []);
        setInvitationMessage(invitationsResult.value?.message || '');
      }
    } catch (err) {
      console.error('Failed to load guardian dashboard:', err);
      setLoadError(true);
      setChildrenLoadFailed(true);
      toast.error(
        tRef.current?.guardianPortal?.toasts?.loadFailed
          || 'حدث خطأ أثناء تحميل بيانات لوحة ولي الأمر'
      );
    } finally {
      setLoading(false);
    }
  }, [ready, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const fetchChildReports = useCallback(async (childId) => {
    if (!ready || !childId || childId === 'family') return;
    setReportsError(false);
    try {
      const res = await api.get(`/api/guardian/reports/${childId}`, { auth: true });
      setReports(res.reports || []);
    } catch {
      setReports([]);
      setReportsError(true);
    }
  }, [ready]);

  const fetchChildHomework = useCallback(async (childId) => {
    if (!ready || !childId || childId === 'family') return;
    setHomeworkError(false);
    try {
      const res = await api.get(`/api/guardian/homework/${childId}`, { auth: true });
      setHomeworkTasks(res.tasks || []);
    } catch {
      setHomeworkTasks([]);
      setHomeworkError(true);
    }
  }, [ready]);

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
          fetchChildHomework(selectedChildId);
        }
      }

      if (type === 'system') {
        loadDashboardData();
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);
    return () => window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
  }, [ready, syncUpcomingSessions, refreshFamilyOverview, selectedChildId, loadDashboardData, fetchChildHomework]);

  // Fetch only the selected child's private data. Family mode never mixes
  // reports or homework between siblings.
  useEffect(() => {
    if (!ready || !selectedChildId || selectedChildId === 'family') {
      setReports([]);
      setHomeworkTasks([]);
      setReportsError(false);
      setHomeworkError(false);
      return undefined;
    }

    let active = true;
    setReportsError(false);
    setHomeworkError(false);

    api.get(`/api/guardian/reports/${selectedChildId}`, { auth: true })
      .then((res) => {
        if (active) setReports(res.reports || []);
      })
      .catch(() => {
        if (active) {
          setReports([]);
          setReportsError(true);
        }
      });

    api.get(`/api/guardian/homework/${selectedChildId}`, { auth: true })
      .then((res) => {
        if (active) setHomeworkTasks(res.tasks || []);
      })
      .catch(() => {
        if (active) {
          setHomeworkTasks([]);
          setHomeworkError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [ready, selectedChildId]);

  const respondToInvitation = async (invitationId, action) => {
    if (!invitationId || invitationLockRef.current) return;
    invitationLockRef.current = invitationId;
    setRespondingInvitation({ id: invitationId, action });
    try {
      await api.post(`/api/guardian/invitations/${invitationId}/respond`, { action }, { auth: true });
      const toasts = tRef.current?.guardianPortal?.toasts || {};
      toast.success(
        action === 'accept'
          ? (toasts.inviteAccepted || 'تم ربط الابن بحسابك')
          : (toasts.inviteRejected || 'تم رفض طلب الربط')
      );
      await loadDashboardData();
    } catch (error) {
      const toasts = tRef.current?.guardianPortal?.toasts || {};
      toast.error(error.message || toasts.inviteFailed || 'تعذر تحديث طلب الربط');
    } finally {
      invitationLockRef.current = '';
      setRespondingInvitation({ id: '', action: '' });
    }
  };

  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (linkingLockRef.current || linking) return;

    const validation = tRef.current?.guardianPortal?.validation || {};
    const toasts = tRef.current?.guardianPortal?.toasts || {};

    if (!linkInput.trim()) {
      const msg = validation.linkCodeRequired || toasts.linkCodeRequired || 'يرجى إدخال كود ربط الطالب';
      setLinkError(msg);
      toast.error(msg);
      return;
    }

    setLinkError('');
    linkingLockRef.current = true;
    setLinking(true);
    try {
      const payload = {
        relationship,
        studentCode: linkInput.trim(),
      };

      const res = await api.post('/api/guardian/link-child', payload, { auth: true });
      toast.success(res.message || toasts.linkSuccess || 'تم ربط الطالب بنجاح!');
      setShowLinkModal(false);
      setLinkInput('');
      setLinkError('');
      await loadDashboardData();
    } catch (err) {
      const msg = err.message || toasts.linkFailed || 'فشل ربط الطالب، تأكد من صحة كود الربط';
      setLinkError(msg);
      toast.error(msg);
    } finally {
      linkingLockRef.current = false;
      setLinking(false);
    }
  };

  const handleRsvp = async (sessionId, status, reason = '', targetStudentId = null) => {
    if (rsvpLockRef.current || submittingRsvp) return;
    const studentIdToUse = targetStudentId || selectedChildId;
    if (!studentIdToUse || studentIdToUse === 'family') return;

    const toasts = tRef.current?.guardianPortal?.toasts || {};
    rsvpLockRef.current = true;
    setSubmittingRsvp(true);
    setRsvpPendingKey(`${sessionId}:${studentIdToUse}`);
    try {
      const res = await api.post(`/api/sessions/${sessionId}/rsvp`, {
        studentId: studentIdToUse,
        status,
        excuseReason: reason,
      }, { auth: true });

      toast.success(
        res.message || (
          status === 'confirmed'
            ? (toasts.rsvpConfirmed || 'تم تأكيد الحضور بنجاح')
            : (toasts.rsvpExcused || 'تم تسجيل الاعتذار')
        )
      );
      setExcuseModalSession(null);
      setExcuseReason('');

      const sessionsRes = await api.get('/api/guardian/upcoming-sessions', { auth: true });
      setUpcomingSessions(sessionsRes.sessions || []);
    } catch (err) {
      toast.error(err.message || toasts.rsvpFailed || 'فشل تحديث حالة الحضور');
    } finally {
      rsvpLockRef.current = false;
      setSubmittingRsvp(false);
      setRsvpPendingKey('');
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

  const heroCopy = gp.hero || {};
  const invCopy = gp.invitations || {};
  const famCopy = gp.family || {};
  const statsCopy = gp.childStats || {};
  const subCopy = gp.subscription || {};
  const sessCopy = gp.sessions || {};
  const evalCopy = gp.latestEvaluation || {};
  const hwCopy = gp.homework || {};
  const repCopy = gp.reports || {};
  const polCopy = gp.attendancePolicy || {};
  const permCopy = gp.permissionsCard || {};
  const errCopy = gp.errors || {};
  const studentInitialFallback = (invCopy.studentFallback || 'ط').charAt(0);

  return (
    <DashboardLayout
      title={gp.dashboardTitle || 'لوحة متابعة ولي الأمر'}
      user={user}
      onLogout={logout}
    >
      {loading ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-24 space-y-4">
          <span className="sr-only">{gp.loadingText || 'جاري تحميل بيانات الأبناء وحلقات القرآن…'}</span>
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
          <p className="text-[var(--wn-text-secondary)] font-medium" aria-hidden="true">
            {gp.loadingText || 'جاري تحميل بيانات الأبناء وحلقات القرآن...'}
          </p>
        </div>
      ) : (
        <div className="wn-guardian-stage space-y-6">
          {/* Children Selector Top Bar */}
          <div className="wn-dashboard-hero-card rounded-2xl p-6 text-[var(--wn-text-inverse)] relative overflow-hidden">
            <div className="absolute -end-10 -bottom-10 w-48 h-48 bg-[var(--wn-emerald)]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="text-[var(--wn-gold)]" size={20} aria-hidden="true" />
                  <span className="text-[var(--wn-mint)] text-sm">
                    {heroCopy.eyebrow || 'بوابة أولياء الأمور'}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-[var(--wn-text-inverse)]">
                  {formatMsg(heroCopy.greeting || 'مرحبًا بك، {name}', {
                    name: user?.name || heroCopy.guardianFallback || 'ولي الأمر الكريم',
                  })}
                </h2>
                <p className="text-[var(--wn-mint)]/90 text-sm mt-1">
                  {heroCopy.subtitle || 'تابع تقدم أبنائك في حفظ القرآن الكريم وأحكام التجويد، والحصص المباشرة والتقارير الدورية'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLinkError('');
                  setShowLinkModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-[var(--wn-gold)] hover:opacity-95 text-[var(--wn-emerald-deep)] font-bold rounded-xl transition-all shadow-md active:scale-95 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-text-inverse)]"
              >
                <UserPlus size={18} aria-hidden="true" />
                <span>{heroCopy.linkChildBtn || 'ربط ابن جديد'}</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 relative z-10">
              <Link
                to={localizedPath('/free-trial', locale)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-[var(--wn-emerald-dark)]/80 hover:bg-[var(--wn-emerald)]/80 text-[var(--wn-text-inverse)] border border-[var(--wn-border-mint)]/30 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-text-inverse)]"
              >
                <Sparkles size={14} className="text-[var(--wn-gold)]" aria-hidden="true" />
                <span>{heroCopy.bookTrialChildBtn || 'حجز حصة تجريبية لابن جديد'}</span>
              </Link>
            </div>

            {/* Child Selector Pills */}
            {children.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[var(--wn-border-mint)]/25 flex flex-wrap items-center gap-3">
                <span className="text-xs text-[var(--wn-mint)] font-medium">
                  {heroCopy.registeredChildrenLabel || 'الأبناء المسجلون:'}
                </span>
                {children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedChildId('family'); setTab('overview'); }}
                    aria-pressed={isFamilyMode}
                    className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 py-1.5 rounded-full text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-text-inverse)] ${
                      isFamilyMode
                        ? 'bg-[var(--wn-btn-light-bg)] text-[var(--wn-btn-light-text)] font-bold shadow-md ring-2 ring-[var(--wn-gold)]'
                        : 'bg-[var(--wn-emerald-dark)]/85 text-[var(--wn-text-inverse)] hover:bg-[var(--wn-emerald)]'
                    }`}
                  >
                    <Users size={15} aria-hidden="true" />
                    <span>{heroCopy.allChildren || 'كل الأبناء'}</span>
                    <b className="min-w-5 h-5 px-1 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-[10px] grid place-items-center">
                      {children.length}
                    </b>
                  </button>
                )}
                {children.map((child) => {
                  const isSelected = String(child.studentId) === String(selectedChildId);
                  return (
                    <button
                      key={child.studentId}
                      type="button"
                      onClick={() => { setSelectedChildId(String(child.studentId)); setTab('overview'); }}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 py-1.5 rounded-full text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-text-inverse)] ${
                        isSelected
                          ? 'bg-[var(--wn-btn-light-bg)] text-[var(--wn-btn-light-text)] font-bold shadow-md ring-2 ring-[var(--wn-gold)]'
                          : 'bg-[var(--wn-emerald-dark)]/85 text-[var(--wn-text-inverse)] hover:bg-[var(--wn-emerald)]'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] flex items-center justify-center text-xs font-bold shrink-0">
                        {child.name?.charAt(0) || studentInitialFallback}
                      </span>
                      <span>{child.name}</span>
                      {child.circle && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
                          {child.circle.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load Error Banner with Retry (never mask network failures as empty states) */}
          {loadError && !childrenLoadFailed && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-4 text-[var(--wn-text-danger)]"
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{errCopy.loadFailed || 'حدث خطأ أثناء تحميل بيانات لوحة ولي الأمر'}</span>
              </div>
              <button
                type="button"
                onClick={loadDashboardData}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-heading)] text-xs font-bold hover:bg-[var(--wn-surface-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>{errCopy.retry || 'إعادة المحاولة'}</span>
              </button>
            </div>
          )}

          {pendingInvitations.length > 0 && (
            <section className="wn-guardian-invitations">
              <div className="wn-guardian-invitations__heading">
                <div>
                  <span>{invCopy.eyebrow || 'طلبات ربط جديدة'}</span>
                  <h3>{invCopy.title || 'أبناء استخدموا رقمك كولي أمر'}</h3>
                  <p>{invCopy.subtitle || 'راجع الاسم ثم وافق أو ارفض. لن تظهر بيانات الطالب الكاملة قبل الموافقة.'}</p>
                </div>
                <b>{pendingInvitations.length}</b>
              </div>

              <div className="wn-guardian-invitations__list">
                {pendingInvitations.map((invitation) => {
                  const isBusy = respondingInvitation.id === invitation._id;
                  const isAccepting = isBusy && respondingInvitation.action === 'accept';
                  const isRejecting = isBusy && respondingInvitation.action === 'reject';

                  return (
                    <article key={invitation._id}>
                      <span className="wn-guardian-child-avatar">
                        {invitation.student?.name?.charAt(0) || studentInitialFallback}
                      </span>
                      <div>
                        <span>{invitationRelationshipLabel(invitation.relationship, gp)}</span>
                        <h4>{invitation.student?.name || invCopy.studentFallback || 'طالب'}</h4>
                        <small>
                          {formatMsg(invCopy.phoneMatchLabel || 'الرقم المطابق: {phone}', {
                            phone: invitation.phoneMasked || '—',
                          })}
                        </small>
                      </div>
                      <div className="wn-guardian-invitations__actions">
                        <button
                          type="button"
                          onClick={() => respondToInvitation(invitation._id, 'accept')}
                          disabled={isBusy}
                          className="is-accept min-h-[44px]"
                        >
                          {isAccepting ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Check size={15} aria-hidden="true" />
                          )}
                          <span>{invCopy.acceptBtn || 'تأكيد'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToInvitation(invitation._id, 'reject')}
                          disabled={isBusy}
                          className="is-reject min-h-[44px]"
                        >
                          {isRejecting ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <XCircle size={15} aria-hidden="true" />
                          )}
                          <span>{invCopy.rejectBtn || 'رفض'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {!pendingInvitations.length && invitationMessage && (
            <div className="wn-guardian-invitation-note">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>{invitationMessage}</span>
            </div>
          )}

          {/* Family command center, selected child metrics, error state, or empty state */}
          {childrenLoadFailed && children.length === 0 ? (
            <div
              role="alert"
              className="rounded-2xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center"
            >
              <AlertCircle className="mx-auto text-[var(--wn-text-danger)] mb-2" size={36} aria-hidden="true" />
              <h3 className="font-bold text-[var(--wn-heading)] text-lg">
                {errCopy.loadFailed || 'حدث خطأ أثناء تحميل بيانات لوحة ولي الأمر'}
              </h3>
              <button
                type="button"
                onClick={loadDashboardData}
                className="mt-4 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-xl font-bold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{errCopy.retry || 'إعادة المحاولة'}</span>
              </button>
            </div>
          ) : isFamilyMode && children.length > 0 ? (
            <div className="wn-guardian-family-hub">
              <div className="wn-guardian-family-summary">
                <div>
                  <span>{famCopy.totalChildren || 'نظرة عامة'}</span>
                  <strong>{familyOverview.summary?.totalChildren || children.length}</strong>
                  <small>{famCopy.totalChildrenSub || 'أبناء مرتبطون'}</small>
                </div>
                <div>
                  <span>{famCopy.upcomingSessions || 'الحصص القادمة'}</span>
                  <strong>{familyOverview.summary?.upcomingSessions || 0}</strong>
                  <small>{famCopy.upcomingSessionsSub || 'لكل الأبناء'}</small>
                </div>
                <div>
                  <span>{famCopy.pendingHomework || 'واجبات معلقة'}</span>
                  <strong>{familyOverview.summary?.pendingHomework || 0}</strong>
                  <small>{famCopy.pendingHomeworkSub || 'تحتاج متابعة'}</small>
                </div>
                <div className={(familyOverview.summary?.needsAttention || 0) > 0 ? 'is-alert' : ''}>
                  <span>{famCopy.needsAttention || 'تحتاج انتباهك'}</span>
                  <strong>{familyOverview.summary?.needsAttention || 0}</strong>
                  <small>{famCopy.needsAttentionSub || 'طلبات أو واجبات'}</small>
                </div>
              </div>

              {children.length > 1 && (
                <section className="mb-4 rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[var(--wn-text-accent)]">
                        {famCopy.comparisonEyebrow || 'مقارنة شاملة'}
                      </span>
                      <h3 className="text-base font-black text-[var(--wn-heading)]">
                        {famCopy.comparisonTitle || 'مقارنة تقدم الأبناء'}
                      </h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm">
                      <thead>
                        <tr className="border-b border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-tertiary)]">
                          <th className="py-2.5 px-3">{famCopy.colChild || 'الابن / الابنة'}</th>
                          <th className="py-2.5 px-3">{famCopy.colAttendance || 'نسبة الحضور'}</th>
                          <th className="py-2.5 px-3">{famCopy.colLastEval || 'آخر تقييم حفظ'}</th>
                          <th className="py-2.5 px-3">{famCopy.colHomework || 'الواجبات المعلقة'}</th>
                          <th className="py-2.5 px-3">{famCopy.colPoints || 'النقاط'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--wn-border)]">
                        {children.map((child) => {
                          const familyChild = familyChildById.get(String(child.studentId)) || {};
                          const attRate = child.attendance?.rate;
                          const memScore = familyChild.latestReport?.memorizationScore;
                          return (
                            <tr key={child.studentId} className="hover:bg-[var(--wn-surface-mint)]/50 transition-colors">
                              <td className="py-3 px-3 font-bold text-[var(--wn-heading)]">{child.name}</td>
                              <td className="py-3 px-3">
                                {attRate != null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--wn-surface-sunken)]">
                                      <div
                                        className="h-full rounded-full bg-[var(--wn-emerald)]"
                                        style={{ width: `${Math.min(100, Number(attRate))}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">{attRate}%</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-3 font-bold text-[var(--wn-badge-emerald-text)]">
                                {memScore != null ? `${memScore}/10` : '—'}
                              </td>
                              <td className="py-3 px-3 text-[var(--wn-text-primary)]">{familyChild.pendingHomework ?? 0}</td>
                              <td className="py-3 px-3 font-bold text-[var(--wn-text-gold)]">
                                <span className="inline-flex items-center gap-1">
                                  {child.studentProfile?.points || 0}
                                  <Star size={14} className="text-[var(--wn-gold)]" fill="currentColor" aria-hidden="true" />
                                </span>
                              </td>
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
                        <span className="wn-guardian-child-avatar">
                          {child.name?.charAt(0) || studentInitialFallback}
                        </span>
                        <div>
                          <strong>{child.name}</strong>
                          <small>{relationshipLabel(child.relationship, gp)}</small>
                        </div>
                        {(familyChild.attentionCount || 0) > 0 ? <b>{familyChild.attentionCount}</b> : null}
                      </div>

                      <div className="wn-guardian-child-card__metrics">
                        <div>
                          <span>{famCopy.nextSessionMetric || 'الحصة القادمة'}</span>
                          <strong>
                            {next
                              ? new Date(next.scheduledAt).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })
                              : '—'}
                          </strong>
                        </div>
                        <div>
                          <span>{famCopy.pendingHomeworkMetric || 'واجبات معلقة'}</span>
                          <strong>{familyChild.pendingHomework ?? '—'}</strong>
                        </div>
                        <div>
                          <span>{famCopy.lastMemorizationMetric || 'آخر حفظ'}</span>
                          <strong>
                            {familyChild.latestReport?.memorizationScore != null
                              ? `${familyChild.latestReport.memorizationScore}/10`
                              : '—'}
                          </strong>
                        </div>
                      </div>

                      {next ? (
                        <div className="wn-guardian-child-card__next">
                          <Clock size={14} aria-hidden="true" />
                          <span>
                            {new Date(next.scheduledAt).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })} · {next.teacherName}
                          </span>
                        </div>
                      ) : (
                        <div className="wn-guardian-child-card__next is-empty">
                          <CalendarCheck size={14} aria-hidden="true" />
                          <span>{famCopy.noUpcomingChild || 'لا توجد حصة قادمة'}</span>
                        </div>
                      )}

                      <span className="wn-guardian-child-card__open">
                        <span>{formatMsg(famCopy.openChildCta || 'فتح متابعة {name}', { name: child.name })}</span>
                        {isRTL ? <ChevronLeft size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : currentChild ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] flex items-center justify-center shrink-0">
                  <TrendingUp size={24} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {statsCopy.attendanceRate || 'نسبة الحضور'}
                  </p>
                  <p className="text-xl font-bold text-[var(--wn-heading)]">
                    {currentChild.attendance?.rate != null ? `${currentChild.attendance.rate}%` : '—'}
                  </p>
                  <span className="text-[11px] text-[var(--wn-badge-emerald-text)] font-medium">
                    {formatMsg(statsCopy.attendanceOfTotal || '{attended} من {total} حصة', {
                      attended: currentChild.attendance?.attended || 0,
                      total: currentChild.attendance?.total || 0,
                    })}
                  </span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] flex items-center justify-center shrink-0">
                  <Award size={24} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {statsCopy.pointsAndBadges || 'نقاط التحفيز والأوسمة'}
                  </p>
                  <p className="text-xl font-bold text-[var(--wn-heading)]">
                    {currentChild.studentProfile?.points || 0}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--wn-text-gold)] font-medium">
                    <Flame size={13} aria-hidden="true" />
                    <span>
                      {formatMsg(statsCopy.streakDays || '{days} أيام متتالية', {
                        days: currentChild.studentProfile?.streak || 0,
                      })}
                    </span>
                  </span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)] flex items-center justify-center shrink-0">
                  <BookOpen size={24} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {statsCopy.learningTrack || 'المسار التعليمي'}
                  </p>
                  <p className="text-sm font-bold text-[var(--wn-heading)] truncate">
                    {currentChild.studentProfile?.plan || statsCopy.unspecified || 'غير محدد'}
                  </p>
                  <span className="text-[11px] text-[var(--wn-teal-dark)] font-medium">
                    {formatMsg(statsCopy.levelPrefix || 'المستوى: {level}', {
                      level: currentChild.studentProfile?.level || statsCopy.unspecified || 'غير محدد',
                    })}
                  </span>
                </div>
              </div>

              <div className="wn-dashboard-mini-card rounded-xl p-4 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-text-accent)] flex items-center justify-center shrink-0">
                  <Sparkles size={24} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {statsCopy.currentSurah || 'السورة الحالية'}
                  </p>
                  <p className="text-sm font-bold text-[var(--wn-heading)] truncate">
                    {currentChild.studentProfile?.currentSurah || statsCopy.unspecifiedSurah || 'غير محددة'}
                  </p>
                  <span className="text-[11px] text-[var(--wn-text-accent)] font-medium">
                    {currentChild.circle ? currentChild.circle.name : (statsCopy.noCircleYet || 'لم تُحدد حلقة بعد')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={heroCopy.noChildrenTitle || 'لم يتم ربط أي طالب بحسابك بعد'}
              description={heroCopy.noChildrenDesc || 'اضغط على زر "ربط ابن جديد" وأدخل كود الطالب للبدء بمتابعة دراسته، أو احجز حصة تجريبية مجانية لابن جديد.'}
              action={(
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to={localizedPath('/free-trial', locale)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-[var(--wn-surface)] border border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)] rounded-xl font-bold text-xs hover:bg-[var(--wn-surface-mint)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    <span>{heroCopy.bookTrialChildBtn || 'حجز حصة تجريبية لابن جديد'}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkError('');
                      setShowLinkModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-xl font-bold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <UserPlus size={16} aria-hidden="true" />
                    <span>{heroCopy.linkNowBtn || 'ربط الطالب الآن'}</span>
                  </button>
                </div>
              )}
            />
          )}

          {currentChild && (
            <GuardianOverviewCenter child={currentChild} nextSession={nextChildSession} />
          )}

          {/* Child-specific navigation */}
          {currentChild && (
            <div className="wn-dashboard-surface">
              <TabBar
                ariaLabel={gp.tabs?.ariaLabel || 'أقسام متابعة الطالب'}
                tabs={[
                  {
                    id: 'overview',
                    label: gp.tabs?.overview || 'الحصص والمتابعة',
                    tabId: 'guardian-tab-overview',
                    panelId: 'guardian-panel-overview',
                  },
                  {
                    id: 'homework',
                    label: gp.tabs?.homework || 'الواجبات',
                    tabId: 'guardian-tab-homework',
                    panelId: 'guardian-panel-homework',
                  },
                  {
                    id: 'reports',
                    label: gp.tabs?.reports || 'تقارير الحفظ والتجويد',
                    tabId: 'guardian-tab-reports',
                    panelId: 'guardian-panel-reports',
                  },
                  {
                    id: 'attendance',
                    label: gp.tabs?.attendance || 'الحضور والصلاحيات',
                    tabId: 'guardian-tab-attendance',
                    panelId: 'guardian-panel-attendance',
                  },
                ]}
                active={tab}
                onChange={setTab}
              />

              {/* TAB 1: OVERVIEW & UPCOMING SESSIONS */}
              {tab === 'overview' && (
                <div
                  role="tabpanel"
                  id="guardian-panel-overview"
                  aria-labelledby="guardian-tab-overview"
                  className="space-y-6 mt-4"
                >
                  {/* Student Subscription & Session Balance Card */}
                  {(() => {
                    const childSub = currentChild?.subscription;
                    const sessionsRemaining = childSub?.sessionsRemaining ?? 0;
                    const sessionsUsed = childSub?.sessionsUsed ?? 0;
                    const totalSessionsCount = childSub?.sessionCount ?? (sessionsRemaining + sessionsUsed || 8);
                    const isLowBalance = childSub ? (sessionsRemaining <= 2 && childSub.status !== 'completed') : true;

                    const statusStyle = childSub?.status ? SUBSCRIPTION_STATUS_STYLES[childSub.status] : null;
                    const statusLabelText = childSub?.status
                      ? (gp.subscriptionStatuses?.[childSub.status] || statusStyle?.defaultLabel || childSub.status)
                      : (childSub
                          ? (subCopy.inProgressStatus || 'قيد المتابعة')
                          : (subCopy.noActiveStatus || 'لا يوجد اشتراك نشط'));
                    const statusClass = statusStyle?.cls
                      || 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]';

                    const planName = (childSub?.planKey && (gp.planLabels?.[childSub.planKey] || DEFAULT_PLAN_LABELS[childSub.planKey]))
                      || currentChild?.studentProfile?.plan
                      || subCopy.defaultPlanName
                      || 'حلقات القرآن الكريم';

                    return (
                      <div className="rounded-2xl border border-[var(--wn-border-mint)] bg-gradient-to-r from-[var(--wn-surface-mint)] via-[var(--wn-surface)] to-[var(--wn-surface-soft)] p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] flex items-center justify-center shrink-0 shadow-sm">
                              <CreditCard size={24} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-[var(--wn-heading)] text-base">
                                  {formatMsg(subCopy.title || 'اشتراك وحصص الطالب {name}', {
                                    name: currentChild?.name || '',
                                  })}
                                </h4>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusClass}`}>
                                  {statusLabelText}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                                {subCopy.planPrefix || 'الباقة:'}{' '}
                                <strong className="text-[var(--wn-heading)]">{planName}</strong>
                                {currentChild?.circle ? ` · ${currentChild.circle.name}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center flex-wrap gap-2">
                            <Link
                              to={localizedPath(`/plans?student=${currentChild?.studentId}${childSub && ['active', 'completed'].includes(childSub.status) ? `&renew=${childSub._id}` : ''}`, locale)}
                              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-xl text-sm font-bold transition shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                            >
                              <RefreshCw size={15} aria-hidden="true" />
                              <span>{subCopy.renewBtn || 'تجديد أو شحن الحصص'}</span>
                            </Link>
                            <Link
                              to={childSub?._id && ['pending_payment', 'payment_review'].includes(childSub.status)
                                ? localizedPath(`/payment/manual?student=${currentChild?.studentId}&subscription=${childSub._id}`, locale)
                                : localizedPath(`/plans?student=${currentChild?.studentId}`, locale)}
                              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 text-[var(--wn-badge-emerald-text)] bg-[var(--wn-emerald-soft)] hover:bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                            >
                              <Wallet size={14} aria-hidden="true" />
                              <span>
                                {childSub?._id && ['pending_payment', 'payment_review'].includes(childSub.status)
                                  ? (subCopy.completePaymentBtn || 'إتمام سداد الاشتراك المختار')
                                  : (subCopy.bankTransferBtn || 'التحويل البنكي المباشر')}
                              </span>
                            </Link>
                          </div>
                        </div>

                        {/* Balance breakdown */}
                        <div className="mt-4 pt-4 border-t border-[var(--wn-border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-[var(--wn-surface)] rounded-xl p-3 border border-[var(--wn-border)]">
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] block">
                              {subCopy.remainingLabel || 'الحصص المتبقية'}
                            </span>
                            <span className="text-2xl font-black text-[var(--wn-badge-emerald-text)]">{sessionsRemaining}</span>
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] ms-1">
                              {subCopy.sessionUnit || 'حصة'}
                            </span>
                          </div>
                          <div className="bg-[var(--wn-surface)] rounded-xl p-3 border border-[var(--wn-border)]">
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] block">
                              {subCopy.usedLabel || 'الحصص المستهلكة'}
                            </span>
                            <span className="text-2xl font-black text-[var(--wn-heading)]">{sessionsUsed}</span>
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] ms-1">
                              {subCopy.sessionUnit || 'حصة'}
                            </span>
                          </div>
                          <div className="bg-[var(--wn-surface)] rounded-xl p-3 border border-[var(--wn-border)]">
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] block">
                              {subCopy.totalLabel || 'إجمالي باقة الاشتراك'}
                            </span>
                            <span className="text-2xl font-black text-[var(--wn-text-primary)]">{totalSessionsCount}</span>
                            <span className="text-[11px] text-[var(--wn-text-tertiary)] ms-1">
                              {subCopy.sessionUnit || 'حصة'}
                            </span>
                          </div>
                        </div>

                        {/* Low balance alert */}
                        {isLowBalance && (
                          <div className="mt-3 flex items-center gap-2 p-2.5 bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] rounded-xl text-xs text-[var(--wn-text-gold)]">
                            <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                            <span>
                              {sessionsRemaining === 0
                                ? (subCopy.lowBalanceZero || 'رصيد الحصص نفد بالكامل. يرجى التجديد وشحن الحصص لاستمرار الحلقات دون انقطاع.')
                                : formatMsg(
                                    subCopy.lowBalanceSoon || 'رصيد الحصص قارب على الانتهاء ({count} حصة متبقية). يرجى التجديد لضمان حجز المواعيد القادمة.',
                                    { count: sessionsRemaining }
                                  )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Upcoming Quran Sessions Section */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h3 className="text-lg font-bold text-[var(--wn-heading)] flex items-center gap-2">
                        <Calendar className="text-[var(--wn-text-accent)] shrink-0" size={20} aria-hidden="true" />
                        <span>{sessCopy.heading || 'الحصص والحلقات القادمة وتأكيد الحضور (RSVP)'}</span>
                      </h3>
                      <span className="text-xs text-[var(--wn-text-tertiary)]">
                        {sessCopy.policyReminder || '* تذكير: يمكنك الاعتذار قبل 6 ساعات على الأقل للحصول على حصة تعويضية'}
                      </span>
                    </div>

                    {selectedChildSessions.length === 0 ? (
                      <EmptyState
                        icon={CalendarCheck}
                        title={sessCopy.emptyTitle || 'لا توجد حصص قادمة مجدولة حاليًا'}
                        description={sessCopy.emptyDesc || 'سيتم إشعارك فور إدراج الحصة القادمة في الجدول.'}
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedChildSessions.map((session) => {
                          const dateObj = new Date(session.scheduledAt);
                          const rsvpVal = typeof session.rsvp === 'object' ? session.rsvp?.status : session.rsvp;
                          const isConfirmed = rsvpVal === 'confirmed';
                          const isExcused = rsvpVal === 'excused';
                          const sessionChildId = session.child?.id || session.childId || selectedChildId;
                          const pendingKey = `${session._id}:${sessionChildId}`;
                          const isConfirmingThis = submittingRsvp && rsvpPendingKey === pendingKey;

                          const rawMeetingLink = session.meetingLink || session.meetingUrl;
                          const liveRoomTo = typeof rawMeetingLink === 'string' && rawMeetingLink.startsWith('/live/')
                            ? localizedPath(rawMeetingLink, locale)
                            : typeof rawMeetingLink === 'string' && rawMeetingLink.trim()
                              ? localizedPath(`/live/${session.roomId || rawMeetingLink}`, locale)
                              : null;

                          return (
                            <div
                              key={session.instanceKey || `${session._id}:${sessionChildId}`}
                              className="border border-[var(--wn-border-mint)] rounded-xl p-5 bg-[var(--wn-surface)] shadow-sm hover:shadow-md transition"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                <div>
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] mb-1">
                                    {session.circleName}
                                  </span>
                                  <h4 className="font-bold text-[var(--wn-heading)] text-base">
                                    {formatMsg(sessCopy.studentPrefix || 'حلقة الطالب: {name}', {
                                      name: session.child?.name || currentChild?.name || sessCopy.studentFallback || 'الطالب',
                                    })}
                                  </h4>
                                </div>

                                {isConfirmed && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--wn-badge-emerald-text)] bg-[var(--wn-emerald-soft)] px-2.5 py-1 rounded-md">
                                    <Check size={14} aria-hidden="true" />
                                    <span>{sessCopy.confirmedBadge || 'مؤكد الحضور'}</span>
                                  </span>
                                )}
                                {isExcused && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--wn-text-gold)] bg-[var(--wn-gold-soft)] px-2.5 py-1 rounded-md">
                                    <AlertCircle size={14} aria-hidden="true" />
                                    <span>{sessCopy.excusedBadge || 'معتذر (مستحق للتعويض)'}</span>
                                  </span>
                                )}
                              </div>

                              <div className="space-y-2 text-sm text-[var(--wn-text-secondary)] mb-4 bg-[var(--wn-surface-soft)] p-3 rounded-lg border border-[var(--wn-border)]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Clock size={16} className="text-[var(--wn-text-accent)] shrink-0" aria-hidden="true" />
                                  <span>
                                    {dateObj.toLocaleDateString(intlLocale, {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })}
                                  </span>
                                  <span className="font-bold text-[var(--wn-heading)] ms-2">
                                    {formatMsg(sessCopy.timePrefix || 'الساعة {time}', {
                                      time: dateObj.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' }),
                                    })}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Users size={16} className="text-[var(--wn-text-tertiary)] shrink-0" aria-hidden="true" />
                                    <span>
                                      {sessCopy.teacherPrefix || 'المعلم:'}{' '}
                                      <strong className="text-[var(--wn-heading)]">
                                        {session.teacher?.name || sessCopy.defaultTeacher || 'معلم الحلقة'}
                                      </strong>
                                    </span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--wn-text-tertiary)] bg-[var(--wn-surface)] px-2.5 py-1 rounded-md border border-[var(--wn-border)]">
                                    <MessageCircle size={13} aria-hidden="true" />
                                    <span>{sessCopy.internalChatSoon || 'الشات الداخلي قريبًا'}</span>
                                  </span>
                                </div>
                              </div>

                              {/* RSVP Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--wn-border)]">
                                {!isConfirmed && !isExcused ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRsvp(session._id, 'confirmed', '', sessionChildId)}
                                      disabled={submittingRsvp}
                                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-bold transition shadow-sm active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                                    >
                                      {isConfirmingThis ? (
                                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                      ) : (
                                        <Check size={16} aria-hidden="true" />
                                      )}
                                      <span>{sessCopy.confirmAttendanceBtn || 'تأكيد الحضور'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setExcuseModalSession(session)}
                                      disabled={submittingRsvp}
                                      className="min-h-[44px] inline-flex items-center justify-center gap-1 py-2 px-3 border border-[var(--wn-danger)]/35 text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] rounded-lg text-sm font-medium transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                                    >
                                      <span>{sessCopy.priorExcuseBtn || 'اعتذار مسبق'}</span>
                                    </button>
                                  </>
                                ) : (
                                  <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wn-text-secondary)]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span>
                                        {isConfirmed
                                          ? (sessCopy.confirmedNote || 'تم تأكيد الحضور في سجل الحلقة')
                                          : (sessCopy.excusedNote || 'تم تسجيل الاعتذار في سجل الحلقة')}
                                      </span>
                                      {isConfirmed && (
                                        <button
                                          type="button"
                                          onClick={() => setExcuseModalSession(session)}
                                          disabled={submittingRsvp}
                                          className="min-h-[44px] inline-flex items-center text-[var(--wn-text-danger)] font-bold underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                                        >
                                          {sessCopy.emergencyExcuseBtn || 'اعتذار طارئ؟'}
                                        </button>
                                      )}
                                    </div>
                                    {liveRoomTo ? (
                                      <Link
                                        to={liveRoomTo}
                                        className="min-h-[44px] inline-flex items-center gap-1 text-[var(--wn-badge-emerald-text)] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                                      >
                                        <span>{sessCopy.observerLinkBtn || 'دخول الغرفة كمراقب صامت'}</span>
                                        {isRTL ? <ArrowLeft size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
                                      </Link>
                                    ) : (
                                      <span className="text-[var(--wn-text-tertiary)]">
                                        {sessCopy.observerUnavailable || 'تتاح غرفة المتابعة عند بدء الحصة'}
                                      </span>
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
                    <div className="border border-[var(--wn-border-mint)] rounded-2xl p-6 bg-gradient-to-br from-[var(--wn-surface-mint)] via-[var(--wn-surface)] to-[var(--wn-surface-soft)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] flex items-center justify-center shrink-0">
                            <FileText size={20} aria-hidden="true" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[var(--wn-heading)] text-base">
                              {evalCopy.title || 'بطاقة تقييم آخر حلقة تسميع'}
                            </h4>
                            <p className="text-xs text-[var(--wn-text-tertiary)]">
                              {formatMsg(evalCopy.datePrefix || 'بتاريخ: {date}', {
                                date: new Date(currentChild.latestEvaluation.date).toLocaleDateString(intlLocale, { dateStyle: 'full' }),
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => shareReportViaWhatsApp({
                              surahRecited: currentChild.latestEvaluation.surahRecited,
                              fromAyah: currentChild.latestEvaluation.fromAyah,
                              toAyah: currentChild.latestEvaluation.toAyah,
                              memorizationScore: currentChild.latestEvaluation.memorizationScore,
                              tajweedScore: currentChild.latestEvaluation.tajweedScore,
                              nextHomework: currentChild.latestEvaluation.nextHomework,
                              notes: currentChild.latestEvaluation.notes,
                            }, currentChild.name)}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1.5 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-xs font-bold transition shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                            title={evalCopy.shareTitle || 'مشاركة التقرير عبر واتساب'}
                          >
                            <Share2 size={14} className="text-[var(--wn-gold)]" aria-hidden="true" />
                            <span>{evalCopy.shareBtn || 'مشاركة عبر واتساب'}</span>
                          </button>
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] rounded-full text-xs font-bold">
                            <MessageCircle size={14} aria-hidden="true" />
                            <span>{evalCopy.sentWhatsappBadge || 'تم الإرسال على واتساب'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[var(--wn-surface)] p-3.5 rounded-xl border border-[var(--wn-border)] shadow-sm text-center">
                          <p className="text-xs text-[var(--wn-text-tertiary)] mb-1">
                            {evalCopy.memorizationScore || 'درجة الحفظ'}
                          </p>
                          <p className="text-2xl font-black text-[var(--wn-badge-emerald-text)]">
                            {currentChild.latestEvaluation.memorizationScore}{' '}
                            <span className="text-sm font-normal text-[var(--wn-text-tertiary)]">/ 10</span>
                          </p>
                        </div>

                        <div className="bg-[var(--wn-surface)] p-3.5 rounded-xl border border-[var(--wn-border)] shadow-sm text-center">
                          <p className="text-xs text-[var(--wn-text-tertiary)] mb-1">
                            {evalCopy.tajweedScore || 'درجة التجويد والإتقان'}
                          </p>
                          <p className="text-2xl font-black text-[var(--wn-teal-dark)]">
                            {currentChild.latestEvaluation.tajweedScore}{' '}
                            <span className="text-sm font-normal text-[var(--wn-text-tertiary)]">/ 10</span>
                          </p>
                        </div>

                        <div className="bg-[var(--wn-surface)] p-3.5 rounded-xl border border-[var(--wn-border)] shadow-sm text-center">
                          <p className="text-xs text-[var(--wn-text-tertiary)] mb-1">
                            {evalCopy.surahLabel || 'السورة والمقدار'}
                          </p>
                          <p className="text-sm font-bold text-[var(--wn-heading)]">
                            {currentChild.latestEvaluation.surahRecited || evalCopy.surahFallback || 'سورة مسمّعة'}
                          </p>
                          <span className="text-[11px] text-[var(--wn-text-secondary)]">
                            {formatMsg(evalCopy.ayahsRange || 'الآيات [{from} - {to}]', {
                              from: currentChild.latestEvaluation.fromAyah || 1,
                              to: currentChild.latestEvaluation.toAyah || evalCopy.endOfSurah || 'نهاية السورة',
                            })}
                          </span>
                        </div>

                        <div className="bg-[var(--wn-surface)] p-3.5 rounded-xl border border-[var(--wn-border)] shadow-sm text-center">
                          <p className="text-xs text-[var(--wn-text-tertiary)] mb-1">
                            {evalCopy.nextHomeworkLabel || 'الواجب القادم'}
                          </p>
                          <p className="text-sm font-bold text-[var(--wn-badge-emerald-text)] truncate" title={currentChild.latestEvaluation.nextHomework}>
                            {currentChild.latestEvaluation.nextHomework || evalCopy.nextHomeworkFallback || 'مراجعة الورد السابق'}
                          </p>
                        </div>
                      </div>

                      {currentChild.latestEvaluation.notes && (
                        <div className="bg-[var(--wn-surface)] p-3.5 rounded-xl border border-[var(--wn-border)] text-sm text-[var(--wn-text-primary)]">
                          <strong className="text-[var(--wn-badge-emerald-text)]">
                            {evalCopy.teacherNotesLabel || 'توجيهات المعلم لولي الأمر:'}{' '}
                          </strong>
                          <span>{currentChild.latestEvaluation.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* HOMEWORK */}
              {tab === 'homework' && (
                <div
                  role="tabpanel"
                  id="guardian-panel-homework"
                  aria-labelledby="guardian-tab-homework"
                  className="space-y-4 mt-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[var(--wn-text-accent)]">
                        {hwCopy.eyebrow || 'متابعة الواجب'}
                      </span>
                      <h3 className="font-bold text-[var(--wn-heading)] text-lg">
                        {formatMsg(hwCopy.title || 'واجبات {name}', { name: currentChild?.name || '' })}
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--wn-text-tertiary)]">
                      {formatMsg(hwCopy.countsSummary || '{pending} مطلوب · {submitted} قيد التصحيح', {
                        pending: homeworkTasks.filter((task) => task.status === 'pending').length,
                        submitted: homeworkTasks.filter((task) => task.status === 'submitted').length,
                      })}
                    </span>
                  </div>

                  {homeworkError ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center text-[var(--wn-text-danger)]"
                    >
                      <AlertCircle className="mx-auto mb-2" size={28} aria-hidden="true" />
                      <p className="text-sm font-bold">{errCopy.homeworkLoadFailed || 'تعذر تحميل واجبات الطالب حاليًا'}</p>
                      <button
                        type="button"
                        onClick={() => fetchChildHomework(selectedChildId)}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-heading)] text-xs font-bold hover:bg-[var(--wn-surface-soft)] transition"
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        <span>{errCopy.retry || 'إعادة المحاولة'}</span>
                      </button>
                    </div>
                  ) : homeworkTasks.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title={hwCopy.empty || 'لا توجد واجبات لهذا الطالب حتى الآن'}
                    />
                  ) : (
                    <div className="wn-guardian-homework-list">
                      {homeworkTasks.map((task) => (
                        <article key={task._id} className={`wn-guardian-homework-card is-${task.status}`}>
                          <div>
                            <span>{taskStatusLabel(task.status, gp)}</span>
                            <h4>{task.title}</h4>
                            <p>{task.description || hwCopy.noExtraInstructions || 'بدون تعليمات إضافية'}</p>
                          </div>
                          <div className="wn-guardian-homework-card__meta">
                            <span>
                              <Users size={14} aria-hidden="true" />
                              {task.teacherName || hwCopy.defaultTutor || 'معلم الأكاديمية'}
                            </span>
                            <span>
                              <Calendar size={14} aria-hidden="true" />
                              {task.dueDate
                                ? new Date(task.dueDate).toLocaleDateString(intlLocale)
                                : (hwCopy.noDueDate || 'بدون موعد تسليم')}
                            </span>
                          </div>
                          {task.teacherFeedback ? (
                            <div className="wn-guardian-homework-feedback">
                              <MessageCircle size={15} aria-hidden="true" />
                              <div>
                                <strong>{hwCopy.teacherNote || 'ملاحظة المعلم'}</strong>
                                <p>{task.teacherFeedback}</p>
                              </div>
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
                <div
                  role="tabpanel"
                  id="guardian-panel-reports"
                  aria-labelledby="guardian-tab-reports"
                  className="space-y-4 mt-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-[var(--wn-heading)] text-lg">
                      {formatMsg(repCopy.title || 'سجل تقارير {name} المُرسلة للواتساب', {
                        name: currentChild?.name || repCopy.studentFallback || 'الطالب',
                      })}
                    </h3>
                    <span className="text-xs text-[var(--wn-text-tertiary)]">
                      {formatMsg(repCopy.totalCount || 'إجمالي التقارير: {count}', { count: reports.length })}
                    </span>
                  </div>

                  {reportsError ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center text-[var(--wn-text-danger)]"
                    >
                      <AlertCircle className="mx-auto mb-2" size={28} aria-hidden="true" />
                      <p className="text-sm font-bold">{errCopy.reportsLoadFailed || 'تعذر تحميل تقارير الطالب حاليًا'}</p>
                      <button
                        type="button"
                        onClick={() => fetchChildReports(selectedChildId)}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-heading)] text-xs font-bold hover:bg-[var(--wn-surface-soft)] transition"
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        <span>{errCopy.retry || 'إعادة المحاولة'}</span>
                      </button>
                    </div>
                  ) : reports.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title={repCopy.emptyTitle || 'لا توجد تقارير مسجلة لهذا الطالب حتى الآن'}
                      description={repCopy.emptyDesc || 'يتم إنشاء التقرير تلقائيًا فور انتهاء المعلم من حلقة التسميع.'}
                    />
                  ) : (
                    reports.map((rep, idx) => (
                      <div
                        key={rep.sessionId || idx}
                        className="border border-[var(--wn-border)] rounded-xl p-5 bg-[var(--wn-surface)] shadow-sm hover:border-[var(--wn-border-mint)] transition"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 pb-3 border-b border-[var(--wn-border)]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[var(--wn-heading)] text-base">
                                {rep.surahRecited
                                  ? formatMsg(repCopy.surahPrefix || 'سورة {surah}', { surah: rep.surahRecited })
                                  : (repCopy.recitationFallback || 'جلسة تسميع')}
                              </span>
                              {rep.fromAyah && rep.toAyah && (
                                <span className="text-xs px-2 py-0.5 bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] rounded-md">
                                  {formatMsg(repCopy.ayahRange || 'من الآية {from} إلى {to}', {
                                    from: rep.fromAyah,
                                    to: rep.toAyah,
                                  })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--wn-text-tertiary)] mt-1">
                              {formatMsg(repCopy.teacherPrefix || 'المعلم: {name}', { name: rep.teacherName || '' })}
                              {' • '}
                              {new Date(rep.scheduledAt).toLocaleDateString(intlLocale, { dateStyle: 'full' })}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <span className="block text-[11px] text-[var(--wn-text-tertiary)]">
                                {repCopy.memLabel || 'الحفظ'}
                              </span>
                              <span className="font-black text-[var(--wn-badge-emerald-text)] text-base">
                                {rep.memorizationScore}/10
                              </span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[11px] text-[var(--wn-text-tertiary)]">
                                {repCopy.tajLabel || 'التجويد'}
                              </span>
                              <span className="font-black text-[var(--wn-teal-dark)] text-base">
                                {rep.tajweedScore}/10
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => shareReportViaWhatsApp(rep, currentChild?.name)}
                              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-[var(--wn-badge-emerald-text)] hover:bg-[var(--wn-emerald-soft)] rounded-lg border border-[var(--wn-border-mint)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                              title={repCopy.shareTitle || 'مشاركة في واتساب'}
                              aria-label={repCopy.shareTitle || 'مشاركة في واتساب'}
                            >
                              <Share2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-[var(--wn-text-secondary)]">
                          {rep.nextHomework && (
                            <p className="flex items-start gap-1.5">
                              <BookOpen size={15} className="shrink-0 mt-1 text-[var(--wn-text-accent)]" aria-hidden="true" />
                              <span>
                                <strong className="text-[var(--wn-heading)]">
                                  {repCopy.homeworkLabel || 'الواجب المطلوب:'}{' '}
                                </strong>
                                {rep.nextHomework}
                              </span>
                            </p>
                          )}
                          {rep.notes && (
                            <p className="flex items-start gap-1.5">
                              <FileText size={15} className="shrink-0 mt-1 text-[var(--wn-text-accent)]" aria-hidden="true" />
                              <span>
                                <strong className="text-[var(--wn-heading)]">
                                  {repCopy.notesLabel || 'ملاحظات المعلم:'}{' '}
                                </strong>
                                {rep.notes}
                              </span>
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
                <div
                  role="tabpanel"
                  id="guardian-panel-attendance"
                  aria-labelledby="guardian-tab-attendance"
                  className="space-y-6 mt-4"
                >
                  <div className="bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-xl p-5">
                    <h4 className="font-bold text-[var(--wn-heading)] text-base mb-2">
                      {polCopy.title || 'سياسة الحضور والحصص التعويضية في أكاديمية وَحْيٌ وَنَمَاء'}
                    </h4>
                    <ul className="text-sm text-[var(--wn-text-secondary)] space-y-1.5 list-disc list-inside">
                      <li>{polCopy.rule1 || 'يتم إرسال تذكير بالحصة قبل 24 ساعة عبر الواتساب لتأكيد الحضور أو تقديم اعتذار.'}</li>
                      <li>
                        {polCopy.rule2Prefix || 'في حال تم تقديم الاعتذار قبل موعد الحصة بـ '}
                        <strong className="text-[var(--wn-heading)]">{polCopy.rule2Strong || '6 ساعات على الأقل'}</strong>
                        {polCopy.rule2Suffix || '، يحفظ للطالب حقه في حصة تعويضية مجانية.'}
                      </li>
                      <li>{polCopy.rule3 || 'الغياب المفاجئ دون اعتذار مسبق يُسجل كغياب وتُعطى الأولوية للطلاب الحاضرين.'}</li>
                    </ul>
                  </div>

                  <div className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-xl p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-xs font-bold text-[var(--wn-text-accent)]">
                          {permCopy.eyebrow || 'إعدادات الربط والرقابة'}
                        </span>
                        <h4 className="font-bold text-[var(--wn-heading)] text-base">
                          {formatMsg(permCopy.title || 'صلاحيات المتابعة المفعلة لحساب {name}', {
                            name: currentChild?.name || repCopy.studentFallback || 'الطالب',
                          })}
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] text-xs font-bold">
                        <ShieldCheck size={14} aria-hidden="true" />
                        <span>{permCopy.verifiedBadge || 'حساب مرتبط وموثق'}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                      {[
                        {
                          key: 'viewProgress',
                          label: permCopy.labels?.viewProgress || 'متابعة الحفظ والتقدم',
                          enabled: currentChild?.permissions?.viewProgress !== false,
                        },
                        {
                          key: 'viewGrades',
                          label: permCopy.labels?.viewGrades || 'الاطلاع على تقييمات التسميع',
                          enabled: currentChild?.permissions?.viewGrades !== false,
                        },
                        {
                          key: 'viewAttendance',
                          label: permCopy.labels?.viewAttendance || 'سجل الحضور والاعتذارات',
                          enabled: currentChild?.permissions?.viewAttendance !== false,
                        },
                        {
                          key: 'receiveNotifications',
                          label: permCopy.labels?.receiveNotifications || 'إشعارات الحصص والتقارير',
                          enabled: currentChild?.permissions?.receiveNotifications !== false,
                        },
                        {
                          key: 'approveEnrollments',
                          label: permCopy.labels?.approveEnrollments || 'إدارة الاشتراكات والتجديد',
                          enabled: currentChild?.permissions?.approveEnrollments === true,
                        },
                      ].map((perm) => (
                        <div
                          key={perm.key}
                          className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                            perm.enabled
                              ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)]'
                              : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-tertiary)]'
                          }`}
                        >
                          <span className="font-bold">{perm.label}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                              perm.enabled
                                ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                                : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-tertiary)]'
                            }`}
                          >
                            {perm.enabled ? (permCopy.enabled || 'مفعّل') : (permCopy.restricted || 'مقيد')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] rounded-xl p-4 text-center">
                      <CheckCircle className="mx-auto text-[var(--wn-badge-emerald-text)] mb-2" size={28} aria-hidden="true" />
                      <p className="text-sm text-[var(--wn-badge-emerald-text)]">
                        {permCopy.completedCount || 'الحصص المكتملة'}
                      </p>
                      <p className="text-2xl font-black text-[var(--wn-heading)] mt-1">
                        {currentChild?.attendance?.attended || 0}
                      </p>
                    </div>

                    <div className="border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] rounded-xl p-4 text-center">
                      <AlertCircle className="mx-auto text-[var(--wn-text-gold)] mb-2" size={28} aria-hidden="true" />
                      <p className="text-sm text-[var(--wn-text-gold)]">
                        {permCopy.excusedCount || 'اعتذارات معتمدة للتعويض'}
                      </p>
                      <p className="text-2xl font-black text-[var(--wn-text-gold)] mt-1">
                        {currentChild?.attendance?.excused || 0}
                      </p>
                    </div>

                    <div className="border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] rounded-xl p-4 text-center">
                      <XCircle className="mx-auto text-[var(--wn-text-danger)] mb-2" size={28} aria-hidden="true" />
                      <p className="text-sm text-[var(--wn-text-danger)]">
                        {permCopy.absentCount || 'حالات الغياب غير المعتذر عنها'}
                      </p>
                      <p className="text-2xl font-black text-[var(--wn-text-danger)] mt-1">
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

      <LinkChildModal
        isOpen={showLinkModal}
        onClose={() => {
          if (!linking) {
            setShowLinkModal(false);
            setLinkError('');
          }
        }}
        onSubmit={handleLinkChild}
        linkInput={linkInput}
        onLinkInputChange={(e) => {
          setLinkInput(e.target.value);
          if (linkError) setLinkError('');
        }}
        linkError={linkError}
        relationship={relationship}
        onRelationshipChange={(e) => setRelationship(e.target.value)}
        linking={linking}
        gp={gp}
      />

      <RsvpExcuseModal
        session={excuseModalSession}
        onClose={() => {
          if (!submittingRsvp) {
            setExcuseModalSession(null);
          }
        }}
        onConfirm={() =>
          handleRsvp(
            excuseModalSession._id,
            'excused',
            excuseReason,
            excuseModalSession.child?.id || excuseModalSession.childId || selectedChildId
          )
        }
        excuseReason={excuseReason}
        onExcuseReasonChange={(e) => setExcuseReason(e.target.value)}
        submittingRsvp={submittingRsvp}
        gp={gp}
      />
    </DashboardLayout>
  );
}
