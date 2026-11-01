import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/seo';
import {PUBLIC_ROUTES} from '@/lib/seo/routes';
import {loadServerGameData} from '@/lib/game-data-server';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const manifest = await loadServerGameData<{schemaVersion:number;paths:string[]} | null>('', 'link-preview-paths', {throwOnNotFound:false});
  // No synthetic lastModified: a request/build time is not a content modification date.
  return [...new Set([...PUBLIC_ROUTES, ...(manifest?.schemaVersion === 1 ? manifest.paths : [])])]
    .map(route => ({url:`${origin}${route}`}));
}
