import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Users, Mic, MicOff, Hand, Clock, Play, Pause, 
  RotateCcw, CheckCircle2, UserCheck, VolumeX, Sparkles,
  ChevronRight, Award, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './classroom.css';

// قائمة افتراضية لـ 10 طلاب لحلقة القرآن النموذجية
const DEFAULT_STUDENTS_LIST = [
  { id: 'seat-1', name: 'أحمد بن عبد الله', avatar: 'أ' },
  { id: 'seat-2', name: 'عمر بن الفاروق', avatar: 'ع' },
  { id: 'seat-3', name: 'يوسف بن إبراهيم', avatar: 'ي' },
  { id: 'seat-4', name: 'عبد الرحمن خالد', avatar: 'ع' },
  { id: 'seat-5', name: 'حمزة بن عبد المطلب', avatar: 'ح' },
  { id: 'seat-6', name: 'زيد بن ثابت', avatar: 'ز' },
  { id: 'seat-7', name: 'سليمان بن داود', avatar: 'س' },
  { id: 'seat-8', name: 'بلال بن رباح', avatar: 'ب' },
  { id: 'seat-9', name: 'معاذ بن جبل', avatar: 'م' },
  { id: 'seat-10', name: 'أنس بن مالك', avatar: 'أ' }
];

/**
 * مكون إدارة الحلقة ونظام التسميع للـ 10 طلاب
 */
