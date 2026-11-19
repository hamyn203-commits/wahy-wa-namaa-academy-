import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useParticipants,
  TrackToggle,
  DisconnectButton
} from '@livekit/components-react';
import '@livekit/components-styles';
import './LiveRoom.css';
import '../../styles/session-experience.css';
import '../../components/classroom/classroom.css';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Users, MessageSquare, Send, X, ArrowRight, ArrowLeft,
  Languages, BookOpen, Shield, Sparkles, AlertTriangle, Eye, Clock, CheckCircle2, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { LangSelect } from '../../components/live/SessionTranslateChat';
import { translateText } from '../../lib/translateApi';
import { detectBrowserLocale, localizedPath, resolveIntlLocale } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import SyncedMushaf from '../../components/classroom/SyncedMushaf';
import CircleTurnManager from '../../components/classroom/CircleTurnManager';
import { inspectMessage } from '../../components/classroom/ChatSafetyFilter';

function LiveRoomContent({ isHost, isObserver, participantName, roomId, sessionContext, onEndAndEvaluate }) {
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('mushaf'); // 'mushaf' | 'circle' | 'video'

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [safetyWarning, setSafetyWarning] = useState(null);
  const [chatError, setChatError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chatEndRef = useRef(null);

  const [myLang, setMyLang] = useState(() => locale || detectBrowserLocale());
  const [partnerLang, setPartnerLang] = useState(() => ((locale || detectBrowserLocale()) === 'ar' ? 'id' : 'ar'));
  const [autoTranslate, setAutoTranslate] = useState(false);
  const autoTranslateBudgetRef = useRef({ windowStart: 0, count: 0 });

  const participants = useParticipants();
  const room = useRoomContext();
  const localParticipant = useLocalParticipant();

  const addMessage = useCallback(async (text, sender, isMe, lang) => {
    const cleanText = String(text || '').trim().slice(0, 1000);
    if (!cleanText) return;
    if (!isMe) {
      const incomingCheck = inspectMessage(cleanText);
      if (!incomingCheck.isSafe) {
        return;
      }
    }
    const safeLang = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'].includes(String(lang || '').toLowerCase())
      ? String(lang).toLowerCase()
      : 'ar';
    let displayText = cleanText;
    let original = null;
    if (autoTranslate && !isMe && safeLang && safeLang !== myLang) {
      const now = Date.now();
      const budget = autoTranslateBudgetRef.current;
      if (now - budget.windowStart > 60000) {
        budget.windowStart = now;
        budget.count = 0;
      }
      if (budget.count < 15) {
        budget.count += 1;
        try {
          displayText = await translateText(cleanText, safeLang, myLang, { auth: true });
          original = cleanText;
        } catch { /* keep original */ }
      }
    }
    setChatMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      sender,
      text: displayText,
      original,
      lang: safeLang,
      timestamp: new Date().toLocaleTimeString(resolveIntlLocale(locale), { hour: '2-digit', minute: '2-digit' }),
      isMe,
    }]);
    if (!showChat && !isMe) {
      setUnreadCount((c) => c + 1);
    }
  }, [autoTranslate, myLang, showChat, locale]);

  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChat, chatMessages.length]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isHost && roomId) {
      api.patch('/api/live/sessions/' + encodeURIComponent(roomId) + '/live', { isLive: true }, { auth: true }).catch(() => {});
    }
  }, [isHost, roomId]);

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = async (payload, participant) => {
      try {
        const raw = new TextDecoder().decode(payload);
        const message = JSON.parse(raw);

        if (message.type === 'MUSHAF_ACTION' || message.type === 'CIRCLE_ACTION') {
          return;
        }

        if (message.text) {
          await addMessage(
            message.text,
            participant?.name || t.live.room.unknownSender,
            false,
            message.lang || 'ar'
          );
        }
      } catch (e) {
        console.error('Failed to parse incoming message:', e);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, myLang, autoTranslate, addMessage, t]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (isObserver || !newMessage.trim() || !localParticipant.localParticipant) return;

    const inspection = inspectMessage(newMessage);
    if (!inspection.isSafe) {
      const reasonText = inspection.reasonKey ? t.live.chatSafety?.[inspection.reasonKey] : '';
      const warningText = t.live.chatSafety?.[inspection.warningKey] || inspection.warning;
      setSafetyWarning(reasonText ? `${reasonText} — ${warningText}` : warningText);
      return;
    }

    setSafetyWarning(null);
    setChatError('');

    const messageData = {
      type: 'chat',
      text: newMessage,
      lang: myLang,
      timestamp: Date.now(),
    };

    try {
      await localParticipant.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(messageData)),
        { reliable: true }
      );

      setChatMessages((prev) => [...prev, {
        id: Date.now(),
        sender: t.live.room.meSender,
        text: newMessage,
        lang: myLang,
        timestamp: new Date().toLocaleTimeString(resolveIntlLocale(locale), { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      }]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError(t.live.room.chatSendError);
      toast.error(t.live.room.chatSendError);
    }
  };

  return (
    <div className="live-room-container" dir={dir}>
      {isObserver && (
        <div className="observer-banner flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Shield size={16} className="text-amber-300 shrink-0" aria-hidden="true" />
            <span>{t.live.room.observerBanner}</span>
          </div>
          <span className="observer-badge shrink-0">
            <Eye size={12} aria-hidden="true" />
            {t.live.room.observerWatchOnly}
          </span>
        </div>
      )}

      <div className="live-room-header">
        <div className="live-room-header-right">
          <BrandLogo size={40} variant="light" />
          <div className="live-room-info">
            <div className="flex flex-wrap items-center gap-2">
              <h2>{sessionContext?.title || t.live.title}</h2>
              {isObserver ? (
                <span className="observer-badge">
                  <Shield size={12} aria-hidden="true" />
                  {t.live.room.roleObserver}
                </span>
              ) : isHost ? (
                <span className="teacher-badge">
                  <Sparkles size={12} aria-hidden="true" />
                  {t.live.room.roleTeacher}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
                  {t.live.room.roleStudent}
                </span>
              )}
            </div>
            <div className="live-room-stats">
              <span className="live-badge">
                <span className="live-dot"></span>
                {t.live.live}
              </span>
              <span className="participants-count">
                <Users size={16} aria-hidden="true" />
                {participants.length} {t.live.participants} • <Clock size={13} className="inline ms-1" aria-hidden="true" />{formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="live-room-tabs" role="tablist" aria-label={t.live.title}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mushaf'}
            aria-label={t.live.room.mushafTab}
            className={`room-tab-btn ${activeTab === 'mushaf' ? 'active' : ''}`}
            onClick={() => setActiveTab('mushaf')}
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>{t.live.room.mushafTab}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'circle'}
            aria-label={t.live.room.circleTab}
            className={`room-tab-btn ${activeTab === 'circle' ? 'active' : ''}`}
            onClick={() => setActiveTab('circle')}
          >
            <Users size={16} aria-hidden="true" />
            <span>{t.live.room.circleTab}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'video'}
            aria-label={t.live.room.videoTab}
            className={`room-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            <Video size={16} aria-hidden="true" />
            <span>{t.live.room.videoTab}</span>
          </button>
        </div>

        <div className="live-room-header-left flex items-center gap-2">
          {isHost && onEndAndEvaluate && (
            <button
              type="button"
              onClick={onEndAndEvaluate}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              title={t.live.room.endAndEvaluateTitle}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{t.live.room.endAndEvaluate}</span>
            </button>
          )}
          <button
            type="button"
            className={`chat-toggle-btn ${showChat ? 'active' : ''}`}
            onClick={() => { setShowChat((v) => !v); setUnreadCount(0); }}
            aria-label={t.live.room.chatToggleTitle}
            aria-expanded={showChat}
            title={t.live.room.chatToggleTitle}
          >
            <MessageSquare size={20} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="chat-badge">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="live-room-main">
        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-900">
          {activeTab === 'mushaf' && (
            <div className="w-full h-full p-2 flex flex-col">
              <SyncedMushaf
                room={room}
                localParticipant={localParticipant}
                isTeacher={isHost}
                isObserver={isObserver}
              />
            </div>
          )}

          {activeTab === 'circle' && (
            <div className="w-full h-full p-3 flex flex-col overflow-y-auto">
              <CircleTurnManager
                room={room}
                localParticipant={localParticipant}
                participants={participants}
                isTeacher={isHost}
                isObserver={isObserver}
                currentUserName={participantName}
                rosterStudents={sessionContext?.roster || []}
                onMuteLocalMic={() => localParticipant?.localParticipant?.setMicrophoneEnabled(false)}
              />
            </div>
          )}

          {activeTab === 'video' && (
            <div className="video-area">
              <VideoConference />
            </div>
          )}

          <RoomAudioRenderer />
        </div>

        <AnimatePresence>
          {showChat && (
            <motion.div
              className="chat-panel"
              initial={{ x: isRTL ? -300 : 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -300 : 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="chat-header">
                <h3>{t.live.chat}</h3>
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className="chat-close-btn"
                  aria-label={t.common.close}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="p-3 border-b border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--wn-text-accent)]">
                  <Languages size={14} aria-hidden="true" /> {t.live.room.liveTranslationLabel}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LangSelect label={t.live.room.myLang} value={myLang} onChange={setMyLang} uiLocale={locale} />
                  <LangSelect label={t.live.room.translateTo} value={partnerLang} onChange={setPartnerLang} uiLocale={locale} />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--wn-text-primary)] cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={autoTranslate} onChange={(e) => setAutoTranslate(e.target.checked)} />
                  <span>{t.live.room.autoTranslateToggle}</span>
                </label>
              </div>

              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <MessageSquare size={48} aria-hidden="true" />
                    <p>{t.live.noMessages}</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.isMe ? 'mine' : ''}`}>
                      <div className="message-header">
                        <span className="sender-name">{msg.sender}</span>
                        <span className="message-time">{msg.timestamp}</span>
                      </div>
                      <p className="message-text">{msg.text}</p>
                      <span ref={chatEndRef} />
                      {msg.original && msg.original !== msg.text && (
                        <p className="text-xs text-[var(--wn-text-secondary)] mt-1 italic">{msg.original}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {safetyWarning && (
                <div role="alert" className="p-3 bg-[var(--wn-danger-soft)] border-t border-[var(--wn-border)] text-[var(--wn-text-danger)] text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold mb-0.5">{t.live.room.safetyAlertTitle}</p>
                    <p>{safetyWarning}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSafetyWarning(null)}
                    aria-label={t.live.chatSafetyDismiss}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}

              {chatError && (
                <div role="alert" className="px-3 py-2 text-xs bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-t border-[var(--wn-border)]">
                  {chatError}
                </div>
              )}

              <form className="chat-input-form" onSubmit={sendMessage}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (safetyWarning) setSafetyWarning(null);
                    if (chatError) setChatError('');
                  }}
                  aria-label={t.live.room.chatPlaceholder}
                  placeholder={t.live.room.chatPlaceholder}
                  className="chat-input"
                  disabled={isObserver}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={isObserver || !newMessage.trim()}
                  aria-label={t.live.chatSend}
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="live-room-controls">
        <div className="controls-group">
          {isObserver ? (
            <div className="observer-media-locked" title={t.live.room.observerMediaLocked}>
              <div className="observer-lock-pill">
                <MicOff size={18} className="text-red-400" aria-hidden="true" />
                <VideoOff size={18} className="text-red-400" aria-hidden="true" />
                <span>{t.live.room.observerMediaLocked}</span>
              </div>
            </div>
          ) : (
            <>
              <TrackToggle source="microphone">
                {(isEnabled) => (isEnabled ? <Mic size={24} /> : <MicOff size={24} />)}
              </TrackToggle>

              <TrackToggle source="camera">
                {(isEnabled) => (isEnabled ? <Video size={24} /> : <VideoOff size={24} />)}
              </TrackToggle>

              {isHost && (
                <TrackToggle source="screen_share">
                  {(isEnabled) => (isEnabled ? <Monitor size={24} /> : <MonitorOff size={24} />)}
                </TrackToggle>
              )}
            </>
          )}
        </div>

        <DisconnectButton>
          <PhoneOff size={24} aria-hidden="true" />
          <span>{t.live.leave}</span>
        </DisconnectButton>
      </div>
    </div>
  );
}

