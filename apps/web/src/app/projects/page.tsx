import {generatePageMetadata} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { ProjectsView } from './projects-view';

export async function generateMetadata() { return generatePageMetadata('/projects/'); }

export default async function ProjectsPage() {
  const { locale } = await resolveServerLocale();
  return <ProjectsView initialLocale={locale} />;
}
