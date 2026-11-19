import { useId, useState } from 'react';
import { BriefcaseBusiness, Loader2, MonitorPlay, Trash2, TrendingUp, Users } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { StatCard } from '../../components/dashboard/DashboardLayout';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { formatMsg } from './adminFormat';

const CHART_COLORS = [
  'var(--wn-chart-1)',
  'var(--wn-chart-2)',
  'var(--wn-chart-3)',
  'var(--wn-chart-4)',
];

const TOOLTIP_STYLE = {
  background: 'var(--wn-chart-tooltip-bg)',
  color: 'var(--wn-chart-tooltip-text)',
  borderRadius: 'var(--wn-radius-md)',
  border: 'none',
};

const DONATION_STATUSES = ['pledged', 'confirmed', 'cancelled'];
const APP_STATUSES = ['new', 'reviewing', 'interview', 'hired', 'rejected'];
const VIDEO_CATEGORIES = ['quran', 'tajweed', 'arabic', 'seerah', 'kids'];

export default function AdminGrowthTab({
  growthSummary,
  donations,
  applications,
  videos,
  videoForm,
  setVideoForm,
  onReloadGrowth,
}) {
  const { t } = useI18n();
  const toast = useToast();
  const tg = t.adminPortal.tabs.growth;
  const tt = t.adminPortal.toasts;
  const tc = t.adminPortal.common;
  const formId = useId();

  const [busyId, setBusyId] = useState(null);
  const [addingVideo, setAddingVideo] = useState(false);
  const [deleteVideoModal, setDeleteVideoModal] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(false);

  const donationPieData = Object.entries(growthSummary.donationsByCategory || {}).map(([name, value]) => ({
    name: tg.charts.categories?.[name] || tg.charts.categories.general,
    value,
  }));

  const regsData = (growthSummary.monthlyRegs || []).map((r) => ({
    name: r.month,
    [tg.charts.regsKey]: r.count,
  }));

  const enrollmentsData = (growthSummary.enrollmentsByCourse || []).map((c) => ({
    name: c.name?.length > 20 ? `${c.name.slice(0, 20)}…` : c.name,
    [tg.charts.enrollmentsKey]: c.count,
  }));

  const handleDonationStatus = async (donationId, status) => {
    setBusyId(`donation-${donationId}`);
    try {
      await api.put(`/api/donations/${donationId}/status`, { status }, { auth: true });
      toast.success(tt.donationUpdated);
      await onReloadGrowth();
    } catch (err) {
      toast.error(err.message || tt.donationUpdateFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleApplicationStatus = async (appId, status) => {
    setBusyId(`app-${appId}`);
    try {
      await api.put(`/api/careers/applications/${appId}/status`, { status }, { auth: true });
      toast.success(tt.applicationUpdated);
      await onReloadGrowth();
    } catch (err) {
      toast.error(err.message || tt.applicationUpdateFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (addingVideo) return;
    setAddingVideo(true);
    try {
      await api.post('/api/videos', videoForm, { auth: true });
      toast.success(tt.videoAdded);
      setVideoForm({ title: '', category: 'quran', videoUrl: '', duration: 600 });
      await onReloadGrowth();
    } catch (err) {
      toast.error(err.message || tt.videoAddFailed);
    } finally {
      setAddingVideo(false);
    }
  };

  const confirmDeleteVideo = async () => {
    if (!deleteVideoModal || deletingVideo) return;
    setDeletingVideo(true);
    try {
      await api.delete(`/api/videos/${deleteVideoModal._id}`, { auth: true });
      toast.success(tt.videoDeleted);
      setDeleteVideoModal(null);
      await onReloadGrowth();
    } catch (err) {
      toast.error(err.message || tt.videoDeleteFailed);
    } finally {
      setDeletingVideo(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={tg.stats.donations} value={growthSummary.donations?.pledged?.count || 0} icon={TrendingUp} color="orange" />
        <StatCard label={tg.stats.applications} value={growthSummary.newApplications || 0} icon={BriefcaseBusiness} color="blue" />
        <StatCard label={tg.stats.videos} value={growthSummary.publishedVideos || 0} icon={MonitorPlay} color="purple" />
        <StatCard label={tg.stats.referrals} value={growthSummary.totalReferrals || 0} icon={Users} color="emerald" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
        <div className="wn-dashboard-surface flex flex-col text-start">
          <h4 className="font-bold text-[var(--wn-heading)] mb-4 text-start">{tg.charts.regsTitle}</h4>
          <div className="h-64 w-full" dir="ltr">
            {regsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--wn-text-tertiary)] text-sm">
                {tg.charts.regsEmpty}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={regsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wnAdminColorRegs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--wn-chart-2)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--wn-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--wn-chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--wn-chart-axis)' }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--wn-chart-axis)' }} axisLine={false} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey={tg.charts.regsKey} stroke="var(--wn-chart-2)" strokeWidth={2} fillOpacity={1} fill="url(#wnAdminColorRegs)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="wn-dashboard-surface flex flex-col text-start">
          <h4 className="font-bold text-[var(--wn-heading)] mb-4 text-start">{tg.charts.enrollmentsTitle}</h4>
          <div className="h-64 w-full" dir="ltr">
            {enrollmentsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--wn-text-tertiary)] text-sm">
                {tg.charts.enrollmentsEmpty}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--wn-chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--wn-chart-axis)' }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--wn-chart-axis)' }} axisLine={false} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey={tg.charts.enrollmentsKey} fill="var(--wn-chart-4)" radius={[4, 4, 0, 0]}>
                    {enrollmentsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="wn-dashboard-surface flex flex-col text-start">
          <h4 className="font-bold text-[var(--wn-heading)] mb-4 text-start">{tg.charts.donationsTitle}</h4>
          <div className="h-64 w-full relative" dir="ltr">
            {donationPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--wn-text-tertiary)] text-sm">
                {tg.charts.donationsEmpty}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donationPieData} cx="50%" cy="50%" innerRadius={56} outerRadius={78} paddingAngle={5} dataKey="value">
                    {donationPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.75rem' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="wn-dashboard-surface">
        <h3 className="font-bold text-[var(--wn-heading)] mb-4">
          {tg.donationsTitle.replace('{count}', String(donations.length))}
        </h3>
        {donations.length === 0 ? (
          <EmptyState icon={TrendingUp} title={tg.donationsEmpty} />
        ) : (
          donations.slice(0, 10).map((d) => (
            <div key={d._id} className="flex flex-wrap justify-between items-center border border-[var(--wn-border)] rounded-lg p-3 mb-2 gap-2">
              <div>
                <p className="font-semibold text-[var(--wn-heading)]">{d.isAnonymous ? tg.anonymousDonor : d.name}</p>
                <p className="text-xs text-[var(--wn-text-secondary)]">{d.amount} {d.currency} — {d.category}</p>
              </div>
              <select
                value={d.status}
                aria-label={tg.donationStatusAria}
                disabled={busyId === `donation-${d._id}`}
                onChange={(e) => handleDonationStatus(d._id, e.target.value)}
                className="min-h-[44px] text-sm border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-1.5 disabled:opacity-60"
              >
                {DONATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{tg.donationStatuses?.[s] || s}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>

      <div className="wn-dashboard-surface">
        <h3 className="font-bold text-[var(--wn-heading)] mb-4">
          {tg.appsTitle.replace('{count}', String(applications.length))}
        </h3>
        {applications.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title={tg.appsEmpty} />
        ) : (
          applications.slice(0, 10).map((a) => (
            <div key={a._id} className="flex flex-wrap justify-between items-center border border-[var(--wn-border)] rounded-lg p-3 mb-2 gap-2">
              <div>
                <p className="font-semibold text-[var(--wn-heading)]">{a.name}</p>
                <p className="text-xs text-[var(--wn-text-secondary)]">{a.position} — {a.email}</p>
              </div>
              <select
                value={a.status}
                aria-label={tg.appStatusAria}
                disabled={busyId === `app-${a._id}`}
                onChange={(e) => handleApplicationStatus(a._id, e.target.value)}
                className="min-h-[44px] text-sm border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-1.5 disabled:opacity-60"
              >
                {APP_STATUSES.map((s) => (
                  <option key={s} value={s}>{tg.appStatuses?.[s] || s}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={handleAddVideo} className="wn-dashboard-surface space-y-3">
          <h3 className="font-bold text-[var(--wn-heading)]">{tg.newVideoTitle}</h3>
          <div>
            <label htmlFor={`${formId}-vtitle`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
              {tg.videoFields.title}
            </label>
            <input
              id={`${formId}-vtitle`}
              required
              placeholder={tg.videoFields.title}
              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
              value={videoForm.title}
              onChange={(e) => setVideoForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-vurl`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
              {tg.videoFields.url}
            </label>
            <input
              id={`${formId}-vurl`}
              required
              placeholder={tg.videoFields.url}
              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
              value={videoForm.videoUrl}
              onChange={(e) => setVideoForm((p) => ({ ...p, videoUrl: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-vcat`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
              {tg.videoFields.category}
            </label>
            <select
              id={`${formId}-vcat`}
              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
              value={videoForm.category}
              onChange={(e) => setVideoForm((p) => ({ ...p, category: e.target.value }))}
            >
              {VIDEO_CATEGORIES.map((c) => (
                <option key={c} value={c}>{tg.videoFields.categories?.[c] || c}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={addingVideo}
            className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {addingVideo && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            <span>{addingVideo ? tg.videoFields.addingBtn : tg.videoFields.addBtn}</span>
          </button>
        </form>

        <div className="wn-dashboard-surface">
          <h3 className="font-bold text-[var(--wn-heading)] mb-4">
            {tg.libraryTitle.replace('{count}', String(videos.length))}
          </h3>
          {videos.length === 0 ? (
            <EmptyState icon={MonitorPlay} title={tg.libraryEmpty} />
          ) : (
            videos.slice(0, 8).map((v) => (
              <div
                key={v._id}
                className="flex justify-between items-center border border-[var(--wn-border)] rounded-lg px-3 py-2 mb-2 text-sm text-[var(--wn-text-primary)]"
              >
                <span className="truncate">{v.title}</span>
                <button
                  type="button"
                  onClick={() => setDeleteVideoModal(v)}
                  aria-label={tg.deleteVideoAria}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] shrink-0"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={Boolean(deleteVideoModal)}
        onClose={() => setDeleteVideoModal(null)}
        title={tg.deleteVideoConfirmTitle}
        disableClose={deletingVideo}
        maxWidth="440px"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {formatMsg(tg.deleteVideoConfirmBody, { title: deleteVideoModal?.title || '' })}
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
            <button
              type="button"
              onClick={() => setDeleteVideoModal(null)}
              disabled={deletingVideo}
              className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-lg"
            >
              {tc.cancel}
            </button>
            <button
              type="button"
              onClick={confirmDeleteVideo}
              disabled={deletingVideo}
              className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-semibold rounded-lg bg-[var(--wn-danger)] hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {deletingVideo && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              <span>{deletingVideo ? tc.deleting : tc.delete}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
