/**
 * MMO Build card rules over the generated catalog (game-data/build-mmo-page.json, scripts/generators/build-mmo-card.cjs).
 * Provenance and the unresolved parts: docs/imports.md.
 */
export type MmoCurve = readonly (readonly [number, number])[];

/** UE linear curve with constant extrapolation, as the card and threshold curve rows declare. */
export function evaluateMmoCurve(keys:MmoCurve,time:number):number|null {
  if(!keys.length)return null;
  if(time<=keys[0]![0])return keys[0]![1];
  for(let index=1;index<keys.length;index++) {
    const [t1,v1]=keys[index]!,[t0,v0]=keys[index-1]!;
    if(time<=t1)return v0+(v1-v0)*(time-t0)/(t1-t0);
  }
  return keys.at(-1)![1];
}

/**
 * Expansion-card text parameters: {n} = Value × curve(equipped cards of that pack). Verified against the in-game
 * Charge (29.638% at 4 cards) and Stable DMG (8.4% at 4 cards) texts; card stars do not select another row.
 */
export function mmoCardParams(params:readonly {value:number;curve:MmoCurve|null}[],equipped:number):(number|null)[] {
  return params.map(param=>{
    const value=param.curve?evaluateMmoCurve(param.curve,equipped):null;
    // Half-up to three decimals as the game text shows (29.6375 → 29.638); the epsilon absorbs float error.
    return value===null?null:Math.round(param.value*value*1000+1e-6)/1000;
  });
}

/** Fills {n} with resolved parameters; an unresolved one keeps its placeholder (shown as a dash by GameRichText). */
export function fillMmoText(text:string,params:readonly (number|null)[]):string {
  return text.replace(/\{(\d+)\}/g,(match,index:string)=>{
    const value=params[Number(index)];
    return value===null||value===undefined?match:String(value);
  });
}

/** Random-stat sums by quality-suffixed property, the inputs of the seasonal threshold tracks. */
export function mmoRandomStatTotals(rolls:readonly {prop:string;value:number|null}[]):Record<string,number> {
  const totals:Record<string,number>={};
  for(const roll of rolls)if(roll.prop&&roll.value!==null)totals[roll.prop]=(totals[roll.prop]??0)+roll.value;
  return totals;
}

/** Number of reached threshold levels (0 = none) for one track. */
export function mmoThresholdLevel(levels:readonly {value:number}[],total:number):number {
  let reached=0;
  for(const level of levels)if(total>=level.value-1e-9)reached++;
  return reached;
}

/**
 * Expansion-card base stats: the star row's per-level factor × the attribute's level coefficient curve
 * (DT_MMOEquipmentSlotSkillAttribute × DT_MMOEquipmentSlotSkillCoefficient). The level input is a model (player level).
 */
export function mmoCardStats(stats:readonly {prop:string;values:readonly number[]}[],stars:number,coefficients:Readonly<Record<string,MmoCurve>>,level:number) {
  return stats.map(stat=>{
    const factor=stat.values[Math.min(Math.max(0,stars),stat.values.length-1)]??null;
    const coefficient=coefficients[stat.prop]?evaluateMmoCurve(coefficients[stat.prop]!,level):null;
    return {prop:stat.prop,value:factor===null||coefficient===null?null:factor*coefficient};
  });
}
