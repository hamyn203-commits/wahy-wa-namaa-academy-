import { useI18n } from '../i18n';
import { Link, useParams } from 'react-router-dom';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';
import {
  Globe, MessageCircle, Camera, Play, Send,
  Mail, Phone, MapPin, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { SOCIAL_LINKS, CONTACT } from '../config/social';
import BrandLogo from './BrandLogo';
import MobileStickyBar from './MobileStickyBar';
import { prefetchRoute } from '../lib/routePrefetch';
import { usePublicChromeHidden } from '../lib/publicChrome';

const FOOTER_COPY = {
  ar: {
    plans: 'الخطط والباقات',
    library: 'المكتبة',
    kids: 'برنامج الأطفال',
    women: 'تعليم السيدات',
    aboutText: 'نتعلم القرآن، نحفظه، وننمو به. تجربة تعليمية تجمع بين أصالة التلقي ووضوح الأدوات الحديثة.',
    contactFallback: 'تواصل معنا عبر نموذج الدعم',
    academyName: 'أكاديمية وَحْيٌ وَنَمَاء',
    tagline: 'الوحي أصل الرحلة، والنماء أثرها.',
  },
  en: {
    plans: 'Plans',
    library: 'Library',
    kids: 'Kids',
    women: 'Women',
    aboutText: 'Learn the Quran, memorize it, and grow through it — authentic learning with a calm modern experience.',
    contactFallback: 'Contact us through the support form',
    academyName: 'Wahy Wa Namaa Academy',
    tagline: 'Revelation at the root. Growth as the outcome.',
  },
  fr: {
    plans: 'Formules',
    library: 'Bibliothèque',
    kids: 'Enfants',
    women: 'Femmes',
    aboutText: 'Apprendre le Coran, le mémoriser et grandir grâce à lui — un enseignement authentique dans un cadre moderne et serein.',
    contactFallback: 'Contactez-nous via le formulaire d’assistance',
    academyName: 'Académie Wahy Wa Namaa',
    tagline: 'La Révélation à la racine. La croissance comme fruit.',
  },
  de: {
    plans: 'Tarife',
    library: 'Bibliothek',
    kids: 'Kinder',
    women: 'Frauen',
    aboutText: 'Den Koran lernen, auswendig lernen und mit ihm wachsen — authentischer Unterricht mit ruhiger, moderner Erfahrung.',
    contactFallback: 'Kontaktieren Sie uns über das Support-Formular',
    academyName: 'Wahy Wa Namaa Akademie',
    tagline: 'Offenbarung als Wurzel. Wachstum als Frucht.',
  },
  tr: {
    plans: 'Paketler',
    library: 'Kütüphane',
    kids: 'Çocuklar',
    women: 'Kadınlar',
    aboutText: 'Kur’an’ı öğrenin, ezberleyin ve onunla gelişin — sakin ve modern bir deneyimle özgün eğitim.',
    contactFallback: 'Destek formu üzerinden bizimle iletişime geçin',
    academyName: 'Wahy Wa Namaa Akademisi',
    tagline: 'Kökünde Vahiy, meyvesinde gelişim.',
  },
  ur: {
    plans: 'پیکجز',
    library: 'کتب خانہ',
    kids: 'بچے',
    women: 'خواتین',
    aboutText: 'ہم قرآن سیکھتے ہیں، حفظ کرتے ہیں اور اس کے ساتھ آگے بڑھتے ہیں۔ مستند تعلیم اور جدید سہولت کا حسین امتزاج۔',
    contactFallback: 'سپورٹ فارم کے ذریعے ہم سے رابطہ کریں',
    academyName: 'وحی و نما اکیڈمی',
    tagline: 'وحی سفر کی بنیاد ہے اور نمو اس کا ثمر۔',
  },
  id: {
    plans: 'Paket',
    library: 'Perpustakaan',
    kids: 'Anak-anak',
    women: 'Muslimah',
    aboutText: 'Mempelajari Al-Qur’an, menghafalnya, dan bertumbuh bersamanya — pembelajaran autentik dengan pengalaman modern yang tenang.',
    contactFallback: 'Hubungi kami melalui formulir bantuan',
    academyName: 'Akademi Wahy Wa Namaa',
    tagline: 'Wahyu sebagai akar. Pertumbuhan sebagai hasil.',
  },
  ms: {
    plans: 'Pelan',
    library: 'Perpustakaan',
    kids: 'Kanak-kanak',
    women: 'Wanita',
    aboutText: 'Belajar Al-Quran, menghafaznya dan berkembang melaluinya — pembelajaran autentik dengan pengalaman moden yang tenang.',
    contactFallback: 'Hubungi kami melalui borang sokongan',
    academyName: 'Akademi Wahy Wa Namaa',
    tagline: 'Wahyu sebagai akar. Pertumbuhan sebagai hasil.',
  },
  ku: {
    plans: 'پاکێجەکان',
    library: 'کتێبخانە',
    kids: 'منداڵان',
    women: 'ئافرەتان',
    aboutText: 'قورئان فێر دەبین، لەبەری دەکەین و پێی گەشە دەکەین — فێرکردنی ڕەسەن بە ئەزموونێکی مۆدێرن و ئارام.',
    contactFallback: 'لە ڕێگەی فۆرمی پشتگیرییەوە پەیوەندیمان پێوە بکە',
    academyName: 'ئەکادیمیای وەحی و نەما',
    tagline: 'وەحی بنچینەی گەشتەکەیە و گەشەکردن بەرهەمەکەیەتی.',
  },
};

export default function GlobalFooter() {
  const hidden = usePublicChromeHidden();
  return hidden ? null : <PublicGlobalFooter />;
}

function PublicGlobalFooter() {
  const { t, locale, isRTL } = useI18n();
  const { locale: paramLocale } = useParams();
  const activeLocale = paramLocale || locale || DEFAULT_LOCALE;
  const copy = FOOTER_COPY[activeLocale] || (isRTL ? FOOTER_COPY.ar : FOOTER_COPY.en);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const lp = (path) => localizedPath(path, activeLocale);

  const quickLinks = [
    { to: lp('/courses'), label: t.footer.courses },
    { to: lp('/teachers'), label: t.footer.teachers },
    { to: lp('/plans'), label: t.common?.plans || copy.plans },
    { to: lp('/library'), label: t.common?.library || copy.library },
    { to: lp('/programs/kids'), label: copy.kids },
    { to: lp('/women'), label: t.common?.women || copy.women },
    { to: lp('/blog'), label: t.footer.blog },
    { to: lp('/contact'), label: t.footer.contact },
  ];

  const social = [
    { href: SOCIAL_LINKS.facebook, icon: Globe, label: 'Facebook' },
    { href: SOCIAL_LINKS.whatsapp, icon: MessageCircle, label: 'WhatsApp' },
    { href: SOCIAL_LINKS.instagram, icon: Camera, label: 'Instagram' },
    { href: SOCIAL_LINKS.youtube, icon: Play, label: 'YouTube' },
    { href: SOCIAL_LINKS.telegram, icon: Send, label: 'Telegram' },
  ].filter((item) => Boolean(item.href));

  const hasContact = Boolean(CONTACT.email || CONTACT.phone || CONTACT.address);

  return (
    <>
      <MobileStickyBar />
      <footer className="wn-approved-footer wn-pattern-geo--gold">
        <div className="page-container relative z-10 py-16">
          <div className="mb-12 flex justify-center">
            <BrandLogo to={lp('/')} size="lg" showText variant="light" layout="vertical" />
          </div>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="max-w-xs text-sm leading-7 text-white/75">
                {copy.aboutText}
              </p>
              {social.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {social.map(({ href, icon: Icon, label }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="wn-approved-footer__social">
                      <Icon size={17} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="wn-approved-footer__title">{t.footer.quickLinks}</h2>
              <ul className="space-y-1.5">
                {quickLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      onMouseEnter={() => prefetchRoute(to)}
                      onTouchStart={() => prefetchRoute(to)}
                      className="wn-approved-footer__link"
                    >
                      <ArrowIcon size={13} className="opacity-60" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="wn-approved-footer__title">{t.footer.support}</h2>
              <ul className="space-y-1.5">
                {[
                  { to: lp('/faq'), label: t.footer.faq },
                  { to: lp('/privacy'), label: t.footer.privacy },
                  { to: lp('/terms'), label: t.footer.terms },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      onMouseEnter={() => prefetchRoute(to)}
                      onTouchStart={() => prefetchRoute(to)}
                      className="wn-approved-footer__link"
                    >
                      <ArrowIcon size={13} className="opacity-60" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="wn-approved-footer__title">{t.footer.contactUs}</h2>
              {hasContact ? (
                <ul className="space-y-4 text-sm">
                  {CONTACT.email ? (
                    <li className="wn-approved-footer__contact">
                      <Mail size={17} aria-hidden="true" />
                      <a href={'mailto:' + CONTACT.email} dir="ltr">{CONTACT.email}</a>
                    </li>
                  ) : null}
                  {CONTACT.phone ? (
                    <li className="wn-approved-footer__contact">
                      <Phone size={17} aria-hidden="true" />
                      <a href={'tel:' + CONTACT.phone.replace(/\s/g, '')} dir="ltr">{CONTACT.phone}</a>
                    </li>
                  ) : null}
                  {CONTACT.address ? (
                    <li className="wn-approved-footer__contact">
                      <MapPin size={17} aria-hidden="true" />
                      <span>{CONTACT.address}</span>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <Link
                  to={lp('/contact')}
                  onMouseEnter={() => prefetchRoute('/contact')}
                  onTouchStart={() => prefetchRoute('/contact')}
                  className="wn-approved-footer__link"
                >
                  <ArrowIcon size={13} className="opacity-60" aria-hidden="true" />
                  {copy.contactFallback}
                </Link>
              )}
            </div>
          </div>

          <div className="wn-approved-footer__bottom">
            <p>© {new Date().getFullYear()} {t.common?.appNameFull || copy.academyName}. {t.footer.rights}</p>
            <p>{t.common?.brandTagline || copy.tagline}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
