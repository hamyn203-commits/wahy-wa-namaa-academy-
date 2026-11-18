import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles, Search, SearchX } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import '../../styles/public-experience.css';

const FAQ_COPY = {
  ar: {
    eyebrow: 'مركز المساعدة',
    title: 'الأسئلة الشائعة',
    subtitle: 'إجابات مختصرة على الأسئلة المتكررة عن الدراسة والحسابات.',
    searchPlaceholder: 'ابحث في الأسئلة...',
    searchAria: 'ابحث في الأسئلة',
    noResults: 'لا توجد نتائج مطابقة.',
  },
  en: {
    eyebrow: 'HELP CENTER',
    title: 'Frequently asked questions',
    subtitle: 'Short answers to common questions about learning and accounts.',
    searchPlaceholder: 'Search questions...',
    searchAria: 'Search questions',
    noResults: 'No matching questions.',
  },
  fr: {
    eyebrow: 'CENTRE D’AIDE',
    title: 'Questions fréquentes',
    subtitle: 'Réponses claires aux questions courantes sur l’apprentissage et les comptes.',
    searchPlaceholder: 'Rechercher une question...',
    searchAria: 'Rechercher dans les questions',
    noResults: 'Aucune question correspondante.',
  },
  de: {
    eyebrow: 'HILFEZENTRUM',
    title: 'Häufig gestellte Fragen',
    subtitle: 'Kurze Antworten auf häufige Fragen zu Unterricht und Konten.',
    searchPlaceholder: 'Fragen durchsuchen...',
    searchAria: 'Fragen durchsuchen',
    noResults: 'Keine passenden Fragen gefunden.',
  },
  tr: {
    eyebrow: 'YARDIM MERKEZİ',
    title: 'Sıkça sorulan sorular',
    subtitle: 'Eğitim ve hesaplarla ilgili sık sorulan soruların kısa yanıtları.',
    searchPlaceholder: 'Sorularda ara...',
    searchAria: 'Sorularda ara',
    noResults: 'Eşleşen soru bulunamadı.',
  },
  ur: {
    eyebrow: 'امداد مرکز',
    title: 'اکثر پوچھے گئے سوالات',
    subtitle: 'تعلیم اور اکاؤنٹس کے بارے میں عام سوالات کے مختصر جوابات۔',
    searchPlaceholder: 'سوالات میں تلاش کریں...',
    searchAria: 'سوالات میں تلاش کریں',
    noResults: 'کوئی مماثل سوال نہیں ملا۔',
  },
  id: {
    eyebrow: 'PUSAT BANTUAN',
    title: 'Pertanyaan yang sering diajukan',
    subtitle: 'Jawaban singkat untuk pertanyaan umum seputar pembelajaran dan akun.',
    searchPlaceholder: 'Cari pertanyaan...',
    searchAria: 'Cari pertanyaan',
    noResults: 'Tidak ada pertanyaan yang cocok.',
  },
  ms: {
    eyebrow: 'PUSAT BANTUAN',
    title: 'Soalan lazim',
    subtitle: 'Jawapan ringkas bagi soalan lazim berkaitan pembelajaran dan akaun.',
    searchPlaceholder: 'Cari soalan...',
    searchAria: 'Cari soalan',
    noResults: 'Tiada soalan yang sepadan.',
  },
  ku: {
    eyebrow: 'ناوەندی یارمەتی',
    title: 'پرسیارە باوەکان',
    subtitle: 'وەڵامی کورت بۆ پرسیارە باوەکانی فێربوون و هەژمارەکان.',
    searchPlaceholder: 'لە پرسیارەکاندا بگەڕێ...',
    searchAria: 'گەڕان لە پرسیارەکاندا',
    noResults: 'هیچ پرسیارێکی گونجاو نەدۆزرایەوە.',
  },
};

export default function FAQPage() {
  const { locale, t, dir } = useI18n();
  const { createFAQSchema } = useSEO();
  const [open, setOpen] = useState(null);
  const [closedInSearch, setClosedInSearch] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const copy = FAQ_COPY[locale] || FAQ_COPY.en;

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

  const faqSchema = createFAQSchema(allFaqs.map((item) => ({ question: item.q, answer: item.a })));

  const handleToggle = (question) => {
    if (searching) {
      setClosedInSearch((prev) => {
        const next = new Set(prev);
        if (next.has(question)) next.delete(question);
        else next.add(question);
        return next;
      });
    } else {
      setOpen((prev) => (prev === question ? null : question));
    }
  };

  return (
    <>
      <SEOHead page={{
        title: t.faq?.title || copy.title,
        description: t.faq?.subtitle || copy.subtitle,
        url: '/faq',
        type: 'website',
        schema: faqSchema,
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}</span>
              <h1>{t.faq?.title || copy.title}</h1>
              <p>{t.faq?.subtitle || copy.subtitle}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><HelpCircle size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="wn-editorial-wrap">
          <div className="relative mb-5">
            <Search size={18} className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-4 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setClosedInSearch(new Set());
              }}
              placeholder={t.faq?.searchPlaceholder || copy.searchPlaceholder}
              aria-label={t.faq?.searchPlaceholder || copy.searchAria}
              className="input-field min-h-[44px] !py-3 ps-11 pe-4"
            />
          </div>

          {faqs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] px-6 py-12 text-center">
              <SearchX size={32} className="text-[var(--wn-gold)]" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm text-[var(--wn-text-secondary)]">{t.faq?.noResults || copy.noResults}</p>
            </div>
          ) : (
            <div className="wn-faq-list">
              {faqs.map((item, idx) => {
                const isOpen = searching ? !closedInSearch.has(item.q) : open === item.q;
                const panelId = `faq-answer-${idx}`;
                return (
                  <div key={item.q} className="wn-faq-item">
                    <button
                      type="button"
                      onClick={() => handleToggle(item.q)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="wn-faq-button min-h-[44px]"
                    >
                      <span>{item.q}</span>
                      <ChevronDown size={18} className={'shrink-0 transition-transform ' + (isOpen ? 'rotate-180' : '')} aria-hidden="true" />
                    </button>
                    {searching ? (
                      <div id={panelId} hidden={!isOpen} className="wn-faq-answer">{item.a}</div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <motion.div id={panelId} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
