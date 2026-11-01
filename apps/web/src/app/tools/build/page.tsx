import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/build/', props); }

import {BuildPage} from '@/features/build/build-page';
import {loadBuildCatalog} from './catalog';

export default async function Page() {
  const catalog=await loadBuildCatalog();
  if(catalog.schemaVersion!==1)throw new Error('Unsupported build catalog version');
  return <BuildPage catalog={catalog}/>;
}
