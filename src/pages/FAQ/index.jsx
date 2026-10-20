import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles, Search, SearchX } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import '../../styles/public-experience.css';

export default function FAQPage() {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');

  const allFaqs = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
    { q: t.faq.q5, a: t.faq.a5 },
    { q: t.faq.q6, a: t.faq.a6 },
    { q: t.faq.q7, a: t.faq.a7 },
    { q: t.faq.q8, a: t.faq.a8 },
    { q: t.faq.q9, a: t.faq.a9 },
    { q: t.faq.q10, a: t.faq.a10 },
  ].filter((item) => item.q && item.a);

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const faqs = searching
    ? allFaqs.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(trimmedQuery))
    : allFaqs;

  return (
    <>
      <SEOHead page={{ title: t.faq?.title || (isAr ? 'الأسئلة الشائعة' : 'FAQ'), description: t.faq?.subtitle, url: '/faq', type: 'website' }} />
      <GlobalHeader />
      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} /> {isAr ? 'مركز المساعدة' : 'HELP CENTER'}</span>
              <h1>{t.faq?.title || (isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions')}</h1>
              <p>{t.faq?.subtitle || (isAr ? 'إجابات مختصرة على الأسئلة المتكررة عن الدراسة والحسابات.' : 'Short answers to common questions about learning and accounts.')}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><HelpCircle size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="wn-editorial-wrap">
          <div className="relative mb-5">
            <Search size={18} className="pointer-events-none absolute top-1/2 -translate-y-1/2 ltr:left-4 rtl:right-4 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.faq?.searchPlaceholder || (isAr ? 'ابحث في الأسئلة...' : 'Search questions...')}
              aria-label={t.faq?.searchPlaceholder || (isAr ? 'ابحث في الأسئلة' : 'Search questions')}
              className="input-field !py-3 ltr:pl-11 ltr:pr-4 rtl:pr-11 rtl:pl-4"
            />
          </div>

          {faqs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--wn-border)] bg-white px-6 py-12 text-center">
              <SearchX size={32} className="text-[var(--wn-gold)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--wn-text-secondary)]">{t.faq?.noResults || (isAr ? 'لا توجد نتائج مطابقة.' : 'No matching questions.')}</p>
            </div>
          ) : (
            <div className="wn-faq-list">
              {faqs.map((item) => {
                const isOpen = searching || open === item.q;
                return (
                  <div key={item.q} className="wn-faq-item">
                    <button type="button" onClick={() => setOpen(open === item.q ? null : item.q)} aria-expanded={isOpen} className="wn-faq-button">
                      <span>{item.q}</span>
                      <ChevronDown size={18} className={'shrink-0 transition-transform ' + (isOpen ? 'rotate-180' : '')} />
                    </button>
                    {searching ? (
                      isOpen ? <div className="wn-faq-answer">{item.a}</div> : null
                    ) : (
                      <AnimatePresence initial={false}>
                        {open === item.q ? (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="wn-faq-answer">{item.a}</div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
