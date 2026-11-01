import {preferScoringTrack,alteredAttackSources,compareCurrentGearForTrack,compareGrvTotals,idealGearForTrack,scoreBuildForTrack,scoreCurrentGearForTrack,type BuildRVRole,type GearScoreReference} from '@tof-hub/game-domain';

/** What the board rates: DPS damage, healer ATK, tank resistance of the element. */
export type RankingRole=BuildRVRole;
export const RANKING_ROLES:RankingRole[]=['dps','healer','tank'];
import {analyzeGear,gearRollValue,titanMaximums,type RollValueContext} from '../build/model';
import type {BuildCatalog,BuildDraft,GearDraft} from '../build/types';
import type {ElementTrack,GearTopEntry,PlayerTopEntry,TopGear,TopPlayer,RankingCatalog} from './types';

/** Scoring reads only the stat reference, slot pools and icons; the slim catalog carries all of them. */
export const scoringCatalog=(catalog:RankingCatalog)=>catalog as unknown as BuildCatalog;
const GRV_DRAFT={rv:{element:'',includeCrit:true,mode:'grv'}} as BuildDraft;

export const trackId=(track:ElementTrack)=>track.join('-');
/** Query value of the All filter: every item / player at its best track. */
export const ALL_TRACKS='all';
/** Tracks ranked by the All filter: mono elements including Altered, plus the pairs (a tank has no pairs). */
export const rankedTracks=(catalog:RankingCatalog,role:RankingRole='dps'):ElementTrack[]=>[...Object.keys(catalog.elementIcons).map(element=>[element]),...(role==='tank'?[]:catalog.pairs)];
export const parseTrack=(id:string|null|undefined,catalog:RankingCatalog):ElementTrack=>{
  const mono=Object.keys(catalog.elementIcons);
  if(id&&mono.includes(id))return [id];
  return catalog.pairs.find(pair=>trackId(pair)===id)??[mono[0]!];
};
export function trackContext(track:ElementTrack,role:BuildRVRole='dps'):RollValueContext {
  return {element:track[0]!,selected:track[0]!,percentElements:track,role};
}

/** GRV of one gear piece for an element track, as on the build card in GRV mode. */
export function gearTrackScore(gear:GearDraft,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const score=gearRollValue(gear,GRV_DRAFT,scoringCatalog(catalog),trackContext(track,role));
  const ratio=score.value===null||score.maximum<=0?null:score.value/score.maximum;
  return {score,ratio,percent:ratio===null?null:ratio*100};
}

/**
 * Ranking rank by current stats: the GRV families, units and slot ceiling, read from the item's values
 * now. Titan growth is random per stat, so someone else's pre-Titan values cannot be recovered; the full-Titan
 * projection (`gearTrackScore`) stays for items whose pre-Titan values are known.
 */
/** The scoring input of a top's gear draft: its current stats and, for Titan pieces, the added ones. */
function gearScoreInput(gear:GearDraft,catalog:RankingCatalog) {
  const allowedTypes=scoringCatalog(catalog).gear.find(item=>item.id===gear.id)?.allowedStats??[];
  return {rows:gear.rows.map(row=>({type:row.type,value:row.value})),
    augments:gear.titan||gear.augmented?gear.augments.filter(augment=>augment.type):[],allowedTypes};
}
export function gearCurrentScore(gear:GearDraft,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  return scoreCurrentGearForTrack(gearScoreInput(gear,catalog),track,scoringCatalog(catalog).reference as unknown as GearScoreReference,role);
}

/**
 * Exact output gain of item A over item B on the universal fighter (2026-10-09): damage for
 * DPS, ATK for healers, damage taken relative to health for tanks; each item on its own track.
 * Tank damage taken is the inverse EHP ratio, so swap the operands for both the total and every factor.
 */
