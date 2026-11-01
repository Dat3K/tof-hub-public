/** Materialized SSR bounds. All coefficients are supplied by the data pipeline. */
export interface BuildStatBounds {
  randomStatDefaultValue: number;
  randomStatMinRollValue: number;
  randomStatMaxRollValue: number;
  maxAugmentIncreaseMultiplier: number;
  maxAugmentIncreaseFlat: number;
  isPercentageBased: boolean;
}
export interface BuildRandomStat {type:string;beforeTitan:number|null}

/** Quality of upgrade gains only: minimum rolls are 0%, maximum rolls 100%. */
export function getBuildRollQuality(gain:number|null,rolls:number|null,type:BuildStatBounds):number|null {
  if(gain===null||!Number.isFinite(gain)||rolls===null||!Number.isInteger(rolls)||rolls<=0)return null;
  const minimum=rolls*type.randomStatMinRollValue;
  const range=rolls*(type.randomStatMaxRollValue-type.randomStatMinRollValue);
  // Fixed-value upgrades have no quality range.
  return range>0?Math.max(0,Math.min(1,(gain-minimum)/range)):null;
}

export function getBuildRollCandidates(value:number,type:BuildStatBounds,limit:number):number[] {
  if(!Number.isFinite(value)||value<type.randomStatDefaultValue)return [];
  const gain=value-type.randomStatDefaultValue;
  return Array.from({length:limit+1},(_,n)=>n).filter(n=>gain+1e-9>=n*type.randomStatMinRollValue&&gain-1e-9<=n*type.randomStatMaxRollValue);
}
export function enumerateBuildRolls(rows:BuildRandomStat[],types:Record<string,BuildStatBounds>,stars:number,limit:number):number[][] {
  if(!Number.isInteger(stars)||stars<0||stars>limit||!rows.length)return [];
  let paths:number[][]=[[]];
  for(const row of rows) {
    const type=types[row.type];
    if(!type||row.beforeTitan===null)return [];
    paths=paths.flatMap(previous=>getBuildRollCandidates(row.beforeTitan!,type,limit).map(n=>[...previous,n])).filter(p=>p.reduce((a,b)=>a+b,0)<=stars);
  }
  return paths.filter(p=>p.reduce((a,b)=>a+b,0)===stars);
}
/**
 * Most likely roll split when several fit the totals. A gain of n rolls is a sum of n uniform rolls,
 * approximated by a normal distribution (mean n·mid, variance n·range²/12); the path with the smallest
 * squared z-score sum wins, ties keep enumeration order.
 */
export function pickBuildRollPath(rows:BuildRandomStat[],types:Record<string,BuildStatBounds>,paths:number[][]):number[]|null {
  if(!paths.length)return null;
  const score=(path:number[])=>path.reduce((sum,n,i)=>{
    const type=types[rows[i].type],gain=(rows[i].beforeTitan??0)-(type?.randomStatDefaultValue??0);
    if(!type||n===0)return sum;
    const mid=(type.randomStatMinRollValue+type.randomStatMaxRollValue)/2,range=type.randomStatMaxRollValue-type.randomStatMinRollValue;
    return range>0?sum+(gain-n*mid)**2/(n*range*range/12):sum;
  },0);
  return paths.reduce((best,path)=>score(path)<score(best)-1e-12?path:best);
}
export function getBuildStatMaximum(before:number,rolls:number,type:BuildStatBounds) {
  return {roll:type.randomStatDefaultValue+rolls*type.randomStatMaxRollValue,titan:before*(1+type.maxAugmentIncreaseMultiplier)+type.maxAugmentIncreaseFlat};
}
export function getBuildCriticalRates(rating:number,denominator:number|undefined,additional:number) {
  const base=denominator&&denominator>0?rating/denominator:null;
  return {base,total:base===null?null:base+additional};
}
export function getBuildResistanceReduction(resistance:number,constant:number|undefined) {
  return constant&&constant>0&&resistance>=0?resistance/(resistance+constant):null;
}

export interface BuildTitanGrowth {pullUpFactors:number[];priorities:Record<string,string[]>;fallbacks:Record<string,string[]>;maxAddedStats:number;universalAttackElements:string[];unconfirmedPullUpRanks:number[];
  /** Highest observed share of the primary's Titan rolls an added resistance / HP receives (generated, observations). */
  addedStatShare?:number}
/** Mirrors getPossibleAugmentStats(includeAll): original stats are excluded,
 * and fallback pools are hidden when priorities can fill both slots. */
