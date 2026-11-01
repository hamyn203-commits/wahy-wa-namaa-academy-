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
  PhoneOff, Users, MessageSquare, Send, X, ArrowRight, 
  Languages, BookOpen, Shield, Sparkles, AlertTriangle, Eye, Clock, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import { useAppContext } from '../../context/AppProvider';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { LangSelect } from '../../components/live/SessionTranslateChat';
import { translateText } from '../../lib/translateApi';
import { detectBrowserLocale, localizedPath } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import { useI18n } from '../../i18n';
import SyncedMushaf from '../../components/classroom/SyncedMushaf';
import CircleTurnManager from '../../components/classroom/CircleTurnManager';
import { inspectMessage } from '../../components/classroom/ChatSafetyFilter';

function LiveRoomContent({ isHost, isObserver, participantName, roomId, sessionContext, onEndAndEvaluate }) {
  const { t } = useAppContext();
  
  // شاشات الفصل الذكي (المصحف المتزامن / حلقة الـ 10 طلاب / شبكة الكاميرات)
  const [activeTab, setActiveTab] = useState('mushaf'); // 'mushaf' | 'circle' | 'video'

  // حالة الشات
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [safetyWarning, setSafetyWarning] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chatEndRef = useRef(null);

  // الترجمة الفورية
  const [myLang, setMyLang] = useState(detectBrowserLocale());
  const [partnerLang, setPartnerLang] = useState(myLang === 'ar' ? 'id' : 'ar');
  const [autoTranslate, setAutoTranslate] = useState(true);

  // LiveKit hooks
  const participants = useParticipants();
  const room = useRoomContext();
  const localParticipant = useLocalParticipant();

  const addMessage = useCallback(async (text, sender, isMe, lang) => {
    let displayText = text;
    let original = null;
    if (autoTranslate && lang && lang !== myLang) {
      try {
        displayText = await translateText(text, lang, myLang);
        original = text;
      } catch { /* keep original */ }
    }
    setChatMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      sender,
      text: displayText,
      original,
      lang,
      timestamp: new Date().toLocaleTimeString(),
      isMe,
    }]);
    if (!showChat && !isMe) {
      setUnreadCount((c) => c + 1);
    }
  }, [autoTranslate, myLang, showChat]);

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

        // تصفية أحداث المزامنة للمصحف والحلقة لمنع تداخلها مع الشات
        if (message.type === 'MUSHAF_ACTION' || message.type === 'CIRCLE_ACTION') {
          return;
        }

        if (message.text) {
          await addMessage(
            message.text,
            participant?.name || 'Unknown',
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
  }, [room, myLang, autoTranslate, addMessage]);

  // إرسال رسالة شات آمنة مع فحص الشات الأخلاقي
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !localParticipant.localParticipant) return;

    // فحص الأمان الأخلاقي وحظر أرقام الهواتف والروابط والبريد
    const inspection = inspectMessage(newMessage);
    if (!inspection.isSafe) {
      setSafetyWarning(inspection.warning);
      return;
    }

    setSafetyWarning(null);

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
        sender: 'أنا',
        text: newMessage,
        lang: myLang,
        timestamp: new Date().toLocaleTimeString(),
        isMe: true,
      }]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="live-room-container">
      {/* ── شريط وضع المراقب الصامت (ولي أمر / مشرف) ── */}
      {isObserver && (
        <div className="observer-banner">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-300" />
            <span>
              أهلاً بك في وضع المراقب الصامت. تم إغلاق الكاميرا والمايكروفون تلقائياً لضمان خصوصيتك وهدوء الحلقة القرآنية.
            </span>
          </div>
          <span className="observer-badge">
            <Eye size={12} />
            استماع ومشاهدة فقط
          </span>
        </div>
      )}

      {/* ── رأس الغرفة المباشرة ── */}
      <div className="live-room-header">
        <div className="live-room-header-right">
          <BrandLogo size={40} variant="light" />
          <div className="live-room-info">
            <div className="flex items-center gap-2">
              <h2>{sessionContext?.title || t.live.title}</h2>
              {isObserver ? (
                <span className="observer-badge">
                  <Shield size={12} />
                  مراقب / ولي أمر
                </span>
              ) : isHost ? (
                <span className="teacher-badge">
                  <Sparkles size={12} />
                  المعلم
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                  طالب
                </span>
              )}
            </div>
            <div className="live-room-stats">
              <span className="live-badge">
                <span className="live-dot"></span>
                {t.live.live}
              </span>
              <span className="participants-count">
                <Users size={16} />
                {participants.length} {t.live.participants} • <Clock size={13} className="inline ml-1" />{formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* أزرار تبديل وجهة الفصل (المصحف / الحلقة / الكاميرات) */}
        <div className="live-room-tabs">
          <button
            className={`room-tab-btn ${activeTab === 'mushaf' ? 'active' : ''}`}
            onClick={() => setActiveTab('mushaf')}
          >
            <BookOpen size={16} />
            <span>المصحف المتزامن</span>
          </button>
          <button
            className={`room-tab-btn ${activeTab === 'circle' ? 'active' : ''}`}
            onClick={() => setActiveTab('circle')}
          >
            <Users size={16} />
            <span>حلقة الـ 10 طلاب</span>
          </button>
          <button
            className={`room-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            <Video size={16} />
            <span>شبكة الكاميرات</span>
          </button>
        </div>

        <div className="live-room-header-left flex items-center gap-2">
          {isHost && onEndAndEvaluate && (
            <button
              type="button"
              onClick={onEndAndEvaluate}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
              title="إنهاء البث والانتقال للوحة المعلم لرصد التقييم"
            >
              <CheckCircle2 size={15} />
              <span>إنهاء الحصة والتقييم</span>
            </button>
          )}
          <button 
            className={`chat-toggle-btn ${showChat ? 'active' : ''}`}
            onClick={() => { setShowChat((v) => !v); setUnreadCount(0); }}
            title="المحادثة الفورية"
          >
            <MessageSquare size={20} />
            {unreadCount > 0 && (
              <span className="chat-badge">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── جسم الغرفة الرئيسي ── */}
      <div className="live-room-main">
        {/* العرض المختار */}
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

          {/* مشغّل الصوت المشترك للغرفة دائماً مفعل للاستماع */}
          <RoomAudioRenderer />
        </div>

        {/* ── لوحة الشات الجانبية مع فلتر الأمان الأخلاقي ── */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              className="chat-panel"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="chat-header">
                <h3>{t.live.chat}</h3>
                <button onClick={() => setShowChat(false)} className="chat-close-btn">
                  <X size={20} />
                </button>
              </div>

              {/* ترجمة فورية */}
              <div className="p-3 border-b bg-emerald-50/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                  <Languages size={14} /> ترجمة فورية
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LangSelect label="لغتي" value={myLang} onChange={setMyLang} isAr />
                  <LangSelect label="ترجم إلى" value={partnerLang} onChange={setPartnerLang} isAr />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={autoTranslate} onChange={(e) => setAutoTranslate(e.target.checked)} />
                  ترجمة تلقائية للرسائل الواردة
                </label>
              </div>
              
              {/* الرسائل */}
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <MessageSquare size={48} />
                    <p>{t.live.noMessages}</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.isMe ? 'mine' : ''}`}>
                      <div className="message-header">
                        <span className="sender-name">{msg.sender}</span>
                        <span className="message-time">{msg.timestamp}</span>
                      </div>
                      <p className="message-text">{msg.text}</p>
                      <span ref={chatEndRef} />
                      {msg.original && msg.original !== msg.text && (
                        <p className="text-xs text-gray-400 mt-1 italic">{msg.original}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* تنبيه فلتر الأمان الأخلاقي اللحظي */}
              {safetyWarning && (
                <div className="p-3 bg-red-50 border-t border-red-200 text-red-900 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold mb-0.5">تنبيه خصوصية وسلامة الغرفة:</p>
                    <p>{safetyWarning}</p>
                  </div>
                  <button 
                    onClick={() => setSafetyWarning(null)}
                    className="text-red-500 hover:text-red-700 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* إدخال الرسالة */}
              <form className="chat-input-form" onSubmit={sendMessage}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (safetyWarning) setSafetyWarning(null);
                  }}
                  placeholder={t.live.typeMessage}
                  className="chat-input"
                />
                <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── أشرطة التحكم السفلية ── */}
      <div className="live-room-controls">
        <div className="controls-group">
          {/* وضع المراقب: أزرار الصوت والكاميرا مغلقة تماماً */}
          {isObserver ? (
            <div className="observer-media-locked" title="الكاميرا والمايك مغلقان في وضع المراقب الصامت">
              <div className="observer-lock-pill">
                <MicOff size={18} className="text-red-400" />
                <VideoOff size={18} className="text-red-400" />
                <span>وضع المراقب الصامت (مشاهدة فقط)</span>
              </div>
            </div>
          ) : (
            <>
              <TrackToggle source="microphone">
                {(isEnabled) => isEnabled ? <Mic size={24} /> : <MicOff size={24} />}
              </TrackToggle>
              
              <TrackToggle source="camera">
                {(isEnabled) => isEnabled ? <Video size={24} /> : <VideoOff size={24} />}
              </TrackToggle>

              {isHost && (
                <TrackToggle source="screen_share">
                  {(isEnabled) => isEnabled ? <Monitor size={24} /> : <MonitorOff size={24} />}
                </TrackToggle>
              )}
            </>
          )}
        </div>

        <DisconnectButton>
          <PhoneOff size={24} />
          <span>{t.live.leave}</span>
        </DisconnectButton>
      </div>
    </div>
  );
}