export function gearGain(a:{gear:GearDraft;track:ElementTrack},b:{gear:GearDraft;track:ElementTrack},catalog:RankingCatalog,role:BuildRVRole='dps') {
  if(role==='tank')[a,b]=[b,a];
  return compareCurrentGearForTrack({gear:gearScoreInput(a.gear,catalog),track:a.track},{gear:gearScoreInput(b.gear,catalog),track:b.track},
    scoringCatalog(catalog).reference as unknown as GearScoreReference,role);
}
const normalizations=new Map<string,number>();
/** Log-output gain of 100 GRV on a track (the same for every slot): converts GRV totals into output. */
export function trackNormalization(track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const key=role+'|'+trackId(track);
  let value=normalizations.get(key);
  if(value===undefined){value=gearCurrentScore({id:'',equipped:true,enhancement:0,stars:0,titan:false,augmented:false,rows:[],augments:[],base:[],rareId:'',rareLevel:0},track,catalog,role).normalization;normalizations.set(key,value);}
  return value;
}
/** First-order output gain of build A over build B from their GRV totals (players; each on its own track). */
export function buildGain(a:{value:number;track:ElementTrack},b:{value:number;track:ElementTrack},catalog:RankingCatalog,role:BuildRVRole='dps') {
  if(role==='tank')[a,b]=[b,a];
  return compareGrvTotals({value:a.value,normalization:trackNormalization(a.track,catalog,role)},{value:b.value,normalization:trackNormalization(b.track,catalog,role)});
}

/** Maximum-roll GRV weights of the track (as in the build's item dialog), limited to the slot's pool when one is chosen. */
export function trackRollWeights(track:ElementTrack,slot:string|null,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const gear:GearDraft={id:slot??'',equipped:true,enhancement:0,stars:0,titan:false,augmented:false,rows:[],augments:[],base:[],rareId:'',rareLevel:0};
  return gearRollValue(gear,GRV_DRAFT,scoringCatalog(catalog),trackContext(track,role)).rollWeights;
}

/** GRV ceiling of a slot for the track: the points of its perfect item (100 %). */
export function slotCeiling(slot:string,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  return gearCurrentScore({id:slot,equipped:true,enhancement:0,stars:0,titan:false,augmented:false,rows:[],augments:[],base:[],rareId:'',rareLevel:0},track,catalog,role).maximum;
}

/** The perfect item of a slot for the track: the GRV ceiling (100 %) as concrete full-Titan stats. */
export function idealGear(slot:string,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps',rolledType?:string) {
  const build=scoringCatalog(catalog);
  const allowedTypes=build.gear.find(item=>item.id===slot)?.allowedStats??[];
  return idealGearForTrack(allowedTypes,track,build.reference as unknown as GearScoreReference,role,rolledType);
}

/** Columns of an expanded row: values before Titan, current values and the full-Titan ceiling of this roll split. */
export function gearStages(gear:GearDraft,catalog:RankingCatalog) {
  const build=scoringCatalog(catalog);
  const {rolls}=analyzeGear(gear,build);
  const maxima=titanMaximums(gear,build);
  const augments=gear.augments.filter(augment=>augment.type);
  const addedIndex=augments.map(augment=>gear.augments.indexOf(augment));
  return {
    original:gear.rows.map((row,i)=>({type:row.type,value:row.beforeTitan,rolls:rolls[i]??null})),
    current:gear.rows.map((row,i)=>({type:row.type,value:row.value,maximum:maxima.random[i]??null})),
    augments:augments.map((augment,i)=>({type:augment.type,value:augment.value,maximum:maxima.added[addedIndex[i]!]??null})),
    maximum:gear.rows.map((row,i)=>({type:row.type,value:maxima.random[i]??null})),
    maximumAugments:augments.map((augment,i)=>({type:augment.type,value:maxima.added[addedIndex[i]!]??null})),
  };
}

type StageRow={type:string;value:number|null};
/** Current-value GRV of one stage of the item; null when any of its values is unknown. */
function stageScore(gear:GearDraft,rows:StageRow[],augments:StageRow[],track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  if(rows.some(row=>row.value===null)||augments.some(row=>row.value===null))return null;
  return gearCurrentScore({...gear,rows:rows.map(row=>({type:row.type,value:row.value!,beforeTitan:null})),augments:augments.map(row=>({type:row.type,value:row.value!}))},track,catalog,role);
}

/** GRV of the item now and at its full-Titan ceiling (same units); the ceiling needs known pre-Titan values. */
export function gearStageScores(gear:GearDraft,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const stages=gearStages(gear,catalog);
  const known=stages.original.some(row=>row.value!==null);
  const titan=gear.titan||gear.augmented;
  return {
    now:gearCurrentScore(gear,track,catalog,role),
    maximum:known?stageScore({...gear,titan:true},stages.maximum,titan?stages.maximumAugments:[],track,catalog,role):null,
  };
}

