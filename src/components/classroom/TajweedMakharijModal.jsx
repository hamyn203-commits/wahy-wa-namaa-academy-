import { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Activity, BookOpen, Volume2 } from 'lucide-react';
import { MAKHARIJ_ZONES, ARABIC_LETTERS_MAKHARIJ, QAIDA_HARAKAT } from './classroomGamesData';

const TEMPO_MS = {
  tahqeeq: 950,
  tadweer: 700,
  hadr: 480,
};

/**
 * مختبر التجويد ومخارج الحروف واللوح النوراني الحي المتزامن
 */
export default function TajweedMakharijModal({
  isOpen,
  onClose,
  isTeacher = false,
  tajweedLabState,
  onUpdateLab,
  dir = 'rtl',
}) {
  const activeTab = tajweedLabState?.activeModal && tajweedLabState.activeModal !== 'none' && tajweedLabState.activeModal !== 'ritual'
    ? tajweedLabState.activeModal
    : 'metronome';

  const counts = tajweedLabState?.metronome?.counts || 4;
  const tempo = tajweedLabState?.metronome?.tempo || 'tadweer';
  const isMetronomeActive = Boolean(tajweedLabState?.metronome?.active);
  const metronomeNonce = tajweedLabState?.metronome?.nonce || 0;

  const selectedLetter = tajweedLabState?.selectedLetter || 'ق';
  const qaidaLetter = tajweedLabState?.qaidaLetter || 'ب';
  const qaidaHaraka = tajweedLabState?.qaidaHaraka || 'fatha';

  const [activeBeat, setActiveBeat] = useState(0);

  useEffect(() => {
    if (!isOpen || activeTab !== 'metronome' || !isMetronomeActive) {
      setActiveBeat(0);
      return undefined;
    }
    setActiveBeat(1);
    const stepMs = TEMPO_MS[tempo] || 700;
    const interval = setInterval(() => {
      setActiveBeat((prev) => (prev >= counts ? 1 : prev + 1));
    }, stepMs);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, isMetronomeActive, counts, tempo, metronomeNonce]);

  const letterInfo = useMemo(() => {
    return ARABIC_LETTERS_MAKHARIJ.find((l) => l.letter === selectedLetter) || ARABIC_LETTERS_MAKHARIJ[0];
  }, [selectedLetter]);

  const activeZoneInfo = useMemo(() => {
    return MAKHARIJ_ZONES.find((z) => z.id === letterInfo.zone) || MAKHARIJ_ZONES[0];
  }, [letterInfo]);

  const qaidaRendered = useMemo(() => {
    const h = QAIDA_HARAKAT.find((item) => item.id === qaidaHaraka) || QAIDA_HARAKAT[0];
    return {
      ...h,
      display: `${h.prefix || ''}${qaidaLetter}${h.combine}`,
    };
  }, [qaidaLetter, qaidaHaraka]);

  if (!isOpen) return null;

  const switchTab = (tab) => {
    if (isTeacher && onUpdateLab) {
      onUpdateLab({ activeModal: tab });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-sm"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label="مختبر التجويد ومخارج الحروف"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] shadow-2xl flex flex-col">
        <div className="p-4 border-b border-[var(--wn-border)] bg-[var(--wn-surface-soft)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-[var(--wn-text-gold)] shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-bold text-base text-[var(--wn-heading)]">مختبر التجويد والنطق الحي المتزامن</h3>
              <p className="text-xs text-[var(--wn-text-secondary)]">
                {isTeacher ? 'أي أداة تختارها تظهر فوراً أمام الطالب في نفس اللحظة' : 'يعرض لك المعلم الآن الشرح التفاعلي المباشر'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl inline-flex items-center justify-center hover:bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-2.5 border-b border-[var(--wn-border)] bg-[var(--wn-surface)] flex flex-wrap gap-2">
          {[
            { id: 'metronome', icon: Activity, label: 'ميزان الحركات والمدود' },
            { id: 'makharij', icon: Volume2, label: 'مرآة مخارج الحروف' },
            { id: 'qaida', icon: BookOpen, label: 'اللوح النوراني السريع' },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={!isTeacher}
                onClick={() => switchTab(tab.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:cursor-default ${
                  selected
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] shadow-sm'
                    : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-5">
          {activeTab === 'metronome' && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-2xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] space-y-4">
                <p className="text-sm font-bold text-[var(--wn-heading)]">
                  ميزان ضبط زمن الغنّة والمدود البصري (بدون صوت — لتجاوز أي تأخير في الإنترنت)
                </p>
                <div className="flex items-center justify-center gap-3 py-4 flex-wrap">
                  {Array.from({ length: counts }).map((_, idx) => {
                    const num = idx + 1;
                    const lit = isMetronomeActive && activeBeat >= num;
                    const isPeak = isMetronomeActive && activeBeat === num;
                    return (
                      <div
                        key={num}
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 border-2 ${
                          isPeak
                            ? 'scale-115 bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-gold)] shadow-lg'
                            : lit
                              ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border-[var(--wn-emerald)]'
                              : 'bg-[var(--wn-surface)] text-[var(--wn-text-tertiary)] border-[var(--wn-border)]'
                        }`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--wn-text-secondary)]">
                  {counts === 2 && 'حركتان: للمد الطبيعي، مد العوض، مد البدل، والغنة الكاملة'}
                  {counts === 4 && '٤ حركات: للمد الواجب المتصل والمد الجائز المنفصل (بالتوسط)'}
                  {counts === 5 && '٥ حركات: للمد الواجب المتصل (فوق التوسط)'}
                  {counts === 6 && '٦ حركات لزوماً: للمد اللازم الكلمي والحرفي (مثل: الضَّآلِّينَ، آلم)'}
                </p>
              </div>

              {isTeacher && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                      { n: 2, label: '٢ حركتان (طبيعي/غنة)' },
                      { n: 4, label: '٤ حركات (متصل/منفصل)' },
                      { n: 5, label: '٥ حركات' },
                      { n: 6, label: '٦ حركات (مد لازم)' },
                    ].map((opt) => (
                      <button
                        key={opt.n}
                        type="button"
                        onClick={() => onUpdateLab?.({ metronome: { counts: opt.n, tempo, active: true } })}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                          counts === opt.n
                            ? 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
                            : 'bg-[var(--wn-surface)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                      { id: 'tahqeeq', label: 'مرتبة التحقيق (بطيء للتعليم)' },
                      { id: 'tadweer', label: 'مرتبة التدوير (معتدل)' },
                      { id: 'hadr', label: 'مرتبة الحدر (سريع للمراجعة)' },
                    ].map((tOpt) => (
                      <button
                        key={tOpt.id}
                        type="button"
                        onClick={() => onUpdateLab?.({ metronome: { counts, tempo: tOpt.id, active: true } })}
                        className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          tempo === tOpt.id
                            ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-emerald)] text-[var(--wn-badge-emerald-text)]'
                            : 'bg-[var(--wn-surface)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                        }`}
                      >
                        {tOpt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateLab?.({ metronome: { counts, tempo, active: !isMetronomeActive } })}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] font-bold text-sm cursor-pointer"
                  >
                    {isMetronomeActive ? 'إيقاف النبض الضوئي' : 'تشغيل النبض الضوئي المتزامن للطالب'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'makharij' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div className="md:col-span-2 p-4 rounded-2xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] flex flex-col items-center">
                  <svg viewBox="0 0 220 220" className="w-44 h-44" aria-label="رسم توضيحي لمخارج الحروف">
                    <circle cx="110" cy="110" r="98" fill="none" stroke="var(--wn-border-strong)" strokeWidth="2" />
                    {/* الخيشوم */}
                    <ellipse
                      cx="88"
                      cy="68"
                      rx="28"
                      ry="14"
                      fill={letterInfo.zone === 'khayshoom' ? 'var(--wn-gold)' : 'var(--wn-surface-sunken)'}
                      stroke="var(--wn-emerald)"
                      strokeWidth="2"
                    />
                    <text x="88" y="72" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--wn-text-primary)">الخيشوم</text>
                    {/* الشفتان */}
                    <ellipse
                      cx="42"
                      cy="112"
                      rx="18"
                      ry="22"
                      fill={letterInfo.zone === 'shafatan' ? 'var(--wn-gold)' : 'var(--wn-surface-sunken)'}
                      stroke="var(--wn-emerald)"
                      strokeWidth="2"
                    />
                    <text x="42" y="116" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--wn-text-primary)">الشفتان</text>
                    {/* اللسان */}
                    <ellipse
                      cx="104"
                      cy="116"
                      rx="38"
                      ry="20"
                      fill={letterInfo.zone === 'lisan' ? 'var(--wn-gold)' : 'var(--wn-surface-sunken)'}
                      stroke="var(--wn-emerald)"
                      strokeWidth="2"
                    />
                    <text x="104" y="120" textAnchor="middle" fontSize="12" fontWeight="bold" fill="var(--wn-text-primary)">اللسان</text>
                    {/* الجوف */}
                    <ellipse
                      cx="145"
                      cy="95"
                      rx="22"
                      ry="14"
                      fill={letterInfo.zone === 'jawf' ? 'var(--wn-gold)' : 'var(--wn-surface-sunken)'}
                      stroke="var(--wn-emerald)"
                      strokeWidth="2"
                    />
                    <text x="145" y="99" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--wn-text-primary)">الجوف</text>
                    {/* الحلق */}
                    <rect
                      x="132"
                      y="132"
                      width="36"
                      height="56"
                      rx="14"
                      fill={letterInfo.zone === 'halq' ? 'var(--wn-gold)' : 'var(--wn-surface-sunken)'}
                      stroke="var(--wn-emerald)"
                      strokeWidth="2"
                    />
                    <text x="150" y="164" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--wn-text-primary)">الحلق</text>
                  </svg>
                  <span className="mt-2 px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
                    المنطقة النشطة: {activeZoneInfo.labelAr}
                  </span>
                </div>

                <div className="md:col-span-3 space-y-3">
                  <div className="p-4 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold font-serif text-[var(--wn-heading)]">حرف «{letterInfo.letter}»</span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]">
                        {letterInfo.sifat}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--wn-text-primary)]">المخرج الدقيق: {letterInfo.place}</p>
                    <p className="text-sm font-serif bg-[var(--wn-surface)] p-2.5 rounded-xl border border-[var(--wn-border)] text-center text-lg">
                      تدريب النطق: {letterInfo.drill}
                    </p>
                    <p className="text-xs text-[var(--wn-text-secondary)]">💡 تنبيه المعلم: {letterInfo.tip}</p>
                  </div>
                </div>
              </div>

              {isTeacher && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[var(--wn-text-secondary)]">اختر الحرف ليظهر مخرجه وتدريبه عند الطالب فوراً:</p>
                  <div className="flex flex-wrap gap-2">
                    {ARABIC_LETTERS_MAKHARIJ.map((item) => (
                      <button
                        key={item.letter}
                        type="button"
                        onClick={() => onUpdateLab?.({ selectedLetter: item.letter })}
                        className={`min-w-[44px] min-h-[44px] px-3 rounded-xl font-serif text-lg font-bold border cursor-pointer ${
                          selectedLetter === item.letter
                            ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                            : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                        }`}
                      >
                        {item.letter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'qaida' && (
            <div className="space-y-4 text-center">
              <div className="p-6 rounded-2xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface-soft)] space-y-3">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]">
                  {qaidaRendered.labelAr}
                </span>
                <div className="text-6xl font-serif font-bold text-[var(--wn-heading)] py-3" dir="rtl">
                  {qaidaRendered.display}
                </div>
                <p className="text-xs text-[var(--wn-text-secondary)]">{qaidaRendered.hintAr}</p>
              </div>

              {isTeacher && (
                <div className="space-y-3 text-start">
                  <p className="text-xs font-bold text-[var(--wn-text-secondary)]">١. اختر الحرف:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => onUpdateLab?.({ qaidaLetter: ch })}
                        className={`min-w-[40px] min-h-[40px] rounded-lg font-serif text-base font-bold border cursor-pointer ${
                          qaidaLetter === ch
                            ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                            : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-bold text-[var(--wn-text-secondary)]">٢. اختر الحركة أو المهارة النورانية:</p>
                  <div className="flex flex-wrap gap-2">
                    {QAIDA_HARAKAT.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => onUpdateLab?.({ qaidaHaraka: h.id })}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          qaidaHaraka === h.id
                            ? 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
                            : 'bg-[var(--wn-surface)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                        }`}
                      >
                        {h.labelAr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
