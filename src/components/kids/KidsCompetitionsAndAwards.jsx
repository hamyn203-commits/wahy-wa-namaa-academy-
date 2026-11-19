import { Award, BarChart3, BookOpenCheck, CheckCircle2, HeartHandshake, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';

export default function KidsCompetitionsAndAwards() {
  const { locale, t, dir } = useI18n();
  const copy = t.lms?.kids?.competitions || {};
  const cards = copy.cards || {};

  const items = [
    {
      icon: BarChart3,
      title: cards.progressTitle || 'Progress you can follow',
      text: cards.progressText || 'Learners and families can follow memorization, review, and attendance from recorded account data.',
    },
    {
      icon: Award,
      title: cards.motivationTitle || 'Motivation tied to progress',
      text: cards.motivationText || 'Badges and motivation elements appear when the learner actually meets their requirements.',
    },
    {
      icon: HeartHandshake,
      title: cards.familyTitle || 'Family follow-up',
      text: cards.familyText || 'Session reports help families understand what was completed and what needs follow-up.',
    },
    {
      icon: BookOpenCheck,
      title: cards.contestsTitle || 'Competitions when published',
      text: cards.contestsText || 'When the academy publishes a real competition, its dates, rules, and prizes are shown from the system.',
    },
  ];

  return (
    <section className="py-16" dir={dir}>
      <div className="page-container">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <span className="wn-public-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            {copy.eyebrow || 'KIDS MOTIVATION'}
          </span>
          <h2 className="mt-3 font-[var(--wn-font-display)] text-3xl md:text-4xl text-[var(--wn-heading)]">
            {copy.heading || 'Motivation built around real progress'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--wn-text-secondary)]">
            {copy.subtitle || 'Everything shown to learners and families reflects real account data or official academy announcements.'}
          </p>
        </div>

        <div className="wn-public-feature-grid">
          {items.map(({ icon: Icon, title, text }) => (
            <article key={title} className="wn-public-feature-card">
              <span><Icon size={21} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="flex justify-center mt-7">
          <Link to={localizedPath('/register/student', locale)} className="wn-btn wn-btn--primary min-h-[44px]">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{copy.cta || 'Start the child’s journey'}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
