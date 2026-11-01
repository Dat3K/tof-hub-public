import {mapCaptureGear,normalizeCharacterTitle} from '@tof-hub/game-domain';
import type {BuildCapture,PlayerSnapshot} from '@tof-hub/contracts';
import type {ScoringCatalog} from './scoring-catalog';

/**
 * A decrypted build capture as a player snapshot. The capture itself is kept as the build document; gear is mapped
 * with the same generated tables as the build page, including values before Titan when the capture matched them.
 */
/**
 * HistoryMaxGSChangeTime (`profile.maxCsCivilTime`) is civil time without a verified timezone: kept as written and
 * read as UTC, like the build page shows it (formatBuildDate 'civil').
 */
function civilTime(value:string|null):string|null {
  if(!value)return null;
  const date=new Date(value.replace(/(\.\d+)?Z?$/,'Z'));
  return Number.isFinite(date.getTime())?date.toISOString():null;
}

type MappedGear=ReturnType<typeof mapCaptureGear>['gear'][number];
// A never-upgraded piece still has its original rolls: its current values are the base (known, so verified).
const snapshotGear=(item:MappedGear)=>({slot:item.slot,itemId:item.itemId,stars:item.stars,enhancement:item.enhancement,titan:item.stage==='titan',
  augmented:item.stage!=='normal',rareId:item.rareId||null,rareLevel:item.rareId?item.rareLevel:null,stats:item.rows.map(row=>({type:row.type,value:row.value})),
  statsBeforeTitan:item.rows.some(row=>row.beforeTitan!==null)?item.rows.map(row=>row.beforeTitan)
    :item.stage==='normal'&&item.rows.length?item.rows.map(row=>row.value):null,augments:item.augments,
  augmentCount:item.augmentCount});

/** Equipped gear shared by .tofbuild and the .tofplayers owner row; neither path invents pre-Titan rolls. */
export function captureGearSnapshot(entries:BuildCapture['gear'],catalog:ScoringCatalog) {
  const {gear,unresolved}=mapCaptureGear(entries,catalog.captureGear);
  return {gear:gear.map(snapshotGear),unresolved};
}

/**
 * `inventory`: the backpack returned beside the signed card. Every piece is a candidate (Titan or not, 2026-10-10: a
 * non-Titan piece stronger than the equipped one now also counts); identical pieces are offered once. Enhancement and
 * stars are the equipped piece's of the slot, because the game transfers them on equip (as in the Optimizer).
 */
export function snapshotFromCapture(capture:BuildCapture,catalog:ScoringCatalog,inventory:BuildCapture['inventory']=undefined):{snapshot:PlayerSnapshot;unresolved:string[]} {
  const {gear,unresolved}=captureGearSnapshot(capture.gear,catalog);
  const seen=new Set<string>();
  const backpack=mapCaptureGear((inventory??[]).map(entry=>({...entry,enhancement:0,stars:null})),catalog.captureGear).gear.flatMap(item=>{
      const slot=gear.find(equipped=>equipped.slot===item.slot);
      return [{...snapshotGear(item),enhancement:slot?.enhancement??0,stars:slot?.stars??0}];
    }).filter(item=>{
      const key=JSON.stringify([item.slot,item.itemId,item.stats,item.augments,item.rareId,item.rareLevel]);
      return seen.has(key)?false:(seen.add(key),true);
    });
  const p=capture.profile;
  const whole=(value:number|null)=>value===null?undefined:Math.floor(value);
  const text=(value:string|null,max=120)=>value?value.slice(0,max):undefined;
  const augmentationTotal=(items:typeof gear):number|null=>items.every(item=>item.augmentCount!==null)
    ?items.reduce((total,item)=>total+item.augmentCount!,0):null;
  const equippedAugmentationSpent=augmentationTotal(gear);
  const backpackAugmentationSpent=augmentationTotal(backpack);
  const gearCounters=inventory===undefined?undefined:{
    augmentationSpent:equippedAugmentationSpent===null||backpackAugmentationSpent===null?null:equippedAugmentationSpent+backpackAugmentationSpent,
    equippedAugmentationSpent,equippedPieceCount:gear.length,backpackAugmentationSpent,backpackPieceCount:backpack.length,
  };
  return {unresolved,snapshot:{source:'self',capturedAt:new Date(capture.capture.capturedAt).toISOString(),
    player:{uid:capture.capture.subject.uid,roleId:capture.capture.subject.roleId,nickname:text(p.name,64),level:p.level??undefined,crew:text(p.crew,64),
      titleId:normalizeCharacterTitle(text(p.titleId))||undefined,avatarId:text(p.avatarId),avatarFrameId:text(p.avatarFrameId),combatScore:p.cs!==null&&p.cs>=0?whole(p.cs):undefined,maxCombatScore:whole(p.maxCs),
      ...(p.maxCs!==null&&civilTime(p.maxCsCivilTime)?{maxCombatScoreAt:civilTime(p.maxCsCivilTime)!}:{}),
      // Own account counters stay raw; TotalRecharge also fills the column that inspected profiles use.
      ...(capture.account?{account:capture.account}:{}),
      ...(gearCounters?{gearCounters}:{}),
      ...(typeof capture.account?.totalRecharge==='number'?{totalRecharge:capture.account.totalRecharge}:{})},
    gear,...(backpack.length?{backpack:backpack.slice(0,2000)}:{}),
    build:{draft:capture,combatScore:p.cs!==null&&p.cs>=0?whole(p.cs)??null:null,element:null,role:null}}};
}
