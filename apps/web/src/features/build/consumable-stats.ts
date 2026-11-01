import {enhancementShotBonuses} from './loadout-stats';
import {attackPercentContributions} from './matrix-attack';
import {estimatedResistancePercent,gearPercentTotal} from './resistance-stats';
import type {BuildCatalog,BuildDraft,ConsumableStatsApplied} from './types';

/** First-received and manual inputs precede selected consumables. Derived totals retain their applied gains. */
export function applyConsumableStats(draft:BuildDraft,catalog:BuildCatalog):BuildDraft {
  const index=catalog.consumables.findIndex(group=>group.id==='enhancement');
  const selectedShot=index>=0&&catalog.consumables[index].items.some(item=>item.id===draft.consumables?.[index]);
  const previous=draft.combat.consumableStatsApplied;
  const flatBonuses=catalog.consumables.flatMap((group,index)=>group.items.find(item=>item.id===draft.consumables?.[index])?.flatAttackBonuses??[]);
  const percentBonuses=catalog.consumables.flatMap((group,index)=>group.items.find(item=>item.id===draft.consumables?.[index])?.attackPercentBonuses??[]);
  const native=catalog.reference.titanGrowth.universalAttackElements;
  // Universal ATK% modifies the native attributes; Altered inherits their boosted final ATK once.
  const percents=attackPercentContributions(percentBonuses.map(bonus=>bonus.elements==='all'?{...bonus,elements:native}:bonus),0,catalog).filter(bonus=>!bonus.conditional);
  const selected=selectedShot||percents.length>0||flatBonuses.length>0;
  if(!selected&&!previous)return draft;
  const bonuses=selectedShot?enhancementShotBonuses(draft,catalog):null;
  const gain=(id:string)=>bonuses?.total.find(stat=>stat.id===id)?.value??0;
  const attackPercent=Object.fromEntries(draft.combat.elements.map(element=>[element.id,
    percents.filter(bonus=>bonus.elements.includes(element.id)).reduce((sum,bonus)=>sum+bonus.value,0)]));
  const postPercentElementAttack=Object.fromEntries(draft.combat.elements.map(element=>[element.id,element.id==='Altered'?0:
    flatBonuses.filter(bonus=>bonus.elements==='all'?native.includes(element.id):bonus.elements.includes(element.id)).reduce((sum,bonus)=>sum+bonus.value,0)]));
  const baseCS=previous?.baseCS??draft.profile.cs??null;
  const capturedCS=draft.captureSource?.capture.profile.cs;
  const rawCS=previous?previous.rawCS:capturedCS!=null&&baseCS===Math.floor(capturedCS)?capturedCS:baseCS;
  const next:ConsumableStatsApplied={attack:gain('attack'),hp:gain('hp'),crit:gain('crit'),resistance:gain('resistance'),attackPercent,postPercentElementAttack,
    combatScore:bonuses?.combatScore??(selectedShot?null:0),baseCS,rawCS};
  if(selected&&previous&&!previous.elementAttack&&(['attack','hp','crit','resistance','combatScore'] as const).every(key=>next[key]===previous[key])&&Object.entries(attackPercent).every(([element,value])=>value===(previous.attackPercent?.[element]??0))&&Object.entries(postPercentElementAttack).every(([element,value])=>value===(previous.postPercentElementAttack?.[element]??0)))return draft;
  const difference=(key:'attack'|'hp'|'crit'|'resistance')=>next[key]-(previous?.[key]??0);
  const hpPercent=draft.combat.hpPercent??gearPercentTotal(draft,['HP %']);
  const combat={...draft.combat,
    hp:draft.combat.hp>0?draft.combat.hp+difference('hp')*(1+hpPercent):draft.combat.hp,crit:draft.combat.crit+difference('crit'),
    elements:draft.combat.elements.map(element=>{
      const percent=element.resistancePercent??estimatedResistancePercent(draft,element.id,catalog);
      return {...element,attack:element.id==='Altered'||element.attack<=0?element.attack:element.attack+difference('attack')-(previous?.elementAttack?.[element.id]??0),
        attackPercent:element.attackPercent===undefined?undefined:element.attackPercent+attackPercent[element.id]-(previous?.attackPercent?.[element.id]??0),
        resistance:element.resistance===null||element.resistance<=0?element.resistance:element.resistance+difference('resistance')*(1+percent)};
    })};
  if(selected)combat.consumableStatsApplied=next;
  else delete combat.consumableStatsApplied;
  const cs=selected?(rawCS===null||next.combatScore===null?null:Math.floor(rawCS+next.combatScore)):baseCS;
  return {...draft,profile:{...draft.profile,cs},combat};
}
