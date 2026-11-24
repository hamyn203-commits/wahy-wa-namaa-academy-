import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';

const INITIAL_CLASSROOM_STATE = {
  mushaf: {
    page: 1,
    surahNumber: 1,
    ayahKey: '',
    wordIndex: -1,
    wordText: '',
    spotlightWord: '',
    hifzVeilMode: 'none',
    peekWordKey: '',
    peekExpiresAt: 0,
    allowIndependent: false,
    qariAudio: { reciter: 'Husary_Muallim_128kbps', surah: 1, ayah: 1, repeat: 1, playing: false, nonce: 0 },
    pinnedMistakes: [],
  },
  tajweedLab: {
    activeModal: 'none',
    metronome: { counts: 4, tempo: 'tadweer', active: false, nonce: 0 },
    selectedLetter: 'ق',
    qaidaLetter: 'ب',
    qaidaHaraka: 'fatha',
    ritualType: 'none',
  },
  activeGame: {
    roundId: '',
    status: 'idle',
    mode: 'missing_word',
    prompt: '',
    surahName: '',
    ayahNumber: 0,
    words: [],
    options: [],
    correctAnswer: '',
    explanation: '',
    durationSec: 25,
    startedAt: 0,
    submissions: [],
  },
  engagement: {
    totalStars: 0,
    studentStars: {},
    lastReaction: null,
    activeListenerAlerts: [],
    visitedPages: [1],
  },
  whiteboard: {
    mode: 'ayah',
    permission: 'teacher_only',
    delegatedStudentId: '',
    delegatedStudentName: '',
    featuredStudentId: '',
    ayahText: '',
    compareText: '',
    stripTashkeel: false,
    syllableMode: false,
    tracingLetter: 'ب',
    strokes: [],
    stamps: [],
    studentBoards: {},
    teleportNonce: 0,
  },
  updatedAtMs: 0,
};

/**
 * محرك المزامنة المزدوج للغرفة المباشرة (LiveKit DataChannel + REST State Sync)
 */
