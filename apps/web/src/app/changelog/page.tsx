import {generatePageMetadata} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { ChangelogView } from './changelog-view';

export async function generateMetadata() { return generatePageMetadata('/changelog/'); }

export default async function ChangelogPage() {
  const { locale } = await resolveServerLocale();
  return <ChangelogView initialLocale={locale} />;
}
