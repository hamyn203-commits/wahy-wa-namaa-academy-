import { Volume2, VolumeX, Eye, Sparkles, CheckCircle2, Bell, Search } from 'lucide-react';
import { QARI_OPTIONS, SAJDAH_PAGES_MAP } from './classroomGamesData';

/**
 * شريط أدوات المعلم والطالب التفاعلي أعلى المصحف المتزامن:
 * - ستار التسميع الغيبي (4 مستويات)
 * - فاحص الكلمة المختارة (المؤشر الذهبي + مُكبّر الكلمة + ختم الأخطاء الثلاثي)
 * - المقرئ المتزامن (الحصري / المنشاوي / العفاسي)
 * - ذاكرة أخطاء الطالب السابقة من الحصص الماضية
 * - جرس المستمع اليقظ ومنبّه سجدات التلاوة الـ 15
 */
export default function MushafWordInspectorBar({
  isTeacher = false,
  isObserver = false,
  currentPage = 1,
  currentSurah,
  selectedWordInfo = null, // { ayahNum, wordIndex, wordText, surahNumber }
  hifzVeilMode = 'none',
  spotlightWord = '',
  isAudioPlaying = false,
  selectedReciter = 'Husary_Muallim_128kbps',
  onChangeReciter,
  onPlayQariAyah,
  onStopQariAyah,
  onChangeVeilMode,
  onToggleSpotlight,
  onPinMistake,
  pinnedMistakes = [],
  studentOpenMistakes = [],
  onUndoOrResolveMistake,
  onJumpToSurahNumber,
  onRingListenerBell,
  onOpenTajweedLab,
  onTeleportToWhiteboard,
  bellSentNotice = false,
}) {
  const sajdahInfo = SAJDAH_PAGES_MAP[currentPage] || null;

  return (
    <div className="space-y-1.5 px-3 py-2 bg-[var(--wn-surface-soft)] border-b border-[var(--wn-border)] text-xs">
      {/* الصف الأول: ستار التسميع الغيبي + مختبر التجويد + المقرئ المتزامن + جرس المستمع اليقظ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isTeacher ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[var(--wn-heading)] inline-flex items-center gap-1">
              <Eye size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              ستار التسميع:
            </span>
            {[
              { id: 'none', label: 'كامل' },
              { id: 'heads', label: 'رؤوس الآيات' },
              { id: 'alternating', label: 'متناوب 50%' },
              { id: 'full', label: 'اختبار غيبي (مع فتح ٣ث)' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeVeilMode?.(mode.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  hifzVeilMode === mode.id
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                {mode.label}
              </button>
            ))}

            <button
              type="button"
              onClick={onOpenTajweedLab}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>مختبر التجويد والمخارج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {hifzVeilMode !== 'none' && (
              <span className="px-2.5 py-1 rounded-lg bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)] font-bold">
                🫣 وضع التسميع الغيبي مفعّل من المعلم — سمِّع غيباً بارك الله فيك
              </span>
            )}
            {!isObserver && (
              <button
                type="button"
                onClick={onRingListenerBell}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[var(--wn-emerald-soft)] hover:bg-[var(--wn-mint)] border border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                title="اضغط بصمت لتنبيه المعلم أنك متابع يقظ ولديك فتح أو ملاحظة دون مقاطعة القارئ"
              >
                <Bell size={13} aria-hidden="true" />
                <span>{bellSentNotice ? 'تم إرسال تنبيهك للمعلم ✅' : '🔔 جرس المستمع اليقظ'}</span>
              </button>
            )}
          </div>
        )}

        {/* مشغل المقرئ المتزامن */}
        {isTeacher && (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="اختيار القارئ المعلم"
              value={selectedReciter}
              onChange={(e) => onChangeReciter?.(e.target.value)}
              className="min-h-[34px] px-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-xs font-semibold"
            >
              {QARI_OPTIONS.map((q) => (
                <option key={q.id} value={q.id}>{q.labelAr}</option>
              ))}
            </select>

            {isAudioPlaying ? (
              <button
                type="button"
                onClick={onStopQariAyah}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-white)] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <VolumeX size={13} aria-hidden="true" />
                <span>إيقاف التلاوة</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onPlayQariAyah?.(1)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-white)] font-bold inline-flex items-center gap-1 cursor-pointer"
                  title="إسماع الآية المحددة للطرفين بصوت الشيخ المختار"
                >
                  <Volume2 size={13} aria-hidden="true" />
                  <span>إسماع الآية {selectedWordInfo?.ayahNum ? `(${selectedWordInfo.ayahNum})` : '(١)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPlayQariAyah?.(3)}
                  className="min-h-[34px] px-2 py-1 rounded-lg border border-[var(--wn-emerald)] text-[var(--wn-heading)] bg-[var(--wn-surface)] font-bold cursor-pointer"
                  title="تكرار الآية 3 مرات للتلقين والتثبيت"
                >
                  تكرار ٣×
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* شريط الكلمة المحددة للمعلم: المؤشر الذهبي + التكبير + ختم الأخطاء في سجل الطالب */}
      {isTeacher && selectedWordInfo?.wordText && (
        <div className="p-2 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-gold)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] font-serif text-base font-bold">
              «{selectedWordInfo.wordText}»
            </span>
            <span className="text-[var(--wn-text-secondary)] font-semibold">
              {currentSurah?.name} • آية {selectedWordInfo.ayahNum}
            </span>
            <button
              type="button"
              onClick={() => onToggleSpotlight?.(spotlightWord === selectedWordInfo.wordText ? '' : selectedWordInfo.wordText)}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg font-bold border inline-flex items-center gap-1 cursor-pointer ${
                spotlightWord === selectedWordInfo.wordText
                  ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                  : 'bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] border-[var(--wn-border)]'
              }`}
            >
              <Search size={12} aria-hidden="true" />
              <span>{spotlightWord === selectedWordInfo.wordText ? 'إخفاء المُكبّر' : 'مُكبّر الكلمة'}</span>
            </button>
            {onTeleportToWhiteboard && (
              <button
                type="button"
                onClick={() => onTeleportToWhiteboard(selectedWordInfo.ayahFullText || selectedWordInfo.wordText)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-white)] font-bold inline-flex items-center gap-1 cursor-pointer"
                title="إرسال هذه الكلمة أو الآية فوراً إلى السبورة الذكية للشرح والتشريح"
              >
                <span>📌 للسبورة</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[var(--wn-text-secondary)] font-semibold">ختم تصحيح فوري بسجل الطالب:</span>
            <button
              type="button"
              onClick={() => onPinMistake?.('memorization')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border border-[var(--wn-danger)] font-bold cursor-pointer"
            >
              🔴 خطأ حفظ
            </button>
            <button
              type="button"
              onClick={() => onPinMistake?.('tajweed')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-gold)] font-bold cursor-pointer"
            >
              🟠 خطأ تجويد
            </button>
            <button
              type="button"
              onClick={() => onPinMistake?.('tashkeel')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-emerald)] font-bold cursor-pointer"
            >
              🔵 تشكيل
            </button>
          </div>
        </div>
      )}

      {/* مُكبّر الكلمة القرآنية الضخم (يظهر عند الطرفين عند تفعيله من المعلم) */}
      {spotlightWord && (
        <div className="p-3 rounded-2xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface)] text-center shadow-md">
          <div className="text-[11px] font-bold text-[var(--wn-badge-gold-text)] mb-1">🔍 ركّز على نطق ورسم هذه الكلمة الكريمة:</div>
          <div className="text-4xl md:text-5xl font-serif font-bold text-[var(--wn-heading)] py-1" dir="rtl">
            {spotlightWord}
          </div>
        </div>
      )}

      {/* منبّه سجدات التلاوة الـ 15 التلقائي */}
      {sajdahInfo && (
        <div className="p-2 px-3 rounded-xl bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)] flex flex-wrap items-center justify-between gap-2 text-[var(--wn-badge-gold-text)]">
          <span className="font-bold">
            ۩ موضع سجدة تلاوة في هذه الصفحة ({sajdahInfo.surah} — آية {sajdahInfo.ayah})
          </span>
          <span className="font-serif text-sm">«{sajdahInfo.dua}»</span>
        </div>
      )}

      {/* الأخطاء المسجلة في الحصة الحالية + ذاكرة أخطاء الطالب السابقة */}
      {(pinnedMistakes.length > 0 || (isTeacher && studentOpenMistakes.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {pinnedMistakes.slice(0, 5).map((m) => (
            <span
              key={m.id}
              className="px-2.5 py-1 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] inline-flex items-center gap-1.5 font-semibold"
            >
              <span>{m.type === 'memorization' ? '🔴' : m.type === 'tajweed' ? '🟠' : '🔵'}</span>
              <span>{m.wordText || `آية ${m.ayahNumber}`}</span>
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => onUndoOrResolveMistake?.({ mistakeId: m.id, annotationId: m.annotationId })}
                  className="text-[var(--wn-emerald)] font-bold hover:underline cursor-pointer"
                  title="تراجع أو اعتماد التصحيح"
                >
                  ✓
                </button>
              )}
            </span>
          ))}

          {isTeacher && studentOpenMistakes.slice(0, 3).map((oldM) => (
            <span
              key={oldM._id}
              className="px-2.5 py-1 rounded-lg bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)] inline-flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => onJumpToSurahNumber?.(oldM.surahNumber)}
                className="font-bold hover:underline cursor-pointer"
                title="اضغط للانتقال إلى موضع الملاحظة السابقة لمراجعتها"
              >
                📌 سابقاً: {oldM.surahName || `سورة ${oldM.surahNumber}`} ({oldM.ayahNumber}) {oldM.wordText ? `«${oldM.wordText}»` : ''}
              </button>
              <button
                type="button"
                onClick={() => onUndoOrResolveMistake?.({ annotationId: String(oldM._id) })}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--wn-emerald)] text-[var(--wn-white)] font-bold cursor-pointer"
                title="اعتماد إتقان الطالب لهذه الملاحظة الآن"
              >
                <CheckCircle2 size={11} aria-hidden="true" />
                <span>أتقنها</span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
