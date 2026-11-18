import { Link } from 'react-router-dom';
import { Smartphone, Download, Share, Bell, WifiOff, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';

const STEPS = [
  { icon: Download, ar: 'استخدم خيار تثبيت التطبيق عندما يظهر في المتصفح', en: 'Use the install option when your browser offers it' },
  { icon: Share, ar: 'في Safari: مشاركة ← إضافة إلى الشاشة الرئيسية', en: 'In Safari: Share → Add to Home Screen' },
  { icon: Bell, ar: 'فعّل الإشعارات من إعدادات حسابك إذا رغبت', en: 'Enable notifications from account settings if you want them' },
  { icon: WifiOff, ar: 'بعض الموارد قد تبقى متاحة بعد التثبيت حسب التخزين المحلي', en: 'Some resources may remain available after install depending on local cache' },
];

export default function MobileAppPage() {
  const { locale, isRTL, dir, t } = useI18n();
  const lp = (path) => localizedPath(path, locale);

  return (
    <>
      <SEOHead page={{
        url: '/app',
        title: isRTL ? 'وحي ونماء على الهاتف' : 'Wahy Wa Namaa on mobile',
        description: isRTL ? 'تعرف على طريقة تثبيت تجربة وحي ونماء على هاتفك كتطبيق ويب.' : 'Learn how to install Wahy Wa Namaa as a web app on your phone.',
      }} />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {isRTL ? 'تجربة الهاتف' : 'MOBILE EXPERIENCE'}</span>
              <h1>{isRTL ? 'خلي وحي ونماء أقرب إليك' : 'Keep Wahy Wa Namaa close at hand'}</h1>
              <p>{isRTL ? 'يمكن تثبيت المنصة كتطبيق ويب من المتصفح للوصول السريع إلى حسابك ودروسك.' : 'Install the platform as a web app from your browser for faster access to your account and lessons.'}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <Link to={lp('/register/student')} className="wn-btn wn-btn--accent min-h-[44px]">{t.common?.register || (isRTL ? 'إنشاء حساب' : 'Create account')}</Link>
                <Link to={lp('/login')} className="wn-btn wn-btn--secondary min-h-[44px]">{t.common?.login || (isRTL ? 'تسجيل الدخول' : 'Sign in')}</Link>
              </div>
            </div>

            <div className="wn-public-hero__art">
              <div className="wn-mobile-preview" aria-hidden="true">
                <div className="wn-mobile-preview__screen">
                  <Smartphone size={52} strokeWidth={1.2} />
                  <strong>{t.common?.appName || (isRTL ? 'وحي ونماء' : 'Wahy Wa Namaa')}</strong>
                  <small>{isRTL ? 'تعلم • احفظ • انمُ' : 'Learn • Memorize • Grow'}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid">
            {STEPS.map(({ icon: Icon, ar, en }) => (
              <article key={ar} className="wn-public-feature-card">
                <span><Icon size={21} aria-hidden="true" /></span>
                <h3>{isRTL ? ar : en}</h3>
              </article>
            ))}
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