export function getBuildAugmentPools(rows:BuildRandomStat[],growth:BuildTitanGrowth,primary:number) {
  const unused=(type:string)=>!rows.some(row=>row.type===type);
  const priority=(growth.priorities[rows[primary]?.type]??[]).filter(unused);
  const fallback=priority.length>=growth.maxAddedStats?[]:(growth.fallbacks[rows[primary]?.type]??[]).filter(unused);
  return {priority,fallback};
}
/** The upstream primary is (value - initial) / max roll, independent of roll-count ambiguity. */
export function getBuildTitanProjection(rows:BuildRandomStat[],types:Record<string,BuildStatBounds>,growth:BuildTitanGrowth,primary:number) {
  const random=rows.map(row=>row.beforeTitan===null||!types[row.type]?null:getBuildStatMaximum(row.beforeTitan,0,types[row.type]).titan);
  const sources=rows.map(row=>row.type);
  // Only the four core elements share pull-up groups. Other elements remain
  // independent: they cannot increase either a core stat or its RV ceiling.
  for(const role of ['Attack','Attack %','Damage %']) {
    const family=rows.map((row,i)=>({row,i})).filter(({row})=>growth.universalAttackElements.includes(row.type.split(' ')[0])&&row.type.endsWith(' '+role)&&row.beforeTitan!==null).sort((a,b)=>b.row.beforeTitan!-a.row.beforeTitan!);
    family.slice(1).forEach(({i},n)=>{
      if(growth.pullUpFactors[n]===undefined||growth.unconfirmedPullUpRanks.includes(n+2)){random[i]=null;return;}
      const pulled=random[family[0].i]!*growth.pullUpFactors[n];
      // Pull-up can raise an original stat, but must not replace its own growth with a lower ceiling.
      // Equal (or close) pre-Titan values otherwise acquire different maxima solely from row order.
      if(pulled>random[i]!){random[i]=pulled;sources[i]=rows[family[0].i].type;}
    });
  }
  const pools=getBuildAugmentPools(rows,growth,primary);
  const added=(type:string)=>{
    if(!types[type]||random[primary]===null||random[primary]===undefined||!pools.priority.concat(pools.fallback).includes(type))return null;
    // Every added stat (elemental ATK / ATK % / DMG % as well as resistances and HP) takes a share of the primary's rolls
    // AFTER Titan, (value − initial) / max roll, into its own range and does not grow further. Captured stats sit at
    // 0.73–0.975 of those rolls (median ≈ 0.89) for every pair, ATK → ATK included (19,141 stats, max 0.975): upstream's
    // fixed 0.95 × primary for added ATK is about the 95th percentile, not a rule (2026-10-08). The maximum uses the highest observed share.
    const source=types[rows[primary].type],target=types[type];
    const rolls=Math.max(0,(random[primary]!-source.randomStatDefaultValue)/source.randomStatMaxRollValue);
    return target.randomStatDefaultValue+(growth.addedStatShare??1)*rolls*target.randomStatMaxRollValue;
  };
  return {random,sources,added};
}
export function getBuildTitanPrimaries(rows:BuildRandomStat[],types:Record<string,BuildStatBounds>) {
  const weights=rows.map(row=>row.beforeTitan===null||!types[row.type]?-1:(row.beforeTitan-types[row.type].randomStatDefaultValue)/types[row.type].randomStatMaxRollValue);
  const maximum=Math.max(...weights);
  return maximum>0?weights.flatMap((weight,i)=>Math.abs(weight-maximum)<1e-8?[i]:[]):[];
}

export interface BuildRVProfile {flatAttack:number;attackPercent:number;damagePercent:number;critChance:number;critDamageBonus:number;critDenominator:number;
  /**
   * Tank rating (effective HP): resistance of the selected element before RES% and its total RES% (fraction), HP before
   * HP% and the total HP%, and the defence constant K of the level (damage reduction = R / (R + K)).
   */
  resistance?:number;resistancePercent?:number;hp?:number;hpPercent?:number;resistanceConstant?:number;
  /** A separate post-percentage addition, e.g. own Altered ATK. Native Space Support belongs in the base. */
  postPercentAttack?:number;
  /** Personal ratings count only the joint Crit / Crit Rate contribution up to 100%. */
  capCritContribution?:boolean}
