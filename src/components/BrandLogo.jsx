import { Link } from 'react-router-dom';
import WahyNamaaEmblem from './WahyNamaaEmblem';

export default function BrandLogo({
  size = 'md',
  showText = true,
  to = '/',
  variant = 'dark',
  layout = 'horizontal',
}) {
  const sizes = { sm: 34, md: 46, lg: 58, xl: 72 };
  const px = typeof size === 'number' ? size : (sizes[size] || sizes.md);
  const isLight = variant === 'light';
  const vertical = layout === 'vertical';

  const content = (
    <span className={'group inline-flex shrink-0 select-none ' + (vertical ? 'flex-col items-center gap-2 text-center' : 'items-center gap-3')}>
      <span className="flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]">
        <WahyNamaaEmblem size={px} variant={isLight ? 'light' : 'default'} />
      </span>

      {showText && (
        <span className={'flex min-w-0 flex-col ' + (vertical ? 'items-center' : 'items-start')}>
          <span
            className={'wn-brand-wordmark font-naskh text-[18px] sm:text-[20px] font-bold leading-none ' + (isLight ? 'text-white' : 'text-[var(--wn-emerald-deep)]')}
          >
            وَحْيٌ وَنَمَاء
          </span>
          <span
            className={'wn-brand-wordmark__sub mt-1 block text-[9px] sm:text-[10px] font-semibold tracking-[0.08em] leading-none ' + (isLight ? 'text-[var(--wn-sand)]' : 'text-[var(--wn-text-secondary)]')}
          >
            Wahy Wa Namaa Academy
          </span>
        </span>
      )}
    </span>
  );

  if (!to) return content;

  return (
    <Link
      to={to}
      className="inline-flex shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] focus-visible:ring-offset-2"
      aria-label="أكاديمية وحي ونماء — الصفحة الرئيسية"
    >
      {content}
    </Link>
  );
}
