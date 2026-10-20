import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { ArrowLeft, ArrowRight, ChevronDown, HelpCircle, Search, SearchX } from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';

const LANDING_FAQ_COUNT = 6;

export default function FAQHomeSection() {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');

  const allFaqs = [
    { q: t.faq?.q1, a: t.faq?.a1 }, { q: t.faq?.q2, a: t.faq?.a2 },
    { q: t.faq?.q3, a: t.faq?.a3 }, { q: t.faq?.q4, a: t.faq?.a4 },
    { q: t.faq?.q5, a: t.faq?.a5 }, { q: t.faq?.q6, a: t.faq?.a6 },
    { q: t.faq?.q7, a: t.faq?.a7 }, { q: t.faq?.q8, a: t.faq?.a8 },
    { q: t.faq?.q9, a: t.faq?.a9 }, { q: t.faq?.q10, a: t.faq?.a10 },
  ].filter((item) => item.q && item.a);

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const matches = searching
    ? allFaqs.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(trimmedQuery))
    : allFaqs;
  const visible = searching ? matches : matches.slice(0, LANDING_FAQ_COUNT);
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <section className="wn-home-section wn-home-section--white" id="faq">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow"><HelpCircle size={14} /> {isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
          <h2>{t.faq?.title || (isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions')}</h2>
          <p>{t.faq?.subtitle || (isAr ? 'إجابات سريعة على أكثر ما يهمك قبل البدء.' : 'Quick answers to what matters most before you begin.')}</p>
        </div>

        <div className="wn-home-faq">
          <div className="relative">
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

          {visible.length === 0 ? (
            <div className="wn-home-faq__empty">
              <SearchX size={30} className="text-[var(--wn-gold)]" strokeWidth={1.5} />
              <p>{t.faq?.noResults || (isAr ? 'لا توجد نتائج مطابقة. جرّب كلمة أخرى.' : 'No matching questions. Try another keyword.')}</p>
            </div>
          ) : (
            <div className="wn-home-faq__list">
              {visible.map((item) => {
                const isOpen = searching || open === item.q;
                return (
                  <div key={item.q} className="wn-home-faq__item">
                    <button type="button" onClick={() => setOpen(open === item.q ? null : item.q)} aria-expanded={isOpen} className="wn-home-faq__button">
                      <span>{item.q}</span>
                      <ChevronDown size={18} className={'shrink-0 transition-transform ' + (isOpen ? 'rotate-180' : '')} />
                    </button>
                    {isOpen ? <div className="wn-home-faq__answer">{item.a}</div> : null}
                  </div>
                );
              })}
            </div>
          )}

          {!searching && matches.length > LANDING_FAQ_COUNT ? (
            <div className="wn-home-faq__more">
              <LocalizedLink to="/faq" locale={locale} className="wn-btn wn-btn--secondary">
                <span>{t.faq?.viewAll || (isAr ? 'تصفح كل الأسئلة' : 'Browse all questions')}</span>
                <ArrowIcon size={16} />
              </LocalizedLink>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
