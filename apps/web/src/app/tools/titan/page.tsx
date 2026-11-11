import {existsSync} from 'node:fs';
import path from 'node:path';
import type {Metadata} from 'next';
import {resolveServerLocale} from '@/lib/i18n/server';
import {localeText} from '@/lib/i18n/text';
import {SITE_PAGE_COPY} from '@tof-hub/config';
import {buildMetadata} from '@/lib/seo';
import {TitanCalculatorPage} from '@/features/titan-calculator/titan-calculator-page';
import {loadServerGameData} from '@/lib/game-data-server';
import type {BuildCatalog} from '@/features/build/types';
import type {TitanWeapon} from '@/features/titan-calculator/weapon-match';
import {TITAN_STATS,TITAN_STAT_KEYS} from '@/features/titan-calculator/model';
import {EXAMPLE_WEAPONS} from '@/features/titan-calculator/titan-example';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({
    title:localeText(locale)('Titan Calculator','Калькулятор титанки'),
    description:SITE_PAGE_COPY['/tools/titan/'][1],
    path:'/tools/titan/',
  });
}

export default async function Page() {
  const catalog=await loadServerGameData<BuildCatalog|null>('','build-page',{throwOnNotFound:false});
  const weapons=catalog?.weapons.filter(weapon=>!weapon.id.endsWith('-mmo'))
    .map(({id,weaponId,weapon,role,elements,icon,resonances,elementFromResonance,selectableElements}):TitanWeapon=>
      ({id,weaponId,weapon,role,elements,icon,resonances,elementFromResonance,selectableElements}))??[];
  const statIcons=Object.fromEntries(TITAN_STAT_KEYS.flatMap(stat=>{
    const icon=catalog?.statIcons?.[TITAN_STATS[stat]]?.icon;
    return icon?[[stat,icon]]:[];
  }));
  const hasExampleMedia = [...EXAMPLE_WEAPONS.map(weapon => weapon.image), 'worn-titan.webp']
    .every(file => existsSync(path.join(process.cwd(), 'public/examples/titan', file)));
  return <TitanCalculatorPage hasExampleMedia={hasExampleMedia}
    catalog={{weapons,statIcons,titanMark:catalog?.titanMark,elementIcons:catalog?.elementIcons??{},roleResonances:catalog?.roleResonances}}/>;
}
