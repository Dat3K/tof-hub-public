import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import {useBuildEditable,useBuildEditing} from './build-editing';
import {Inspect} from './build-inspection';
import {ConsumableExpiry} from './consumable-expiry';
import {GameRichText} from '@tof-hub/ui';
import {buildInfoHref} from './info-link';
import {RelicEffects,RelicHeading} from './relic-effects';
import {Stars} from './stars';
import {buildRole,enhancementShotBonuses,attackPercentContributions} from './model';
import {EnhancementBonuses,attackPercentBonusText} from './stat-bonuses';
import {StatLink,statInspectTypes,ENHANCEMENT_SOURCES,CRIT_SOURCES,HP_SOURCES,RESISTANCE_SOURCES,resistanceSourceKey,resistanceSourceKeys,DAMAGE_SOURCES,ATTACK_SOURCES,ATTACK_PERCENT_SOURCES,CS_TOTAL,useActiveStatKeys} from './stat-highlight';
import {elementLabel,formatValue} from './presentation';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';

type LoadoutProps={draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale};
export function RelicSystem({draft,catalog,locale}:LoadoutProps) {
  const edit=useBuildEditable();
  const {locked}=useBuildEditing();
  const activeStats=useActiveStatKeys();
  const resistanceHovered=activeStats.some(stat=>stat===RESISTANCE_SOURCES||stat.startsWith(`${RESISTANCE_SOURCES}:`)||stat==='Resistance'||stat.endsWith(' Resistance')||stat.endsWith(' Resistance %'));
  const damageHovered=activeStats.some(stat=>stat===DAMAGE_SOURCES||stat==='Damage %'||stat.endsWith(' Damage %'));
  const tank=buildRole(draft)==='tank';
  const showResistance=(tank||resistanceHovered)&&!damageHovered;
  return <div className="system relic-system"><h3><span>{localeText(locale)('Relics')}</span><small>{showResistance?'RES% A4':'DMG% A4'}</small></h3><div className="relic-loadout"><StatLink types={[]} inspectTypes={[]}><div className="compact-relics">{draft.relics.map((relic,index)=>{
      const item=catalog.relics.find(item=>item.id===relic.id);
      return <div key={index} className="compact-relic" {...edit(`relic:${index}`,'area')}>
        {item?<Inspect title={localized(item.name, locale)} infoHref={buildInfoHref('relic',item.id)} heading={<RelicHeading name={localized(item.name, locale)} stars={relic.stars}/>} tooltipDetails={<RelicEffects item={item} stars={relic.stars} locale={locale}/>} details={<RelicEffects item={item} stars={relic.stars} locale={locale}/>}><img src={item.icon} alt=""/></Inspect>:<span className="compact-empty" {...edit(`relic:${index}`)}>{locked?'—':'+'}</span>}
        {(item||!locked)&&<div className="compact-relic-label"><b data-hint-overflow {...edit(`relic:${index}`)}>{localized(item?.name, locale)||'—'}</b><span className="relic-rank" {...edit(`relic-stars:${index}`)}><Stars value={relic.stars}/></span></div>}
      </div>;
    })}</div></StatLink>{(()=>{
      // Relic A4: a unique per-element relic stat. A tank card shows RES% A4 (Altered included), others DMG% A4.
      const elements=Object.keys(catalog.elementIcons).filter(element=>showResistance||element!=='Altered');
      return <div className="relic-damage" data-tank-icons={showResistance||undefined} style={{gridTemplateRows:`repeat(${elements.length},1fr)`}} aria-label={showResistance?(localeText(locale)('Relic A4 resistance', 'Сопротивление от реликвий A4')):(localeText(locale)('Relic A4 damage'))}>{elements.map(element=>{
      const value=showResistance?(draft.relicResistance?.[element]??0):(draft.relicDamage?.[element]??0);
      const label=`${elementLabel(element,locale)} · ${showResistance?(localeText(locale)('Relic A4 RES %')):(localeText(locale)('Relic A4 DMG %'))}`;
      const icon=(showResistance?catalog.resistanceIcons[element]?.icon:undefined)??catalog.elementIcons[element]?.icon;
      const isSource=showResistance||value>0;
      const resistanceSource=showResistance?resistanceSourceKey(element):undefined;
      const sourceChannel=showResistance?resistanceSource!:DAMAGE_SOURCES;
      const sourceBonus=isSource?`${showResistance?'RES%':'DMG%'}: +${formatValue(value,true,locale,1)}`:undefined;
      return <StatLink key={element} types={showResistance?(isSource?[`Relic A4: ${element}`,`Relic A4 resistance: ${element}`,`${element} Resistance`,resistanceSource!]:[`Relic A4: ${element}`,`Relic A4 resistance: ${element}`]):(isSource?[`Relic A4: ${element}`,`${element} Damage %`,DAMAGE_SOURCES]:[`Relic A4: ${element}`,`${element} Damage %`])} inspectTypes={showResistance?[]:statInspectTypes(`${element} Damage %`)} sourceChannel={sourceChannel} sourceBonuses={{[sourceChannel]:sourceBonus,...(!showResistance?{[`${element} Damage %`]:sourceBonus}:{})}}><span className="relic-damage-value" aria-label={label} {...edit(`${showResistance?'relic-resistance':'relic-damage'}:${element}`)}><img src={icon} alt={elementLabel(element,locale)} data-resistance-element={showResistance?element:undefined}/><b>{formatValue(value,true,locale,1)}</b></span></StatLink>;
    })}</div>;})()}</div></div>;
}

