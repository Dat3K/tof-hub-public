import {generatePageMetadata} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { ContributeView } from './contribute-view';

export async function generateMetadata() { return generatePageMetadata('/contribute/'); }

export default async function ContributePage() {
  const { locale } = await resolveServerLocale();
  return <ContributeView initialLocale={locale} />;
}
