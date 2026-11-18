import { useI18n } from '../../i18n';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import { LOCALE_BRAND } from '../../seo/brand';
import HomepageMotionController from './HomepageMotionController';
import { SKIP_TO_CONTENT, pickLocale } from './landingI18n';

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
  const { locale, isRTL, t } = useI18n();
  const { createWebPageSchema, createOrganizationSchema } = useSEO();
  const skipLabel = t.common?.skipToContent || pickLocale(SKIP_TO_CONTENT, locale, isRTL);

  const cleanSlogan = String(t.common.slogan || '').replace(/[.۔]+$/, '');
  const pageTitle = LOCALE_BRAND[locale]?.homeTitle || `${t.common.appNameFull || t.common.appName} | ${cleanSlogan}`;
  const pageDesc = t.common.seoDescription || t.hero?.subtitle || '';

  const homeSchemas = [
    createWebPageSchema({
      name: pageTitle,
      description: pageDesc,
      url: '/',
    }),
    ...(typeof createOrganizationSchema === 'function' ? [createOrganizationSchema()] : []),
  ].filter(Boolean);

  return (
    <>
      <a href="#main-content" className="wn-skip-link">
        {skipLabel}
      </a>
      <SEOHead
        page={{
          title: pageTitle,
          description: pageDesc,
          url: '/',
          type: 'website',
          schema: homeSchemas,
        }}
      />
      <GlobalHeader />
      <HomepageMotionController />
      <main className="wn-approved-home" id="main-content" tabIndex={-1}>
        <HeroSection />
        <ProgramsSection />
        <WhyWahyNamaaSection />
        <AlAzharHeritageSection />
        <ImmersiveLearningSection />
        <ProductShowcaseSection />
        <StudentJourneySection />
        <TeachersSection />
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