export function ConsumableSystem({draft,catalog,locale}:LoadoutProps) {
  const edit=useBuildEditable();
  const {locked}=useBuildEditing();
  const enhancement=enhancementShotBonuses(draft,catalog);
  const selected=catalog.consumables.map((group,index)=>({group,index,item:group.items.find(item=>item.id===draft.consumables?.[index])})).filter(slot=>!locked||slot.item);
  return <div className="system consumable-system"><h3>{localeText(locale)('Consumables', 'Расходники')}</h3>{locked&&!selected.length?<p className="consumable-empty">{localeText(locale)('Nothing', 'Ничего')}</p>:<div className="consumable-slots" data-count={selected.length}>{selected.map(({group,index,item})=>{
      const expiresAt=group.id!=='food'&&item?draft.consumableExpiresAt?.[item.id]:undefined;
      const details=group.id==='enhancement'||expiresAt?<>{/* The Enhancement Shot's game text says "max stars"; its real effect is listed below as computed gains. */}{expiresAt&&item?.description&&group.id!=='enhancement'&&<GameRichText density="compact" text={localized(item.description, locale)}/ >}{group.id==='enhancement'&&<><EnhancementBonuses stats={enhancement.total} catalog={catalog} locale={locale}/>{enhancement.total.length===0&&<span>+0</span>}</>}{expiresAt&&<ConsumableExpiry expiresAt={expiresAt} locale={locale}/>}</>:undefined;
      const percent=attackPercentContributions(item?.attackPercentBonuses,0,catalog);
      const percentKeys=percent.flatMap(b=>b.elements.map(element=>`${element} Attack %`));
      const flat=item?.flatAttackBonuses??[];
      const flatKeys=flat.flatMap(b=>(b.elements==='all'?Object.keys(catalog.elementIcons):b.elements).map(element=>`${element} Attack`));
      const critBonus=group.id==='enhancement'&&item?`${localeText(locale)('Crit')}: +${formatValue(enhancement.total.find(s=>s.id==='crit')?.value??0,false,locale)}`:undefined;
      const hpBonus=group.id==='enhancement'&&item?`HP: +${formatValue(enhancement.total.find(s=>s.id==='hp')?.value??0,false,locale)}`:undefined;
      const resistanceBonus=group.id==='enhancement'&&item?`${localeText(locale)('Resistance', 'Сопротивление')}: +${formatValue(enhancement.total.find(s=>s.id==='resistance')?.value??0,false,locale)}`:undefined;
      const attackValue=group.id==='enhancement'&&item?enhancement.total.find(s=>s.id==='attack')?.value??0:flat.reduce((sum,b)=>sum+b.value,0);
      const attackBonus=(group.id==='enhancement'&&item)||attackValue>0?`ATK: +${formatValue(attackValue,false,locale)}`:undefined;
      const resistanceKeys=group.id==='enhancement'&&item?resistanceSourceKeys(Object.keys(catalog.elementIcons)):[];
      const hasCS=group.id==='enhancement'&&item&&enhancement.combatScore!==null;
      const csBonus=hasCS?`CS: ${formatValue(enhancement.combatScore!,false,locale)}`:undefined;
      return <StatLink key={group.id} types={[...(hasCS?[CS_TOTAL]:[]),...(group.id==='enhancement'&&item?[ENHANCEMENT_SOURCES,CRIT_SOURCES,HP_SOURCES,ATTACK_SOURCES,...resistanceKeys]:[]),...flatKeys,...percentKeys]} inspectTypes={group.id==='enhancement'&&item?[ENHANCEMENT_SOURCES]:[]} sourceBonuses={{[CS_TOTAL]:csBonus,[CRIT_SOURCES]:critBonus,...Object.fromEntries(resistanceKeys.map(key=>[key,resistanceBonus])),[HP_SOURCES]:hpBonus,[ATTACK_SOURCES]:attackBonus,[ATTACK_PERCENT_SOURCES]:percent.length?attackPercentBonusText(percent,locale):undefined}} sourceChannel={[ENHANCEMENT_SOURCES,...resistanceKeys]}><div className="consumable-slot" data-consumable-slot={group.id}>
      {item?<Inspect title={localized(item.name, locale)} description={localized(item.description, locale)} tooltipDetails={details} details={details} editTarget={`consumable:${index}`} infoHref={`/info/food/#${encodeURIComponent(item.id)}`}><img src={item.icon} alt=""/></Inspect>:<span className="compact-empty" data-hint={localized(group.name, locale)} {...edit(`consumable:${index}`)}>+</span>}
    </div></StatLink>;
    })}</div>}</div>;
}
