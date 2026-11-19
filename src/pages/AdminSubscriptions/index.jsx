import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Plus, RefreshCw, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import EmptyState from '../../components/shared/EmptyState';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import SubscriptionCircleCard from './SubscriptionCircleCard';

const DAY_KEYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? '')),
    String(template || '')
  );
}

export default function AdminSubscriptions() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, dir, isRTL, t } = useI18n();
  const ps = t.payments.subscriptions;
  const searchInputId = useId();
  const awaitingTabId = useId();
  const circlesTabId = useId();
  const awaitingPanelId = useId();
  const circlesPanelId = useId();
  const showLoadError = toast.error;
  const [tab, setTab] = useState('awaiting');
  const [subscriptions, setSubscriptions] = useState([]);
  const [circles, setCircles] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState('');
  const [search, setSearch] = useState('');
  const [showNewCircleForm, setShowNewCircleForm] = useState(false);
  const [newCircleForm, setNewCircleForm] = useState({
    name: '',
    teacherId: '',
    planKey: 'group',
    section: 'men_children',
    day: 'Saturday',
    startTime: '',
    endTime: '',
  });

  const planName = useCallback((item) => {
    const snap = item.pricingSnapshot;
    if (locale === 'ar' && snap?.nameAr) return snap.nameAr;
    if (locale !== 'ar' && snap?.nameEn) return snap.nameEn;
    return snap?.nameAr || snap?.nameEn || ps.planNames[item.planKey] || item.planKey;
  }, [locale, ps.planNames]);

  const teacherName = useCallback((item) => (
    item.preferredTeacher?.personalInfo?.fullName
    || item.preferredTeacher?.user?.name
    || ps.awaitingCard.teacherUnassigned
  ), [ps.awaitingCard.teacherUnassigned]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [placements, groups] = await Promise.all([
        api.get('/api/subscriptions/admin/placements?status=awaiting_placement', { auth: true }),
        api.get('/api/subscriptions/admin/circles', { auth: true }),
      ]);
      setSubscriptions(placements.subscriptions || []);
      setCircles(groups.circles || []);
      setTeachers(groups.teachers || placements.teachers || []);
      setAllStudents(groups.students || []);
    } catch (error) {
      const message = error.message || ps.loadError;
      setLoadError(message);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [showLoadError, ps.loadError]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const formFor = (item) => forms[item._id] || {
    mode: item.compatibleCircles?.length ? 'existing' : 'new',
    existingCircleId: item.compatibleCircles?.[0]?._id || item.flexibleCircles?.[0]?._id || '',
    circleName: planName(item) + ' — ' + teacherName(item),
    teacherId: item.preferredTeacher?._id || '',
    setScheduleNow: false,
    startImmediately: false,
    day: 'Saturday',
    startTime: '18:00',
    endTime: '19:00',
    timezone: 'Africa/Cairo',
  };
  const updateForm = (item, patch) => setForms((current) => ({
    ...current,
    [item._id]: { ...formFor(item), ...patch },
  }));

  const place = async (item) => {
    if (working) return;
    const form = formFor(item);
    if ((form.mode === 'existing' || form.mode === 'flexible') && !form.existingCircleId) {
      toast.error(ps.toasts.chooseCircleError);
      return;
    }
    if (form.mode === 'new' && !form.circleName.trim()) {
      toast.error(ps.toasts.circleNameRequired);
      return;
    }
    if (form.setScheduleNow && (!form.startTime || !form.endTime || form.endTime <= form.startTime)) {
      toast.error(ps.toasts.invalidScheduleTime);
      return;
    }
    setWorking(item._id);
    try {
      const schedulePayload = form.setScheduleNow
        ? [{ day: form.day || 'Saturday', startTime: form.startTime, endTime: form.endTime }]
        : undefined;
      const payload = form.mode === 'existing' || form.mode === 'flexible'
        ? {
            existingCircleId: form.existingCircleId,
            allowFlexibleCircle: form.mode === 'flexible',
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          }
        : {
            circleName: form.circleName.trim(),
            teacherId: form.teacherId || undefined,
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          };
      const result = await api.post('/api/subscriptions/admin/' + encodeURIComponent(item._id) + '/place', payload, { auth: true });
      toast.success(result.subscriptionStatus === 'active'
        ? ps.toasts.placedActive
        : result.circleStatus === 'ready'
          ? ps.toasts.placedReady
          : ps.toasts.placedDefault);
      await load();
    } catch (error) {
      toast.error(error.message || ps.toasts.placeFailed);
    } finally {
      setWorking('');
    }
  };

  const createStandaloneCircle = async (e) => {
    e.preventDefault();
    if (working) return;
    if (!newCircleForm.name.trim()) return toast.error(ps.toasts.standaloneNameRequired);
    if (!newCircleForm.teacherId) return toast.error(ps.toasts.standaloneTeacherRequired);
    setWorking('create-circle');
    try {
      const schedule = newCircleForm.startTime && newCircleForm.endTime && newCircleForm.endTime > newCircleForm.startTime
        ? [{ day: newCircleForm.day, startTime: newCircleForm.startTime, endTime: newCircleForm.endTime }]
        : [];
      await api.post('/api/subscriptions/admin/circles', {
        name: newCircleForm.name.trim(),
        teacherId: newCircleForm.teacherId,
        planKey: newCircleForm.planKey,
        section: newCircleForm.section,
        schedule,
      }, { auth: true });
      toast.success(ps.toasts.standaloneCreated);
      setNewCircleForm({ name: '', teacherId: '', planKey: 'group', section: 'men_children', day: 'Saturday', startTime: '', endTime: '' });
      setShowNewCircleForm(false);
      await load();
    } catch (error) {
      toast.error(error.message || ps.toasts.standaloneCreateFailed);
    } finally {
      setWorking('');
    }
  };

  const filteredSubscriptions = useMemo(
    () => subscriptions.filter((item) => [item.student?.name, teacherName(item), planName(item)].join(' ').toLowerCase().includes(search.trim().toLowerCase())),
    [subscriptions, search, teacherName, planName]
  );
  const filteredCircles = useMemo(
    () => circles.filter((circle) => [circle.name, circle.teacher?.personalInfo?.fullName, circle.teacher?.user?.name, circle.plan?.name?.ar, circle.plan?.name?.en].join(' ').toLowerCase().includes(search.trim().toLowerCase())),
    [circles, search]
  );
  const readyCount = circles.filter((circle) => circle.status === 'ready').length;

  const handleTabKeyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setTab((current) => (current === 'awaiting' ? 'circles' : 'awaiting'));
    }
  };

  if (!ready) return null;

  return (
    <DashboardLayout title={ps.title} user={user} onLogout={logout}>
      <SEOHead page={{ title: ps.seoTitle, description: ps.seoDesc, noindex: true, canonical: false }} />
      <div className="space-y-5" dir={dir}>
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" onClick={() => navigate('..', { relative: 'path' })}>
            {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {ps.backToAdmin}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" onClick={() => navigate('../payments', { relative: 'path' })}>
              {ps.reviewPayments}
            </button>
            <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" disabled={loading || Boolean(working)} onClick={load}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {ps.refresh}
            </button>
          </div>
        </div>

        <div className="wn-dashboard-surface">
          <h2 className="font-bold text-xl flex gap-2 items-center text-[var(--wn-heading)]">
            <UsersRound aria-hidden="true" /> {ps.headerTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--wn-text-secondary)]">{ps.headerFlow}</p>
          <p className="mt-2 text-sm text-[var(--wn-text-primary)]">{ps.headerNote}</p>
          <div className="flex flex-wrap gap-2 mt-4" role="tablist" aria-label={ps.tabs.ariaLabel}>
            <button
              id={awaitingTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'awaiting'}
              aria-controls={awaitingPanelId}
              tabIndex={tab === 'awaiting' ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              className={'wn-btn min-h-[44px] ' + (tab === 'awaiting' ? 'wn-btn--primary' : 'wn-btn--secondary')}
              onClick={() => setTab('awaiting')}
            >
              {formatMsg(ps.tabs.awaiting, { count: subscriptions.length })}
            </button>
            <button
              id={circlesTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'circles'}
              aria-controls={circlesPanelId}
              tabIndex={tab === 'circles' ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              className={'wn-btn min-h-[44px] ' + (tab === 'circles' ? 'wn-btn--primary' : 'wn-btn--secondary')}
              onClick={() => setTab('circles')}
            >
              {formatMsg(ps.tabs.circles, { count: circles.length })} · {formatMsg(ps.tabs.readyCount, { count: readyCount })}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor={searchInputId} className="block text-sm font-semibold text-[var(--wn-heading)]">
            {ps.searchLabel}
          </label>
          <input
            id={searchInputId}
            className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl p-3 mt-1"
            value={search}
            placeholder={ps.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-4" role="status" aria-label={t.adminPortal.common.loading}>
            {[1, 2, 3].map((row) => (
              <div key={row} className="wn-dashboard-surface space-y-3">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="wn-dashboard-surface border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} aria-hidden="true" />
              <span className="font-semibold">{loadError}</span>
            </div>
            <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
              {ps.retry}
            </button>
          </div>
        ) : tab === 'circles' ? (
          <div id={circlesPanelId} role="tabpanel" aria-labelledby={circlesTabId} className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNewCircleForm((v) => !v)}
                className="wn-btn wn-btn--primary min-h-[44px] text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={15} aria-hidden="true" /> {showNewCircleForm ? ps.closeNewCircleBtn : ps.newCircleBtn}
              </button>
            </div>

            {showNewCircleForm ? (
              <form onSubmit={createStandaloneCircle} className="wn-dashboard-surface border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] space-y-3">
                <h3 className="font-bold text-sm text-[var(--wn-heading)]">{ps.form.title}</h3>
                <div className="grid sm:grid-cols-4 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.nameLabel}</span>
                    <input
                      required
                      type="text"
                      maxLength={120}
                      placeholder={ps.form.namePlaceholder}
                      value={newCircleForm.name}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, name: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.teacherLabel}</span>
                    <select
                      required
                      value={newCircleForm.teacherId}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, teacherId: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="">{ps.form.teacherPlaceholder}</option>
                      {teachers.map((teacherItem) => <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.planLabel}</span>
                    <select
                      value={newCircleForm.planKey}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, planKey: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="community">{ps.planNames.community}</option>
                      <option value="group">{ps.planNames.group}</option>
                      <option value="focused">{ps.planNames.focused}</option>
                      <option value="mini">{ps.planNames.mini}</option>
                      <option value="private">{ps.planNames.private}</option>
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.sectionLabel}</span>
                    <select
                      value={newCircleForm.section}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, section: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="men_children">{ps.awaitingCard.sectionMenChildren}</option>
                      <option value="ladies">{ps.awaitingCard.sectionLadies}</option>
                    </select>
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.dayLabel}</span>
                    <select
                      value={newCircleForm.day}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, day: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.startLabel}</span>
                    <input
                      type="time"
                      value={newCircleForm.startTime}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.endLabel}</span>
                    <input
                      type="time"
                      value={newCircleForm.endTime}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, endTime: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewCircleForm(false)} disabled={Boolean(working)} className="wn-btn wn-btn--secondary min-h-[44px] text-xs">
                    {ps.form.cancel}
                  </button>
                  <button type="submit" disabled={Boolean(working)} className="wn-btn wn-btn--primary min-h-[44px] text-xs">
                    {working === 'create-circle' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                    {working === 'create-circle' ? ps.form.submitting : ps.form.submit}
                  </button>
                </div>
              </form>
            ) : null}

            {filteredCircles.length ? filteredCircles.map((circle) => (
              <SubscriptionCircleCard
                key={circle._id}
                circle={circle}
                teachers={teachers}
                allStudents={allStudents}
                onChanged={load}
              />
            )) : (
              <div className="wn-dashboard-surface">
                <EmptyState icon={UsersRound} title={ps.emptyCircles} />
              </div>
            )}
          </div>
        ) : (
          <div id={awaitingPanelId} role="tabpanel" aria-labelledby={awaitingTabId} className="space-y-4">
            {!filteredSubscriptions.length ? (
              <div className="wn-dashboard-surface">
                <EmptyState icon={UsersRound} title={ps.emptyAwaiting} />
              </div>
            ) : filteredSubscriptions.map((item) => {
              const form = formFor(item);
              const isPlacing = working === item._id;
              return (
                <article key={item._id} className="wn-dashboard-surface grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-[var(--wn-heading)]">{item.student?.name || ps.awaitingCard.studentFallback}</h3>
                    <p className="text-sm text-[var(--wn-text-secondary)]">{item.student?.email}</p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {formatMsg(ps.awaitingCard.planLine, { plan: planName(item), price: (item.pricePerSessionMinor || 0) / 100 })}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">{ps.awaitingCard.preferredTutor}: <strong>{teacherName(item)}</strong></p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {ps.awaitingCard.sectionLabel}: {item.section === 'ladies' ? ps.awaitingCard.sectionLadies : ps.awaitingCard.sectionMenChildren} · {ps.awaitingCard.ageLabel}: {item.student?.age || t.adminPortal.common.dash}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {ps.awaitingCard.balanceLabel}: <strong>{item.sessionsRemaining}/{item.sessionCount} {ps.card.table.sessionUnit}</strong>
                    </p>
                    <span className="inline-block bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] rounded-lg p-2 text-sm font-semibold">
                      {ps.awaitingCard.paidBadge}
                    </span>
                  </div>
                  <div className="border border-[var(--wn-border)] rounded-xl p-4 space-y-3 bg-[var(--wn-surface-soft)]">
                    <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                      {ps.awaitingCard.placementModeLabel}
                      <select
                        className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                        value={form.mode}
                        onChange={(event) => {
                          const nextMode = event.target.value;
                          const nextCircleId = nextMode === 'existing'
                            ? (item.compatibleCircles?.[0]?._id || '')
                            : nextMode === 'flexible'
                              ? (item.flexibleCircles?.[0]?._id || '')
                              : '';
                          updateForm(item, { mode: nextMode, existingCircleId: nextCircleId });
                        }}
                      >
                        <option value="existing" disabled={!item.compatibleCircles?.length}>{ps.awaitingCard.modeExisting}</option>
                        {item.flexibleCircles?.length ? (
                          <option value="flexible">{ps.awaitingCard.modeFlexible}</option>
                        ) : null}
                        <option value="new">{ps.awaitingCard.modeNew}</option>
                      </select>
                    </label>

                    {form.mode === 'existing' ? (
                      <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                        {ps.awaitingCard.circleLabel}
                        <select
                          className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                          value={form.existingCircleId}
                          onChange={(event) => updateForm(item, { existingCircleId: event.target.value })}
                        >
                          {item.compatibleCircles?.map((circle) => (
                            <option key={circle._id} value={circle._id}>
                              {circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? ps.awaitingCard.circleOptionStatusRunning : ps.awaitingCard.circleOptionStatusForming}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : form.mode === 'flexible' ? (
                      <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                        {ps.awaitingCard.flexibleCircleLabel}
                        <select
                          className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                          value={form.existingCircleId}
                          onChange={(event) => updateForm(item, { existingCircleId: event.target.value })}
                        >
                          {item.flexibleCircles?.map((circle) => (
                            <option key={circle._id} value={circle._id}>
                              {circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? ps.awaitingCard.circleOptionStatusRunning : ps.awaitingCard.circleOptionStatusForming}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                          {ps.awaitingCard.newCircleNameLabel}
                          <input
                            className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                            maxLength={120}
                            value={form.circleName}
                            onChange={(event) => updateForm(item, { circleName: event.target.value })}
                          />
                        </label>
                        {teachers.length > 0 ? (
                          <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                            {ps.awaitingCard.assignTeacherLabel}
                            <select
                              className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                              value={form.teacherId || item.preferredTeacher?._id || ''}
                              onChange={(event) => updateForm(item, { teacherId: event.target.value })}
                            >
                              {!item.preferredTeacher?._id ? <option value="">{ps.awaitingCard.selectTeacherPlaceholder}</option> : null}
                              {teachers.map((teacherItem) => <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.name}</option>)}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--wn-border)] space-y-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={Boolean(form.setScheduleNow)}
                          onChange={(e) => updateForm(item, { setScheduleNow: e.target.checked })}
                          className="w-4 h-4 accent-[var(--wn-emerald)]"
                        />
                        <span>{ps.awaitingCard.scheduleNowCheckbox}</span>
                      </label>
                      {form.setScheduleNow ? (
                        <div className="rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] p-3 space-y-2 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.dayLabel}</span>
                              <select
                                value={form.day || 'Saturday'}
                                onChange={(e) => updateForm(item, { day: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              >
                                {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                              </select>
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.fromLabel}</span>
                              <input
                                type="time"
                                value={form.startTime || '18:00'}
                                onChange={(e) => updateForm(item, { startTime: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              />
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.toLabel}</span>
                              <input
                                type="time"
                                value={form.endTime || '19:00'}
                                onChange={(e) => updateForm(item, { endTime: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              />
                            </label>
                          </div>
                          <label className="inline-flex items-center gap-2 font-bold text-[var(--wn-emerald)] cursor-pointer pt-1 min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={Boolean(form.startImmediately)}
                              onChange={(e) => updateForm(item, { startImmediately: e.target.checked })}
                              className="w-4 h-4 accent-[var(--wn-emerald)]"
                            />
                            <span>{ps.awaitingCard.startImmediatelyLabel}</span>
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs text-[var(--wn-text-secondary)]">{ps.awaitingCard.placementHint}</p>
                    <button
                      type="button"
                      disabled={Boolean(working)}
                      className="wn-btn wn-btn--primary wn-btn--block min-h-[44px]"
                      onClick={() => place(item)}
                    >
                      {isPlacing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                      {isPlacing ? ps.awaitingCard.placingBtn : ps.awaitingCard.placeBtn}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="text-xs text-[var(--wn-text-tertiary)]">{ps.footerNote}</p>
      </div>
    </DashboardLayout>
  );
}

