import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, Plus, Users, Calendar, Clock, Play,
  Video, BookOpen, Trash2, Copy, Check, Loader2, AlertCircle, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import '../LiveRoom/LiveRoom.css';
import '../../styles/session-experience.css';

export default function LiveSessions() {
  const navigate = useNavigate();
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [liveStatus, setLiveStatus] = useState({ configured: false });
  const [demoLoading, setDemoLoading] = useState(false);
  const [deleteConfirmRoomId, setDeleteConfirmRoomId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const copyTimerRef = useRef(null);

  const role = user?.role || '';
  const canManage = role === 'teacher' || role === 'admin';

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/api/live/sessions', { auth: true });
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
      setLoadError(error?.message || t.common.errorTitle);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale), { replace: true });
      return;
    }

    fetchSessions();
    api.get('/api/live/status').then(setLiveStatus).catch(() => {});
  }, [authLoading, isAuthenticated, navigate, locale, fetchSessions]);

  const copyLink = async (roomId) => {
    const link = `${window.location.origin}${localizedPath(`/live/${roomId}`, locale)}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(link);
      setCopiedId(roomId);
      toast.success(t.live.sessions.copySuccess);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t.live.sessions.copyError);
    }
  };

  const joinSession = (roomId) => {
    navigate(localizedPath(`/live/${roomId}`, locale));
  };

  const startDemo = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const data = await api.post('/api/live/demo-room', {}, { auth: true });
      if (data.roomId) joinSession(data.roomId);
    } catch (e) {
      toast.error(e?.message || t.live.sessions.createError);
    } finally {
      setDemoLoading(false);
    }
  };

  const deleteSession = async (roomId) => {
    if (!roomId || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/api/live/sessions/${roomId}`, { auth: true });
      setSessions((prev) => prev.filter((s) => s.roomId !== roomId));
      setDeleteConfirmRoomId(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error(error?.message || t.live.sessions.deleteError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="live-sessions-page wn-session-shell" dir={dir}>
      <header className="live-sessions-header">
        <div className="header-content">
          <div className="header-right flex-wrap">
            <BrandLogo size={50} />
            <div className="header-info min-w-0">
              <h1>{t.live.sessionsTitle}</h1>
              <p>{t.live.sessionsSubtitle}</p>
            </div>
          </div>
          {canManage && liveStatus.configured && (
            <button
              type="button"
              className="btn-premium create-session-btn min-h-[44px]"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              {t.live.createSession}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-3">
        <div
          className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm border ${
            liveStatus.configured
              ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)]'
              : 'bg-[var(--wn-gold-soft)] border-[var(--wn-border)] text-[var(--wn-badge-gold-text)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Radio size={16} className="shrink-0" aria-hidden="true" />
            {liveStatus.configured
              ? t.live.liveKitReady
              : t.live.liveKitPending}
          </span>
          {import.meta.env.DEV && role === 'admin' && (
            <button
              type="button"
              onClick={startDemo}
              disabled={demoLoading}
              className="btn-premium text-sm min-h-[44px] py-2 px-4 inline-flex items-center gap-2"
            >
              {demoLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              <span>{demoLoading ? t.common.loading : t.live.tryDemo}</span>
            </button>
          )}
        </div>
      </div>

      <main className="live-sessions-main">
        {loading ? (
          <div className="sessions-grid" role="status" aria-busy="true" aria-label={t.common.loading}>
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="session-card premium-card space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
            <p className="font-bold text-[var(--wn-text-danger)]">{loadError}</p>
            <button
              type="button"
              onClick={fetchSessions}
              className="btn-primary min-h-[44px] inline-flex items-center gap-2"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>{t.common.retry}</span>
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={t.live.noSessions}
            description={t.live.noSessionsDesc}
            action={canManage && liveStatus.configured ? (
              <button
                type="button"
                className="btn-premium min-h-[44px]"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={20} aria-hidden="true" />
                {t.live.createFirst}
              </button>
            ) : null}
          />
        ) : (
          <div className="sessions-grid">
            <AnimatePresence>
              {sessions.map((session, index) => (
                <motion.div
                  key={session.roomId}
                  className="session-card premium-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="session-status">
                    {session.isLive ? (
                      <span className="live-indicator">
                        <span className="live-dot"></span>
                        {t.live.live}
                      </span>
                    ) : (
                      <span className="scheduled-indicator">
                        <Clock size={14} aria-hidden="true" />
                        {t.live.scheduled}
                      </span>
                    )}
                  </div>

                  <div className="session-icon">
                    <Video size={32} aria-hidden="true" />
                  </div>

                  <h3 className="session-title">{session.title}</h3>

                  {session.description && (
                    <p className="session-description">{session.description}</p>
                  )}

                  <div className="session-meta">
                    <div className="meta-item">
                      <BookOpen size={16} aria-hidden="true" />
                      <span>{session.subject || t.live.general}</span>
                    </div>
                    <div className="meta-item">
                      <Users size={16} aria-hidden="true" />
                      <span>{session.participants || 0} {t.live.participants}</span>
                    </div>
                    {session.scheduledAt && (
                      <div className="meta-item">
                        <Calendar size={16} aria-hidden="true" />
                        <span>{formatSessionDateTime(session, resolveIntlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session)}</span>
                      </div>
                    )}
                  </div>

                  <div className="session-actions">
                    <button
                      type="button"
                      className="btn-premium join-btn min-h-[44px]"
                      onClick={() => joinSession(session.roomId)}
                    >
                      <Play size={18} aria-hidden="true" />
                      {session.isLive ? t.live.joinNow : t.live.enterRoom}
                    </button>

                    <button
                      type="button"
                      className="btn-icon copy-btn min-w-[44px] min-h-[44px]"
                      onClick={() => copyLink(session.roomId)}
                      aria-label={t.live.copyLink}
                      title={t.live.copyLink}
                    >
                      {copiedId === session.roomId ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                    </button>

                    {session.canManage && (
                      <button
                        type="button"
                        className="btn-icon delete-btn min-w-[44px] min-h-[44px]"
                        onClick={() => setDeleteConfirmRoomId(session.roomId)}
                        aria-label={t.common.delete}
                        title={t.common.delete}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Modal
        isOpen={Boolean(deleteConfirmRoomId)}
        onClose={() => !deleting && setDeleteConfirmRoomId(null)}
        title={t.live.sessions.deleteTitle}
        disableClose={deleting}
      >
        <div className="p-2 space-y-4 text-start" dir={dir}>
          <p className="font-bold text-[var(--wn-text-primary)]">{t.live.sessions.confirmDelete}</p>
          <p className="text-sm text-[var(--wn-text-secondary)]">{t.live.sessions.deleteConfirmBody}</p>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteConfirmRoomId(null)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] font-semibold cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => deleteSession(deleteConfirmRoomId)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--wn-danger)] text-[var(--wn-white)] font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              {deleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              <span>{deleting ? t.common.deleting : t.live.sessions.deleteConfirmBtn}</span>
            </button>
          </div>
        </div>
      </Modal>

      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        role={role}
        onCreated={(session) => {
          setSessions((prev) => [session, ...prev]);
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}

function CreateSessionModal({ isOpen, onClose, onCreated, role }) {
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [bookedSessions, setBookedSessions] = useState([]);

  useEffect(() => {
    if (!isOpen || role !== 'teacher') return;

    let active = true;
    api.get('/api/sessions/my-sessions?status=accepted&limit=50', { auth: true })
      .then((data) => {
        if (active) setBookedSessions(data.sessions || []);
      })
      .catch(() => {
        if (active) setBookedSessions([]);
      });

    return () => {
      active = false;
    };
  }, [isOpen, role]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating || !title.trim() || (role === 'teacher' && !sessionId)) return;

    setCreating(true);
    setFormError('');
    try {
      const session = await api.post('/api/live/sessions', {
        title: title.trim(),
        description: description.trim(),
        subject,
        sessionId: sessionId || undefined,
      }, { auth: true });

      onCreated(session);
      setTitle('');
      setDescription('');
      setSubject('');
      setSessionId('');
    } catch (error) {
      console.error('Failed to create session:', error);
      const msg = error?.message || t.live.sessions.createError;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !creating && onClose()}
      title={t.live.createSession}
      disableClose={creating}
    >
      <div className="create-session-modal" dir={dir}>
        <p className="modal-subtitle">{t.live.createSessionDesc}</p>

        {formError && (
          <div role="alert" className="rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-3 py-2 text-xs text-[var(--wn-text-danger)]">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreate} className="session-form">
          {role === 'teacher' && (
            <div className="form-group">
              <label htmlFor="live-linked-session">{t.live.sessions.linkedSessionLabel}</label>
              <select
                id="live-linked-session"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="premium-input min-h-[44px]"
                required
              >
                <option value="">{t.live.sessions.selectAcceptedSession}</option>
                {bookedSessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.student?.name || t.live.sessions.circleStudentFallback} — {new Date(session.scheduledAt).toLocaleString(resolveIntlLocale(locale))}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="live-session-title">{t.live.sessionTitle}</label>
            <input
              id="live-session-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.live.sessionTitlePlaceholder}
              className="premium-input min-h-[44px]"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="live-session-subject">{t.live.sessionSubject}</label>
            <select
              id="live-session-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="premium-input min-h-[44px]"
            >
              <option value="">{t.live.selectSubject}</option>
              <option value="quran">{t.live.subjects.quran}</option>
              <option value="tajweed">{t.live.subjects.tajweed}</option>
              <option value="tafseer">{t.live.subjects.tafseer}</option>
              <option value="hadith">{t.live.subjects.hadith}</option>
              <option value="fiqh">{t.live.subjects.fiqh}</option>
              <option value="arabic">{t.live.subjects.arabic}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="live-session-description">{t.live.sessionDescription}</label>
            <textarea
              id="live-session-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.live.sessionDescriptionPlaceholder}
              className="premium-input"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              disabled={creating}
              className="btn-premium-outline min-h-[44px]"
              onClick={onClose}
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="btn-premium min-h-[44px] inline-flex items-center gap-2"
              disabled={creating || !title.trim() || (role === 'teacher' && !sessionId)}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>{t.common.loading}</span>
                </>
              ) : (
                <>
                  <Radio size={18} aria-hidden="true" />
                  <span>{t.live.startSession}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}