/** What the roll value rates: DPS damage, healer ATK (no crit or DMG%), or tank effective HP. */
export type BuildRVRole='dps'|'healer'|'tank';
/** Local logarithmic damage derivatives; fractions, never whole percentages. Crit is capped at 100%. */
export function getBuildRVWeight(type:string,profile:BuildRVProfile) {
  const {flatAttack:B,attackPercent:a,damagePercent:d,critChance:c,critDamageBonus:k,critDenominator:denom}=profile;
  if(![B,a,d,c,k,denom].every(Number.isFinite)||B<=0||a<=-1||d<=-1||c<0||k<0||denom<=0)return 0;
  if(type==='Crit')return c>=1?0:k/(denom*(1+c*k));
  if(type==='Crit Rate %')return c>=1?0:k/(1+c*k);
  const support=profile.postPercentAttack??0,attack=B*(1+a)+support;
  if(!Number.isFinite(support)||support<0)return 0;
  if(type==='Attack %'||type.endsWith(' Attack %'))return B/attack;
  if(type==='Damage %'||type.endsWith(' Damage %'))return 1/(1+d);
  if(type==='Attack'||type.endsWith(' Attack'))return (1+a)/attack;
  return 0;
}

/** Fraction of a finite Crit addition that fits below the cap; raw stat values remain intact. */
export function getBuildCritContributionScale(stats:readonly {type:string;value:number}[],profile:BuildRVProfile) {
  if(!profile.capCritContribution)return 1;
  const chance=stats.reduce((sum,stat)=>sum+(stat.type==='Crit'?stat.value/profile.critDenominator:stat.type==='Crit Rate %'?stat.value:0),0);
  return chance>0?Math.min(1,Math.max(0,1-profile.critChance)/chance):1;
}

function capCritEntries<T extends {type:string;value:number;rv:number}>(entries:T[],profile:BuildRVProfile|undefined):T[] {
  if(!profile?.capCritContribution)return entries;
  const scale=getBuildCritContributionScale(entries,profile);
  return entries.map(entry=>entry.type==='Crit'||entry.type==='Crit Rate %'?{...entry,rv:entry.rv*scale}:entry);
}

/** Best legal roll allocation when Crit saturation can make another stat a better recipient. */
function cappedRollAllocation(set:string[],types:Record<string,BuildStatBounds>,maxRolls:number,unit:(type:string)=>number,profile:BuildRVProfile,primary?:string|null) {
  const rolls=set.map(()=>0);
  const entries=()=>capCritEntries(set.map((type,i)=>{
    const bounds=types[type],before=bounds.randomStatDefaultValue+rolls[i]*bounds.randomStatMaxRollValue;
    const value=getBuildStatMaximum(before,0,bounds).titan;
    return {type,rolls:rolls[i],before,value,rv:100*value/unit(type)};
  }),profile);
  const initial=entries().reduce((sum,entry)=>sum+entry.rv,0);
  let best={initial,maximum:0,stats:[] as ReturnType<typeof entries>};
  const allocate=(index:number,left:number)=>{
    if(index===set.length) {
      if(left)return;
      const stats=entries(),maximum=stats.reduce((sum,entry)=>sum+entry.rv,0);
      if(maximum>best.maximum)best={initial,maximum,stats};
      return;
    }
    for(let count=0;count<=left;count++) {
      if(primary&&set[index]!==primary&&count>0)continue;
      rolls[index]=count;allocate(index+1,left-count);
    }
  };
  allocate(0,maxRolls);
  return best;
}

/**
 * Rated stat families of an element. Altered inherits: its ATK is the final ATK of the strongest element (flat ATK incl.
 * universal ATK, times that element's ATK%) plus Altered ATK added after the percentages. With `inheritFrom` set to that
 * source element, the families are the source's flat ATK and ATK%, Altered ATK, and crit; the gear has no Altered
 * ATK% or DMG% stats and the source's DMG% does not apply to Altered damage.
 */
export function getBuildRatedFamilies(element:string,percentElements:string[],includeCrit:boolean,growth:BuildTitanGrowth,inheritFrom?:string,role:BuildRVRole='dps',flatElements?:string[]):string[][] {
  // Tank: effective HP against the selected element — HP, HP%, general RES, that element's RES and RES%.
  if(role==='tank')return [['HP'],['HP %'],['Resistance'],[element+' Resistance'],[element+' Resistance %']];
  // Healer: as much of one ATK as possible — flat ATK and ATK% count, crit and DMG% do not.
  const crit=includeCrit&&role==='dps'?[['Crit'],['Crit Rate %']]:[];
  const damage=role==='dps'?[percentElements.map(e=>e+' Damage %')]:[];
  if(inheritFrom)return [...(growth.universalAttackElements.includes(inheritFrom)?[['Attack']]:[]),[inheritFrom+' Attack'],[element+' Attack'],...crit,[inheritFrom+' Attack %']];
  return [...(growth.universalAttackElements.includes(element)?[['Attack']]:[]),(flatElements??[element]).map(e=>e+' Attack'),...crit,percentElements.map(e=>e+' Attack %'),...damage];
}
/**
 * Weight of a rated type. For an inheriting element (Altered) its own flat ATK comes after the source's ATK%:
 * d log[B(1+a)+A]/dA = 1/(B(1+a)) at A≈0, so it is the flat weight divided by (1 + a).
 */
