import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
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
  BookOpen, Shield, Sparkles, AlertTriangle, Eye, Clock, CheckCircle2,
  RotateCcw, Trophy, Wifi, Maximize2, Minimize2, Gamepad2, PenTool
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import SyncedMushaf from '../../components/classroom/SyncedMushaf';
import CircleTurnManager from '../../components/classroom/CircleTurnManager';
import LiveQuranGameArena from '../../components/classroom/LiveQuranGameArena';
import TajweedMakharijModal from '../../components/classroom/TajweedMakharijModal';
import LiveEncouragementOverlay from '../../components/classroom/LiveEncouragementOverlay';
import TeacherPermissionsModal from '../../components/classroom/TeacherPermissionsModal';
import PostSessionRatingModal from '../../components/classroom/PostSessionRatingModal';
import useClassroomSync from '../../components/classroom/useClassroomSync';
import { inspectMessage } from '../../components/classroom/ChatSafetyFilter';

const SmartQuranWhiteboard = lazy(() => import('../../components/classroom/SmartQuranWhiteboard'));

function ClassroomStageCore({
  room = null,
  localParticipant = null,
  participants = [],
  isHost,
  isObserver,
  currentUserId = '',
  participantName,
  roomId,
  sessionContext,
  initialServerState = null,
  onEndAndEvaluate,
  onStudentVoluntaryLeave = null,
  onRemoteSessionEnded = null,
  onBackToDashboard = null,
  hasLiveKitMedia = false,
}) {
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('mushaf'); // 'mushaf' | 'whiteboard' | 'games' | 'circle' | 'video'
  const [focusMode, setFocusMode] = useState(false);
  const [lowDataMode, setLowDataMode] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [currentPageData, setCurrentPageData] = useState(null);

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [safetyWarning, setSafetyWarning] = useState(null);
  const [chatError, setChatError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chatEndRef = useRef(null);
  const lastAutoSwitchedRoundRef = useRef('');
  const lastTeleportNonceRef = useRef(initialServerState?.whiteboard?.teleportNonce || 0);
  const lastBoardPermRef = useRef(initialServerState?.whiteboard?.permission || 'teacher_only');

  const primaryStudentUserId = useMemo(() => {
    if (!isHost && !isObserver && currentUserId) return String(currentUserId);
    const firstRoster = sessionContext?.roster?.[0];
    if (firstRoster?.userId) return String(firstRoster.userId);
    if (firstRoster?.id && String(firstRoster.id).startsWith('student:')) {
      return String(firstRoster.id).slice('student:'.length);
    }
    return '';
  }, [isHost, isObserver, currentUserId, sessionContext]);

  const {
    classroomState,
    sessionEnded,
    syncedSessionContext,
    studentOpenMistakes,
    updateClassroomState,
    endClassroomForAll,
    submitGameAnswer,
    ringListenerBell,
    submitWhiteboardStudentAction,
    submitStudentPointer,
    pinStudentMistake,
    undoOrResolveMistake,
  } = useClassroomSync({
    roomId,
    room,
    localParticipant,
    isHost,
    isObserver,
    initialServerState,
    primaryStudentUserId,
  });

  const effectiveSessionContext = syncedSessionContext || sessionContext;
  const [endingRoom, setEndingRoom] = useState(false);

  const handleHostEndRoom = useCallback(async () => {
    if (!isHost || endingRoom) return;
    setEndingRoom(true);
    await endClassroomForAll();
    try {
      room?.disconnect();
    } catch {
      // ignore
    }
    if (onEndAndEvaluate) {
      await onEndAndEvaluate({ alreadyEndedOnServer: true });
    }
  }, [isHost, endingRoom, endClassroomForAll, room, onEndAndEvaluate]);

  useEffect(() => {
    if (!sessionEnded || isHost) return;
    try {
      room?.disconnect();
    } catch {
      // ignore
    }
    onRemoteSessionEnded?.(effectiveSessionContext);
  }, [sessionEnded, isHost, room, onRemoteSessionEnded, effectiveSessionContext]);

  const controls = classroomState?.controls || {};
  const followTeacherTab = controls.followTeacherTab !== false;
  const micPolicy = controls.micPolicy || 'open';
  const cameraAllowed = Boolean(controls.cameraAllowed);
  const chatMode = controls.chatMode || 'teacher_only';
  const allowHandRaise = controls.allowHandRaise !== false;
  const studentPointerAllowed = Boolean(controls.studentPointerAllowed);

  const canUseMic =
    isHost ||
    (!isObserver &&
      (micPolicy === 'open' ||
        (micPolicy === 'reciter_only' &&
          Boolean(controls.activeReciterUserId) &&
          String(currentUserId) === String(controls.activeReciterUserId))));

  const canUseCamera = isHost || (!isObserver && cameraAllowed);

  // Enforce Follow-Teacher-Screen lock on learners
  useEffect(() => {
    if (isHost || !followTeacherTab) return;
    const hostTab = controls.activeStageTab || 'mushaf';
    const resolvedTab = hostTab === 'video' && !hasLiveKitMedia ? 'mushaf' : hostTab;
    setActiveTab(resolvedTab);
  }, [isHost, followTeacherTab, controls.activeStageTab, hasLiveKitMedia]);

  // Enforce Hard Microphone Lock & Camera Privacy Gate on learners
  useEffect(() => {
    if (isHost || !localParticipant?.localParticipant) return;
    if (!canUseMic) {
      try {
        localParticipant.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // ignore
      }
    }
  }, [isHost, canUseMic, localParticipant]);

  useEffect(() => {
    if (isHost || !localParticipant?.localParticipant) return;
    if (!canUseCamera) {
      try {
        localParticipant.localParticipant.setCameraEnabled(false);
      } catch {
        // ignore
      }
    }
  }, [isHost, canUseCamera, localParticipant]);

  const selectStageTab = useCallback((nextTab) => {
    if (!isHost && followTeacherTab) return;
    setActiveTab(nextTab);
    if (isHost) {
      updateClassroomState({ controls: { activeStageTab: nextTab } });
    }
  }, [isHost, followTeacherTab, updateClassroomState]);

  // Auto-focus learners onto the Live Challenges tab whenever the teacher launches a new game round
  useEffect(() => {
    const g = classroomState?.activeGame;
    if (g?.status === 'active' && g?.roundId && g.roundId !== lastAutoSwitchedRoundRef.current) {
      lastAutoSwitchedRoundRef.current = g.roundId;
      if (!isHost) {
        setActiveTab('games');
      }
    }
  }, [classroomState?.activeGame, isHost]);

  // Auto-focus learners onto the Smart Whiteboard when the teacher teleports a verse or opens mini-boards
  useEffect(() => {
    const wb = classroomState?.whiteboard;
    if (!wb) return;
    const nextNonce = wb.teleportNonce || 0;
    const nextPerm = wb.permission || 'teacher_only';
    if (nextNonce > lastTeleportNonceRef.current) {
      lastTeleportNonceRef.current = nextNonce;
      if (!isHost) setActiveTab('whiteboard');
    }
    if (nextPerm !== lastBoardPermRef.current) {
      lastBoardPermRef.current = nextPerm;
      if (!isHost && (nextPerm === 'all_miniboards' || nextPerm === 'delegated')) {
        setActiveTab('whiteboard');
      }
    }
  }, [classroomState?.whiteboard, isHost]);

  const addMessage = useCallback((text, sender, isMe) => {
    const cleanText = String(text || '').trim().slice(0, 1000);
    if (!cleanText) return;
    if (!isMe) {
      const incomingCheck = inspectMessage(cleanText);
      if (!incomingCheck.isSafe) return;
    }
    setChatMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      sender,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString(resolveIntlLocale(locale), { hour: '2-digit', minute: '2-digit' }),
      isMe,
    }]);
    if (!showChat && !isMe) {
      setUnreadCount((c) => c + 1);
    }
  }, [showChat, locale]);

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

  useEffect(() => {
    if (!room) return undefined;

    const handleDataReceived = (payload, participant) => {
      try {
        const raw = new TextDecoder().decode(payload);
        const message = JSON.parse(raw);

        if (
          message.type === 'MUSHAF_ACTION' ||
          message.type === 'CIRCLE_ACTION' ||
          message.type === 'CLASSROOM_SYNC'
        ) {
          return;
        }

        if (message.text) {
          addMessage(
            message.text,
            participant?.name || t.live.room.unknownSender,
            false
          );
        }
      } catch {
        // ignore non-chat payloads
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, addMessage, t]);

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (isObserver || !newMessage.trim() || !localParticipant?.localParticipant) return;
    if (!isHost && chatMode === 'locked') return;

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
      timestamp: Date.now(),
    };

    const hostIdentities =
      !isHost && chatMode === 'teacher_only'
        ? participants
            .map((p) => p.identity)
            .filter((id) => id && (String(id).startsWith('teacher:') || String(id).startsWith('admin:')))
        : [];

    try {
      await localParticipant.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(messageData)),
        {
          reliable: true,
          ...(hostIdentities.length > 0 ? { destinationIdentities: hostIdentities } : {}),
        }
      );

      setChatMessages((prev) => [...prev, {
        id: Date.now(),
        sender: t.live.room.meSender,
        text: newMessage,
        timestamp: new Date().toLocaleTimeString(resolveIntlLocale(locale), { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      }]);
      setNewMessage('');
    } catch {
      setChatError(t.live.room.chatSendError);
      toast.error(t.live.room.chatSendError);
    }
  };

  const toggleLowDataMode = () => {
    const next = !lowDataMode;
    setLowDataMode(next);
    if (next && localParticipant?.localParticipant) {
      try {
        localParticipant.localParticipant.setCameraEnabled(false);
      } catch {
        // ignore
      }
    }
  };

  const activeLabModal = classroomState?.tajweedLab?.activeModal || 'none';
  const isTajweedModalOpen = ['metronome', 'makharij', 'qaida'].includes(activeLabModal);
  const totalStars = classroomState?.engagement?.totalStars || 0;
  const isGameActive = classroomState?.activeGame?.status === 'active';

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
          <BrandLogo size={38} variant="light" />
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
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-200 inline-flex items-center gap-1">
                <Trophy size={12} aria-hidden="true" />
                <span>{totalStars} ⭐</span>
              </span>
            </div>
            <div className="live-room-stats">
              <span className="live-badge">
                <span className="live-dot"></span>
                {hasLiveKitMedia ? t.live.live : t.live.room.smartClassroomBadge}
              </span>
              <span className="participants-count">
                <Users size={15} aria-hidden="true" />
                {hasLiveKitMedia ? `${participants.length} ${t.live.participants} • ` : ''}
                <Clock size={13} className="inline ms-1" aria-hidden="true" />
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="live-room-tabs" role="tablist" aria-label={t.live.title}>
          <button
            type="button"
            role="tab"
            disabled={!isHost && followTeacherTab}
            aria-selected={activeTab === 'mushaf'}
            aria-label={t.live.room.mushafTab}
            className={`room-tab-btn ${activeTab === 'mushaf' ? 'active' : ''}`}
            onClick={() => selectStageTab('mushaf')}
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>{t.live.room.mushafTab}</span>
          </button>

          <button
            type="button"
            role="tab"
            disabled={!isHost && followTeacherTab}
            aria-selected={activeTab === 'whiteboard'}
            aria-label={t.live.room.whiteboardTab}
            className={`room-tab-btn relative ${activeTab === 'whiteboard' ? 'active' : ''}`}
            onClick={() => selectStageTab('whiteboard')}
          >
            <PenTool size={16} aria-hidden="true" />
            <span>{t.live.room.whiteboardTab}</span>
            {classroomState?.whiteboard?.permission === 'all_miniboards' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            disabled={!isHost && followTeacherTab}
            aria-selected={activeTab === 'games'}
            aria-label={t.live.room.gamesTab}
            className={`room-tab-btn relative ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => selectStageTab('games')}
          >
            <Gamepad2 size={16} aria-hidden="true" />
            <span>{t.live.room.gamesTab}</span>
            {isGameActive && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            disabled={!isHost && followTeacherTab}
            aria-selected={activeTab === 'circle'}
            aria-label={t.live.room.circleTab}
            className={`room-tab-btn ${activeTab === 'circle' ? 'active' : ''}`}
            onClick={() => selectStageTab('circle')}
          >
            <Users size={16} aria-hidden="true" />
            <span>{t.live.room.circleTab}</span>
          </button>

          {hasLiveKitMedia && (isHost || !followTeacherTab) && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'video'}
              aria-label={t.live.room.videoTab}
              className={`room-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => selectStageTab('video')}
            >
              <Video size={16} aria-hidden="true" />
              <span>{t.live.room.videoTab}</span>
            </button>
          )}
        </div>

        <div className="live-room-header-left flex items-center gap-1.5">
          {isHost && (
            <button
              type="button"
              onClick={() => setShowPermissionsModal(true)}
              className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              title="ضبط صلاحيات الطلاب (الميكروفون، الكاميرا، المحادثة، وتثبيت الشاشة)"
            >
              <Shield size={15} aria-hidden="true" />
              <span className="hidden xl:inline">صلاحيات الطلاب</span>
            </button>
          )}
          {isHost && (
            <button
              type="button"
              onClick={() =>
                updateClassroomState({
                  tajweedLab: { activeModal: isTajweedModalOpen ? 'none' : 'metronome' },
                })
              }
              className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              title="فتح مختبر التجويد ومخارج الحروف واللوح النوراني"
            >
              <Sparkles size={15} aria-hidden="true" />
              <span className="hidden xl:inline">{t.live.room.tajweedLabBtn}</span>
            </button>
          )}

          {hasLiveKitMedia && (
            <>
              <button
                type="button"
                onClick={toggleLowDataMode}
                aria-pressed={lowDataMode}
                className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                  lowDataMode ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/85'
                }`}
                title="وضع توفير الباقة والاتصال الضعيف (صوت نقي + مصحف متزامن باستهلاك أقل 99%)"
              >
                <Wifi size={15} aria-hidden="true" />
                <span className="hidden xl:inline">{t.live.room.lowDataBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => setFocusMode((f) => !f)}
                aria-pressed={focusMode}
                className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                  focusMode ? 'bg-amber-500 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white/85'
                }`}
                title={t.live.room.focusModeBtn}
              >
                {focusMode ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
              </button>
            </>
          )}

          {isHost && onEndAndEvaluate && (
            <button
              type="button"
              disabled={endingRoom}
              onClick={handleHostEndRoom}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-60"
              title={t.live.room.endAndEvaluateTitle}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{t.live.room.endAndEvaluate}</span>
            </button>
          )}

          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isRTL ? <ArrowRight size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
              <span className="hidden sm:inline">{t.live.room.backToDashboard}</span>
            </button>
          )}

          {hasLiveKitMedia && (
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
          )}
        </div>
      </div>

      {/* شريط أوسمة التشجيع الروحانية + تنبيهات المستمع اليقظ + آداب المجلس */}
      <LiveEncouragementOverlay
        isTeacher={isHost}
        engagement={classroomState?.engagement}
        tajweedLabState={classroomState?.tajweedLab}
        pinnedMistakes={classroomState?.mushaf?.pinnedMistakes || []}
        onSendReaction={(reaction) =>
          updateClassroomState({
            reaction: { ...reaction, targetStudentId: primaryStudentUserId },
          })
        }
        onRewardListener={(alertId) => updateClassroomState({ rewardListenerAlertId: alertId })}
        onClearListeners={() => updateClassroomState({ clearListenerAlerts: true })}
        onTriggerRitual={(ritualType) => updateClassroomState({ tajweedLab: { ritualType } })}
        dir={dir}
      />

      <div className="live-room-main">
        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-900">
          {activeTab === 'mushaf' && (
            <div className="w-full h-full p-1.5 md:p-2 flex flex-col">
              <SyncedMushaf
                room={room}
                localParticipant={localParticipant}
                isTeacher={isHost}
                isObserver={isObserver}
                mushafState={classroomState?.mushaf}
                studentOpenMistakes={studentOpenMistakes}
                onSyncMushaf={(mushafPatch) => updateClassroomState({ mushaf: mushafPatch })}
                onPinMistake={pinStudentMistake}
                onUndoOrResolveMistake={undoOrResolveMistake}
                onRingListenerBell={ringListenerBell}
                onOpenTajweedLab={() => updateClassroomState({ tajweedLab: { activeModal: 'metronome' } })}
                onTeleportToWhiteboard={(textToBoard) => {
                  updateClassroomState({
                    whiteboard: {
                      mode: 'ayah',
                      ayahText: textToBoard,
                      stripTashkeel: false,
                      syllableMode: false,
                      clearMainBoard: true,
                      teleport: true,
                    },
                    controls: { activeStageTab: 'whiteboard' },
                  });
                  setActiveTab('whiteboard');
                }}
                onStudentPointWord={submitStudentPointer}
                allowHandRaise={allowHandRaise}
                studentPointerAllowed={studentPointerAllowed}
                onPageDataReady={setCurrentPageData}
              />
            </div>
          )}

          {activeTab === 'whiteboard' && (
            <div className="w-full h-full bg-[var(--wn-bg)] overflow-hidden flex flex-col">
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center text-sm font-bold text-[var(--wn-text-secondary)]">
                    جاري فتح السبورة الذكية…
                  </div>
                }
              >
                <SmartQuranWhiteboard
                  isTeacher={isHost}
                  isObserver={isObserver}
                  currentUserId={currentUserId}
                  rosterStudents={sessionContext?.roster || []}
                  whiteboardState={classroomState?.whiteboard}
                  onHostUpdateWhiteboard={(wbPatch) => updateClassroomState({ whiteboard: wbPatch })}
                  onStudentWhiteboardAction={submitWhiteboardStudentAction}
                  dir={dir}
                />
              </Suspense>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="w-full h-full bg-[var(--wn-bg)] overflow-hidden flex flex-col">
              <LiveQuranGameArena
                isTeacher={isHost}
                isObserver={isObserver}
                currentUserId={currentUserId}
                activeGame={classroomState?.activeGame}
                engagement={classroomState?.engagement}
                currentPageData={currentPageData}
                onLaunchGame={(gamePayload) => updateClassroomState({ activeGame: gamePayload })}
                onRevealGame={() => updateClassroomState({ activeGame: { status: 'revealed' } })}
                onResetGame={() => updateClassroomState({ activeGame: { status: 'idle' } })}
                onSubmitAnswer={submitGameAnswer}
                dir={dir}
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
                allowHandRaise={allowHandRaise}
                onActiveReciterChange={(reciterId) =>
                  updateClassroomState({ controls: { activeReciterUserId: reciterId } })
                }
                onMuteLocalMic={() => localParticipant?.localParticipant?.setMicrophoneEnabled(false)}
              />
            </div>
          )}

          {hasLiveKitMedia && activeTab === 'video' && (
            <div className="video-area">
              <VideoConference />
            </div>
          )}

          {/* شريط الفيديو العائم (PiP) بجانب المصحف والألعاب ليتفوق على زووم وميت */}
          {hasLiveKitMedia && activeTab !== 'video' && !focusMode && !lowDataMode && (
            <div className="hidden md:block absolute bottom-4 end-4 w-64 h-44 rounded-2xl overflow-hidden border-2 border-[var(--wn-gold)] shadow-2xl z-30 bg-slate-950">
              <VideoConference />
            </div>
          )}

          {hasLiveKitMedia && <RoomAudioRenderer />}
        </div>

        <AnimatePresence>
          {hasLiveKitMedia && showChat && (
            <motion.div
              className="chat-panel"
              initial={{ x: isRTL ? -300 : 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -300 : 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="chat-header">
                <div>
                  <h3>{t.live.chat}</h3>
                  <p className="text-[11px] text-[var(--wn-text-secondary)]">
                    {chatMode === 'locked'
                      ? '🔒 المحادثة مغلقة حالياً'
                      : chatMode === 'teacher_only'
                        ? '🛡️ رسائل الطلاب تصل للمعلم فقط'
                        : 'متاحة لجميع المشاركين'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className="chat-close-btn"
                  aria-label={t.common.close}
                >
                  <X size={20} aria-hidden="true" />
                </button>
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
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg font-bold cursor-pointer"
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
                  placeholder={!isHost && chatMode === 'locked' ? '🔒 المحادثة مغلقة من المعلم حالياً' : t.live.room.chatPlaceholder}
                  className="chat-input"
                  disabled={isObserver || (!isHost && chatMode === 'locked')}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={isObserver || (!isHost && chatMode === 'locked') || !newMessage.trim()}
                  aria-label={t.live.chatSend}
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasLiveKitMedia && (
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
                {canUseMic ? (
                  <TrackToggle source="microphone">
                    {(isEnabled) => (isEnabled ? <Mic size={24} /> : <MicOff size={24} />)}
                  </TrackToggle>
                ) : (
                  <div className="observer-lock-pill" title="الميكروفون مقفل من المعلم حتى يبدأ دورك">
                    <MicOff size={18} className="text-red-400" aria-hidden="true" />
                    <span className="text-xs">المايك بإذن المعلم</span>
                  </div>
                )}

                {canUseCamera ? (
                  <TrackToggle source="camera">
                    {(isEnabled) => (isEnabled ? <Video size={24} /> : <VideoOff size={24} />)}
                  </TrackToggle>
                ) : (
                  <div className="observer-lock-pill" title="الكاميرا مغلقة افتراضياً ولا تفتح إلا بإذن المعلم">
                    <VideoOff size={18} className="text-red-400" aria-hidden="true" />
                    <span className="text-xs">الكاميرا مقفلة</span>
                  </div>
                )}

                {isHost && (
                  <TrackToggle source="screen_share">
                    {(isEnabled) => (isEnabled ? <Monitor size={24} /> : <MonitorOff size={24} />)}
                  </TrackToggle>
                )}
              </>
            )}
          </div>

          {isHost ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={endingRoom}
                onClick={handleHostEndRoom}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <PhoneOff size={20} aria-hidden="true" />
                <span>{t.live.room.endSessionForAll || t.live.room.endAndEvaluate}</span>
              </button>
              <DisconnectButton>
                <span className="text-xs">{t.live.room.leaveTemporarily || t.live.leave}</span>
              </DisconnectButton>
            </div>
          ) : (
            <div onClickCapture={() => onStudentVoluntaryLeave?.()}>
              <DisconnectButton>
                <PhoneOff size={24} aria-hidden="true" />
                <span>{t.live.leave}</span>
              </DisconnectButton>
            </div>
          )}
        </div>
      )}

      {/* مختبر التجويد ومخارج الحروف واللوح النوراني الحي المتزامن */}
      <TajweedMakharijModal
        isOpen={isTajweedModalOpen}
        onClose={() => {
          if (isHost) {
            updateClassroomState({ tajweedLab: { activeModal: 'none' } });
          }
        }}
        isTeacher={isHost}
        tajweedLabState={classroomState?.tajweedLab}
        onUpdateLab={(labPatch) => updateClassroomState({ tajweedLab: labPatch })}
        dir={dir}
      />

      {isHost && (
        <TeacherPermissionsModal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          controls={controls}
          onUpdateControls={(ctrlPatch) => updateClassroomState({ controls: ctrlPatch })}
          dir={dir}
        />
      )}
    </div>
  );
}

