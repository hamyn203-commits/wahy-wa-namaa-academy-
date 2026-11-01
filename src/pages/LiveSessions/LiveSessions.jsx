import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, Plus, Users, Calendar, Clock, Play, 
  Video, BookOpen, Trash2, Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';
import { useAppContext } from '../../context/AppProvider';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import '../LiveRoom/LiveRoom.css';
import '../../styles/session-experience.css';

export default function LiveSessions() {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { t } = useAppContext();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [liveStatus, setLiveStatus] = useState({ configured: false });
  const [demoLoading, setDemoLoading] = useState(false);
  const [deleteConfirmRoomId, setDeleteConfirmRoomId] = useState(null);

  const role = user?.role || '';
  const canManage = role === 'teacher' || role === 'admin';

  const fetchSessions = async () => {
    try {
      const data = await api.get('/api/live/sessions', { auth: true });
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale), { replace: true });
      return;
    }

    fetchSessions();
    api.get('/api/live/status').then(setLiveStatus).catch(() => {});
    // fetchSessions is intentionally scoped to this authenticated page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, navigate, locale]);

  const copyLink = (roomId) => {
    const link = `${window.location.origin}${localizedPath(`/live/${roomId}`, locale)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const joinSession = (roomId) => {
    navigate(localizedPath(`/live/${roomId}`, locale));
  };

  const startDemo = async () => {
    setDemoLoading(true);
    try {
      const data = await api.post('/api/live/demo-room', {}, { auth: true });
      if (data.roomId) joinSession(data.roomId);
    } catch (e) {
      console.error(e);
    } finally {
      setDemoLoading(false);
    }
  };

  const deleteSession = async (roomId) => {
    if (!roomId) return;
    setDeleteConfirmRoomId(null);
    
    try {
      await api.delete(`/api/live/sessions/${roomId}`, { auth: true });
      setSessions(prev => prev.filter(s => s.roomId !== roomId));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <div className="live-sessions-page wn-session-shell">
      <header className="live-sessions-header">
        <div className="header-content">
          <div className="header-right">
            <BrandLogo size={50} />
            <div className="header-info">
              <h1>{t.live.sessionsTitle}</h1>
              <p>{t.live.sessionsSubtitle}</p>
            </div>
          </div>
          {canManage && liveStatus.configured && (
            <button 
              className="btn-premium create-session-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} />
              {t.live.createSession}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm ${liveStatus.configured ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}>
          <span className="flex items-center gap-2">
            <Radio size={16} />
            {liveStatus.configured
              ? (t.live?.liveKitReady || 'LiveKit جاهز — يمكنك إنشاء غرفة أو تجربة العرض')
              : (t.live?.liveKitPending || 'LiveKit غير مُفعّل — استخدم «غرفة تجريبية» للمعاينة')}
          </span>
          {import.meta.env.DEV && role === 'admin' && (
            <button type="button" onClick={startDemo} disabled={demoLoading} className="btn-premium text-sm py-2 px-4">
              <Play size={16} />
              {demoLoading ? '...' : (t.live?.tryDemo || 'غرفة تجريبية')}
            </button>
          )}
        </div>
      </div>

      <main className="live-sessions-main">
        {loading ? (
          <div className="loading-sessions">
            <div className="spinner spinner-lg"></div>
            <p>{t.common.loading}</p>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={t.live.noSessions}
            description={t.live.noSessionsDesc}
            action={canManage && liveStatus.configured ? (
              <button 
                className="btn-premium"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={20} />
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
                        <Clock size={14} />
                        {t.live.scheduled}
                      </span>
                    )}
                  </div>

                  <div className="session-icon">
                    <Video size={32} />
                  </div>

                  <h3 className="session-title">{session.title}</h3>
                  
                  {session.description && (
                    <p className="session-description">{session.description}</p>
                  )}

                  <div className="session-meta">
                    <div className="meta-item">
                      <BookOpen size={16} />
                      <span>{session.subject || t.live.general}</span>
                    </div>
                    <div className="meta-item">
                      <Users size={16} />
                      <span>{session.participants || 0} {t.live.participants}</span>
                    </div>
                    {session.scheduledAt && (
                      <div className="meta-item">
                        <Calendar size={16} />
                        <span>{formatSessionDateTime(session, locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session)}</span>
                      </div>
                    )}
                  </div>

                  <div className="session-actions">
                    <button 
                      className="btn-premium join-btn"
                      onClick={() => joinSession(session.roomId)}
                    >
                      <Play size={18} />
                      {session.isLive ? t.live.joinNow : t.live.enterRoom}
                    </button>
                    
                    <button 
                      className="btn-icon copy-btn"
                      onClick={() => copyLink(session.roomId)}
                      title={t.live.copyLink}
                    >
                      {copiedId === session.roomId ? <Check size={18} /> : <Copy size={18} />}
                    </button>

                    {session.canManage && (
                      <button 
                        className="btn-icon delete-btn"
                        onClick={() => setDeleteConfirmRoomId(session.roomId)}
                        title={t.common.delete}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Modal isOpen={Boolean(deleteConfirmRoomId)} onClose={() => setDeleteConfirmRoomId(null)}>
        <div className="p-4 space-y-4 text-right" dir="rtl">
          <h3 className="text-lg font-bold text-slate-900">{t.live.confirmDelete || 'تأكيد حذف الغرفة المباشرة'}</h3>
          <p className="text-sm text-slate-600">هل أنت متأكد من رغبتك في حذف هذه الغرفة المباشرة نهائياً؟</p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDeleteConfirmRoomId(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold">
              {t.common.cancel}
            </button>
            <button type="button" onClick={() => deleteSession(deleteConfirmRoomId)} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold">
              {t.common.delete}
            </button>
          </div>
        </div>
      </Modal>
      <CreateSessionModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        role={role}
        onCreated={(session) => {
          setSessions(prev => [session, ...prev]);
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}

function CreateSessionModal({ isOpen, onClose, onCreated, role }) {
  const { t } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);
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
    if (!title.trim() || (role === 'teacher' && !sessionId)) return;

    setCreating(true);
    try {
      const session = await api.post('/api/live/sessions', {
        title,
        description,
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
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="create-session-modal">
        <h2 className="text-gradient-gold">{t.live.createSession}</h2>
        <p className="modal-subtitle">{t.live.createSessionDesc}</p>

        <form onSubmit={handleCreate} className="session-form">
          {role === 'teacher' && (
            <div className="form-group">
              <label>الحصة المرتبطة</label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="premium-input"
                required
              >
                <option value="">اختر حصة مقبولة</option>
                {bookedSessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.student?.name || 'حلقة / طالب'} — {new Date(session.scheduledAt).toLocaleString('ar-EG')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>{t.live.sessionTitle}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.live.sessionTitlePlaceholder}
              className="premium-input"
              required
            />
          </div>

          <div className="form-group">
            <label>{t.live.sessionSubject}</label>
            <select 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="premium-input"
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
            <label>{t.live.sessionDescription}</label>
            <textarea
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
              className="btn-premium-outline"
              onClick={onClose}
            >
              {t.common.cancel}
            </button>
            <button 
              type="submit" 
              className="btn-premium"
              disabled={creating || !title.trim() || (role === 'teacher' && !sessionId)}
            >
              {creating ? t.common.loading : (
                <>
                  <Radio size={18} />
                  {t.live.startSession}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}