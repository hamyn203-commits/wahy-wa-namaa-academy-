import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { ChevronUp, ChevronDown, Search, SearchX } from 'lucide-react';
import { useReveal, GoldDivider } from './_shared';

export default function FAQSection() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const ref = useReveal();
  const faqs = [
    { q: t.faq.q1, a: t.faq.a1 }, { q: t.faq.q2, a: t.faq.a2 }, { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 }, { q: t.faq.q5, a: t.faq.a5 },
  ];

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const filtered = searching
    ? faqs.filter((faq) => `${faq.q} ${faq.a}`.toLowerCase().includes(trimmedQuery))
    : faqs;

  return (
    <section className="py-24" style={{ background: 'var(--wn-surface-soft)' }}>
      <div className="page-container max-w-3xl">
        <div ref={ref} className="reveal text-center mb-12">
          <span className="section-label mb-4">{locale === 'id' ? 'Pertanyaan Umum' : locale === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span>
          <h2 className="section-heading mt-4">{t.faq.title}</h2>
          <GoldDivider center />
          <p className="section-desc mx-auto !mt-2">{t.faq.subtitle}</p>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="pointer-events-none absolute top-1/2 -translate-y-1/2 ltr:left-4 rtl:right-4 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.faq.searchPlaceholder}
            aria-label={t.faq.searchPlaceholder}
            className="input-field !py-3 ltr:pl-11 ltr:pr-4 rtl:pr-11 rtl:pl-4"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--wn-border)] bg-white px-6 py-12 text-center">
            <SearchX size={32} className="text-[var(--wn-gold)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--wn-text-secondary)]">{t.faq.noResults}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((faq) => {
              const isOpen = searching || open === faq.q;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border bg-white overflow-hidden transition-shadow"
                  style={{ borderColor: isOpen ? 'rgba(212,175,107,0.4)' : 'var(--wn-border)' }}
                >
                  <button
                    onClick={() => setOpen(open === faq.q ? null : faq.q)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 p-5 text-right text-sm font-semibold text-[var(--wn-text-primary)] hover:bg-[var(--wn-gold-soft)] transition-colors"
                  >
                    {faq.q}
                    {isOpen ? <ChevronUp size={18} className="shrink-0 text-[var(--wn-gold)]" /> : <ChevronDown size={18} className="shrink-0 text-[var(--wn-text-secondary)]" />}
                  </button>
                  {(searching || open === faq.q) && (
                    <div className="px-5 pb-5 text-sm text-[var(--wn-text-secondary)] leading-relaxed border-t border-[var(--wn-border)] pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