export default function CircleTurnManager({
  room,
  localParticipant,
  participants = [],
  isTeacher = false,
  isObserver = false,
  currentUserName = 'مشارك',
  onMuteLocalMic = null,
  rosterStudents = [],
}) {
  // حالة الطالب الحالي
  const currentParticipantId = localParticipant?.localParticipant?.identity || currentUserName;

  // حالة التسميع والمؤقت
  const [activeReciter, setActiveReciter] = useState(null); // { id, name }
  const [timerDuration, setTimerDuration] = useState(300); // 5 دقائق (300 ثانية)
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // قائمة رافعي الأيدي بالدور
  const [waitingQueue, setWaitingQueue] = useState([]); // [{ id, name, timestamp }]

  // سجل الوقت المستغرق لكل طالب (لتوزيع الوقت بالعدل)
  const [timeSpentMap, setTimeSpentMap] = useState({}); // { [studentId]: seconds }

  // تنبيهات لحظية
  const [actionNotice, setActionNotice] = useState(null);

  // هل الطالب الحالي رافع يده؟
  const isHandRaised = useMemo(() => {
    return waitingQueue.some(item => item.id === currentParticipantId || item.name === currentUserName);
  }, [waitingQueue, currentParticipantId, currentUserName]);

  // إرسال إشارات الحلقة عبر LiveKit Data Channel
  const broadcastCircleAction = useCallback((action, payload = {}) => {
    if (!room || !localParticipant?.localParticipant) return;

    const messageData = {
      type: 'CIRCLE_ACTION',
      action,
      payload,
      senderName: currentUserName,
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
  }, [room, localParticipant, currentUserName, currentParticipantId]);

  // الاستماع لأحداث الحلقة اللحظية
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== 'CIRCLE_ACTION') return;

        const { action, payload: p } = data;

        switch (action) {
          case 'MUTE_ALL':
            // إذا كان المستخدم ليس المعلم، اكتم الصوت
            if (!isTeacher) {
              if (onMuteLocalMic) onMuteLocalMic();
              try { localParticipant?.localParticipant?.setMicrophoneEnabled(false); } catch { /* ignore */ }
              setActionNotice('قام المعلم بكتم صوت الجميع للحفاظ على هدوء التسميع');
              setTimeout(() => setActionNotice(null), 4000);
            }
            break;

          case 'START_RECITATION':
            setActiveReciter({ id: p.studentId, name: p.studentName });
            setTimeLeft(p.duration || 300);
            setIsTimerRunning(true);
            // إزالة الطالب من قائمة الانتظار
            setWaitingQueue(prev => prev.filter(item => item.id !== p.studentId));
            setActionNotice(`بدأ التسميع لـ: ${p.studentName}`);
            setTimeout(() => setActionNotice(null), 3500);
            break;

          case 'END_RECITATION':
            setActiveReciter(null);
            setIsTimerRunning(false);
            setActionNotice('تم إنهاء جولة التسميع الحالية');
            setTimeout(() => setActionNotice(null), 3000);
            break;

          case 'TIMER_TICK':
            // مزامنة وقت المؤقت من المعلم
            if (!isTeacher && p.timeLeft !== undefined) {
              setTimeLeft(p.timeLeft);
              setIsTimerRunning(p.isRunning);
            }
            break;

          case 'RAISE_HAND':
            setWaitingQueue(prev => {
              if (prev.some(item => item.id === p.studentId)) return prev;
              return [...prev, { id: p.studentId, name: p.studentName, timestamp: Date.now() }];
            });
            break;

          case 'LOWER_HAND':
            setWaitingQueue(prev => prev.filter(item => item.id !== p.studentId));
            break;

          default:
            break;
        }
      } catch (e) {
        // تجاهل
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, isTeacher, onMuteLocalMic]);

  // عداد المؤقت التنازلي
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          // تحديث وقت الطالب المستغرق
          if (activeReciter) {
            setTimeSpentMap(m => ({
              ...m,
              [activeReciter.id]: (m[activeReciter.id] || 0) + 1
            }));
          }
          // إذا كان المعلم، يبث مزامنة الوقت كل 5 ثوانٍ
          if (isTeacher && next % 5 === 0) {
            broadcastCircleAction('TIMER_TICK', { timeLeft: next, isRunning: true });
          }
          return next;
        });
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setActionNotice('انتهى وقت التسميع لهذا الطالب!');
      setTimeout(() => setActionNotice(null), 4000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, activeReciter, isTeacher, broadcastCircleAction]);

  // دمج الطلاب الـ 10 مع المشاركين الحقيقيين في الغرفة
  const circleStudents = useMemo(() => {
    // قائمة أسماء الحاضرين في الغرفة
    const activeNames = new Set(participants.map(p => p.name || p.identity));
    const activeIdentities = new Set(participants.map(p => p.identity).filter(Boolean));
    if (currentUserName) activeNames.add(currentUserName);
    if (currentParticipantId) activeIdentities.add(currentParticipantId);
    const baseList = Array.isArray(rosterStudents) && rosterStudents.length > 0 ? rosterStudents : DEFAULT_STUDENTS_LIST;
    if (currentUserName) activeNames.add(currentUserName);

    return baseList.map((student, index) => {
      const matchedParticipant = Array.isArray(rosterStudents) && rosterStudents.length > 0
        ? participants.find(p => p.identity === student.id || p.name === student.name)
        : participants[index];
      const isOnline = Boolean(matchedParticipant) || activeIdentities.has(student.id) || activeNames.has(student.name);
      // إما اسم مسجل أو مشارك فعلي في الغرفة


      const studentName = matchedParticipant?.name || student.name;
      const studentId = matchedParticipant?.identity || student.id;

      const isRecitingNow = activeReciter?.id === studentId || activeReciter?.name === studentName;
      const queuePosition = waitingQueue.findIndex(item => item.id === studentId || item.name === studentName);

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
  }, [participants, currentUserName, currentParticipantId, rosterStudents, activeReciter, waitingQueue, timeSpentMap]);

  // ── أدوات المعلم ──

  // كتم صوت الجميع
  const handleMuteAll = () => {
    if (!isTeacher) return;
    broadcastCircleAction('MUTE_ALL');
    setActionNotice('تم إرسال أمر كتم صوت الجميع للغرفة');
    setTimeout(() => setActionNotice(null), 3000);
  };

  // بدء التسميع لطالب معين
  const handleStartRecitation = (student) => {
    if (!isTeacher) return;
    const duration = timerDuration;
    setActiveReciter({ id: student.id, name: student.name });
    setTimeLeft(duration);
    setIsTimerRunning(true);
    broadcastCircleAction('START_RECITATION', {
      studentId: student.id,
      studentName: student.name,
      duration
    });
  };

  // إنهاء التسميع الحالي
  const handleEndRecitation = () => {
    if (!isTeacher) return;
    setActiveReciter(null);
    setIsTimerRunning(false);
    broadcastCircleAction('END_RECITATION');
  };

  // الانتقال للطالب التالي في قائمة الدور
  const handleNextInQueue = () => {
    if (!isTeacher || waitingQueue.length === 0) return;
    const nextStudent = waitingQueue[0];
    handleStartRecitation({ id: nextStudent.id, name: nextStudent.name });
  };

  // ── أدوات الطالب ──

  // رفع اليد / خفض اليد
  const toggleRaiseHand = () => {
    if (isObserver) return; // المراقب لا يرفع يده

    if (isHandRaised) {
      broadcastCircleAction('LOWER_HAND', { studentId: currentParticipantId });
      setWaitingQueue(prev => prev.filter(item => item.id !== currentParticipantId && item.name !== currentUserName));
    } else {
      broadcastCircleAction('RAISE_HAND', {
        studentId: currentParticipantId,
        studentName: currentUserName
      });
      setWaitingQueue(prev => [
        ...prev,
        { id: currentParticipantId, name: currentUserName, timestamp: Date.now() }
      ]);
    }
  };

  // تنسيق دقائق وثواني
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // نسبة التقدم للمؤقت
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / timerDuration) * 100));

  return (
    <div className="circle-manager-card">
      {/* ── رأس مدير الحلقة ── */}
      <div className="circle-manager-header">
        <div className="circle-manager-title">
          <Users size={18} className="text-emerald-700" />
          <h3>
            حلقة القرآن الكريم
            <span className="circle-count-badge">{circleStudents.length} طلاب</span>
          </h3>
        </div>

        {/* أدوات سريعة في الرأس */}
        <div className="flex items-center gap-2">
          {isTeacher ? (
            <button 
              onClick={handleMuteAll} 
              className="btn-mute-all"
              title="كتم صوت جميع الطلاب دفعة واحدة"
            >
              <VolumeX size={15} />
              كتم الجميع
            </button>
          ) : !isObserver ? (
            <button
              onClick={toggleRaiseHand}
              className={`btn-raise-hand ${isHandRaised ? 'is-raised' : ''}`}
            >
              <Hand size={15} />
              {isHandRaised ? 'خفض اليد' : 'رفع اليد للتسميع'}
            </button>
          ) : (
            <span className="text-xs text-gray-500 font-semibold px-2 py-1 bg-gray-100 rounded">
              وضع الاستماع فقط
            </span>
          )}
        </div>
      </div>

      {/* ── شريط تنبيه الإجراءات ── */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div 
            className="p-2 text-center text-xs font-bold bg-amber-100 text-amber-900 border-b border-amber-200"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {actionNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── مؤقت التسميع التنازلي المتزامن ── */}
      <div className={`recitation-timer-banner ${
        timeLeft < 30 ? 'timer-critical' : timeLeft < 60 ? 'timer-warning' : 'timer-active'
      }`}>
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-emerald-800" />
          <div>
            <div className="text-xs text-gray-500 font-semibold">
              {activeReciter ? `يسمّع الآن: ${activeReciter.name}` : 'لا يوجد طالب يسمّع حالياً'}
            </div>
            <div className="timer-clock">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* أزرار تحكم المعلم بالمؤقت */}
        {isTeacher && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              disabled={!activeReciter}
              className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40"
              title={isTimerRunning ? 'إيقاف مؤقت' : 'استئناف المؤقت'}
            >
              {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={() => setTimeLeft(timerDuration)}
              disabled={!activeReciter}
              className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40"
              title="إعادة ضبط المؤقت"
            >
              <RotateCcw size={14} />
            </button>
            {activeReciter && (
              <button
                onClick={handleEndRecitation}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
              >
                إنهاء التسميع
              </button>
            )}
          </div>
        )}

        {/* شريط تقدم المؤقت */}
        <div className="timer-progress-bar">
          <div 
            className="timer-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── قائمة المنتظرين بالدور (Queue) ── */}
      {waitingQueue.length > 0 && (
        <div className="p-2 px-3 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Hand size={14} className="text-amber-600" />
            <span>قائمة الدور ({waitingQueue.length}):</span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px]">
              {waitingQueue.map((item, idx) => (
                <span key={item.id} className="bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                  #{idx + 1} {item.name}
                </span>
              ))}
            </div>
          </div>
          {isTeacher && (
            <button
              onClick={handleNextInQueue}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1"
            >
              <span>التالي بالدور</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── شبكة مقاعد الـ 10 طلاب ── */}
      <div className="students-circle-grid">
        {circleStudents.map((student, idx) => {
          return (
            <div 
              key={student.id}
              className={`student-seat-card ${
                student.isRecitingNow ? 'is-reciting' : ''
              } ${student.isOnline ? 'is-online' : 'is-offline'}`}
            >
              {/* صورة وأيقونة المقعد */}
              <div className="seat-avatar-wrap">
                <span>{student.avatar}</span>
                <span className="seat-number-chip">{idx + 1}</span>
              </div>

              {/* بيانات الطالب وحالته */}
              <div className="seat-info">
                <p className="seat-name">{student.name}</p>
                <div className="seat-status-row">
                  <span className={`status-dot ${
                    student.isRecitingNow ? 'status-dot-reciting' : 
                    student.isOnline ? 'status-dot-online' : 'status-dot-offline'
                  }`} />
                  <span className="text-gray-500">
                    {student.isRecitingNow ? 'يسمّع الآن 🎙️' :
                     student.isOnline ? 'متصل بالحلقة' : 'غير متصل'}
                  </span>
                  {student.timeSpent > 0 && (
                    <span className="text-emerald-700 font-mono text-[10px]">
                      ({formatTime(student.timeSpent)})
                    </span>
                  )}
                </div>
              </div>

              {/* شارة رفع اليد أو زر التسميع للمعلم */}
              <div className="flex items-center gap-1">
                {student.inQueue && (
                  <span className="raised-hand-badge" title="في انتظار دوره للتسميع">
                    <Hand size={11} />
                    #{student.queueNumber}
                  </span>
                )}

                {isTeacher && !student.isRecitingNow && (
                  <button
                    onClick={() => handleStartRecitation(student)}
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition"
                    title={`بدء التسميع لـ ${student.name}`}
                  >
                    تسميع
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── شريط عدالة توزيع الوقت ── */}
      <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award size={14} className="text-amber-600" />
          <span>مقياس عدالة الوقت:</span>
          <span className="font-semibold text-gray-800">5 دقائق لكل طالب في الحلقة</span>
        </div>
        <div className="text-[11px] text-gray-500">
          إجمالي الحضور: {circleStudents.filter(s => s.isOnline).length}/{circleStudents.length}
        </div>
      </div>
    </div>
  );
}
