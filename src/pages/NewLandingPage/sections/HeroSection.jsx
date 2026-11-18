import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  BookOpen,
  GraduationCap,
  MonitorSmartphone,
  Users,
  ArrowLeft,
  ArrowRight,
  CirclePlay,
  AudioLines,
  Route,
  Sparkles,
  HeartHandshake,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function HeroSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [activeLens, setActiveLens] = useState('recitation');

  const trustItems = [
    {
      icon: GraduationCap,
      title: isAr ? 'معلمون مؤهلون' : 'Qualified Teachers',
      text: isAr ? 'تعليم متقن وتوجيه تربوي' : 'Skilled, caring instruction',
    },
    {
      icon: BookOpen,
      title: isAr ? 'مناهج متدرجة' : 'Structured Programs',
      text: isAr ? 'من التأسيس إلى الإتقان' : 'From foundation to mastery',
    },
    {
      icon: MonitorSmartphone,
      title: isAr ? 'تعلم مرن' : 'Flexible Learning',
      text: isAr ? 'من أي مكان وفي وقت مناسب' : 'Learn from anywhere',
    },
    {
      icon: Users,
      title: isAr ? 'لجميع الأعمار' : 'For All Ages',
      text: isAr ? 'أطفال وناشئة وبالغون' : 'Kids, youth and adults',
    },
  ];

  const divisionRoutes = [
    {
      id: 'men',
      to: '/start?section=men',
      icon: GraduationCap,
      title: isAr ? 'قسم الرجال والأطفال' : 'Men & Children',
      meta: isAr ? 'شيوخ مجازون • حلقات عمرية متدرجة' : 'Certified male scholars • Age-matched circles',
      variant: 'men',
    },
    {
      id: 'women',
      to: '/start?section=women',
      icon: HeartHandshake,
      title: isAr ? 'قسم السيدات والفتيات' : 'Women & Girls',
      meta: isAr ? 'معلمات مجازات فقط • خصوصية تامة' : 'Certified female tutors • Complete privacy',
      variant: 'women',
    },
  ];

  const heroLenses = {
    recitation: {
      badge: isAr ? 'استوديو التلاوة الذكي' : 'Recitation Studio',
      detail: isAr ? 'تصحيح مخارج الحروف وأحكام التجويد مع المعلم خطوة بخطوة' : 'Live articulation & Tajweed coaching with your tutor',
    },
    pathway: {
      badge: isAr ? 'خريطة حفظ ومراجعة واضحة' : 'Structured Hifz Map',
      detail: isAr ? 'ورد جديد + مراجعة قريبة وبعيدة لضمان رسوخ الحفظ' : 'Balanced new Hifz + structured revision cycles',
    },
  };

  const activeLensData = heroLenses[activeLens] || heroLenses.recitation;

  return (
    <section className="wn-approved-hero">
      <div className="wn-approved-hero__pattern" aria-hidden="true" />

      <div className="page-container wn-approved-hero__layout">
        <div className="wn-approved-hero__copy">
          <span className="wn-approved-eyebrow wn-approved-eyebrow--hero">
            <Sparkles size={14} />
            {isAr ? 'تعليم قرآني أصيل • تجربة رقمية حديثة' : 'AUTHENTIC QURAN LEARNING • MODERN EXPERIENCE'}
          </span>

          <h1 className="wn-approved-hero__title">
            {isAr ? (
              <>
                <span>تعلَّم القرآن</span>
                <strong>يحفظك وينمو بك</strong>
              </>
            ) : (
              <>
                <span>Learn the Quran.</span>
                <strong>Let it shape your growth.</strong>
              </>
            )}
          </h1>

          <p className="wn-approved-hero__lead">
            {isAr
              ? 'تعليم أصيل بسند متصل، معلمون ومعلمات معتمدون، وتجربة حديثة ترافق الطفل والناشئ والكبير في رحلة هادئة من التلاوة والحفظ إلى الفهم والنماء.'
              : 'Authentic Sanad-rooted Quran learning with approved male and female scholars in a calm, modern digital experience for children, youth, and adults.'}
          </p>

          <div className="wn-approved-hero__actions">
            <LocalizedLink
              to="/start"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-btn wn-btn--primary wn-btn--lg"
            >
              <span>{isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" />
            </LocalizedLink>

            <a href="#learning-tools" className="wn-btn wn-btn--secondary wn-btn--lg">
              <CirclePlay size={19} />
              <span>{isAr ? 'جرّب معاينة المنصة' : 'Try interactive preview'}</span>
            </a>
          </div>

          <div className="wn-hero-assurance">
            <span>
              <CheckCircle2 size={15} />
              {isAr ? 'حصة تقييم مستوى مجانية قبل الاشتراك' : 'Free level-assessment session first'}
            </span>
            <span>
              <ShieldCheck size={15} />
              {isAr ? 'باقات مرنة تبدأ من 10 ج للحصة' : 'Flexible circles starting at 10 EGP'}
            </span>
          </div>

          <div className="wn-hero-divisions" aria-label={isAr ? 'اختيار سريع للقسم التعليمي' : 'Quick learning division entry'}>
            <span className="wn-hero-divisions__label">
              {isAr ? 'أو اختر قسمك مباشرة للبدء السريع:' : 'Or jump directly into your dedicated division:'}
            </span>
            <div className="wn-hero-divisions__grid">
              {divisionRoutes.map(({ id, to, icon: Icon, title, meta, variant }) => (
                <LocalizedLink
                  key={id}
                  to={to}
                  locale={locale}
                  onMouseEnter={() => prefetchRoute('/start')}
                  className={`wn-hero-division-card wn-hero-division-card--${variant}`}
                >
                  <span className="wn-hero-division-card__icon" aria-hidden="true">
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <span className="wn-hero-division-card__body">
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </span>
                  <ArrowIcon size={15} className="wn-hero-division-card__arrow" />
                </LocalizedLink>
              ))}
            </div>
          </div>
        </div>

        <div className="wn-approved-hero__visual">
          <img
            src="/images/hero-wahy-namaa.jpg"
            alt={isAr ? 'مصحف كريم في أجواء تعليمية روحانية لأكاديمية وحي ونماء' : 'Quran learning atmosphere at Wahy Wa Namaa Academy'}
            width="640"
            height="560"
            loading="eager"
            fetchPriority="high"
          />
          <div className="wn-approved-hero__shade" aria-hidden="true" />
          <div className="wn-hero-orbit wn-hero-orbit--one" aria-hidden="true" />
          <div className="wn-hero-orbit wn-hero-orbit--two" aria-hidden="true" />

          <aside className="wn-approved-verse-card">
            <span className="wn-approved-verse-card__ornament">✦</span>
            <p className="font-quran">وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</p>
            <span>{isAr ? 'المزمل: ٤' : 'Al-Muzzammil 73:4'}</span>
          </aside>

          <button
            type="button"
            onClick={() => setActiveLens('recitation')}
            aria-pressed={activeLens === 'recitation'}
            className={`wn-hero-live-card wn-hero-live-card--recitation wn-hero-live-card--interactive ${activeLens === 'recitation' ? 'is-focused' : ''}`}
          >
            <span className="wn-hero-live-card__icon"><AudioLines size={16} /></span>
            <div>
              <strong>{isAr ? 'استوديو التلاوة' : 'Recitation Studio'}</strong>
              <div className="wn-mini-wave" aria-hidden="true" data-visual-mask>
                <i /><i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveLens('pathway')}
            aria-pressed={activeLens === 'pathway'}
            className={`wn-hero-live-card wn-hero-live-card--path wn-hero-live-card--interactive ${activeLens === 'pathway' ? 'is-focused' : ''}`}
          >
            <span className="wn-hero-live-card__icon"><Route size={16} /></span>
            <div>
              <strong>{isAr ? 'مسار تعلم واضح' : 'Clear learning path'}</strong>
              <small>{isAr ? 'تعلم • مراجعة • إتقان' : 'Learn • review • master'}</small>
            </div>
          </button>

          <div className="wn-hero-lens-bar" aria-live="polite">
            <span className="wn-hero-lens-bar__dot" aria-hidden="true" />
            <div>
              <strong>{activeLensData.badge}</strong>
              <span>{activeLensData.detail}</span>
            </div>
          </div>
        </div>

        <div className="wn-approved-hero__trust wn-approved-hero__trust--wide">
          {trustItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="wn-approved-trust-item">
              <span className="wn-approved-trust-item__icon"><Icon size={19} strokeWidth={1.8} /></span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
