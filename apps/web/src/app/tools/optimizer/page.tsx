import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/optimizer/', props); }

import {CatalogPage} from '../catalog-page';

export default async function Page() {
  return <CatalogPage tool="optimizer"/>;
}
