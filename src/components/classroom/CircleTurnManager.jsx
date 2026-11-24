import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Hand, Clock, Play, Pause,
  RotateCcw, VolumeX,
  ChevronRight, ChevronLeft, Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../i18n';
import EmptyState from '../shared/EmptyState';
import './classroom.css';

/**
 * مكون إدارة الحلقة ونظام التسميع
 */
export default function CircleTurnManager({
  room,
  localParticipant,
  participants = [],
  isTeacher = false,
  isObserver = false,
  currentUserName,
  onMuteLocalMic = null,
  onActiveReciterChange = null,
  allowHandRaise = true,
  rosterStudents = [],
}) {
  const { isRTL, t } = useI18n();
  const resolvedUserName = currentUserName || t.live.circle.participantFallback;
  const currentParticipantId = localParticipant?.localParticipant?.identity || resolvedUserName;

  const [activeReciter, setActiveReciter] = useState(null); // { id, name }
  const [timerDuration] = useState(300); // 5 minutes
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [waitingQueue, setWaitingQueue] = useState([]); // [{ id, name, timestamp }]
  const [timeSpentMap, setTimeSpentMap] = useState({}); // { [studentId]: seconds }
  const [actionNotice, setActionNotice] = useState(null);
  const noticeTimerRef = useRef(null);
  const lastHandRaiseAtRef = useRef(0);

  const showNotice = useCallback((message, durationMs = 3500) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setActionNotice(message);
    noticeTimerRef.current = setTimeout(() => {
      setActionNotice(null);
      noticeTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const isHandRaised = useMemo(() => {
    return waitingQueue.some((item) => item.id === currentParticipantId || item.name === resolvedUserName);
  }, [waitingQueue, currentParticipantId, resolvedUserName]);

  const broadcastCircleAction = useCallback((action, payload = {}) => {
    if (!room || !localParticipant?.localParticipant) return;

    const messageData = {
      type: 'CIRCLE_ACTION',
      action,
      payload,
      senderName: resolvedUserName,
      senderId: currentParticipantId,
      timestamp: Date.now()
    };

    try {
      localParticipant.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(messageData)),
        { reliable: true }
      );
    } catch (err) {
      console.error('Failed to publish circle action:', err);
    }
  }, [room, localParticipant, resolvedUserName, currentParticipantId]);

  useEffect(() => {
    if (!room) return;

    const isTrustedHostSender = (participant) => {
      const id = String(participant?.identity || '');
      return id.startsWith('teacher:') || id.startsWith('admin:');
    };

    const handleDataReceived = (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== 'CIRCLE_ACTION') return;

        const { action, payload: p = {} } = data;
        const senderIdentity = String(participant?.identity || '');

        switch (action) {
          case 'MUTE_ALL':
            if (!isTrustedHostSender(participant)) return;
            if (!isTeacher) {
              if (onMuteLocalMic) onMuteLocalMic();
              try { localParticipant?.localParticipant?.setMicrophoneEnabled(false); } catch { /* ignore */ }
              showNotice(t.live.circle.mutedNotice, 4000);
            }
            break;

          case 'START_RECITATION': {
            if (!isTrustedHostSender(participant)) return;
            const safeDuration = Math.min(1800, Math.max(30, Number(p.duration) || 300));
            const safeName = String(p.studentName || t.live.circle.studentFallback).slice(0, 80);
            const safeStudentId = String(p.studentId || '').slice(0, 120);
            if (!safeStudentId) return;
            setActiveReciter({ id: safeStudentId, name: safeName });
            setTimeLeft(safeDuration);
            setIsTimerRunning(true);
            setWaitingQueue((prev) => prev.filter((item) => item.id !== safeStudentId));
            showNotice(`${t.live.circle.startedNotice} ${safeName}`, 3500);
            break;
          }

          case 'END_RECITATION':
            if (!isTrustedHostSender(participant)) return;
            setActiveReciter(null);
            setIsTimerRunning(false);
            showNotice(t.live.circle.endedNotice, 3000);
            break;

          case 'TIMER_TICK':
            if (!isTrustedHostSender(participant)) return;
            if (!isTeacher && p.timeLeft !== undefined) {
              const safeLeft = Math.min(1800, Math.max(0, Number(p.timeLeft) || 0));
              setTimeLeft(safeLeft);
              setIsTimerRunning(Boolean(p.isRunning));
            }
            break;

          case 'RAISE_HAND': {
            if (!senderIdentity || senderIdentity.startsWith('guardian:')) return;
            if (p.studentId && String(p.studentId) !== senderIdentity) return;
            const verifiedId = senderIdentity;
            const verifiedName = String(participant?.name || p.studentName || t.live.circle.studentFallback).slice(0, 80);
            setWaitingQueue((prev) => {
              if (prev.some((item) => item.id === verifiedId)) return prev;
              return [...prev, { id: verifiedId, name: verifiedName, timestamp: Date.now() }];
            });
            break;
          }

          case 'LOWER_HAND': {
            if (!senderIdentity) return;
            const targetId = isTrustedHostSender(participant) && p.studentId
              ? String(p.studentId)
              : senderIdentity;
            if (!isTrustedHostSender(participant) && p.studentId && String(p.studentId) !== senderIdentity) {
              return;
            }
            setWaitingQueue((prev) => prev.filter((item) => item.id !== targetId));
            break;
          }

          default:
            break;
        }
      } catch {
        // ignore malformed packets
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, isTeacher, onMuteLocalMic, localParticipant?.localParticipant, showNotice, t]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          if (activeReciter) {
            setTimeSpentMap((m) => ({
              ...m,
              [activeReciter.id]: (m[activeReciter.id] || 0) + 1
            }));
          }
          if (isTeacher && next % 5 === 0) {
            broadcastCircleAction('TIMER_TICK', { timeLeft: next, isRunning: true });
          }
          return next;
        });
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      showNotice(t.live.circle.timeUpNotice, 4000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, activeReciter, isTeacher, broadcastCircleAction, showNotice, t]);

  const circleStudents = useMemo(() => {
    const activeNames = new Set(participants.map((p) => p.name || p.identity));
    const activeIdentities = new Set(participants.map((p) => p.identity).filter(Boolean));
    if (resolvedUserName) activeNames.add(resolvedUserName);
    if (currentParticipantId) activeIdentities.add(currentParticipantId);
    const baseList = Array.isArray(rosterStudents) ? rosterStudents : [];

    return baseList.map((student) => {
      const matchedParticipant = participants.find(
        (p) => p.identity === student.id || p.name === student.name
      );
      const isOnline = Boolean(matchedParticipant) || activeIdentities.has(student.id) || activeNames.has(student.name);

      const studentName = matchedParticipant?.name || student.name;
      const studentId = matchedParticipant?.identity || student.id;

      const isRecitingNow = activeReciter?.id === studentId || activeReciter?.name === studentName;
      const queuePosition = waitingQueue.findIndex((item) => item.id === studentId || item.name === studentName);

      return {
        ...student,
        id: studentId,
        name: studentName,
        isOnline,
        isRecitingNow,
        inQueue: queuePosition !== -1,
        queueNumber: queuePosition !== -1 ? queuePosition + 1 : null,
        timeSpent: timeSpentMap[studentId] || 0
      };
    });
  }, [participants, resolvedUserName, currentParticipantId, rosterStudents, activeReciter, waitingQueue, timeSpentMap]);

  const handleMuteAll = () => {
    if (!isTeacher) return;
    broadcastCircleAction('MUTE_ALL');
    showNotice(t.live.circle.muteAllSentNotice, 3000);
  };

  const handleStartRecitation = (student) => {
    if (!isTeacher) return;
    const duration = timerDuration;
    setActiveReciter({ id: student.id, name: student.name });
    setTimeLeft(duration);
    setIsTimerRunning(true);
    onActiveReciterChange?.(student.userId || student.id);
    broadcastCircleAction('START_RECITATION', {
      studentId: student.id,
      studentName: student.name,
      duration
    });
  };

  const handleEndRecitation = () => {
    if (!isTeacher) return;
    setActiveReciter(null);
    setIsTimerRunning(false);
    onActiveReciterChange?.('');
    broadcastCircleAction('END_RECITATION');
  };

  const handleNextInQueue = () => {
    if (!isTeacher || waitingQueue.length === 0) return;
    const nextStudent = waitingQueue[0];
    handleStartRecitation({ id: nextStudent.id, name: nextStudent.name });
  };

  const toggleRaiseHand = () => {
    if (isObserver || !allowHandRaise) return;

    if (isHandRaised) {
      broadcastCircleAction('LOWER_HAND', { studentId: currentParticipantId });
      setWaitingQueue((prev) => prev.filter((item) => item.id !== currentParticipantId && item.name !== resolvedUserName));
    } else {
      const now = Date.now();
      if (now - lastHandRaiseAtRef.current < 15000) {
        showNotice('يرجى الانتظار قليلاً قبل رفع اليد مجدداً', 2500);
        return;
      }
      lastHandRaiseAtRef.current = now;
      broadcastCircleAction('RAISE_HAND', {
        studentId: currentParticipantId,
        studentName: resolvedUserName
      });
      setWaitingQueue((prev) => [
        ...prev,
        { id: currentParticipantId, name: resolvedUserName, timestamp: now }
      ]);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / timerDuration) * 100));

  return (
    <div className="circle-manager-card">
      <div className="circle-manager-header">
        <div className="circle-manager-title">
          <Users size={18} className="text-[var(--wn-emerald)]" aria-hidden="true" />
          <h3>
            {t.live.circle.title}
            <span className="circle-count-badge">{circleStudents.length} {t.live.circle.studentsCount}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isTeacher ? (
            <button
              type="button"
              onClick={handleMuteAll}
              className="btn-mute-all min-h-[44px]"
              title={t.live.circle.muteAllTitle}
            >
              <VolumeX size={15} aria-hidden="true" />
              <span>{t.live.circle.muteAll}</span>
            </button>
          ) : !isObserver && allowHandRaise ? (
            <button
              type="button"
              onClick={toggleRaiseHand}
              aria-pressed={isHandRaised}
              className={`btn-raise-hand min-h-[44px] ${isHandRaised ? 'is-raised' : ''}`}
            >
              <Hand size={15} aria-hidden="true" />
              <span>{isHandRaised ? t.live.circle.lowerHand : t.live.circle.raiseHand}</span>
            </button>
          ) : (
            <span className="text-xs text-[var(--wn-text-secondary)] font-semibold px-2.5 py-1.5 bg-[var(--wn-surface-sunken)] rounded-md border border-[var(--wn-border)]">
              {t.live.circle.listenOnly}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {actionNotice && (
          <motion.div
            role="status"
            aria-live="polite"
            className="p-2 text-center text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-b border-[var(--wn-border)]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {actionNotice}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`recitation-timer-banner ${
        timeLeft < 30 ? 'timer-critical' : timeLeft < 60 ? 'timer-warning' : 'timer-active'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <Clock size={20} className="text-[var(--wn-heading)] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs text-[var(--wn-text-secondary)] font-semibold truncate">
              {activeReciter ? `${t.live.circle.recitingNow}: ${activeReciter.name}` : t.live.circle.noActiveReciter}
            </div>
            <div className="timer-clock">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              disabled={!activeReciter}
              aria-label={isTimerRunning ? t.live.circle.pauseTimer : t.live.circle.resumeTimer}
              title={isTimerRunning ? t.live.circle.pauseTimer : t.live.circle.resumeTimer}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              {isTimerRunning ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setTimeLeft(timerDuration)}
              disabled={!activeReciter}
              aria-label={t.live.circle.resetTimer}
              title={t.live.circle.resetTimer}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            {activeReciter && (
              <button
                type="button"
                onClick={handleEndRecitation}
                className="min-h-[44px] px-3 bg-[var(--wn-danger)] text-[var(--wn-white)] rounded-lg text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                {t.live.circle.endRecitation}
              </button>
            )}
          </div>
        )}

        <div className="timer-progress-bar">
          <div
            className="timer-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {waitingQueue.length > 0 && (
        <div className="p-2.5 px-3 bg-[var(--wn-gold-soft)] border-b border-[var(--wn-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--wn-badge-gold-text)] min-w-0 flex-1">
            <Hand size={14} className="shrink-0" aria-hidden="true" />
            <span>{t.live.circle.queueLabel} ({waitingQueue.length}):</span>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {waitingQueue.map((item, idx) => (
                <span key={item.id} className="bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                  #{idx + 1} {item.name}
                </span>
              ))}
            </div>
          </div>
          {isTeacher && (
            <button
              type="button"
              onClick={handleNextInQueue}
              className="min-h-[44px] px-3 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <span>{t.live.circle.nextInQueue}</span>
              {isRTL ? <ChevronLeft size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
      )}

      {circleStudents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            icon={Users}
            title={t.live.circle.emptyRoster}
          />
        </div>
      ) : (
        <div className="students-circle-grid">
          {circleStudents.map((student, idx) => (
            <div
              key={student.id}
              className={`student-seat-card ${
                student.isRecitingNow ? 'is-reciting' : ''
              } ${student.isOnline ? 'is-online' : 'is-offline'}`}
            >
              <div className="seat-avatar-wrap">
                <span>{student.avatar}</span>
                <span className="seat-number-chip">{idx + 1}</span>
              </div>

              <div className="seat-info">
                <p className="seat-name">{student.name}</p>
                <div className="seat-status-row">
                  <span className={`status-dot ${
                    student.isRecitingNow ? 'status-dot-reciting' :
                    student.isOnline ? 'status-dot-online' : 'status-dot-offline'
                  }`} />
                  <span className="text-[var(--wn-text-secondary)]">
                    {student.isRecitingNow ? t.live.circle.recitingBadge :
                     student.isOnline ? t.live.circle.onlineStatus : t.live.circle.offlineStatus}
                  </span>
                  {student.timeSpent > 0 && (
                    <span className="text-[var(--wn-text-accent)] font-mono text-[10px]">
                      ({formatTime(student.timeSpent)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {student.inQueue && (
                  <span className="raised-hand-badge" title={t.live.circle.inQueueTitle}>
                    <Hand size={11} aria-hidden="true" />
                    #{student.queueNumber}
                  </span>
                )}

                {isTeacher && !student.isRecitingNow && (
                  <button
                    type="button"
                    onClick={() => handleStartRecitation(student)}
                    className="min-h-[44px] px-3 rounded-lg bg-[var(--wn-emerald-soft)] hover:bg-[var(--wn-mint)] text-[var(--wn-badge-emerald-text)] text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    aria-label={`${t.live.circle.startRecitationTitle} ${student.name}`}
                    title={`${t.live.circle.startRecitationTitle} ${student.name}`}
                  >
                    {t.live.circle.reciteBtn}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-2.5 bg-[var(--wn-surface-soft)] border-t border-[var(--wn-border)] text-xs text-[var(--wn-text-secondary)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Award size={14} className="text-[var(--wn-text-gold)] shrink-0" aria-hidden="true" />
          <span>{t.live.circle.fairnessTitle}</span>
          <span className="font-semibold text-[var(--wn-text-primary)]">{t.live.circle.fairnessDesc}</span>
        </div>
        <div className="text-[11px] text-[var(--wn-text-secondary)]">
          {t.live.circle.attendanceSummary} {circleStudents.filter((s) => s.isOnline).length}/{circleStudents.length}
        </div>
      </div>
    </div>
  );
}
