import {generatePageMetadata} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { PrivacyView } from './privacy-view';

export async function generateMetadata() { return generatePageMetadata('/privacy/'); }

export default async function PrivacyPage() {
  const { locale } = await resolveServerLocale();
  return <PrivacyView initialLocale={locale} />;
}
