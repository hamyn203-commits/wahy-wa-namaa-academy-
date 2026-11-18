import { useI18n } from '../../../i18n';
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircleMore, GraduationCap, HeartHandshake } from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import WahyNamaaEmblem from '../../../components/WahyNamaaEmblem';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function CTASection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const assurances = [
    isAr ? 'حصة تقييم مستوى مجانية أولاً' : 'Free level-assessment session first',
    isAr ? 'نرشح لك الحلقة والمعلم الأنسب' : 'Matched to the right circle & scholar',
    isAr ? 'تبدأ بخطوة واضحة بلا التزام مسبق' : 'Begin clearly with zero upfront pressure',
  ];

  return (
    <section className="wn-home-section wn-home-section--ivory" id="cta">
      <div className="page-container">
        <div className="wn-final-cta wn-pattern-geo--gold">
          <div className="wn-final-cta__glow" aria-hidden="true" />
          <div className="wn-final-cta__mark">
            <WahyNamaaEmblem size={64} variant="light" />
          </div>

          <span className="wn-badge wn-badge--onDark">{isAr ? 'أكاديمية وَحْيٌ وَنَمَاء' : 'WAHY WA NAMAA ACADEMY'}</span>
          <h2>{isAr ? 'ابدأ رحلتك مع القرآن بخطوة بسيطة وواضحة' : 'Begin your Quran journey with one clear step'}</h2>
          <p>
            {isAr
              ? 'نتعلم القرآن، نحفظه، وننمو به. اختر قسمك وسجّل كطالب أو ولي أمر، ثم نرافقك في تحديد المسار الأنسب لك أو لأسرتك.'
              : 'Learn the Quran, memorize it, and grow through it. Choose your division and join as a student or parent to find the right path.'}
          </p>

          <div className="wn-final-cta__actions">
            <LocalizedLink
              to="/start"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-btn wn-btn--light wn-btn--lg"
            >
              <span>{isAr ? 'ابدأ معنا الآن' : 'Start with us'}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" />
            </LocalizedLink>
            <LocalizedLink
              to="/contact"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/contact')}
              className="wn-btn wn-btn--outline-light wn-btn--lg"
            >
              <MessageCircleMore size={18} />
              <span>{isAr ? 'اسأل فريق الأكاديمية' : 'Ask the academy team'}</span>
            </LocalizedLink>
          </div>

          <div className="wn-final-cta__divisions">
            <LocalizedLink
              to="/start?section=men"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-final-cta__division-pill"
            >
              <GraduationCap size={15} />
              <span>{isAr ? 'قسم الرجال والأطفال' : 'Men & Children'}</span>
            </LocalizedLink>
            <LocalizedLink
              to="/start?section=women"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-final-cta__division-pill"
            >
              <HeartHandshake size={15} />
              <span>{isAr ? 'قسم السيدات بمعلمات مجازات' : 'Women’s Section (Female Tutors)'}</span>
            </LocalizedLink>
          </div>

          <div className="wn-final-cta__assurances">
            {assurances.map((item) => <span key={item}><CheckCircle2 size={15} /> {item}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
