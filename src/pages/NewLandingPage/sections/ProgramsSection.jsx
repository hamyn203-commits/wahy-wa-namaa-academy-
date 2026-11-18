import { useI18n } from '../../../i18n';
import {
  BookOpen,
  Award,
  Sparkles,
  ScrollText,
  Languages,
  ArrowLeft,
  ArrowRight,
  Sprout,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function ProgramsSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const programs = [
    {
      id: 'kids',
      icon: Sparkles,
      tag: isAr ? 'من ٥ إلى ١٤ سنة' : 'Ages 5–14',
      title: isAr ? 'تحفيظ القرآن للأطفال' : 'Quran for Children',
      desc: isAr
        ? 'أساليب تفاعلية محببة تغرس صلة الطفل بالقرآن وتبني عادة الحفظ والمراجعة برفق وتشجيع.'
        : 'Warm, interactive learning that builds love of the Quran and steady memorization habits.',
      ctaLabel: isAr ? 'استعرض برنامج الأطفال' : 'Explore kids program',
      to: '/programs/kids',
    },
    {
      id: 'hifz',
      icon: BookOpen,
      tag: isAr ? 'جميع المستويات' : 'All levels',
      title: isAr ? 'الحفظ والمراجعة المتقنة' : 'Memorization & Review',
      desc: isAr
        ? 'خطة متوازنة تجمع بين الورد الجديد والمراجعة القريبة والبعيدة بما يناسب وقت الطالب.'
        : 'A balanced plan combining new memorization with structured revision cycles.',
      ctaLabel: isAr ? 'تصفح مسار الحفظ' : 'Browse Hifz track',
      to: '/courses?track=quran',
    },
    {
      id: 'tajweed',
      icon: Award,
      tag: isAr ? 'تطبيقي ومنهجي' : 'Practical & structured',
      title: isAr ? 'تصحيح التلاوة والتجويد' : 'Recitation & Tajweed',
      desc: isAr
        ? 'ضبط مخارج الحروف وصفاتها وأحكام التجويد عملياً أثناء التلاوة المباشرة مع المعلم.'
        : 'Step-by-step articulation, letter qualities, and applied Tajweed correction.',
      ctaLabel: isAr ? 'تصفح مسار التجويد' : 'Browse Tajweed track',
      to: '/courses?track=tajweed',
    },
    {
      id: 'understanding',
      icon: Languages,
      tag: isAr ? 'تدبر وعربية' : 'Meaning & Arabic',
      title: isAr ? 'الفهم والتدبر واللسان العربي' : 'Understanding & Arabic',
      desc: isAr
        ? 'تقريب المعاني القرآنية وبناء صلة واعية بالآيات وتقوية النطق العربي الفصيح.'
        : 'Deeper understanding of Quranic meanings alongside clear classical Arabic.',
      ctaLabel: isAr ? 'استكشف المسارات' : 'Explore learning tracks',
      to: '/tracks',
    },
    {
      id: 'ijazah',
      icon: ScrollText,
      tag: isAr ? 'للمتقنين والخاتمين' : 'Advanced mastery',
      title: isAr ? 'الإجازة والسند المتصل' : 'Ijazah & Sanad',
      desc: isAr
        ? 'عرض ختمة كاملة بالضبط والإتقان على شيوخ ومعلمات مجازين بسند متصل إلى رسول الله ﷺ.'
        : 'Formal full-Quran recitation with certified scholars holding connected Sanad chains.',
      ctaLabel: isAr ? 'مسار الإجازة بالسند' : 'View Ijazah track',
      to: '/courses?track=ijazah',
    },
  ];

  const trust = [
    isAr ? 'تلقٍ مباشر بالمشافهة' : 'Live oral transmission',
    isAr ? 'مراجعة دورية منظمة' : 'Structured revision',
    isAr ? 'مواعيد مرنة حول العالم' : 'Global flexible slots',
    isAr ? 'مسارات حسب السن والمستوى' : 'Age & level matched',
    isAr ? 'شهادات إتمام موثقة' : 'Verified certificates',
  ];

  return (
    <section className="wn-approved-programs" id="programs">
      <div className="wn-approved-programs__pattern" aria-hidden="true" />
      <div className="page-container relative z-10">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{isAr ? 'برامجنا القرآنية' : 'OUR PROGRAMMES'}</span>
          <h2>{isAr ? 'رحلة تناسب أهدافك في تعلّم القرآن ونماء إيمانك' : 'A Quran journey designed for every stage'}</h2>
          <p>
            {isAr
              ? 'خمسة مسارات متكاملة تبدأ من تأسيس القراءة السليمة وحتى الإتقان والإجازة بالسند المتصل.'
              : 'Five structured pathways guiding learners from foundational recitation to connected Sanad mastery.'}
          </p>
        </div>

        <div className="wn-approved-programs__grid">
          {programs.map(({ id, icon: Icon, tag, title, desc, ctaLabel, to }) => (
            <article key={id} className="wn-approved-program-card">
              <div className="wn-approved-program-card__visual">
                <Icon size={34} strokeWidth={1.55} />
                <span className="wn-program-card-tag">{tag}</span>
              </div>
              <div className="wn-approved-program-card__body">
                <h3>{title}</h3>
                <p>{desc}</p>
                <div className="wn-program-card-footer">
                  <LocalizedLink
                    to={to}
                    locale={locale}
                    onMouseEnter={() => prefetchRoute(to.split('?')[0])}
                    className="wn-program-card-cta"
                  >
                    <span>{ctaLabel}</span>
                    <ArrowIcon size={15} />
                  </LocalizedLink>
                </div>
              </div>
            </article>
          ))}

          <aside className="wn-approved-programs__manifesto">
            <Sprout size={30} strokeWidth={1.5} />
            <p>{isAr ? 'من القرآن نبدأ… وبالعلم والعمل ننمو.' : 'We begin with revelation — and grow through knowledge and practice.'}</p>
            <span>{isAr ? 'رحلة وحي ونماء' : 'A journey of revelation and growth'}</span>
          </aside>
        </div>

        <div className="wn-approved-trust-bar" aria-label={isAr ? 'مميزات تجربة التعلم' : 'Learning experience benefits'}>
          {trust.map((item, index) => (
            <div key={item} className="wn-approved-trust-bar__item">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>

        <div className="wn-approved-programs__more">
          <LocalizedLink
            to="/courses"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/courses')}
            className="wn-btn wn-btn--secondary"
          >
            <span>{isAr ? 'استكشف جميع البرامج والدورات' : 'Explore all programmes & courses'}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
