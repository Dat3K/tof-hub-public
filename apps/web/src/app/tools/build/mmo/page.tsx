import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/build/mmo/', props); }

import {MmoBuildPage} from '@/features/build/mmo/mmo-build-page';
import {loadMmoBuildCatalog} from './catalog';

export default async function Page() {
  return <MmoBuildPage catalog={await loadMmoBuildCatalog()}/>;
}
