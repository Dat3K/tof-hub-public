import { localeText } from '@/lib/i18n/text';
import {Suspense} from 'react';
import type {Metadata} from 'next';
import {loadServerGameData} from '@/lib/game-data-server';
import {resolveServerLocale} from '@/lib/i18n/server';
import {buildMetadata} from '@/lib/seo';
import {RouteLoading} from '@/components/site-shell/route-loading';
import {buildRankingCatalog} from '@/features/ranking/catalog';
import {ProfileDirectory,type ProfileDirectoryCatalog} from '@/features/build/profile-directory';
import type {BuildCatalog} from '@/features/build/types';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({title:'Saved builds',description:localeText(locale)('Saved Tower of Fantasy character builds by role and element.', 'Сохранённые билды персонажей Tower of Fantasy по ролям и стихиям.'),path:'/tools/build/profiles/'});
}
export default async function Page() {
  const catalog=await loadServerGameData<BuildCatalog>('','build-page');
  const images=(items:BuildCatalog['avatars'])=>Object.fromEntries(items.map(({id,icon,canvas})=>[id,{icon,...(canvas?{canvas}:{})}]));
  const directory:ProfileDirectoryCatalog={elementIcons:catalog.elementIcons,roleResonances:catalog.roleResonances,avatars:images(catalog.avatars),frames:images(catalog.avatarFrames),
    avatarAliases:catalog.avatarAliases,regions:buildRankingCatalog(catalog).regions};
  return <Suspense fallback={<RouteLoading/>}><ProfileDirectory catalog={directory}/></Suspense>;
}
