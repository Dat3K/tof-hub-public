import type { FeedbackOrigin } from '@tof-hub/contracts';

// Order matters: Chromium forks also announce "Chrome", and every iOS browser announces "Safari".
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'], [/\b(?:OPR|Opera)\//, 'Opera'], [/\bYaBrowser\//, 'Yandex'],
  [/\bSamsungBrowser\//, 'Samsung Internet'], [/\bVivaldi\//, 'Vivaldi'], [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'], [/\bVersion\/[\d.]+.*Safari\//, 'Safari'],
];
const SYSTEMS: [RegExp, string][] = [
  [/\biPad\b/, 'iPadOS'], [/\b(?:iPhone|iPod)\b/, 'iOS'], [/\bAndroid\b/, 'Android'], [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'], [/\bMac OS X\b/, 'macOS'], [/\bLinux\b/, 'Linux'],
];

/**
 * Coarse device classification from request headers. The User-Agent is visitor-controlled, so this is a hint for
 * reading feedback, never an identifier. Country comes only from an explicitly trusted ingress header.
 */
export function feedbackOrigin(headers: Record<string, string | string[] | undefined>): FeedbackOrigin {
  const header = (name: string) => { const value = headers[name.toLowerCase()]; return (Array.isArray(value) ? value[0] : value) ?? ''; };
  const agent = header('user-agent').slice(0, 512);
  const hintedMobile = header('sec-ch-ua-mobile') === '?1';
  const os = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
  const device = !agent ? 'unknown'
    : os === 'iPadOS' || (os === 'Android' && !/\bMobile\b/.test(agent)) || /\bTablet\b/.test(agent) ? 'tablet'
      : hintedMobile || os === 'iOS' || /\bMobi(?:le)?\b/.test(agent) ? 'mobile'
        : os ? 'desktop' : 'unknown';
  const countryHeader = process.env.FEEDBACK_COUNTRY_HEADER?.trim().toLowerCase();
  const code = countryHeader ? header(countryHeader).trim().toUpperCase() : '';
  // XX/T1 are the "unknown"/Tor placeholders used by common geo proxies.
  const country = /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? code : null;
  return { country, device, os, browser };
}
