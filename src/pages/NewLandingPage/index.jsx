import { useI18n } from '../../i18n';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import HomepageMotionController from './HomepageMotionController';

import HeroSection from './sections/HeroSection';
import ProgramsSection from './sections/ProgramsSection';
import WhyWahyNamaaSection from './sections/WhyWahyNamaaSection';
import ImmersiveLearningSection from './sections/ImmersiveLearningSection';
import ProductShowcaseSection from './sections/ProductShowcaseSection';
import StudentJourneySection from './sections/StudentJourneySection';
import TeachersSection from './sections/TeachersSection';
import AlAzharHeritageSection from './sections/AlAzharHeritageSection';
import TargetAudiencesSection from './sections/TargetAudiencesSection';
import PricingCalculatorSection from './sections/PricingCalculatorSection';
import TrustSignalsSection from './sections/TrustSignalsSection';
import FAQHomeSection from './sections/FAQHomeSection';
import CTASection from './sections/CTASection';

export default function NewLandingPage() {
  const { locale, t } = useI18n();
  const { createWebPageSchema } = useSEO();
  const isAr = locale === 'ar';

  const pageTitle = isAr
    ? 'وَحْيٌ وَنَمَاء | نتعلم القرآن، نحفظه، وننمو به'
    : locale === 'en'
      ? 'Wahy Wa Namaa Academy | Learn. Memorize. Grow.'
      : `${t.common.appName} | ${t.common.slogan}`;

  const pageDesc = isAr
    ? 'أكاديمية وحي ونماء لتعليم القرآن الكريم بتجربة حديثة، هادئة، وموثوقة للأطفال والناشئة والبالغين.'
    : locale === 'en'
      ? 'Wahy Wa Namaa Academy offers modern, trusted Quran learning for children, youth, and adults.'
      : (t.common.seoDescription || t.hero?.subtitle || '');

  return (
    <>
      <a href="#main-content" className="wn-skip-link">
        {isAr ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>
      <SEOHead
        page={{
          title: pageTitle,
          description: pageDesc,
          url: '/',
          type: 'website',
          schema: createWebPageSchema({
            name: pageTitle,
            description: pageDesc,
            url: '/',
          }),
        }}
      />
      <GlobalHeader />
      <HomepageMotionController />
      <main className="wn-approved-home" id="main-content" tabIndex={-1}>
        <HeroSection />
        <ProgramsSection />
        <WhyWahyNamaaSection />
        <ImmersiveLearningSection />
        <ProductShowcaseSection />
        <StudentJourneySection />
        <TeachersSection />
        <AlAzharHeritageSection />
        <TargetAudiencesSection />
        <PricingCalculatorSection />
        <TrustSignalsSection />
        <FAQHomeSection />
        <CTASection />
      </main>
      <GlobalFooter />
    </>
  );
}