export default function useClassroomSync({
  roomId,
  room = null,
  localParticipant = null,
  isHost = false,
  isObserver = false,
  initialServerState = null,
  primaryStudentUserId = '',
}) {
  const [classroomState, setClassroomState] = useState(() => initialServerState || INITIAL_CLASSROOM_STATE);
  const [studentOpenMistakes, setStudentOpenMistakes] = useState([]);
  const [syncConnected, setSyncConnected] = useState(false);
  const latestVersionRef = useRef(initialServerState?.updatedAtMs || 0);

  const applyIncomingState = useCallback((incoming, force = false) => {
    if (!incoming || typeof incoming !== 'object') return;
    const incomingTs = Number(incoming.updatedAtMs) || 0;
    if (!force && incomingTs > 0 && incomingTs < latestVersionRef.current) {
      return;
    }
    if (incomingTs > latestVersionRef.current) {
      latestVersionRef.current = incomingTs;
    }
    setClassroomState((prev) => ({
      ...prev,
      ...incoming,
      mushaf: { ...prev.mushaf, ...(incoming.mushaf || {}) },
      tajweedLab: { ...prev.tajweedLab, ...(incoming.tajweedLab || {}) },
      activeGame: { ...prev.activeGame, ...(incoming.activeGame || {}) },
      engagement: { ...prev.engagement, ...(incoming.engagement || {}) },
      whiteboard: { ...prev.whiteboard, ...(incoming.whiteboard || {}) },
    }));
  }, []);

  const fetchServerState = useCallback(async (force = false) => {
    if (!roomId) return null;
    try {
      const res = await api.get(`/api/live/sessions/${encodeURIComponent(roomId)}/state`, { auth: true });
      if (res?.classroomState) {
        applyIncomingState(res.classroomState, force);
        setSyncConnected(true);
      }
      return res;
    } catch {
      return null;
    }
  }, [roomId, applyIncomingState]);

  useEffect(() => {
    fetchServerState(true);
  }, [fetchServerState]);

  // Poll intelligently: faster (2.5s) when in Smart Classroom mode without WebRTC or during active game/miniboards; slower (6s) otherwise
  useEffect(() => {
    if (!roomId) return undefined;
    const isInteractiveLive =
      classroomState.activeGame?.status === 'active' ||
      classroomState.whiteboard?.permission === 'all_miniboards' ||
      classroomState.whiteboard?.permission === 'delegated';
    const intervalMs = !room || isInteractiveLive ? 2500 : 6000;
    const timer = setInterval(() => {
      fetchServerState(false);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [roomId, room, classroomState.activeGame?.status, classroomState.whiteboard?.permission, fetchServerState]);

  // Listen to instant LiveKit DataChannel CLASSROOM_SYNC broadcasts
  useEffect(() => {
    if (!room) return undefined;
    const onData = (payload, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === 'CLASSROOM_SYNC') {
          const senderId = String(participant?.identity || '');
          const fromHost = senderId.startsWith('teacher:') || senderId.startsWith('admin:');
          if (fromHost && msg.state) {
            // Preserve anti-cheat redaction on non-hosts if game is active
            const safeState = !isHost && msg.state.activeGame?.status === 'active'
              ? {
                  ...msg.state,
                  activeGame: { ...msg.state.activeGame, correctAnswer: '', explanation: '' },
                }
              : msg.state;
            applyIncomingState(safeState, true);
          } else if (msg.nudge === 'REFRESH_STATE') {
            fetchServerState(true);
          }
        }
      } catch {
        // ignore non-JSON payloads
      }
    };
    room.on('dataReceived', onData);
    return () => room.off('dataReceived', onData);
  }, [room, isHost, applyIncomingState, fetchServerState]);

  // Load Student Memory HUD (open mistakes from previous sessions) for Teacher or Student
  const refreshStudentMemory = useCallback(async () => {
    if (!primaryStudentUserId) return;
    try {
      const data = await api.get(`/api/mushaf-progress/student/${encodeURIComponent(primaryStudentUserId)}`, { auth: true });
      const openList = Array.isArray(data?.annotations)
        ? data.annotations.filter((a) => !a.resolved).slice(0, 12)
        : [];
      setStudentOpenMistakes(openList);
    } catch {
      // non-blocking if student has no MushafProgress yet
    }
  }, [primaryStudentUserId]);

  useEffect(() => {
    refreshStudentMemory();
  }, [refreshStudentMemory]);

  const publishRealtimePacket = useCallback((packet) => {
    if (!room || !localParticipant?.localParticipant) return;
    try {
      localParticipant.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(packet)),
        { reliable: true }
      );
    } catch {
      // fallback handled by server state polling
    }
  }, [room, localParticipant]);

  const updateClassroomState = useCallback(async (patch) => {
    if (!isHost || !roomId) return null;
    try {
      const res = await api.patch(`/api/live/sessions/${encodeURIComponent(roomId)}/state`, patch, { auth: true });
      if (res?.classroomState) {
        applyIncomingState(res.classroomState, true);
        publishRealtimePacket({ type: 'CLASSROOM_SYNC', state: res.classroomState });
      }
      return res?.classroomState || null;
    } catch {
      return null;
    }
  }, [isHost, roomId, applyIncomingState, publishRealtimePacket]);

  const submitGameAnswer = useCallback(async (answer) => {
    if (isObserver || isHost || !roomId) return null;
    const res = await api.post(
      `/api/live/sessions/${encodeURIComponent(roomId)}/game-answer`,
      { answer },
      { auth: true }
    );
    if (res?.classroomState) {
      applyIncomingState(res.classroomState, true);
    }
    publishRealtimePacket({ type: 'CLASSROOM_SYNC', nudge: 'REFRESH_STATE' });
    return res?.submission || null;
  }, [isObserver, isHost, roomId, applyIncomingState, publishRealtimePacket]);

  const ringListenerBell = useCallback(async (page, ayahKey) => {
    if (isObserver || isHost || !roomId) return null;
    const res = await api.post(
      `/api/live/sessions/${encodeURIComponent(roomId)}/listener-bell`,
      { page, ayahKey },
      { auth: true }
    );
    if (res?.classroomState) {
      applyIncomingState(res.classroomState, true);
    }
    publishRealtimePacket({ type: 'CLASSROOM_SYNC', nudge: 'REFRESH_STATE' });
    return res?.alert || null;
  }, [isObserver, isHost, roomId, applyIncomingState, publishRealtimePacket]);

  const submitWhiteboardStudentAction = useCallback(async (actionPayload) => {
    if (isObserver || isHost || !roomId) return null;
    const res = await api.post(
      `/api/live/sessions/${encodeURIComponent(roomId)}/whiteboard-action`,
      actionPayload,
      { auth: true }
    );
    if (res?.classroomState) {
      applyIncomingState(res.classroomState, true);
    }
    publishRealtimePacket({ type: 'CLASSROOM_SYNC', nudge: 'REFRESH_STATE' });
    return res?.classroomState || null;
  }, [isObserver, isHost, roomId, applyIncomingState, publishRealtimePacket]);

  const pinStudentMistake = useCallback(async ({ surahNumber, surahName, ayahNumber, wordText, type, note = '' }) => {
    if (!isHost) return null;
    let annotationId = '';
    if (primaryStudentUserId) {
      try {
        const saved = await api.post(
          `/api/mushaf-progress/student/${encodeURIComponent(primaryStudentUserId)}/annotations`,
          { surahNumber, surahName, ayahNumber, wordText, type, note },
          { auth: true }
        );
        annotationId = String(saved?.annotation?._id || '');
        refreshStudentMemory();
      } catch {
        // Still pin inside live room even if student scope save fails
      }
    }
    await updateClassroomState({
      pinnedMistake: {
        surahNumber,
        surahName,
        ayahNumber,
        wordText,
        type,
        studentId: primaryStudentUserId,
        annotationId,
      },
    });
    return annotationId;
  }, [isHost, primaryStudentUserId, updateClassroomState, refreshStudentMemory]);

  const undoOrResolveMistake = useCallback(async ({ mistakeId = '', annotationId = '' }) => {
    if (!isHost) return;
    if (primaryStudentUserId && annotationId) {
      try {
        await api.patch(
          `/api/mushaf-progress/student/${encodeURIComponent(primaryStudentUserId)}/annotations/${encodeURIComponent(annotationId)}`,
          { resolved: true },
          { auth: true }
        );
        refreshStudentMemory();
      } catch {
        // ignore
      }
    }
    if (mistakeId || annotationId) {
      await updateClassroomState({ removeMistakeId: mistakeId || annotationId });
    }
  }, [isHost, primaryStudentUserId, updateClassroomState, refreshStudentMemory]);

  return {
    classroomState,
    syncConnected,
    studentOpenMistakes,
    updateClassroomState,
    submitGameAnswer,
    ringListenerBell,
    submitWhiteboardStudentAction,
    pinStudentMistake,
    undoOrResolveMistake,
    refreshStudentMemory,
  };
}
