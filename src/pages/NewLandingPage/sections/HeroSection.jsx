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
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';

export default function HeroSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

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
              ? 'تعليم أصيل، معلمون موثوقون، وتجربة حديثة ترافق الطفل والناشئ والكبير في رحلة من التلاوة والحفظ إلى الفهم والنماء.'
              : 'Authentic Quran learning with trusted teachers and a modern experience that supports children, youth, and adults from recitation and memorization to understanding and growth.'}
          </p>

          <div className="wn-approved-hero__actions">
            <LocalizedLink to="/start" locale={locale} className="wn-btn wn-btn--primary wn-btn--lg">
              <span>{isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" />
            </LocalizedLink>

            <a href="#platform-experience" className="wn-btn wn-btn--secondary wn-btn--lg">
              <CirclePlay size={19} />
              <span>{isAr ? 'شاهد تجربة المنصة' : 'See the platform experience'}</span>
            </a>
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

          <div className="wn-hero-live-card wn-hero-live-card--recitation">
            <span className="wn-hero-live-card__icon"><AudioLines size={16} /></span>
            <div>
              <strong>{isAr ? 'استوديو التلاوة' : 'Recitation Studio'}</strong>
              <div className="wn-mini-wave" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </div>

          <div className="wn-hero-live-card wn-hero-live-card--path">
            <span className="wn-hero-live-card__icon"><Route size={16} /></span>
            <div>
              <strong>{isAr ? 'مسار تعلم واضح' : 'Clear learning path'}</strong>
              <small>{isAr ? 'تعلم • مراجعة • إتقان' : 'Learn • review • master'}</small>
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