export default function LiveRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { locale, dir, isRTL, t } = useI18n();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);
  const [serverPermissions, setServerPermissions] = useState(null);
  const [resolvedServerUrl, setResolvedServerUrl] = useState('');
  const [standalonePreview, setStandalonePreview] = useState(false);
  const [previewTab, setPreviewTab] = useState('mushaf');
  const [retryNonce, setRetryNonce] = useState(0);

  const role = serverPermissions?.role || user?.role || '';
  const isHost = serverPermissions?.isHost ?? (role === 'teacher' || role === 'admin');
  const isObserver = serverPermissions?.isObserver ?? (role === 'guardian' || role === 'supervisor');
  const participantName = user?.name || user?.email || (isObserver ? t.live.room.roleObserver : isHost ? t.live.room.roleTeacher : t.live.room.roleStudent);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale), { replace: true });
      return;
    }

    let cancelled = false;
    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await api.post('/api/live/token', {
          roomName: roomId,
          participantName,
        }, { auth: true });

        if (cancelled) return;
        setToken(data.token);
        if (data.permissions) setServerPermissions(data.permissions);
        if (data.sessionContext) setSessionContext(data.sessionContext);
        if (data.serverUrl) setResolvedServerUrl(data.serverUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || t.live.room.tokenError);
        api.get('/api/live/sessions/' + encodeURIComponent(roomId), { auth: true })
          .then((s) => {
            if (!cancelled && s?.sessionContext) setSessionContext(s.sessionContext);
          })
          .catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (roomId) fetchToken();
    return () => { cancelled = true; };
  }, [roomId, participantName, authLoading, isAuthenticated, navigate, locale, retryNonce, t]);

  if (loading) {
    return (
      <div className="live-room-loading" dir={dir} role="status" aria-live="polite">
        <BrandLogo size={72} variant="light" />
        <div className="spinner spinner-lg"></div>
        <p>{t.live.room.connectingRoom}</p>
      </div>
    );
  }

  const handleEndAndEvaluate = async () => {
    if (isHost && roomId) {
      await api.patch('/api/live/sessions/' + encodeURIComponent(roomId) + '/live', { isLive: false }, { auth: true }).catch(() => {});
    }
    if (role === 'teacher' && sessionContext?.sessionId) {
      navigate(localizedPath(`/teacher/dashboard?tab=sessions&evaluate=${encodeURIComponent(sessionContext.sessionId)}`, locale));
      return;
    }
    navigate(dashboardPathForRole(role, locale));
  };

  if (standalonePreview) {
    return (
      <div className="live-room-container" dir={dir}>
        <div className="live-room-header">
          <div className="live-room-header-right">
            <BrandLogo size={40} variant="light" />
            <div className="live-room-info">
              <div className="flex flex-wrap items-center gap-2">
                <h2>{sessionContext?.title || t.live.title}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {t.live.room.smartClassroomBadge}
                </span>
              </div>
            </div>
          </div>
          <div className="live-room-tabs" role="tablist" aria-label={t.live.title}>
            <button
              type="button"
              role="tab"
              aria-selected={previewTab === 'mushaf'}
              aria-label={t.live.room.mushafTab}
              className={`room-tab-btn ${previewTab === 'mushaf' ? 'active' : ''}`}
              onClick={() => setPreviewTab('mushaf')}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>{t.live.room.mushafTab}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={previewTab === 'circle'}
              aria-label={t.live.room.circleTab}
              className={`room-tab-btn ${previewTab === 'circle' ? 'active' : ''}`}
              onClick={() => setPreviewTab('circle')}
            >
              <Users size={16} aria-hidden="true" />
              <span>{t.live.room.circleTab}</span>
            </button>
          </div>
          <div className="live-room-header-left">
            <button
              type="button"
              onClick={() => navigate(dashboardPathForRole(role, locale))}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              {isRTL ? <ArrowRight size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
              <span>{t.live.room.backToDashboard}</span>
            </button>
          </div>
        </div>
        <div className="live-room-main">
          <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-900">
            {previewTab === 'mushaf' ? (
              <div className="w-full h-full p-2 flex flex-col">
                <SyncedMushaf room={null} localParticipant={null} isTeacher={isHost} isObserver={isObserver} />
              </div>
            ) : (
              <div className="w-full h-full p-3 flex flex-col overflow-y-auto">
                <CircleTurnManager
                  room={null}
                  localParticipant={null}
                  participants={[]}
                  isTeacher={isHost}
                  isObserver={isObserver}
                  currentUserName={participantName}
                  rosterStudents={sessionContext?.roster || []}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-room-error" dir={dir}>
        <BrandLogo size={72} variant="light" />
        <h2>{t.live.error}</h2>
        <p>{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] font-semibold inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            <RotateCcw size={18} aria-hidden="true" />
            <span>{t.live.room.retry}</span>
          </button>
          <button
            type="button"
            onClick={() => setStandalonePreview(true)}
            className="btn-premium min-h-[44px]"
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>{t.live.room.openSmartClassroom}</span>
          </button>
          {sessionContext?.sessionId && (
            <button
              type="button"
              onClick={() => navigate(localizedPath(`/meeting/${sessionContext.sessionId}`, locale))}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Languages size={18} aria-hidden="true" />
              <span>{t.live.room.altMeetingRoom}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(dashboardPathForRole(role, locale))}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            {isRTL ? <ArrowRight size={18} aria-hidden="true" /> : <ArrowLeft size={18} aria-hidden="true" />}
            <span>{t.live.room.backToDashboard}</span>
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  const serverUrl = resolvedServerUrl || import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud';

  return (
    <LiveKitRoom
      video={!isObserver}
      audio={!isObserver}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      onDisconnected={() => navigate(dashboardPathForRole(role, locale))}
    >
      <LiveRoomContent
        isHost={isHost}
        isObserver={isObserver}
        participantName={participantName}
        roomId={roomId}
        sessionContext={sessionContext}
        onEndAndEvaluate={isHost ? handleEndAndEvaluate : null}
      />
    </LiveKitRoom>
  );
}