function LiveKitConnectedStage(props) {
  const participants = useParticipants();
  const room = useRoomContext();
  const localParticipant = useLocalParticipant();
  return (
    <ClassroomStageCore
      {...props}
      room={room}
      localParticipant={localParticipant}
      participants={participants}
      hasLiveKitMedia
    />
  );
}

export default function LiveRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { locale, dir, isRTL, t } = useI18n();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [token, setToken] = useState(null);
  const [resolvedRoomId, setResolvedRoomId] = useState(roomId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);
  const [serverPermissions, setServerPermissions] = useState(null);
  const [initialClassroomState, setInitialClassroomState] = useState(null);
  const [resolvedServerUrl, setResolvedServerUrl] = useState('');
  const [standalonePreview, setStandalonePreview] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [endedForLearnerContext, setEndedForLearnerContext] = useState(null);
  const studentVoluntaryLeaveRef = useRef(false);
  const postedNativeEndRef = useRef(false);
  const toast = useToast();

  const role = serverPermissions?.role || user?.role || '';
  const isHost = serverPermissions?.isHost ?? (role === 'teacher' || role === 'admin');
  const isObserver = serverPermissions?.isObserver ?? (role === 'guardian' || role === 'supervisor');
  const participantName = user?.name || user?.email || (isObserver ? t.live.room.roleObserver : isHost ? t.live.room.roleTeacher : t.live.room.roleStudent);

  const navigateAfterLearnerExit = useCallback(
    (ctx) => {
      const targetCtx = ctx || sessionContext;
      if (role === 'student' && targetCtx?.sessionType === 'trial' && targetCtx?.sessionId) {
        navigate(
          localizedPath(
            `/student/dashboard?tab=trials&postTrial=${encodeURIComponent(targetCtx.sessionId)}`,
            locale
          ),
          { replace: true }
        );
        return;
      }
      if (role === 'student') {
        navigate(localizedPath('/student/dashboard?tab=sessions', locale), { replace: true });
        return;
      }
      navigate(dashboardPathForRole(role, locale), { replace: true });
    },
    [sessionContext, role, navigate, locale]
  );

  const handleRemoteSessionEnded = useCallback(
    (ctx) => {
      const mergedCtx = ctx || sessionContext || {};
      if (isObserver) {
        toast.success(t.live.room.sessionEndedBanner || 'انتهت الحصة بحمد الله');
        navigate(dashboardPathForRole(role, locale), { replace: true });
        return;
      }
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        if (!postedNativeEndRef.current) {
          postedNativeEndRef.current = true;
          try {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type: 'WWN_SESSION_ENDED',
                sessionContext: mergedCtx,
              })
            );
          } catch {
            // fallback to web modal if postMessage throws
            setEndedForLearnerContext(mergedCtx);
          }
        }
        return;
      }
      setEndedForLearnerContext(mergedCtx);
    },
    [sessionContext, isObserver, toast, t, navigate, role, locale]
  );

  useEffect(() => {
    if (authLoading) return undefined;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale), { replace: true });
      return undefined;
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
        if (data.roomId) setResolvedRoomId(data.roomId);
        if (data.permissions) setServerPermissions(data.permissions);
        if (data.sessionContext) setSessionContext(data.sessionContext);
        if (data.classroomState) setInitialClassroomState(data.classroomState);
        if (data.serverUrl) setResolvedServerUrl(data.serverUrl);
      } catch (err) {
        if (cancelled) return;
        // Attempt to hydrate synced Smart Classroom state even if LiveKit media server is unavailable
        try {
          const fallbackState = await api.get('/api/live/sessions/' + encodeURIComponent(roomId) + '/state', { auth: true });
          if (!cancelled && fallbackState) {
            if (fallbackState.roomId) setResolvedRoomId(fallbackState.roomId);
            if (fallbackState.permissions) setServerPermissions(fallbackState.permissions);
            if (fallbackState.sessionContext) setSessionContext(fallbackState.sessionContext);
            if (fallbackState.classroomState) setInitialClassroomState(fallbackState.classroomState);
            if (fallbackState.sessionEnded || fallbackState.classroomState?.controls?.sessionEnded) {
              if (fallbackState.permissions?.role === 'student') {
                const endedCtx = fallbackState.sessionContext || {};
                if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
                  try {
                    window.ReactNativeWebView.postMessage(
                      JSON.stringify({ type: 'WWN_SESSION_ENDED', sessionContext: endedCtx })
                    );
                  } catch {
                    setEndedForLearnerContext(endedCtx);
                  }
                } else {
                  setEndedForLearnerContext(endedCtx);
                }
                return;
              }
            }
            // If LiveKit is simply not configured yet (503), launch directly into the Synced Smart Classroom!
            if (err?.status === 503) {
              setStandalonePreview(true);
              return;
            }
          }
        } catch {
          // keep primary error if unauthorized or session missing
        }
        if (!cancelled) {
          setError(err.message || t.live.room.tokenError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (roomId) fetchToken();
    return () => { cancelled = true; };
  }, [roomId, participantName, authLoading, isAuthenticated, navigate, locale, retryNonce, t]);

  if (endedForLearnerContext) {
    return (
      <div className="min-h-screen bg-[var(--wn-bg)] flex items-center justify-center">
        <PostSessionRatingModal
          sessionContext={endedForLearnerContext}
          onComplete={() => navigateAfterLearnerExit(endedForLearnerContext)}
          onSkip={() => navigateAfterLearnerExit(endedForLearnerContext)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="live-room-loading" dir={dir} role="status" aria-live="polite">
        <BrandLogo size={72} variant="light" />
        <div className="spinner spinner-lg"></div>
        <p>{t.live.room.connectingRoom}</p>
      </div>
    );
  }

  const handleEndAndEvaluate = async (opts = {}) => {
    const activeRoom = resolvedRoomId || roomId;
    if (isHost && activeRoom && !opts?.alreadyEndedOnServer) {
      await api
        .post('/api/live/sessions/' + encodeURIComponent(activeRoom) + '/end', {}, { auth: true })
        .catch(() =>
          api.patch('/api/live/sessions/' + encodeURIComponent(activeRoom) + '/live', { isLive: false, endSession: true }, { auth: true }).catch(() => {})
        );
    }
    if (role === 'teacher' && sessionContext?.sessionId) {
      navigate(localizedPath(`/teacher/dashboard?tab=sessions&evaluate=${encodeURIComponent(sessionContext.sessionId)}`, locale));
      return;
    }
    navigate(dashboardPathForRole(role, locale));
  };

  if (standalonePreview) {
    return (
      <ClassroomStageCore
        isHost={isHost}
        isObserver={isObserver}
        currentUserId={user?.id || user?._id || ''}
        participantName={participantName}
        roomId={resolvedRoomId || roomId}
        sessionContext={sessionContext}
        initialServerState={initialClassroomState}
        onEndAndEvaluate={isHost ? handleEndAndEvaluate : null}
        onRemoteSessionEnded={handleRemoteSessionEnded}
        onBackToDashboard={() => navigate(dashboardPathForRole(role, locale))}
        hasLiveKitMedia={false}
      />
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

  const handleLiveKitDisconnected = async () => {
    if (isHost) {
      navigate(dashboardPathForRole(role, locale));
      return;
    }
    if (studentVoluntaryLeaveRef.current) {
      navigateAfterLearnerExit(sessionContext);
      return;
    }
    // Check if disconnect happened because the teacher ended the room on SFU
    try {
      const activeRoom = resolvedRoomId || roomId;
      const st = await api.get('/api/live/sessions/' + encodeURIComponent(activeRoom) + '/state', { auth: true });
      if (st?.sessionEnded || st?.classroomState?.controls?.sessionEnded) {
        handleRemoteSessionEnded(st.sessionContext || sessionContext);
        return;
      }
    } catch {
      // ignore
    }
    navigateAfterLearnerExit(sessionContext);
  };

  return (
    <LiveKitRoom
      video={false}
      audio={!isObserver}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      onDisconnected={handleLiveKitDisconnected}
    >
      <LiveKitConnectedStage
        isHost={isHost}
        isObserver={isObserver}
        currentUserId={user?.id || user?._id || ''}
        participantName={participantName}
        roomId={resolvedRoomId || roomId}
        sessionContext={sessionContext}
        initialServerState={initialClassroomState}
        onEndAndEvaluate={isHost ? handleEndAndEvaluate : null}
        onStudentVoluntaryLeave={() => {
          studentVoluntaryLeaveRef.current = true;
        }}
        onRemoteSessionEnded={handleRemoteSessionEnded}
      />
    </LiveKitRoom>
  );
}
