export interface SiteAnalyticsConfig {websiteId: string; scriptUrl: string; domains: string}

export function siteAnalyticsConfig(env: Record<string, string | undefined>): SiteAnalyticsConfig | null {
  if (env.NODE_ENV !== 'production' || !env.UMAMI_WEBSITE_ID || !env.UMAMI_SCRIPT_URL) return null;
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(env.UMAMI_WEBSITE_ID)) return null;
  try {
    const script = new URL(env.UMAMI_SCRIPT_URL), site = new URL(env.SITE_URL ?? 'https://tof.smilekritik.beer');
    if (script.protocol !== 'https:') return null;
    return {websiteId:env.UMAMI_WEBSITE_ID, scriptUrl:script.href, domains:env.UMAMI_DOMAINS ?? site.hostname};
  } catch {return null;}
}

export function analyticsPath(value: string, origin: string) {
  try {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.pathname.replace(/^(\/tools\/build\/)\d+(?:\/[^/]+)?\/?$/, '$1profile/');
  } catch {return '';}
}

/** Only aggregate page views. Never forward arbitrary tracker properties or tool events. */
export function analyticsPageview(type: string, payload: Record<string, unknown>, origin: string) {
  if (type !== 'event' || payload.name || typeof payload.url !== 'string') return false;
  const path = analyticsPath(payload.url, origin);
  if (!path) return false;
  let referrer = '';
  if (typeof payload.referrer === 'string' && payload.referrer) {
    try {
      const source = new URL(payload.referrer, origin);
      if (['http:', 'https:'].includes(source.protocol)) referrer = source.origin === origin ? source.origin + analyticsPath(source.href, origin) : source.origin;
    } catch { /* invalid referrer is omitted */ }
  }
  return {website:payload.website, hostname:payload.hostname, screen:payload.screen, language:payload.language,
    url:path, referrer, title:path, tag:'tof-hub'};
}
