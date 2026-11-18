import React from 'react';

/**
 * Approved Wahy Wa Namaa mark:
 * mihrab/arch + open Quran + growing leaves + light/star.
 * Pure SVG so it stays sharp at any size.
 */
export default function WahyNamaaEmblem({
  size = 44,
  className = '',
  glow = false,
  variant = 'default',
  decorative = false,
  label = 'Wahy Wa Namaa Academy emblem',
}) {
  const id = React.useId().replace(/:/g, '');
  const green = 'wnGreen' + id;
  const teal = 'wnTeal' + id;
  const gold = 'wnGold' + id;

  const light = variant === 'light';
  const mono = variant === 'monochrome' || variant === 'watermark';

  const archStroke = light ? '#ffffff' : mono ? 'currentColor' : 'url(#' + green + ')';
  const bookFill = light ? '#ffffff' : mono ? 'currentColor' : 'url(#' + green + ')';
  const leafFill = light ? '#f8f3e7' : mono ? 'currentColor' : 'url(#' + teal + ')';
  const starFill = light ? '#e8d5a8' : mono ? 'currentColor' : 'url(#' + gold + ')';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.08)}
      viewBox="0 0 120 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={'shrink-0 select-none ' + className}
      style={{ filter: glow ? 'drop-shadow(0 8px 18px rgba(15,107,79,.18))' : undefined }}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      <defs>
        <linearGradient id={green} x1="18" y1="12" x2="102" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F6B4F" />
          <stop offset="1" stopColor="#073528" />
        </linearGradient>
        <linearGradient id={teal} x1="40" y1="40" x2="82" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56B3A6" />
          <stop offset="1" stopColor="#0F6B4F" />
        </linearGradient>
        <linearGradient id={gold} x1="49" y1="18" x2="72" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E6C985" />
          <stop offset="1" stopColor="#B88A39" />
        </linearGradient>
      </defs>

      {/* mihrab / scholarly arch */}
      <path
        d="M22 74V54C22 38 31 27 43 18L60 5l17 13c12 9 21 20 21 36v20"
        stroke={archStroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!light && !mono && (
        <path
          d="M28 73V56c0-13 7-22 17-30L60 14l15 12c10 8 17 17 17 30v17"
          stroke="#D4AF6B"
          strokeOpacity=".72"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}

      {/* light / revelation */}
      <path d="M60 20l4.6 9.4L74 34l-9.4 4.6L60 48l-4.6-9.4L46 34l9.4-4.6L60 20Z" fill={starFill} />

      {/* growing stem */}
      <path d="M60 88V51" stroke={light ? '#ffffff' : mono ? 'currentColor' : '#0F6B4F'} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M58 66c-13-1-21-8-24-20 13 1 21 7 24 20Z" fill={leafFill} />
      <path d="M62 77c15-2 24-10 28-24-15 1-25 9-28 24Z" fill={leafFill} />

      {/* open Quran */}
      <path
        d="M8 82c18-2 34 3 52 17 18-14 34-19 52-17v16c-18-1-35 5-52 20C43 103 26 97 8 98V82Z"
        fill={bookFill}
      />
      {!light && !mono && (
        <>
          <path d="M60 99c-16-11-30-15-45-14" stroke="#D4AF6B" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M60 99c16-11 30-15 45-14" stroke="#D4AF6B" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      <path d="M60 99v18" stroke={light ? '#F8F3E7' : mono ? 'currentColor' : '#073528'} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