export function getBuildRatedWeight(type:string,profile:BuildRVProfile,element:string,inheritFrom?:string,role:BuildRVRole='dps') {
  if(role==='tank') {
    // Effective HP: EHP = H(1+h) × (1 + R(1+r)/K), with damage reduction R(1+r) / (R(1+r) + K). Weights are
    // d log EHP: HP 1/H, HP% 1/(1+h); flat RES (general = the element's own) (1+r)/(K + R(1+r)), RES% R/(K + R(1+r)).
    // Resistance has diminishing returns: the more RES, the larger K + R(1+r) and the smaller the next point.
    const R=profile.resistance??0,r=profile.resistancePercent??0,H=profile.hp??0,h=profile.hpPercent??0,K=profile.resistanceConstant??0;
    if(!(R>0)||!(r>-1)||!(H>0)||!(h>-1)||!(K>0))return 0;
    const pool=K+R*(1+r);
    if(type==='HP')return 1/H;
    if(type==='HP %')return 1/(1+h);
    if(type==='Resistance'||type===element+' Resistance')return (1+r)/pool;
    if(type===element+' Resistance %')return R/pool;
    return 0;
  }
  if(element==='Altered'&&(type==='Damage %'||type.endsWith(' Damage %')))return 0;
  if(role==='healer'&&(type==='Crit'||type==='Crit Rate %'||type==='Damage %'||type.endsWith(' Damage %')))return 0;
  const weight=getBuildRVWeight(type,profile);
  return inheritFrom&&type===element+' Attack'?weight/(1+Math.max(0,profile.attackPercent)):weight;
}

/** One multiplicative factor of the reference output (getBuildRVFactors); `value` is relative, only ratios matter. */
export type BuildRVFactorId='attack'|'attackPercent'|'damagePercent'|'crit'|'hp'|'hpPercent'|'resistance';
export interface BuildRVFactor {id:BuildRVFactorId;value:number}
/**
 * The output GRV weights are the log-derivatives of, with the given stats added to the profile (2026-10-09): DPS damage
 * `(B+F)(1+a+A)(1+d+D)(1+min(1,c+C/denom+Cr)k)`, healer ATK `(B+F)(1+a+A)`, tank effective HP
 * `(H+ΔH)(1+h+Δh)(1+(R+ΔR)(1+r+Δr)/K)`. Altered adds its own ATK after the source's percentages, so its ATK is one factor
 * `(B+F)(1+a+A)+A_alt`. `stats` are the counted stats of the track (the scorer's entries: one winner per rated family, so
 * another element's ATK never reaches here); stats the role does not rate (getBuildRatedWeight = 0) are skipped. The product of the factors is the
 * output; the ratio for two stat sets is the exact gain of the Gear Compare sheet ("swap the item, recompute the damage").
 */
export function getBuildRVFactors(stats:readonly {type:string;value:number}[],profile:BuildRVProfile,element:string,inheritFrom?:string,role:BuildRVRole='dps'):BuildRVFactor[] {
  const sum=(test:(type:string)=>boolean)=>stats.reduce((total,stat)=>total+(Number.isFinite(stat.value)&&test(stat.type)&&getBuildRatedWeight(stat.type,profile,element,inheritFrom,role)>0?stat.value:0),0);
  if(role==='tank') {
    const R=profile.resistance??0,r=profile.resistancePercent??0,H=profile.hp??0,h=profile.hpPercent??0,K=profile.resistanceConstant??0;
    const resistance=R+sum(type=>type==='Resistance'||type===element+' Resistance'),percent=r+sum(type=>type===element+' Resistance %');
    return [{id:'hp',value:H+sum(type=>type==='HP')},{id:'hpPercent',value:1+h+sum(type=>type==='HP %')},{id:'resistance',value:K>0?1+resistance*(1+percent)/K:1}];
  }
  const {flatAttack:B,attackPercent:a,damagePercent:d,critChance:c,critDamageBonus:k,critDenominator:denom}=profile;
  const own=(type:string)=>!!inheritFrom&&type===element+' Attack';
  const flat=B+sum(type=>!own(type)&&(type==='Attack'||type.endsWith(' Attack'))),percent=1+a+sum(type=>type==='Attack %'||type.endsWith(' Attack %'));
  const support=profile.postPercentAttack??0;
  const attack:BuildRVFactor[]=inheritFrom?[{id:'attack',value:flat*percent+support+sum(own)},{id:'attackPercent',value:1}]:[{id:'attack',value:flat+support/percent},{id:'attackPercent',value:percent}];
  if(role==='healer')return attack;
  const chance=Math.min(1,c+(denom>0?sum(type=>type==='Crit')/denom:0)+sum(type=>type==='Crit Rate %'));
  return [...attack,{id:'damagePercent',value:1+d+sum(type=>type==='Damage %'||type.endsWith(' Damage %'))},{id:'crit',value:1+chance*k}];
}

