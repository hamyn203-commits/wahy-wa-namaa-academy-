import { STEPS } from './constants';
import { useI18n } from '../../i18n';

export default function StepProgress({ current }) {
  const { t } = useI18n();
  const trSteps = t?.teacherRegistration?.steps || {};
  const pct = Math.round(((current - 1) / (STEPS.length - 1)) * 100);
  const stepLabel = String(trSteps.stepOf || 'الخطوة {current} من {total}')
    .replace('{current}', String(current))
    .replace('{total}', String(STEPS.length));

  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs text-[var(--wn-text-secondary)] mb-2">
        <span>{stepLabel}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 bg-[var(--wn-surface-sunken)] rounded-full overflow-hidden mb-6"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={stepLabel}
      >
        <div className="h-full bg-[var(--wn-emerald)] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = current === s.id;
          const done = current > s.id;
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
