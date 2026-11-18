import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { ArrowLeft, ArrowRight, ChevronDown, HelpCircle, Search, SearchX, X } from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { FAQ_COPY, handleRovingKeyDown, pickLocale } from '../landingI18nPart2';

const LANDING_FAQ_COUNT = 6;

export default function FAQHomeSection() {
  const { t, locale, isRTL } = useI18n();
  const copy = pickLocale(FAQ_COPY, locale, isRTL);
  const [openId, setOpenId] = useState(1);
  const [searchToggles, setSearchToggles] = useState({});
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');

  const allFaqs = [
    { id: 1, topic: 'start', q: t.faq?.q1, a: t.faq?.a1 },
    { id: 2, topic: 'start', q: t.faq?.q2, a: t.faq?.a2 },
    { id: 3, topic: 'circles', q: t.faq?.q3, a: t.faq?.a3 },
    { id: 4, topic: 'circles', q: t.faq?.q4, a: t.faq?.a4 },
    { id: 5, topic: 'family', q: t.faq?.q5, a: t.faq?.a5 },
    { id: 6, topic: 'family', q: t.faq?.q6, a: t.faq?.a6 },
    { id: 7, topic: 'circles', q: t.faq?.q7, a: t.faq?.a7 },
    { id: 8, topic: 'family', q: t.faq?.q8, a: t.faq?.a8 },
    { id: 9, topic: 'start', q: t.faq?.q9, a: t.faq?.a9 },
    { id: 10, topic: 'circles', q: t.faq?.q10, a: t.faq?.a10 },
  ].filter((item) => item.q && item.a);

  const topics = copy.topics;
  const topicKeys = topics.map((item) => item.id);

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const byTopic = topic === 'all' ? allFaqs : allFaqs.filter((item) => item.topic === topic);
  const matches = searching
    ? byTopic.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(trimmedQuery))
    : byTopic;
  const visible = searching || topic !== 'all' ? matches : matches.slice(0, LANDING_FAQ_COUNT);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleQueryChange = (nextQuery) => {
    setQuery(nextQuery);
    if (!nextQuery.trim()) {
      setSearchToggles({});
    }
  };

  const toggleItem = (id, currentlyOpen) => {
    if (searching) {
      setSearchToggles((prev) => ({ ...prev, [id]: !currentlyOpen }));
    } else {
      setOpenId(currentlyOpen ? null : id);
    }
  };

  return (
    <section className="wn-home-section wn-home-section--white" id="faq">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow"><HelpCircle size={14} aria-hidden="true" /> {copy.eyebrow}</span>
          <h2>{t.faq?.title || copy.title}</h2>
          <p>{t.faq?.subtitle || copy.subtitle}</p>
        </div>

        <div className="wn-home-faq">
          <div className="wn-faq-controls">
            <div className="wn-faq-search">
              <Search size={18} className="wn-faq-search__icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder={t.faq?.searchPlaceholder || copy.searchPlaceholder}
                aria-label={t.faq?.searchPlaceholder || copy.searchPlaceholder}
                className="input-field wn-faq-search__input"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  aria-label={copy.clearSearch}
                  className="wn-faq-search__clear"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="wn-faq-topics" role="group" aria-label={copy.topicsAria}>
              {topics.map((item) => {
                const active = item.id === topic;
                return (
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls="wn-faq-home-list"
                    key={item.id}
                    onClick={() => setTopic(item.id)}
                    onKeyDown={(event) => handleRovingKeyDown({
                      event,
                      keys: topicKeys,
                      currentKey: item.id,
                      onSelect: setTopic,
                      isRTL,
                    })}
                    className={`wn-faq-topic-chip ${active ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div id="wn-faq-home-list">
            {visible.length === 0 ? (
              <div className="wn-home-faq__empty">
                <SearchX size={30} className="text-[var(--wn-gold)]" strokeWidth={1.5} aria-hidden="true" />
                <p>{t.faq?.noResults || copy.noResults}</p>
              </div>
            ) : (
              <div className="wn-home-faq__list">
                {visible.map((item) => {
                  const isOpen = searching
                    ? (searchToggles[item.id] !== undefined ? searchToggles[item.id] : true)
                    : openId === item.id;
                  const panelId = `wn-faq-panel-${item.id}`;
                  return (
                    <div key={item.id} className={`wn-home-faq__item ${isOpen ? 'is-open' : ''}`}>
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id, isOpen)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="wn-home-faq__button"
                      >
                        <span>{item.q}</span>
                        <ChevronDown size={18} className={'shrink-0 transition-transform ' + (isOpen ? 'rotate-180' : '')} aria-hidden="true" />
                      </button>
                      <div
                        id={panelId}
                        hidden={!isOpen}
                        className={`wn-faq-collapse ${isOpen ? 'is-open' : ''}`}
                        aria-hidden={!isOpen}
                      >
                        <div className="wn-faq-collapse__inner">
                          <div className="wn-home-faq__answer">{item.a}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!searching && topic === 'all' && matches.length > LANDING_FAQ_COUNT ? (
            <div className="wn-home-faq__more">
              <LocalizedLink
                to="/faq"
                locale={locale}
                onMouseEnter={() => prefetchRoute('/faq')}
                className="wn-btn wn-btn--secondary"
              >
                <span>{t.faq?.viewAll || copy.viewAll}</span>
                <ArrowIcon size={16} aria-hidden="true" />
              </LocalizedLink>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