/**
 * Slot ceiling that includes the stats Titan adds (tank). Titan adds up to `maxAddedStats` stats from the pools of the
 * most-rolled ("primary") stat (getBuildAugmentPools): its unused priority stats fill the slots first, the fallback list
 * (HP, resistances) only the slots left (it opens when fewer than two priority stats are unused), and never a stat already among the random stats. An added
 * HP or resistance carries the primary's rolls into its own range, so it can be far larger than the same stat rolled
 * on top (e.g. Crit with five rolls on top → HP below). Every top set and primary is tried, with all rolls on the
 * primary and the two best allowed additions; the best total is the ceiling. Results are cached per weight set.
 */
const titanCeilingCache=new Map<string,{maximum:number;initial:number;rows:{type:string;rolls:number;before:number;value:number;rv:number}[];added:{type:string;value:number;rv:number}[]}>();
function getBuildTitanCeiling(types:Record<string,BuildStatBounds>,growth:BuildTitanGrowth,allowedTypes:string[],maxStats:number,maxRolls:number,unit:(type:string)=>number,rolledType?:string) {
  const candidates=allowedTypes.filter(type=>types[type]);
  const key=JSON.stringify([candidates,maxStats,maxRolls,rolledType,candidates.map(type=>unit(type)),Object.keys(types).filter(type=>/ Resistance$|^HP$|^Resistance$/.test(type)).map(type=>unit(type))]);
  const cached=titanCeilingCache.get(key);if(cached)return cached;
  const rv=(type:string,value:number|null|undefined)=>{const size=unit(type);return size>0&&value!==null&&value!==undefined?100*value/size:0;};
  let best={maximum:0,initial:0,rows:[] as {type:string;rolls:number;before:number;value:number;rv:number}[],added:[] as {type:string;value:number;rv:number}[]};
  const combine=(pool:string[],size:number):string[][]=>size===0?[[]]:pool.flatMap((type,i)=>combine(pool.slice(i+1),size-1).map(rest=>[type,...rest]));
  for(const primary of rolledType&&candidates.includes(rolledType)?[rolledType]:candidates)for(const others of combine(candidates.filter(type=>type!==primary),Math.max(0,maxStats-1))) {
    const top=[primary,...others];
    const rows=top.map((type,i)=>({type,beforeTitan:types[type]!.randomStatDefaultValue+(i===0?maxRolls*types[type]!.randomStatMaxRollValue:0)}));
    const projection=getBuildTitanProjection(rows,types,growth,0);
    const topRows=rows.map((row,i)=>{const value=projection.random[i]??getBuildStatMaximum(row.beforeTitan,0,types[row.type]!).titan;return {type:row.type,rolls:i===0?maxRolls:0,before:row.beforeTitan,value,rv:rv(row.type,value)};});
    // Fill order of the source (getMaxTitanGear): the primary's unused priority stats first, the fallback list only
    // for the slots priority cannot fill. The ideal takes the best stats each list allows (rated or not, they take a slot).
    const pools=getBuildAugmentPools(rows,growth,0);
    const scored=(list:string[])=>list.map(type=>{const value=projection.added(type);return {type,value:value??0,rv:rv(type,value)};}).sort((a,b)=>b.rv-a.rv);
    const fromPriority=scored(pools.priority).slice(0,growth.maxAddedStats);
    const added=[...fromPriority,...scored(pools.fallback).slice(0,growth.maxAddedStats-fromPriority.length)].filter(item=>item.rv>0);
    const initial=topRows.reduce((sum,row)=>sum+(row.rolls?0:row.rv),0);
    const maximum=topRows.reduce((sum,row)=>sum+row.rv,0)+added.reduce((sum,item)=>sum+item.rv,0);
    if(maximum>best.maximum)best={maximum,initial,rows:topRows,added};
  }
  if(titanCeilingCache.size>500)titanCeilingCache.clear();
  titanCeilingCache.set(key,best);
  return best;
}

