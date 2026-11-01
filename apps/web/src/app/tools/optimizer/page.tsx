import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/optimizer/', props); }

import {loadServerGameData} from '@/lib/game-data-server';
import {OptimizerView} from '@/features/optimizer/optimizer-view';
import type {OptimizerDemo} from '@/features/optimizer/model';
import type {BuildCatalog} from '@/features/build/types';

export default async function Page() {
  const [catalog,demo]=await Promise.all([loadServerGameData<BuildCatalog>('','build-page'),loadServerGameData<OptimizerDemo>('','optimizer-demo')]);
  if(catalog.schemaVersion!==1||demo.schemaVersion!==1)throw new Error('Unsupported optimizer catalog');
  return <OptimizerView catalog={catalog} demo={demo}/>;
}
