import { useI18n } from '../../../i18n';
import {
  Sparkles,
  HeartHandshake,
  BriefcaseBusiness,
  Globe2,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function TargetAudiencesSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const audiences = [
    {
      icon: Sparkles,
      title: isAr ? 'الأطفال والناشئة' : 'Children & Youth',
      eyebrow: isAr ? 'تعلم محبّب ومتدرج' : 'Gentle, engaging learning',
      desc: isAr
        ? 'حلقات قصيرة وحيوية تناسب قدرة الطفل على التركيز، وتغرس محبة القرآن مع متابعة دقيقة لولي الأمر.'
        : 'Age-aware circles that build confidence, joy in recitation, and clear parent visibility.',
      items: [
        isAr ? 'تسكين متجانس في السن والمستوى' : 'Age- & level-matched peers',
        isAr ? 'تقارير دورية ومراقبة مطمئنة للأسرة' : 'Parent reports & safe oversight',
      ],
      to: '/programs/kids',
      cta: isAr ? 'استكشف برنامج الأطفال' : 'Explore kids program',
    },
    {
      icon: HeartHandshake,
      title: isAr ? 'السيدات والفتيات' : 'Women & Girls',
      eyebrow: isAr ? 'خصوصية تامة بمعلمات مجازات' : 'Dedicated female scholars',
      desc: isAr
        ? 'بيئة تعليمية مستقلة بالكامل للسيدات والفتيات بإشراف معلمات مجازات في الحفظ والتجويد والقراءات.'
        : 'An exclusive, comfortable environment led strictly by certified female Quran instructors.',
      items: [
        isAr ? 'معلمات متقنات ومجازات فقط' : 'Certified female tutors only',
        isAr ? 'مواعيد صباحية ومسائية مرنة' : 'Flexible morning & evening slots',
      ],
      to: '/women',
      cta: isAr ? 'ادخلي بوابة السيدات' : 'Visit women’s portal',
      variant: 'women',
    },
    {
      icon: BriefcaseBusiness,
      title: isAr ? 'الكبار والمشغولون' : 'Adults & Professionals',
      eyebrow: isAr ? 'مرونة بلا تنازل عن الإتقان' : 'Flexible without losing depth',
      desc: isAr
        ? 'خطة واقعية تناسب أوقات العمل والمسؤوليات اليومية، سواء لتصحيح التلاوة أو إتمام الحفظ.'
        : 'Calm, realistic schedules designed around work and family commitments.',
      items: [
        isAr ? 'حلقات جماعية مصغرة أو حصص فردية' : 'Small circles or 1-on-1 sessions',
        isAr ? 'ورد متزن قابل للاستمرار أسبوعياً' : 'Sustainable weekly pacing',
      ],
      to: '/start?section=men',
      cta: isAr ? 'ابدأ خطتك المناسبة' : 'Start your tailored plan',
    },
    {
      icon: Globe2,
      title: isAr ? 'المسلمون الجدد وطلاب العالم' : 'Global Learners & Reverts',
      eyebrow: isAr ? 'عبر المناطق الزمنية واللغات' : 'Time-zone & language aware',
      desc: isAr
        ? 'مسارات ميسّرة للناطقين بغير العربية والمسلمين الجدد والمقيمين بالخارج لتعلّم القراءة من الصفر.'
        : 'Supportive pathways for non-Arabic speakers, reverts, and diaspora families worldwide.',
      items: [
        isAr ? 'مطابقة مع معلمين يتقنون لغات متعددة' : 'Multilingual-capable scholars',
        isAr ? 'جدولة تراعي فارق التوقيت الدولي' : 'Global time-zone scheduling',
      ],
      to: '/programs/reverts',
      cta: isAr ? 'استعرض المسار العالمي' : 'Explore global pathway',
    },
  ];

  return (
    <section className="wn-home-section wn-home-section--white" id="audiences">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{isAr ? 'لكل متعلم طريقه المناسب' : 'A PATH FOR EVERY LEARNER'}</span>
          <h2>{isAr ? 'تجربة تتكيّف مع عمرك وخصوصيتك ووقتك' : 'An experience shaped around your stage, privacy, and schedule'}</h2>
          <p>{isAr ? 'اختر البوابة الأقرب لاحتياجك أو احتياج أسرتك لتنتقل مباشرة إلى المسار المصمم لها.' : 'Select the pathway closest to you or your family for tailored details and enrollment.'}</p>
        </div>

        <div className="wn-audiences-grid">
          {audiences.map(({ icon: Icon, title, eyebrow, desc, items, to, cta, variant }) => (
            <article key={title} className={`wn-audience-card ${variant === 'women' ? 'wn-audience-card--women' : ''}`}>
              <span className="wn-icon-box wn-icon-box--gold"><Icon size={21} strokeWidth={1.6} /></span>
              <small>{eyebrow}</small>
              <h3>{title}</h3>
              <p>{desc}</p>
              <div className="wn-audience-card__checks">
                {items.map((item) => <span key={item}><Check size={14} /> {item}</span>)}
              </div>
              <LocalizedLink
                to={to}
                locale={locale}
                onMouseEnter={() => prefetchRoute(to.split('?')[0])}
                className="wn-audience-card__link"
              >
                <span>{cta}</span>
                <ArrowIcon size={14} />
              </LocalizedLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