/** Full-Titan potential. A supplied profile uses damage weights; omitted profiles retain legacy units. */
export function getBuildRollValue({rows,types,growth,element,percentElements,includeCrit,allowedTypes,stars,maxStats,maxRolls,profile,inheritFrom,flatElements,role='dps'}:{
  rows:BuildRandomStat[];types:Record<string,BuildStatBounds>;growth:BuildTitanGrowth;element:string;
  percentElements:string[];includeCrit:boolean;allowedTypes:string[];stars:number;maxStats:number;maxRolls:number;profile?:BuildRVProfile;inheritFrom?:string;flatElements?:string[];role?:BuildRVRole;
}) {
  const families=getBuildRatedFamilies(element,percentElements,includeCrit,growth,inheritFrom,role,flatElements);
  const weightOf=(type:string)=>getBuildRatedWeight(type,profile!,element,inheritFrom,role);
  // One candidate per family (duo percent types share bounds, the first element wins).
  const canonical=inheritFrom||role!=='dps'?families.map(family=>family[0]!):[...(growth.universalAttackElements.includes(element)?['Attack']:[]),(flatElements?.[0]??element)+' Attack',element+' Attack %',element+' Damage %',...(includeCrit?['Crit','Crit Rate %']:[])];
  // DPS keeps the catalog-wide Q; healer and tank use the best roll of the stats they rate.
  const normalization=profile?Math.max(0,...Object.entries(types).map(([type,bounds])=>{
    const value=bounds.randomStatMaxRollValue*(1+bounds.maxAugmentIncreaseMultiplier);
    return value*(role==='dps'?getBuildRVWeight(type,profile)*getBuildCritContributionScale([{type,value}],profile):families.some(family=>family.includes(type))?weightOf(type):0);
  })):0;
  const unit=(type:string)=>{
    if(profile){const weight=weightOf(type);return weight>0?normalization/weight:0;}
    const reference=types[type==='Attack'?element+' Attack':type];
    return reference?reference.randomStatMaxRollValue*(1+reference.maxAugmentIncreaseMultiplier):0;
  };
  const eligible=canonical.filter(type=>allowedTypes.includes(type)&&unit(type)>0);
  const presence=(type:string)=>100*getBuildStatMaximum(types[type].randomStatDefaultValue,0,types[type]).titan/unit(type);
  // One winner per elemental family. Opposite duo-percent types have identical bounds.
  // Replacing a useful winner with an off-element source cannot beat its direct maximum.
  const increment=(type:string)=>100*types[type].randomStatMaxRollValue*(1+types[type].maxAugmentIncreaseMultiplier)/unit(type);
  // Choose presence and roll recipient in the same legal subset. In particular,
  // a personal profile must not combine four presences with a fifth roll type.
  const subsets:string[][]=[[]];
  for(const type of eligible)for(const set of subsets.slice())if(set.length<maxStats)subsets.push([...set,type]);
  const ceilings=subsets.map(set=>{
    if(!profile?.capCritContribution||role!=='dps') {
      const initial=set.reduce((sum,type)=>sum+presence(type),0);
      return {initial,maximum:initial+maxRolls*Math.max(0,...set.map(increment))};
    }
    return cappedRollAllocation(set,types,maxRolls,unit,profile);
  });
  // A tank's ceiling counts the HP and resistances Titan adds below (getBuildTitanCeiling); other roles keep the
  // rated-stats-only ceiling (their added stats are mostly other elements' ATK% or DMG%).
  const {initial,maximum}=role==='tank'&&profile?getBuildTitanCeiling(types,growth,allowedTypes,maxStats,maxRolls,unit)
    :ceilings.reduce((best,next)=>next.maximum>best.maximum?next:best,{initial:0,maximum:0});
  const missing=rows.length!==maxStats||rows.some(row=>!row.type||row.beforeTitan===null);
  const valid=!missing&&new Set(rows.map(row=>row.type)).size===rows.length&&rows.every(row=>allowedTypes.includes(row.type))&&enumerateBuildRolls(rows,types,stars,maxRolls).length>0;
  function evaluate(currentRows:BuildRandomStat[],projectionStars=stars) {
    const rows=currentRows;
    const primaries=getBuildTitanPrimaries(rows,types);
    const variants=(primaries.length?primaries:[-1]).map(primary=>{
      const projection=getBuildTitanProjection(rows,types,growth,primary);
      const entries=rows.map(row=>({type:row.type,source:row.type,added:false,useful:false,value:0,maximumRoll:unit(row.type),maximumRV:0,rv:0}));
      for(const family of families) {
        const candidates=family.flatMap(type=>{
          const i=rows.findIndex(row=>row.type===type);
          const value=i>=0?projection.random[i]:projectionStars===maxRolls?projection.added(type):null;
          return value===null||value===undefined||unit(type)<=0?[]:[{type,value,i}];
        }).sort((a,b)=>b.value-a.value||family.indexOf(a.type)-family.indexOf(b.type));
        const winner=candidates[0];if(!winner)continue;
        const bounds=types[winner.type];
        const maximumValue=getBuildStatMaximum(bounds.randomStatDefaultValue+maxRolls*bounds.randomStatMaxRollValue,0,bounds).titan;
        const maximumRV=100*maximumValue*(profile?getBuildCritContributionScale([{type:winner.type,value:maximumValue}],profile):1)/unit(winner.type);
        const entry={type:winner.type,source:winner.i>=0?projection.sources[winner.i]:rows[primary].type,added:winner.i<0,useful:true,value:winner.value,maximumRoll:unit(winner.type),maximumRV,rv:100*winner.value/unit(winner.type)};
        if(winner.i>=0)entries[winner.i]=entry;else entries.push(entry);
      }
      const counted=capCritEntries(entries,profile);
      return {entries:counted,value:counted.reduce((n,entry)=>n+entry.rv,0),unsupported:projection.random.some(v=>v===null)};
    }).sort((a,b)=>a.value-b.value);
    const result=variants[0];
    const conservative=variants.some(variant=>Math.abs(variant.value-result.value)>1e-8);
    return {...result,conservative};
  }
  const result=evaluate(rows),conservative=result.conservative;
  return {value:valid&&!result.unsupported&&(!profile||normalization>0)?result.value:null,maximum,initial,normalization,entries:result.entries,conservative,
    reason:missing?'missing':!valid?'invalid':result.unsupported?'unsupported':null} as const;
}

