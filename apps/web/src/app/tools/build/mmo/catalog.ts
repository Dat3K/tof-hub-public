import {loadServerGameData} from '@/lib/game-data-server';
import {loadBuildCatalog} from '../catalog';
import type {MmoBuildCatalog,MmoGeneratedCatalog} from '@/features/build/mmo/types';
import type {HandbookBrainfieldData} from '@/features/datamine/contracts/handbook';
import type {SimulacraDataset} from '@tof-hub/contracts';
import {compareSimulacraRelease} from '@/features/info-sections/common/catalog-release-order';

/** The MMO card catalog of every /tools/build/mmo/ route (own card, public builds). */
export async function loadMmoBuildCatalog():Promise<MmoBuildCatalog> {
  const [mmo,build,brainfield,randomStats,simulacra]=await Promise.all([loadServerGameData<MmoGeneratedCatalog>('','build-mmo-page'),loadBuildCatalog(),
    loadServerGameData<HandbookBrainfieldData|null>('handbook','mmo-brainfield',{throwOnNotFound:false}),
    loadServerGameData<{modes?:{global?:{stats?:Record<string,{name?:MmoGeneratedCatalog['attributes'][string]['name'];icon?:string|null;percent?:boolean}>}}}|null>('handbook','random-stats',{throwOnNotFound:false}),
    loadServerGameData<SimulacraDataset>('en','simulacra')]);
  if(mmo.schemaVersion!==1)throw new Error('Unsupported MMO build catalog version');
  // Only the shared card presentation of the Global catalog reaches the client.
  const {sources:_sources,...generated}=mmo as MmoGeneratedCatalog&{sources?:unknown};
  // Follow Info's current MMO roster and release order in both editor entry points.
  // Keep the generated MMO advancement data; never substitute Global weapon rows.
  const weaponById=new Map(generated.weapons.map(weapon=>[weapon.id,weapon]));
  const weapons=[...(simulacra.mmo??[])].sort((a,b)=>compareSimulacraRelease(a,b,true)).flatMap(item=>{
    const weapon=weaponById.get(item.id);
    return weapon&&weapon.weaponId===item.weapon_id?[weapon]:[];
  });
  // Brainfield stat sums need each node's per-level attribute row only (the Handbook file also carries layout and costs).
  const brainfieldStats=brainfield?.groups.flatMap(group=>group.nodes.map(({id,kind,maxLevel,levels})=>({id,kind,maxLevel,levels:levels.map(({level,attribute})=>({level,attribute}))})));
  // MMO tables omit the elemental `*AtkAdded` attributes that Brainfield nodes raise: like Handbook #brainfield, only their
  // label, icon and percent flag come from the generated Global random-stat presentation (docs/game-data/brainfield.md).
  const attributes={...generated.attributes};
  for(const prop of new Set(brainfieldStats?.flatMap(node=>node.levels.map(level=>level.attribute.propName??''))??[])) {
    const global=randomStats?.modes?.global?.stats?.[prop];
    if(prop&&!attributes[prop]&&global?.name)attributes[prop]={name:global.name,icon:global.icon??null,percent:global.percent===true};
  }
  const catalog:MmoBuildCatalog={...generated,weapons,attributes,artworks:build.artworks,elementIcons:build.elementIcons,
    avatars:[...build.avatars,...generated.avatars??[]],avatarFrames:[...build.avatarFrames,...generated.avatarFrames??[]],roleResonances:build.roleResonances.items,titles:build.titles,titleStyles:build.titleStyles,demoCharacterTitle:build.demoDraft.profile.characterTitle,
    ...(brainfieldStats?{brainfieldStats}:{})};
  return catalog;
}
