import { SITE_PAGE_COPY } from '@tof-hub/config';
export const SEO_ROUTES = SITE_PAGE_COPY;


/** Short tab names for routes whose preview title is descriptive; the tab reads `<name> | ToF Hub`. */
const PAGE_TITLES: Record<string, string> = {
  '/info/': 'Info',
  '/info/food/': 'Food',
  '/datamine/': 'Datamine',
  '/datamine/handbook/': 'Handbook',
  '/tools/': 'Tools',
  '/tools/optimizer/': 'Optimizer',
  '/about/': 'About',
  '/changelog/': 'Changelog',
  '/projects/': 'ToF resources',
};

export const NOINDEX_ROUTES = new Set(['/tools/queue/', '/tools/build/profiles/']);
export const PUBLIC_ROUTES = Object.keys(SEO_ROUTES).filter(path => !NOINDEX_ROUTES.has(path));

export type PreviewEntity = {
  path: string;
  title: string;
  description: string;
  image?: string;
  section: string;
  aliases?: string[];
};
export type PreviewManifest = {
  schemaVersion: 1;
  images: Record<string, string>;
  entities: PreviewEntity[];
  datasets?: Record<string, string>;
};

export function routeCopy(path: string): readonly [string, string] | undefined {
  return SEO_ROUTES[path as keyof typeof SEO_ROUTES];
}

/** Short page name of a known route, without the site suffix. */
export function routeTitle(path: string): string | undefined {
  return PAGE_TITLES[path] ?? routeCopy(path)?.[0];
}