/**
 * Current-value GRV: the families, units and slot ceiling of getBuildRollValue, read from the values an item has now
 * (its random stats and the stats Titan added) instead of a full-Titan projection from pre-Titan values. Titan growth
 * is random per stat (79–99 % of the maximum on 144 captured stats), so pre-Titan values cannot
 * be recovered from someone else's profile; this score needs none.
 */
export function getBuildCurrentValue({rows,added,types,growth,element,percentElements,includeCrit,allowedTypes,maxStats,maxRolls,profile,inheritFrom,flatElements,role='dps',ceiling:knownCeiling}:{
  rows:{type:string;value:number}[];added:{type:string;value:number}[];types:Record<string,BuildStatBounds>;growth:BuildTitanGrowth;
  element:string;percentElements:string[];includeCrit:boolean;allowedTypes:string[];maxStats:number;maxRolls:number;profile:BuildRVProfile;inheritFrom?:string;flatElements?:string[];role?:BuildRVRole;
  /** A batch scorer may reuse the ceiling for exactly the same reference, slot types, track and role. */
  ceiling?:{maximum:number;normalization:number};
}) {
  const ceiling=knownCeiling??getBuildRollValue({rows:[],types,growth,element,percentElements,includeCrit,allowedTypes,stars:maxRolls,maxStats,maxRolls,profile,inheritFrom,flatElements,role});
  const unit=(type:string)=>{const weight=getBuildRatedWeight(type,profile,element,inheritFrom,role);return weight>0&&ceiling.normalization>0?ceiling.normalization/weight:0;};
  const all=[...rows.map(row=>({...row,added:false})),...added.map(row=>({...row,added:true}))];
  const families=getBuildRatedFamilies(element,percentElements,includeCrit,growth,inheritFrom,role,flatElements);
  const entries=capCritEntries(families.flatMap(family=>{
    const winner=all.filter(stat=>family.includes(stat.type)&&unit(stat.type)>0&&Number.isFinite(stat.value)&&stat.value>0)
      .sort((a,b)=>b.value-a.value||family.indexOf(a.type)-family.indexOf(b.type))[0];
    return winner?[{type:winner.type,added:winner.added,value:winner.value,rv:100*winner.value/unit(winner.type)}]:[];
  }),profile);
  // normalization: local weighted maximum-roll scale. Σ value × weight approximates log-output gain.
  return {value:entries.reduce((sum,entry)=>sum+entry.rv,0),maximum:ceiling.maximum,entries,normalization:ceiling.normalization};
}

