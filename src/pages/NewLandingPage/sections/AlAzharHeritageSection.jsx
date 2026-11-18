import { useI18n } from '../../../i18n';
import { useMarket } from '../../../context/MarketProvider';
import {
  Award,
  Globe,
  BookOpen,
  ScrollText,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { HERITAGE_COPY, pickLocale } from '../landingI18n';

const POINT_ICONS = [ScrollText, Globe, BookOpen];

export default function AlAzharHeritageSection() {
  const { locale, isRTL } = useI18n();
  const { marketSlug } = useMarket();
  const isIndonesian = marketSlug === 'indonesia-malaysia' || locale === 'id' || locale === 'ms';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(HERITAGE_COPY, locale, isRTL);

  const points = copy.points.map((pt, idx) => ({
    ...pt,
    icon: POINT_ICONS[idx] || ScrollText,
  }));

  return (
    <section className="wn-azhar-heritage wn-pattern-geo--gold" id="azhar-heritage">
      <div className="wn-azhar-heritage__glow" aria-hidden="true" />

      <div className="page-container relative z-10">
        <div className="wn-azhar-heritage__header">
          <div>
            <span className="wn-azhar-heritage__eyebrow">
              <Award size={14} aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h2>{copy.title}</h2>
          </div>
          <p className="wn-azhar-heritage__lead">{copy.lead}</p>
        </div>

        <div className="wn-azhar-heritage__grid">
          {points.map(({ step, title, desc, highlight, icon: Icon }) => (
            <article key={step} className="wn-azhar-card">
              <div className="wn-azhar-card__top">
                <span className="wn-azhar-card__icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.65} />
                </span>
                <span className="wn-azhar-card__pill">{highlight}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>

        <div className="wn-azhar-heritage__bar">
          <div className="wn-azhar-heritage__checks">
            {copy.credentials.map((item) => (
              <span key={item}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{item}</span>
              </span>
            ))}
          </div>

          <LocalizedLink
            to="/teachers"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/teachers')}
            className="wn-btn wn-btn--light"
          >
            <span>{copy.cta}</span>
            <ArrowIcon size={15} className="wn-btn__arrow" aria-hidden="true" />
          </LocalizedLink>
        </div>

        {isIndonesian && (
          <div className="wn-azhar-heritage__market-note">
            <Globe size={20} strokeWidth={1.7} aria-hidden="true" />
            <p>
              <strong>
                {locale === 'ms' ? 'Nota Khas Asia Tenggara:' : 'Catatan Khusus Asia Tenggara:'}
              </strong>{' '}
              {locale === 'ms'
                ? 'Semua kelas di Wahy Wa Namaa dibimbing oleh guru bertauliah mengikut piawaian makhraj & tajwid Al-Azhar dengan jadual fleksibel mengikut zon waktu MYT/WIB/WITA.'
                : 'Semua kelas di Wahy Wa Namaa dibimbing oleh pengajar terverifikasi dengan standar makhraj & tajwid Al-Azhar serta jadwal fleksibel sesuai zona waktu WIB/WITA/MYT.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
