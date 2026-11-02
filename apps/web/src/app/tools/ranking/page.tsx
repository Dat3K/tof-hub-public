import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/ranking/', props); }

import {loadServerGameData} from '@/lib/game-data-server';
import {buildRankingCatalog, type RankingCatalogSource} from '@/features/ranking/catalog';
import {RankingView} from '@/features/ranking/ranking-view';

type Search=Record<string,string|string[]|undefined>;
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??null:value??null;

export default async function Page({searchParams}:{searchParams?:Promise<Search>}) {
  const catalog=await loadServerGameData<RankingCatalogSource>('','runtime/ranking-page');
  if(catalog.schemaVersion!==1)throw new Error('Unsupported build catalog version');
  const params=(searchParams?await searchParams:undefined)??{};
  const ranking=buildRankingCatalog(catalog);
  const slot=first(params.slot),region=first(params.region);
  const role=first(params.role),q=first(params.q);
  const pioneer=first(params.dataset)==='pioneer';
  return <RankingView catalog={ranking} initial={{board:first(params.board)==='gear'?'gear':'players',role:role==='healer'||role==='tank'?role:'dps',track:first(params.track)??'all',
    ...(pioneer?{dataset:'pioneer' as const}:{}),slot:slot&&ranking.gear.some(item=>item.id===slot)?slot:null,region:!pioneer&&region&&ranking.regions.some(item=>item.code===region)?region:null,
    verified:first(params.verified)==='1',places:first(params.places)==='global'?'global':'region',sort:first(params.sort)==='aug'?'aug':first(params.sort)==='aug-asc'?'aug-asc':first(params.sort)==='grv-asc'?'grv-asc':first(params.sort)==='cs-asc'?'cs-asc':first(params.sort)==='cs'?'cs':first(params.sort)==='name-asc'?'name-asc':first(params.sort)==='name-desc'?'name-desc':'grv'}} initialSearch={q?.slice(0,40)??''} initialCompare={first(params.vs)??undefined}/>;
}
