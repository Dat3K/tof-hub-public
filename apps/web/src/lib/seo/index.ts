import type { Metadata } from 'next';
import { NOINDEX_ROUTES, routeCopy } from './routes';

export const SITE_NAME = 'ToF Hub';

/** Browser tab title: `<short page name> | ToF Hub`. */
export function pageTitle(name: string): string {
  return `${name} | ${SITE_NAME}`;
}

export interface SeoMetadataOptions {
  /** Short page name; the site suffix is added here, except on the home page. */
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

const PRODUCTION_ORIGIN = 'https://tof.smilekritik.beer';

/**
 * Returns the validated public site origin.
 * In production, it ensures no localhost/127.0.0.1 is ever emitted.
 */
export function getSiteOrigin(): string {
  for (const candidate of [process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      if (process.env.NODE_ENV === 'production' && /^(localhost|.*\.localhost|127\..*|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)) continue;
      return url.origin;
    } catch { /* Try the next configured origin. */ }
  }
  return process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : 'http://localhost:8080';
}

/**
 * Builds a canonical URL for a given path with strict trailing slash policy for directory routes.
 */
export function buildCanonicalUrl(path: string): string {
  const origin = getSiteOrigin();
  const url = new URL(path.startsWith('/') && !path.startsWith('//') ? path : `/${path}`, origin);
  url.hash = '';
  if (!/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

/**
 * Constructs standard Next.js App Router Metadata matching legacy audit SEO contracts.
 */
export function buildMetadata(options: SeoMetadataOptions): Metadata {
  const origin = getSiteOrigin();
  const canonical = buildCanonicalUrl(options.canonicalPath || options.path);
  const pathname = new URL(canonical).pathname;
  const copy = routeCopy(pathname);
  const ogTitle = options.ogTitle || copy?.[0] || options.title;
  const ogDescription = options.ogDescription || copy?.[1] || options.description;
  const ogImageUrl = new URL(options.ogImage || `/og/?path=${encodeURIComponent(options.path)}`, origin).toString();
  const noindex = options.noindex || NOINDEX_ROUTES.has(pathname);

  return {
    metadataBase: new URL(origin),
    title: pathname === '/' || options.title === SITE_NAME ? options.title : pageTitle(options.title),
    description: options.description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: buildCanonicalUrl(options.path),
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: options.ogImageAlt || ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [ogImageUrl],
    },
    robots: { index: !noindex, follow: true, ...(!noindex ? { googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const } } : {}) },
  };
}
