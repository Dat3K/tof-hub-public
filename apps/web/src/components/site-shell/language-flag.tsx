import type { ReactNode } from 'react';
import { getLanguageMenuLocale, type LanguageMenuLocale, type Locale } from '@tof-hub/i18n';

const star = 'M0-5 1.12-1.55 4.76-1.55 1.82.59 2.94 4.05 0 1.91-2.94 4.05-1.82.59-4.76-1.55-1.12-1.55Z';

// Local vectors keep flags visible on Windows without emoji fonts or remote images.
const artwork: Record<LanguageMenuLocale, ReactNode> = {
  en: <>
    <rect width="60" height="40" fill="#012169" />
    <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
    <path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="3" />
    <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
    <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="7" />
  </>,
  ru: <>
    <rect width="60" height="40" fill="#fff" />
    <path d="M0 20h60" stroke="#0039a6" strokeWidth={40 / 3} />
    <rect y={80 / 3} width="60" height={40 / 3} fill="#d52b1e" />
  </>,
  de: <>
    <rect width="60" height="40" fill="#ffce00" />
    <rect width="60" height={40 / 3} fill="#000" />
    <path d="M0 20h60" stroke="#d00" strokeWidth={40 / 3} />
  </>,
  es: <>
    <rect width="60" height="40" fill="#aa151b" />
    <rect y="10" width="60" height="20" fill="#f1bf00" />
  </>,
  fr: <>
    <rect width="60" height="40" fill="#fff" />
    <rect width="20" height="40" fill="#002654" />
    <rect x="40" width="20" height="40" fill="#ed2939" />
  </>,
  id: <>
    <rect width="60" height="40" fill="#fff" />
    <rect width="60" height="20" fill="#ce1126" />
  </>,
  ja: <>
    <rect width="60" height="40" fill="#fff" />
    <circle cx="30" cy="20" r="12" fill="#bc002d" />
  </>,
  ko: <>
    <rect width="60" height="40" fill="#fff" />
    <g transform="rotate(33.69 30 20)">
      <circle cx="30" cy="20" r="10" fill="#003478" />
      <path d="M20 20a10 10 0 0 1 20 0 5 5 0 0 1-10 0 5 5 0 0 0-10 0" fill="#c60c30" />
    </g>
    <g stroke="#000" strokeWidth="1.5">
      <path d="M-4-3h8M-4 0h8M-4 3h8" transform="translate(12 10) rotate(-56.31)" />
      <path d="M-4-3h3m2 0h3M-4 0h3m2 0h3M-4 3h3m2 0h3" transform="translate(48 30) rotate(-56.31)" />
      <path d="M-4-3h8M-4 0h3m2 0h3M-4 3h8" transform="translate(48 10) rotate(56.31)" />
      <path d="M-4-3h3m2 0h3M-4 0h8M-4 3h3m2 0h3" transform="translate(12 30) rotate(56.31)" />
    </g>
  </>,
  pt: <>
    <rect width="60" height="40" fill="#009739" />
    <path d="m30 4 25 16-25 16L5 20Z" fill="#ffdf00" />
    <circle cx="30" cy="20" r="10" fill="#002776" />
    <path d="M20.5 17q10-1 18.5 7" fill="none" stroke="#fff" strokeWidth="1.5" />
    <g fill="#fff"><circle cx="27" cy="23" r=".7" /><circle cx="33" cy="25" r=".7" /><circle cx="31" cy="16" r=".7" /></g>
  </>,
  th: <>
    <rect width="60" height="40" fill="#a51931" />
    <rect y={20 / 3} width="60" height={80 / 3} fill="#fff" />
    <rect y={40 / 3} width="60" height={40 / 3} fill="#2d2a4a" />
  </>,
  'zh-CN': <>
    <rect width="60" height="40" fill="#de2910" />
    <g fill="#ffde00">
      <path d={star} transform="translate(12 12) scale(1.2)" />
      <path d={star} transform="translate(23 5) rotate(23) scale(.4)" />
      <path d={star} transform="translate(27 10) rotate(46) scale(.4)" />
      <path d={star} transform="translate(27 17) rotate(8) scale(.4)" />
      <path d={star} transform="translate(23 22) rotate(32) scale(.4)" />
    </g>
  </>,
};

export function LanguageFlag({ locale, className }: { locale: Locale; className?: string }) {
  const code = getLanguageMenuLocale(locale);
  return (
    <svg className={className} viewBox="0 0 60 40" width="18" height="12" aria-hidden="true" focusable="false" data-language-flag={code}>
      {artwork[code]}
    </svg>
  );
}
