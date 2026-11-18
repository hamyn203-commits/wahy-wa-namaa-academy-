import { Star } from 'lucide-react';

export default function EmptyState({ icon: Icon = Star, title, description, action }) {
  return (
    <div className="wn-empty">
      <div
        className="w-20 h-20 rounded-full bg-[var(--wn-gold-soft)] border border-[var(--wn-border)] flex items-center justify-center mb-2"
        aria-hidden="true"
      >
        <Icon size={36} className="text-[var(--wn-gold)]" strokeWidth={1.5} />
      </div>
      {title && (
        <h3 className="font-display text-xl font-bold text-[var(--wn-heading)]">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-[var(--wn-text-secondary)] max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
