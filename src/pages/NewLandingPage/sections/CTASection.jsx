import { useI18n } from '../../../i18n';
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircleMore } from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import WahyNamaaEmblem from '../../../components/WahyNamaaEmblem';

export default function CTASection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const assurances = [
    isAr ? 'نتعرف على مستواك وهدفك' : 'We understand your level and goal',
    isAr ? 'نقترح المسار الأنسب' : 'We suggest the most suitable path',
    isAr ? 'تبدأ بخطوة واضحة' : 'You start with a clear next step',
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
              ? 'نتعلم القرآن، نحفظه، وننمو به. اختر قسمك وسجّل كطالب أو ولي أمر، ثم نساعدك في تحديد المسار الذي يناسبك.'
              : 'Learn the Quran, memorize it, and grow through it. Choose a section and join as a student or parent, then find the right learning path.'}
          </p>

          <div className="wn-final-cta__actions">
            <LocalizedLink to="/start" locale={locale} className="wn-btn wn-btn--light wn-btn--lg">
              <span>{isAr ? 'ابدأ معنا' : 'Start with us'}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" />
            </LocalizedLink>
            <LocalizedLink to="/contact" locale={locale} className="wn-btn wn-btn--outline-light wn-btn--lg">
              <MessageCircleMore size={18} />
              <span>{isAr ? 'اسأل فريق الأكاديمية' : 'Ask the academy team'}</span>
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