export default function LiveRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { t } = useAppContext();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);
  const [resolvedServerUrl, setResolvedServerUrl] = useState('');
  const [standalonePreview, setStandalonePreview] = useState(false);
  const [previewTab, setPreviewTab] = useState('mushaf');

  const role = user?.role || '';
  const isHost = role === 'teacher' || role === 'admin';
  const isObserver = role === 'guardian' || role === 'supervisor';
  const participantName = user?.name || user?.email || (isObserver ? 'مراقب' : isHost ? 'المعلم' : 'طالب');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale), { replace: true });
      return;
    }

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await api.post('/api/live/token', {
          roomName: roomId,
          participantName,
        }, { auth: true });

        setToken(data.token);
        if (data.sessionContext) setSessionContext(data.sessionContext);
        if (data.serverUrl) setResolvedServerUrl(data.serverUrl);
      } catch (err) {
        setError(err.message || 'Failed to get token');
        api.get('/api/live/sessions/' + encodeURIComponent(roomId), { auth: true })
          .then((s) => { if (s?.sessionContext) setSessionContext(s.sessionContext); })
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    };

    if (roomId) fetchToken();
  }, [roomId, participantName, authLoading, isAuthenticated, navigate, locale]);

  if (loading) {
    return (
      <div className="live-room-loading">
        <BrandLogo size={72} variant="light" />
        <div className="spinner spinner-lg"></div>
        <p>{t.live.connecting}</p>
      </div>
    );
  }

  const handleEndAndEvaluate = async () => {
    if (isHost && roomId) {
      await api.patch('/api/live/sessions/' + encodeURIComponent(roomId) + '/live', { isLive: false }, { auth: true }).catch(() => {});
    }
    navigate(dashboardPathForRole(role, locale));
  };

  if (standalonePreview) {
    return (
      <div className="live-room-container">
        <div className="live-room-header">
          <div className="live-room-header-right">
            <BrandLogo size={40} variant="light" />
            <div className="live-room-info">
              <div className="flex items-center gap-2">
                <h2>{sessionContext?.title || t.live.title}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  وضع الفصل التفاعلي الذكي
                </span>
              </div>
            </div>
          </div>
          <div className="live-room-tabs">
            <button
              className={`room-tab-btn ${previewTab === 'mushaf' ? 'active' : ''}`}
              onClick={() => setPreviewTab('mushaf')}
            >
              <BookOpen size={16} />
              <span>المصحف المتزامن</span>
            </button>
            <button
              className={`room-tab-btn ${previewTab === 'circle' ? 'active' : ''}`}
              onClick={() => setPreviewTab('circle')}
            >
              <Users size={16} />
              <span>حلقة التسميع</span>
            </button>
          </div>
          <div className="live-room-header-left">
            <button
              type="button"
              onClick={() => navigate(dashboardPathForRole(role, locale))}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <ArrowRight size={15} />
              <span>العودة للوحة التحكم</span>
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
      <div className="live-room-error">
        <BrandLogo size={72} variant="light" />
        <h2>{t.live.error}</h2>
        <p>{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button type="button" onClick={() => setStandalonePreview(true)} className="btn-premium">
            <BookOpen size={18} />
            <span>فتح الفصل الذكي (المصحف وحلقة التسميع)</span>
          </button>
          {sessionContext?.sessionId && (
            <button
              type="button"
              onClick={() => navigate(localizedPath(`/meeting/${sessionContext.sessionId}`, locale))}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 inline-flex items-center gap-2"
            >
              <Languages size={18} />
              <span>غرفة الاجتماع والترجمة البديلة</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(dashboardPathForRole(role, locale))}
            className="px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 inline-flex items-center gap-2"
          >
            <ArrowRight size={18} />
            <span>العودة للوحة التحكم</span>
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
