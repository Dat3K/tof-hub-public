import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/datamine-builder/',
          '/info/tools/',
          '/tools/build/mockup/',
          '/tools/solo/',
          '/api/',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
