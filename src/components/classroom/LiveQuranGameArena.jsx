import { useState, useEffect, useCallback } from 'react';
import { Trophy, Play, Eye, RotateCcw, Clock, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import {
  CLASSROOM_GAME_MODES,
  createBankRoundPayload,
  createPageRoundPayload,
} from './classroomGamesData';

/**
 * ساحة التحديات والألعاب القرآنية الحية المتزامنة داخل الغرفة (6 ألعاب + تحدي الصفحة المفتوحة)
 */
export default function LiveQuranGameArena({
  isTeacher = false,
  isObserver = false,
  currentUserId = '',
  activeGame,
  engagement,
  currentPageData = null,
  onLaunchGame,
  onRevealGame,
  onResetGame,
  onSubmitAnswer,
  dir = 'rtl',
}) {
  const [selectedMode, setSelectedMode] = useState('ayah_puzzle');
  const [selectedTier, setSelectedTier] = useState('all');
  const [durationSec, setDurationSec] = useState(25);
  const [pickedWords, setPickedWords] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [localResult, setLocalResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const roundId = activeGame?.roundId || '';
  const status = activeGame?.status || 'idle';

  useEffect(() => {
    setPickedWords([]);
    setLocalResult(null);
  }, [roundId]);

  useEffect(() => {
    if (status !== 'active' || !activeGame?.startedAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - activeGame.startedAt) / 1000);
      const rem = Math.max(0, (activeGame.durationSec || 25) - elapsed);
      setSecondsLeft(rem);
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 500);
    return () => clearInterval(timer);
  }, [status, activeGame?.startedAt, activeGame?.durationSec]);

  const submissions = Array.isArray(activeGame?.submissions) ? activeGame.submissions : [];
  const mySubmission = submissions.find((s) => String(s.studentId) === String(currentUserId)) || null;

  const launchFromBank = useCallback((modeId) => {
    if (!isTeacher || !onLaunchGame) return;
    onLaunchGame(createBankRoundPayload(modeId, selectedTier, durationSec));
  }, [isTeacher, onLaunchGame, selectedTier, durationSec]);

  const launchFromCurrentPage = useCallback((modeId = 'ayah_puzzle') => {
    if (!isTeacher || !onLaunchGame) return;
    const payload = createPageRoundPayload({ currentPageData, modeId, durationSec });
    if (payload) onLaunchGame(payload);
  }, [isTeacher, onLaunchGame, currentPageData, durationSec]);

  const handleOptionSelect = async (optionValue) => {
    if (isTeacher || isObserver || submitting || mySubmission || status !== 'active') return;
    setSubmitting(true);
    try {
      const result = await onSubmitAnswer?.(optionValue);
      if (result) setLocalResult(result);
    } catch {
      // handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleWordIndex = (idx) => {
    if (isTeacher || isObserver || mySubmission || status !== 'active') return;
    setPickedWords((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  };

  const handleSubmitPuzzle = async () => {
    if (!activeGame?.words?.length || pickedWords.length === 0) return;
    const composed = pickedWords.map((i) => activeGame.words[i]).join(' ');
    await handleOptionSelect(composed);
  };

  const totalStars = engagement?.totalStars || 0;

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-y-auto p-3 md:p-5 text-[var(--wn-text-primary)]" dir={dir}>
      {/* رأس ساحة التحديات وعداد النجوم */}
      <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] flex items-center justify-center text-xl font-bold">
            🎮
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--wn-heading)]">ساحة التحديات القرآنية الحية</h3>
            <p className="text-xs text-[var(--wn-text-secondary)]">
              تحديات تفاعلية متزامنة بدون موسيقى لتثبيت الحفظ والتجويد والمتشابهات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] text-xs font-bold inline-flex items-center gap-1.5 border border-[var(--wn-gold)]">
            <Trophy size={15} aria-hidden="true" />
            <span>نجوم الحصة: {totalStars} ⭐</span>
          </span>
          {isTeacher && status !== 'idle' && (
            <button
              type="button"
              onClick={onResetGame}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>تحدٍّ جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* شاشة إطلاق اللعبة للمعلم عندما لا توجد جولة نشطة */}
      {status === 'idle' && isTeacher && (
        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 md:p-5 space-y-5 shadow-sm">
          {currentPageData?.verses?.length > 0 && (
            <div className="p-4 rounded-2xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                  <Zap size={15} aria-hidden="true" />
                  <span>توليد ذكي فوري من صفحة المصحف المفتوحة الآن ({currentPageData.surahName})!</span>
                </div>
                <p className="text-xs text-[var(--wn-text-secondary)]">
                  اختبر الطالب مباشرة في الآيات التي يقرؤها أمامك الآن بضغطة واحدة:
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => launchFromCurrentPage('ayah_puzzle')}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-bold cursor-pointer"
                >
                  🧩 رتّب آية من هذه الصفحة
                </button>
                <button
                  type="button"
                  onClick={() => launchFromCurrentPage('missing_word')}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-emerald)] text-[var(--wn-heading)] text-xs font-bold cursor-pointer"
                >
                  🎯 أكمل كلمة من هذه الصفحة
                </button>
                {currentPageData.verses.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => launchFromCurrentPage('next_ayah')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-emerald)] text-[var(--wn-heading)] text-xs font-bold cursor-pointer"
                  >
                    🔗 ما الآية التالية؟
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--wn-text-secondary)]">المستوى:</span>
              {[
                { id: 'all', label: 'شامل' },
                { id: 'beginner', label: 'مبتدئ (جزء عمّ)' },
                { id: 'intermediate', label: 'متوسط (تبارك والملك)' },
                { id: 'advanced', label: 'متقدم (الطوال والإتقان)' },
              ].map((tOpt) => (
                <button
                  key={tOpt.id}
                  type="button"
                  onClick={() => setSelectedTier(tOpt.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    selectedTier === tOpt.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  {tOpt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--wn-text-secondary)]">المؤقت:</span>
              {[15, 25, 40].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDurationSec(sec)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    durationSec === sec
                      ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-gold)]'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  {sec} ث
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CLASSROOM_GAME_MODES.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedMode(m.id); }}
                className={`p-4 rounded-2xl border text-start transition flex flex-col justify-between gap-3 cursor-pointer ${
                  selectedMode === m.id
                    ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)]'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-lg font-bold text-[var(--wn-heading)] flex items-center gap-2">
                    <span>{m.icon}</span>
                    <span>{m.labelAr}</span>
                  </div>
                  <p className="text-xs text-[var(--wn-text-secondary)]">{m.descAr}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    launchFromBank(m.id);
                  }}
                  className="min-h-[42px] w-full rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play size={14} aria-hidden="true" />
                  <span>إطلاق الجولة الآن</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* شاشة الانتظار للطالب قبل أن يطلق المعلم التحدي */}
      {status === 'idle' && !isTeacher && (
        <div className="flex-1 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-8 flex flex-col items-center justify-center text-center gap-3">
          <Sparkles size={42} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
          <h4 className="text-lg font-bold text-[var(--wn-heading)]">استعد للتحدي القرآني المباشر!</h4>
          <p className="text-sm text-[var(--wn-text-secondary)] max-w-md">
            سيُطلق المعلم جولة تفاعلية حية (ترتيب آيات، الكلمة المفقودة، صائد التجويد، أو سباق المتشابهات) وستظهر أمامك هنا فوراً.
          </p>
        </div>
      )}

      {/* شاشة الجولة النشطة أو المكشوفة */}
      {status !== 'idle' && (
        <div className="rounded-2xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface)] p-4 md:p-6 space-y-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wn-border)] pb-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
                {CLASSROOM_GAME_MODES.find((m) => m.id === activeGame.mode)?.labelAr || 'تحدي قرآني'}
              </span>
              {activeGame.surahName && (
                <span className="text-xs font-bold text-[var(--wn-text-secondary)]">
                  {activeGame.surahName} {activeGame.ayahNumber ? `• آية ${activeGame.ayahNumber}` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status === 'active' ? (
                <span className="px-3 py-1.5 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] font-mono font-bold text-sm inline-flex items-center gap-1.5">
                  <Clock size={15} aria-hidden="true" />
                  <span>{secondsLeft}s</span>
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] font-bold text-xs inline-flex items-center gap-1">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>تم كشف الإجابة</span>
                </span>
              )}

              {isTeacher && status === 'active' && (
                <button
                  type="button"
                  onClick={onRevealGame}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={15} aria-hidden="true" />
                  <span>كشف الإجابة والنتيجة</span>
                </button>
              )}
            </div>
          </div>

          {/* نص السؤال */}
          <div className="p-5 rounded-2xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-center">
            <p className="text-xl md:text-2xl font-serif font-bold leading-loose text-[var(--wn-heading)]">
              {activeGame.prompt}
            </p>
          </div>

          {/* نمط ترتيب كلمات الآية */}
          {activeGame.mode === 'ayah_puzzle' && Array.isArray(activeGame.words) && activeGame.words.length > 0 && (
            <div className="space-y-4">
              {!isTeacher && !isObserver && (
                <div className="min-h-[60px] p-3 rounded-xl border-2 border-dashed border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] flex flex-wrap items-center justify-center gap-2">
                  {pickedWords.length === 0 ? (
                    <span className="text-xs text-[var(--wn-text-tertiary)]">اضغط على الكلمات بالأسفل بالترتيب القرآني الصحيح…</span>
                  ) : (
                    pickedWords.map((wIdx, pos) => (
                      <button
                        key={`${wIdx}-${pos}`}
                        type="button"
                        disabled={Boolean(mySubmission) || status !== 'active'}
                        onClick={() => handleToggleWordIndex(wIdx)}
                        className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-white)] font-serif text-lg font-bold cursor-pointer"
                      >
                        {activeGame.words[wIdx]}
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {activeGame.words.map((word, idx) => {
                  const chosen = pickedWords.includes(idx);
                  return (
                    <button
                      key={`${word}-${idx}`}
                      type="button"
                      disabled={isTeacher || isObserver || Boolean(mySubmission) || status !== 'active'}
                      onClick={() => handleToggleWordIndex(idx)}
                      className={`min-h-[46px] px-4 py-2 rounded-xl font-serif text-lg font-bold border transition cursor-pointer disabled:cursor-default ${
                        chosen
                          ? 'opacity-35 bg-[var(--wn-surface-sunken)] border-[var(--wn-border)]'
                          : 'bg-[var(--wn-surface)] border-[var(--wn-border-strong)] hover:border-[var(--wn-emerald)] text-[var(--wn-text-primary)] shadow-xs'
                      }`}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              {!isTeacher && !isObserver && !mySubmission && status === 'active' && (
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={pickedWords.length !== activeGame.words.length || submitting}
                    onClick={handleSubmitPuzzle}
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] font-bold text-sm disabled:opacity-45 cursor-pointer"
                  >
                    اعتماد ترتيب الآية ✅
                  </button>
                  {pickedWords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickedWords([])}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl border border-[var(--wn-border)] text-xs font-bold cursor-pointer"
                    >
                      مسح الترتيب
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* أنماط الاختيارات الأربعة */}
          {Array.isArray(activeGame.options) && activeGame.options.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeGame.options.map((opt) => {
                const isMyPick = mySubmission?.answer === opt;
                const isCorrectOpt = status === 'revealed' && activeGame.correctAnswer === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isTeacher || isObserver || Boolean(mySubmission) || status !== 'active' || submitting}
                    onClick={() => handleOptionSelect(opt)}
                    className={`min-h-[54px] p-3.5 rounded-xl border-2 font-serif text-base md:text-lg font-bold text-center transition cursor-pointer disabled:cursor-default ${
                      isCorrectOpt
                        ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                        : isMyPick
                          ? 'border-[var(--wn-gold)] bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]'
                          : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] text-[var(--wn-text-primary)]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* نتيجة الطالب الفورية */}
          {(localResult || mySubmission) && (
            <div className={`p-3.5 rounded-xl border text-center text-sm font-bold ${
              (localResult?.isCorrect ?? mySubmission?.isCorrect)
                ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-emerald)] text-[var(--wn-badge-emerald-text)]'
                : 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
            }`}>
              {(localResult?.isCorrect ?? mySubmission?.isCorrect)
                ? `ما شاء الله! إجابة صحيحة متقنة 🌟 (+${localResult?.starsAwarded || 2} نجوم)`
                : 'تم تسجيل محاولتك — راجع الفائدة القرآنية مع الشيخ عند كشف الإجابة'}
            </div>
          )}

          {/* بطاقة الشرح والإجابة الصحيحة عند الكشف */}
          {status === 'revealed' && (
            <div className="p-4 rounded-2xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-emerald)] space-y-1.5">
              <p className="text-sm font-bold text-[var(--wn-heading)]">
                ✅ الإجابة الصحيحة: <span className="font-serif text-base">{activeGame.correctAnswer}</span>
              </p>
              {activeGame.explanation && (
                <p className="text-xs text-[var(--wn-text-secondary)]">💡 الفائدة: {activeGame.explanation}</p>
              )}
            </div>
          )}

          {/* لوحة إجابات الطلاب المباشرة أمام المعلم وعند الكشف */}
          {(isTeacher || status === 'revealed') && (
            <div className="pt-2 border-t border-[var(--wn-border)] space-y-2">
              <p className="text-xs font-bold text-[var(--wn-text-secondary)]">
                تفاعل الطلاب في هذه الجولة ({submissions.length}):
              </p>
              {submissions.length === 0 ? (
                <p className="text-xs text-[var(--wn-text-tertiary)]">بانتظار إجابات الطلاب…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {submissions.map((sub) => (
                    <span
                      key={`${sub.studentId}-${sub.submittedAt}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        sub.isCorrect
                          ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-emerald)] text-[var(--wn-badge-emerald-text)]'
                          : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                      }`}
                    >
                      {sub.studentName} {sub.isCorrect ? '✅' : '•'} ({(sub.timeMs / 1000).toFixed(1)}ث)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
