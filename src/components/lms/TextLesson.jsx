import { useI18n } from '../../i18n';

export default function TextLesson({ lesson, locale: propLocale }) {
  const { locale: ctxLocale, isRTL, t, dir } = useI18n();
  const locale = propLocale || ctxLocale;
  const text = isRTL
    ? (lesson?.content?.text?.[locale] || lesson?.content?.text?.ar || lesson?.content?.text?.en || '')
    : (lesson?.content?.text?.[locale] || lesson?.content?.text?.en || lesson?.content?.text?.ar || '');

  if (!text.trim()) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-8 text-center text-[var(--wn-text-secondary)]" dir={dir}>
        {t.lms?.textLesson?.empty || 'No text content is available for this lesson yet.'}
      </div>
    );
  }

  const lines = text.split('\n');

  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-6 sm:p-8 text-[var(--wn-text-primary)]" dir={dir}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-6 mb-3 text-[var(--wn-heading)]">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mb-4 text-[var(--wn-heading)]">{line.slice(2)}</h1>;
        if (/^\d+\./.test(line)) return <li key={i} className="ms-6 mb-2 list-decimal">{line.replace(/^\d+\.\s*/, '')}</li>;
        if (!line.trim()) return <br key={i} />;
        return <p key={i} className="mb-3 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}
