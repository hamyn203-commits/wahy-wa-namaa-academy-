import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Award, X, Sparkles, BookOpen, Trophy } from 'lucide-react';
import { SPIRITUAL_BADGES, SESSION_RITUALS } from './classroomGamesData';

/**
 * شريط أوسمة التشجيع الروحانية، تنبيهات المستمع اليقظ، آداب المجلس، وبطاقة حصاد الحصة
 */
export default function LiveEncouragementOverlay({
  isTeacher = false,
  engagement,
  tajweedLabState,
  pinnedMistakes = [],
  onSendReaction,
  onRewardListener,
  onClearListeners,
  onTriggerRitual,
  dir = 'rtl',
}) {
  const [floatingBadge, setFloatingBadge] = useState(null);
  const lastSeenReactionIdRef = useRef('');
  const hideTimerRef = useRef(null);

  const lastReaction = engagement?.lastReaction || null;
  const listenerAlerts = Array.isArray(engagement?.activeListenerAlerts) ? engagement.activeListenerAlerts : [];
  const visitedPages = Array.isArray(engagement?.visitedPages) ? engagement.visitedPages : [1];
  const totalStars = engagement?.totalStars || 0;
  const ritualType = tajweedLabState?.ritualType || 'none';

  useEffect(() => {
    if (!lastReaction?.id || lastReaction.id === lastSeenReactionIdRef.current) return undefined;
    // Only animate reactions created within the last 12 seconds
    if (Date.now() - (lastReaction.timestamp || 0) > 12000) {
      lastSeenReactionIdRef.current = lastReaction.id;
      return undefined;
    }
    lastSeenReactionIdRef.current = lastReaction.id;
    setFloatingBadge(lastReaction);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setFloatingBadge(null);
    }, 4200);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [lastReaction]);

  const ritualData = ritualType === 'opening' ? SESSION_RITUALS.opening : ritualType === 'closing' ? SESSION_RITUALS.closing : null;

  return (
    <>
      {/* شارة التشجيع الروحانية العائمة (بدون موسيقى) */}
      <AnimatePresence>
        {floatingBadge && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.92 }}
            className="fixed top-24 inset-x-0 z-50 pointer-events-none flex justify-center px-4"
            dir={dir}
          >
            <div className="px-6 py-3.5 rounded-2xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface)] text-[var(--wn-heading)] shadow-2xl flex items-center gap-3">
              <span className="text-3xl">{floatingBadge.emoji}</span>
              <div>
                <p className="font-bold text-base text-[var(--wn-heading)]">{floatingBadge.label}</p>
                {floatingBadge.targetName && (
                  <p className="text-xs text-[var(--wn-badge-gold-text)] font-semibold">{floatingBadge.targetName}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* إشعار صامت للمعلم فقط عند ضغط أحد طلاب الحلقة على جرس «المستمع اليقظ» */}
      {isTeacher && listenerAlerts.length > 0 && (
        <div
          className="px-4 py-2 bg-[var(--wn-gold-soft)] border-b border-[var(--wn-gold)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wn-badge-gold-text)]"
          dir={dir}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Bell size={15} className="shrink-0" aria-hidden="true" />
            <span className="font-bold">تنبيه المستمع اليقظ (صامت):</span>
            {listenerAlerts.slice(0, 4).map((al) => (
              <button
                key={al.id}
                type="button"
                onClick={() => onRewardListener?.(al.id)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-gold)] text-[var(--wn-heading)] font-bold inline-flex items-center gap-1 cursor-pointer"
                title="اضغط لمنحه نجمة المستمع اليقظ"
              >
                <span>{al.studentName} (ص {al.page})</span>
                <Award size={13} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                <span>+⭐</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClearListeners}
            className="min-h-[34px] px-2.5 rounded-lg hover:bg-[var(--wn-surface)] font-bold cursor-pointer"
          >
            مسح التنبيهات
          </button>
        </div>
      )}

      {/* شريط أوسمة التشجيع وآداب المجلس للمعلم */}
      {isTeacher && (
        <div
          className="px-3 py-1.5 bg-[var(--wn-surface-dark)] border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto"
          dir={dir}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-[var(--wn-mint)] me-1 inline-flex items-center gap-1">
              <Sparkles size={12} aria-hidden="true" />
              تشجيع فوري:
            </span>
            {SPIRITUAL_BADGES.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() =>
                  onSendReaction?.({
                    badgeKey: b.key,
                    label: b.labelAr,
                    emoji: b.emoji,
                    starsDelta: b.stars,
                  })
                }
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-[var(--wn-text-inverse)] text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              >
                <span>{b.emoji}</span>
                <span>{b.labelAr}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onTriggerRitual?.(ritualType === 'opening' ? 'none' : 'opening')}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              🤲 دعاء الافتتاح
            </button>
            <button
              type="button"
              onClick={() => onTriggerRitual?.(ritualType === 'closing' ? 'none' : 'closing')}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              📜 حصاد ودعاء الختام
            </button>
          </div>
        </div>
      )}

      {/* نافذة آداب افتتاح/ختام المجلس وحصاد الحصة التلقائي */}
      <AnimatePresence>
        {ritualData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            dir={dir}
          >
            <div className="w-full max-w-lg rounded-2xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] p-6 space-y-4 text-center shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]">
                  آداب الحلقة القرآنية
                </span>
                {isTeacher && (
                  <button
                    type="button"
                    onClick={() => onTriggerRitual?.('none')}
                    className="min-w-[40px] min-h-[40px] rounded-xl inline-flex items-center justify-center hover:bg-[var(--wn-surface-sunken)] cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>

              <h3 className="text-xl font-bold text-[var(--wn-heading)]">{ritualData.titleAr}</h3>
              <p className="p-4 rounded-2xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] font-serif text-xl leading-loose text-[var(--wn-heading)]">
                {ritualData.duaAr}
              </p>
              <p className="text-xs text-[var(--wn-text-secondary)]">{ritualData.noteAr}</p>

              {ritualType === 'closing' && (
                <div className="p-4 rounded-2xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] grid grid-cols-3 gap-2 text-center">
                  <div>
                    <BookOpen size={16} className="mx-auto text-[var(--wn-emerald)] mb-1" aria-hidden="true" />
                    <div className="text-base font-bold text-[var(--wn-heading)]">{visitedPages.length}</div>
                    <div className="text-[11px] text-[var(--wn-text-secondary)]">صفحات تمت مدارستها</div>
                  </div>
                  <div>
                    <Trophy size={16} className="mx-auto text-[var(--wn-text-gold)] mb-1" aria-hidden="true" />
                    <div className="text-base font-bold text-[var(--wn-heading)]">{totalStars} ⭐</div>
                    <div className="text-[11px] text-[var(--wn-text-secondary)]">نجوم التميز</div>
                  </div>
                  <div>
                    <Sparkles size={16} className="mx-auto text-[var(--wn-emerald)] mb-1" aria-hidden="true" />
                    <div className="text-base font-bold text-[var(--wn-heading)]">{pinnedMistakes.length}</div>
                    <div className="text-[11px] text-[var(--wn-text-secondary)]">تنبيهات مصححة</div>
                  </div>
                </div>
              )}

              {!isTeacher && (
                <p className="text-[11px] text-[var(--wn-text-tertiary)]">آمـيـن يـا رب العـالـمـيـن</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
