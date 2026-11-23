import { STEPS } from './constants';
import { useI18n } from '../../i18n';

export default function StepProgress({ current, skipEmailVerification = false }) {
  const { t } = useI18n();
  const trSteps = t?.teacherRegistration?.steps || {};
  const visibleSteps = skipEmailVerification ? STEPS.filter((s) => s.id !== 4) : STEPS;
  const currentIdx = Math.max(0, visibleSteps.findIndex((s) => s.id === current));
  const displayStep = currentIdx + 1;
  const pct = visibleSteps.length > 1
    ? Math.round((currentIdx / (visibleSteps.length - 1)) * 100)
    : 100;
  const stepLabel = String(trSteps.stepOf || 'الخطوة {current} من {total}')
    .replace('{current}', String(displayStep))
    .replace('{total}', String(visibleSteps.length));

  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs text-[var(--wn-text-secondary)] mb-2">
        <span>{stepLabel}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 bg-[var(--wn-surface-sunken)] rounded-full overflow-hidden mb-6"
        role="progressbar"
        aria-valuenow={displayStep}
        aria-valuemin={1}
        aria-valuemax={visibleSteps.length}
        aria-label={stepLabel}
      >
        <div className="h-full bg-[var(--wn-emerald)] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {visibleSteps.map((s, idx) => {
          const Icon = s.icon;
          const active = idx === currentIdx;
          const done = idx < currentIdx;
          return (
            <div
              key={s.id}
              aria-current={active ? 'step' : undefined}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
                active
                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] font-semibold'
                  : done
                    ? 'border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-badge-emerald-text)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-tertiary)]'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">{trSteps[s.shortKey] || s.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
