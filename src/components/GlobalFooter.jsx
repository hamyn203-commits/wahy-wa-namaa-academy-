import { useI18n } from '../i18n';
import { Link, useParams } from 'react-router-dom';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';
import {
  Globe, MessageCircle, Camera, Play, Send,
  Mail, Phone, MapPin, ArrowRight,
} from 'lucide-react';
import { SOCIAL_LINKS, CONTACT } from '../config/social';
import BrandLogo from './BrandLogo';
import MobileStickyBar from './MobileStickyBar';
import { prefetchRoute } from '../lib/routePrefetch';
import { usePublicChromeHidden } from '../lib/publicChrome';

export default function GlobalFooter() {
  const hidden = usePublicChromeHidden();
  return hidden ? null : <PublicGlobalFooter />;
}

function PublicGlobalFooter() {
  const { t, locale } = useI18n();
  const { locale: paramLocale } = useParams();
  const activeLocale = paramLocale || locale || DEFAULT_LOCALE;
  const lp = (path) => localizedPath(path, activeLocale);

  const quickLinks = [
    { to: lp('/courses'), label: t.footer.courses },
    { to: lp('/teachers'), label: t.footer.teachers },
    { to: lp('/plans'), label: activeLocale === 'ar' ? 'الخطط والباقات' : 'Plans' },
    { to: lp('/library'), label: activeLocale === 'ar' ? 'المكتبة' : 'Library' },
    { to: lp('/programs/kids'), label: activeLocale === 'ar' ? 'برنامج الأطفال' : 'Kids' },
    { to: lp('/women'), label: activeLocale === 'ar' ? 'تعليم السيدات' : 'Women' },
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
              <p className="max-w-xs text-sm leading-7 text-white/70">
                {activeLocale === 'ar'
                  ? 'نتعلم القرآن، نحفظه، وننمو به. تجربة تعليمية تجمع بين أصالة التلقي ووضوح الأدوات الحديثة.'
                  : 'Learn the Quran, memorize it, and grow through it — authentic learning with a calm modern experience.'}
              </p>
              {social.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {social.map(({ href, icon: Icon, label }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="wn-approved-footer__social">
                      <Icon size={17} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="wn-approved-footer__title">{t.footer.quickLinks}</h3>
              <ul className="space-y-2.5">
                {quickLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      onMouseEnter={() => prefetchRoute(to)}
                      onTouchStart={() => prefetchRoute(to)}
                      className="wn-approved-footer__link"
                    >
                      <ArrowRight size={13} className="opacity-60" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="wn-approved-footer__title">{t.footer.support}</h3>
              <ul className="space-y-2.5">
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
                      <ArrowRight size={13} className="opacity-60" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="wn-approved-footer__title">{t.footer.contactUs}</h3>
              {hasContact ? (
                <ul className="space-y-4 text-sm">
                  {CONTACT.email ? (
                    <li className="wn-approved-footer__contact">
                      <Mail size={17} />
                      <a href={'mailto:' + CONTACT.email}>{CONTACT.email}</a>
                    </li>
                  ) : null}
                  {CONTACT.phone ? (
                    <li className="wn-approved-footer__contact">
                      <Phone size={17} />
                      <a href={'tel:' + CONTACT.phone.replace(/\s/g, '')}>{CONTACT.phone}</a>
                    </li>
                  ) : null}
                  {CONTACT.address ? (
                    <li className="wn-approved-footer__contact">
                      <MapPin size={17} />
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
                  <ArrowRight size={13} className="opacity-60" />
                  {activeLocale === 'ar' ? 'تواصل معنا عبر نموذج الدعم' : 'Contact us through the support form'}
                </Link>
              )}
            </div>
          </div>

          <div className="wn-approved-footer__bottom">
            <p>© {new Date().getFullYear()} {activeLocale === 'ar' ? 'أكاديمية وَحْيٌ وَنَمَاء' : 'Wahy Wa Namaa Academy'}. {t.footer.rights}</p>
            <p>{activeLocale === 'ar' ? 'الوحي أصل الرحلة، والنماء أثرها.' : 'Revelation at the root. Growth as the outcome.'}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
