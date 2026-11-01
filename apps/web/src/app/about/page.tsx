import {generatePageMetadata} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { AboutView } from './about-view';

export async function generateMetadata() { return generatePageMetadata('/about/'); }

export default async function AboutPage() {
  const { locale } = await resolveServerLocale();
  return <AboutView initialLocale={locale} />;
}
