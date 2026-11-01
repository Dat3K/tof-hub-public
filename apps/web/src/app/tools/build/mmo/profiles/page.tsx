import { localeText } from '@/lib/i18n/text';
import {Suspense} from 'react';
import type {Metadata} from 'next';
import {loadServerGameData} from '@/lib/game-data-server';
import {resolveServerLocale} from '@/lib/i18n/server';
import {buildMetadata} from '@/lib/seo';
import {RouteLoading} from '@/components/site-shell/route-loading';
import {MmoProfileDirectory} from '@/features/build/mmo/mmo-profile-directory';
import type {BuildCatalog} from '@/features/build/types';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({title:'Public MMO builds',
    description:localeText(locale)('Saved Tower of Fantasy MMO character builds by role.', 'Сохранённые MMO-билды персонажей Tower of Fantasy по ролям.'),path:'/tools/build/mmo/profiles/'});
}
export default async function Page() {
  const catalog=await loadServerGameData<BuildCatalog>('','build-page');
  return <Suspense fallback={<RouteLoading/>}><MmoProfileDirectory catalog={{roleResonances:catalog.roleResonances.items}}/></Suspense>;
}