/**
 * A whole build at full Titan (2026-10-08): every piece at its own Titan ceiling, scored as one build
 * (buildTrackScore, the pair rule included). Null unless every piece's pre-Titan values are known.
 */
export function buildTitanMaximum(gear:GearDraft[],track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const drafts:GearDraft[]=[];
  for(const item of gear) {
    const stages=gearStages(item,catalog);
    const augments=item.titan||item.augmented?stages.maximumAugments:[];
    if(!stages.original.some(row=>row.value!==null)||stages.maximum.some(row=>row.value===null)||augments.some(row=>row.value===null))return null;
    drafts.push({...item,titan:true,rows:stages.maximum.map(row=>({type:row.type,value:row.value!,beforeTitan:null})),augments:augments.map(row=>({type:row.type,value:row.value!}))});
  }
  return drafts.length?buildTrackScore(drafts,track,catalog,role):null;
}

export function topGearDraft(gear:TopGear):GearDraft {
  const augmented=gear.titan||gear.augmented;
  return {id:gear.slot,equipped:true,enhancement:gear.enhancement,stars:gear.stars,titan:gear.titan,augmented,
    rows:gear.stats.map((stat,i)=>({type:stat.type,value:stat.value,beforeTitan:gear.statsBeforeTitan?.[i]??(augmented?null:stat.value)})),
    augments:gear.augments,base:[],rareId:gear.rareId??'',rareLevel:gear.rareLevel??0,augmentCount:gear.augmentCount??null};
}
export const entryGear=(entry:GearTopEntry)=>topGearDraft(entry.gear);
function topGear(gear:GearDraft,lastSeenAt:string):TopGear {
  return {slot:gear.id,itemId:gear.id,stars:gear.stars,enhancement:gear.enhancement,titan:gear.titan,augmented:!!gear.augmented,rareId:gear.rareId||null,
    rareLevel:gear.rareLevel??null,stats:gear.rows.map(row=>({type:row.type,value:row.value})),statsBeforeTitan:gear.rows.map(row=>row.beforeTitan),
    augments:gear.augments.filter(augment=>augment.type),lastSeenAt};
}
function gearEntryFromDraft(gear:GearDraft,player:TopPlayer,lastSeenAt:string):Omit<GearTopEntry,'rank'|'score'|'maxScore'> {
  return {player,gear:topGear(gear,lastSeenAt)};
}

/** Ranks gear by the share of its slot ceiling so different slots compare fairly. */
export function rankGear(items:Omit<GearTopEntry,'rank'|'score'|'maxScore'>[],track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps'):GearTopEntry[] {
  return items.map(item=>{const score=gearCurrentScore(entryGear({...item,rank:0,score:0,maxScore:0}),track,catalog,role);
    return {...item,rank:0,score:score.percent??0,maxScore:score.maximum};})
    .sort((a,b)=>b.score-a.score).map((entry,index)=>({...entry,rank:index+1}));
}

/**
 * Tracks a board query compares: every ranked track for All, both orientations of a pair (the page treats a pair as
 * unordered, so an item keeps the better flat ATK of the two elements), or the mono track itself. On a tie the first
 * candidate (mono before pairs, the named orientation first) wins.
 */
export function candidateTracks(track:ElementTrack|null,catalog:RankingCatalog,role:BuildRVRole='dps'):ElementTrack[] {
  if(!track)return rankedTracks(catalog,role);
  return track.length>1?[track,[...track].reverse()]:[track];
}
/** Best track of one item among the candidates: the highest current GRV percent. */
function bestGearTrack(gear:GearDraft,catalog:RankingCatalog,tracks:ElementTrack[]=rankedTracks(catalog),role:BuildRVRole='dps') {
  return tracks.map(track=>({track,score:gearCurrentScore(gear,track,catalog,role)}))
    .reduce((best,next)=>preferScoringTrack({track:trackId(next.track),percent:next.score.percent??0,value:next.score.value},{track:trackId(best.track),percent:best.score.percent??0,value:best.score.value})?next:best);
}