/**
 * The perfect item of a slot for a track, as the GRV ceiling defines it: the best legal set of rated stats, every roll
 * on the stat with the largest per-roll value, each stat at its full-Titan value `T(v) = v·(1+m)+f`. Its current-value
 * GRV equals `getBuildRollValue(...).maximum` (100 %).
 */
export function getBuildIdealItem({types,growth,element,percentElements,includeCrit,allowedTypes,maxStats,maxRolls,profile,inheritFrom,flatElements,role='dps',rolledType}:{
  types:Record<string,BuildStatBounds>;growth:BuildTitanGrowth;element:string;percentElements:string[];includeCrit:boolean;
  allowedTypes:string[];maxStats:number;maxRolls:number;profile:BuildRVProfile;inheritFrom?:string;flatElements?:string[];role?:BuildRVRole;
  /** Optional legal primary; other stats still maximize the rated initial values. */
  rolledType?:string;
}) {
  const ceiling=getBuildRollValue({rows:[],types,growth,element,percentElements,includeCrit,allowedTypes,stars:maxRolls,maxStats,maxRolls,profile,inheritFrom,flatElements,role});
  const unit=(type:string)=>{const weight=getBuildRatedWeight(type,profile,element,inheritFrom,role);return weight>0&&ceiling.normalization>0?ceiling.normalization/weight:0;};
  if(role==='tank') {
    // The tank's perfect item includes the stats Titan adds below (rated or not on top; unrated top stats are shown too).
    const titan=getBuildTitanCeiling(types,growth,allowedTypes,maxStats,maxRolls,unit,rolledType);
    // Top stats that add nothing (and are not the rolled primary) are free slots: any stat except HP and resistances.
    const stats=titan.rows.filter(row=>row.rv>0||row.rolls>0);
    return {stats,augments:titan.added,freeSlots:Math.max(0,maxStats-stats.length),maximum:ceiling.maximum};
  }
  // Same candidates as the ceiling: one type per family (duo percent types share bounds, the first element wins).
  const canonical=inheritFrom||role!=='dps'?getBuildRatedFamilies(element,percentElements,includeCrit,growth,inheritFrom,role,flatElements).map(family=>family[0]!):[...(growth.universalAttackElements.includes(element)?['Attack']:[]),(flatElements?.[0]??element)+' Attack',element+' Attack %',element+' Damage %',...(includeCrit?['Crit','Crit Rate %']:[])];
  const eligible=canonical.filter(type=>allowedTypes.includes(type)&&types[type]&&unit(type)>0);
  const primary=rolledType&&eligible.includes(rolledType)?rolledType:null;
  const presence=(type:string)=>100*getBuildStatMaximum(types[type]!.randomStatDefaultValue,0,types[type]!).titan/unit(type);
  const increment=(type:string)=>100*types[type]!.randomStatMaxRollValue*(1+types[type]!.maxAugmentIncreaseMultiplier)/unit(type);
  let best:{set:string[];maximum:number}={set:[],maximum:0};
  const subsets:string[][]=[[]];
  for(const type of eligible)for(const set of subsets.slice())if(set.length<maxStats)subsets.push([...set,type]);
  if(profile.capCritContribution&&role==='dps') {
    const allocation=subsets.filter(set=>!primary||set.includes(primary)).map(set=>cappedRollAllocation(set,types,maxRolls,unit,profile,primary))
      .reduce((best,next)=>next.maximum>best.maximum?next:best,{maximum:0,stats:[] as ReturnType<typeof cappedRollAllocation>['stats']});
    return {stats:allocation.stats,augments:[] as {type:string;value:number;rv:number}[],freeSlots:Math.max(0,maxStats-allocation.stats.length),maximum:ceiling.maximum};
  }
  for(const set of subsets) {
    if(primary&&!set.includes(primary))continue;
    const maximum=set.reduce((sum,type)=>sum+presence(type),0)+maxRolls*(primary?increment(primary):Math.max(0,...set.map(increment)));
    if(maximum>best.maximum)best={set,maximum};
  }
  const rolled=primary??best.set.reduce<string|null>((winner,type)=>winner===null||increment(type)>increment(winner)?type:winner,null);
  const stats=best.set.map(type=>{
    const bounds=types[type]!,rolls=type===rolled?maxRolls:0,before=bounds.randomStatDefaultValue+rolls*bounds.randomStatMaxRollValue;
    return {type,rolls,before,value:getBuildStatMaximum(before,0,bounds).titan,rv:presence(type)+rolls*increment(type)};
  });
  return {stats,augments:[] as {type:string;value:number;rv:number}[],freeSlots:Math.max(0,maxStats-stats.length),maximum:ceiling.maximum};
}