/** `track` null: the All filter, each item at its best track. */
export function exampleGearTop(catalog:RankingCatalog,track:ElementTrack|null,slot:string|null,role:BuildRVRole='dps'):GearTopEntry[] {
  const {player,gear,capturedAt}=catalog.example;
  const items=gear.filter(item=>!slot||item.id===slot);
  if(track&&track.length===1)return rankGear(items.map(item=>gearEntryFromDraft(item,player,capturedAt)),track,catalog,role);
  return items.map(item=>{const best=bestGearTrack(item,catalog,candidateTracks(track,catalog,role),role);
    return {...gearEntryFromDraft(item,player,capturedAt),rank:0,score:best.score.percent??0,maxScore:best.score.maximum,track:trackId(best.track)};})
    .sort((a,b)=>b.score-a.score).map((entry,index)=>({...entry,rank:index+1}));
}

/** A build's total on a track: on a pair track ATK % and DMG % each from one element, the in-game rule (scoreBuildForTrack). */
export function buildTrackScore(gear:GearDraft[],track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps') {
  const reference=scoringCatalog(catalog).reference as unknown as GearScoreReference;
  const build=scoreBuildForTrack(gear,item=>item.id,item=>gearScoreInput(item,catalog),track,reference,role);
  const slots=gear.map(item=>{const score=build.score(gearScoreInput(item,catalog));return {gear:item,score,percent:score.percent};});
  const value=slots.reduce((sum,slot)=>sum+slot.score.value,0),maximum=slots.reduce((sum,slot)=>sum+slot.score.maximum,0);
  return {slots,value,maximum,choice:build.choice,percent:maximum>0?value/maximum*100:0};
}
/** The perfect item as a gear draft: its rated stats at full Titan, values before Titan from the same rolls. */
export function idealGearDraft(slot:string,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps',rolledType?:string):GearDraft {
  const ideal=idealGear(slot,track,catalog,role,rolledType);
  return draftFromIdeal(slot,ideal,catalog);
}
function draftFromIdeal(slot:string,ideal:ReturnType<typeof idealGear>,catalog:RankingCatalog):GearDraft {
  return {id:slot,equipped:true,enhancement:0,stars:scoringCatalog(catalog).reference.limits.maxNumOfRandomStatRolls,titan:true,augmented:true,
    rows:ideal.stats.map(stat=>({type:stat.type,value:stat.value,beforeTitan:stat.before})),
    // A tank's perfect item has its best Titan additions below (e.g. HP carried from five Crit rolls on top).
    augments:ideal.augments.map(stat=>({type:stat.type,value:stat.value})),base:[],rareId:'',rareLevel:0};
}
const IDEAL_PLAYER:TopPlayer={nickname:null,uid:null,region:null,serverId:null};
/** Shared ATK% piece for both reference boards; null when the slot has no legal ATK%. */
export function attackGearDraft(slot:string,track:ElementTrack,catalog:RankingCatalog,role:BuildRVRole='dps'):GearDraft|null {
  const item=catalog.gear.find(item=>item.id===slot);
  const sources=track[0]==='Altered'&&role!=='tank'?alteredAttackSources(scoringCatalog(catalog).reference):track;
  const primary=sources.map(element=>element+' Attack %').find(type=>item?.allowedStats.includes(type));
  return primary?idealGearDraft(slot,track,catalog,role==='tank'?'dps':role,primary):null;
}
/** Rank 0.5 rows only for slots with ATK%; score against the original unconstrained ceiling. */
export function attackGearTop(catalog:RankingCatalog,track:ElementTrack,slot:string|null,role:BuildRVRole='dps'):GearTopEntry[] {
  return catalog.gear.filter(item=>!slot||item.id===slot).flatMap(item=>{
    const draft=attackGearDraft(item.id,track,catalog,role);
    if(!draft)return [];
    const score=gearCurrentScore(draft,track,catalog,role);
    return [{...gearEntryFromDraft(draft,IDEAL_PLAYER,''),rank:.5,score:score.percent??0,maxScore:score.maximum,ideal:true,reference:'attack-percent' as const}];
  });
}
/** Rank 0 rows of the gear board: the perfect item of the selected slot, or of every slot. */
export function idealGearTop(catalog:RankingCatalog,track:ElementTrack,slot:string|null,role:BuildRVRole='dps'):GearTopEntry[] {
  return catalog.gear.filter(item=>!slot||item.id===slot).map(item=>{
    const draft=idealGearDraft(item.id,track,catalog,role),score=gearCurrentScore(draft,track,catalog,role);
    return {...gearEntryFromDraft(draft,IDEAL_PLAYER,''),rank:0,score:score.percent??0,maxScore:score.maximum,ideal:true};
  });
}
/** Rank 0 row of the player board: a perfect item in every slot. */
export function idealPlayerTop(catalog:RankingCatalog,track:ElementTrack,role:BuildRVRole='dps'):PlayerTopEntry {
  const gear=catalog.gear.map(item=>idealGearDraft(item.id,track,catalog,role)),total=buildTrackScore(gear,track,catalog,role);
  return {rank:0,score:total.percent,maxScore:total.maximum,player:IDEAL_PLAYER,buildId:null,updatedAt:'',gear:gear.map(item=>topGear(item,'')),ideal:true};
}
/** Resistance-only reference: all random rolls and Titan additions are RES; HP stays in main stats. */
export function resistanceGearDraft(slot:string,track:ElementTrack,catalog:RankingCatalog):GearDraft {
  const reference=scoringCatalog(catalog).reference;
  const types=Object.fromEntries(Object.entries(reference.statTypes).filter(([type])=>/Resistance(?: %)?$/.test(type)));
  const allowedTypes=catalog.gear.find(item=>item.id===slot)?.allowedStats.filter(type=>type in types)??[];
  const ideal=idealGearForTrack(allowedTypes,track,{...reference,statTypes:types},'tank');
  return draftFromIdeal(slot,ideal,catalog);
}
export function resistanceGearTop(catalog:RankingCatalog,track:ElementTrack,slot:string|null):GearTopEntry[] {
  return catalog.gear.filter(item=>!slot||item.id===slot).map(item=>{
    const percent=track[0]==='Altered'&&item.allowedStats.includes('Altered Resistance %');
    const draft=percent?idealGearDraft(item.id,track,catalog,'tank','Altered Resistance %'):resistanceGearDraft(item.id,track,catalog),score=gearCurrentScore(draft,track,catalog,'tank');
    return {...gearEntryFromDraft(draft,IDEAL_PLAYER,''),rank:.5,score:score.percent??0,maxScore:score.maximum,ideal:true,reference:percent?'altered-resistance-percent':'resistance-only'};
  });
}
export function resistancePlayerTop(catalog:RankingCatalog,track:ElementTrack):PlayerTopEntry {
  const gear=catalog.gear.map(item=>resistanceGearDraft(item.id,track,catalog)),total=buildTrackScore(gear,track,catalog,'tank');
  return {rank:.5,score:total.percent,maxScore:total.maximum,player:IDEAL_PLAYER,buildId:null,updatedAt:'',gear:gear.map(item=>topGear(item,'')),ideal:true,reference:'resistance-only'};
}
/** Rank 0.5 reference: ATK% primary wherever legal, otherwise the role's perfect slot. */
export function attackPlayerTop(catalog:RankingCatalog,track:ElementTrack,role:BuildRVRole='dps'):PlayerTopEntry {
  const gear=catalog.gear.map(item=>attackGearDraft(item.id,track,catalog,role)??idealGearDraft(item.id,track,catalog,role));
  const total=buildTrackScore(gear,track,catalog,role);
  return {rank:.5,score:total.percent,maxScore:total.maximum,player:IDEAL_PLAYER,buildId:null,updatedAt:'',
    gear:gear.map(item=>topGear(item,'')),ideal:true,reference:'attack-percent'};
}
export function examplePlayerTop(catalog:RankingCatalog,track:ElementTrack|null,role:BuildRVRole='dps'):PlayerTopEntry[] {
  const {player,gear,capturedAt}=catalog.example;
  const best=candidateTracks(track,catalog,role).map(item=>({track:item,total:buildTrackScore(gear,item,catalog,role)}))
    .reduce((top,next)=>preferScoringTrack({track:trackId(next.track),percent:next.total.percent,value:next.total.value},{track:trackId(top.track),percent:top.total.percent,value:top.total.value})?next:top);
  return [{rank:1,score:best.total.percent,maxScore:best.total.maximum,track:trackId(best.track),player,buildId:'example',updatedAt:capturedAt,gear:gear.map(item=>topGear(item,capturedAt))}];
}
