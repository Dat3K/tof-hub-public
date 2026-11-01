'use client';
import {localized,localizedUi} from '@tof-hub/i18n';
import {Button} from '@tof-hub/ui';
import {localeText} from '@/lib/i18n/text';
import {Field,IconPick,NumberField,Pick} from '../build-fields';
import {formatValue} from '../presentation';
import type {BuildLocale,CatalogItem} from '../types';
import {emptyMmoGear,mmoAttribute,mmoGearItem,mmoRollRange,selectMmoGear} from './model';
import type {MmoBuildChange} from './mmo-build-editor';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';
import styles from '../build.module.css';

/** The same slot editor in the card dialog and the advanced form. Expansion belongs to the slot, even without gear. */
export function MmoGearEditor({draft,catalog,locale,change,slotId,onChoose}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;change:MmoBuildChange;slotId:string;onChoose?:(kind:'item'|'card')=>void}) {
  const t=localeText(locale),slot=catalog.slots.find(entry=>entry.id===slotId)!;
  const gear=draft.gear[slotId]??emptyMmoGear(),item=mmoGearItem(catalog,gear.itemId);
  const card=catalog.cards.find(entry=>entry.id===gear.card?.id);
  const items:CatalogItem[]=catalog.gear.filter(entry=>entry.slot===slotId).map(entry=>({id:entry.id,name:entry.name??{en:entry.id,ru:entry.id},icon:entry.icon??''}));
  const cards:CatalogItem[]=catalog.cards.filter(entry=>entry.slots.includes(slotId)).map(entry=>({id:entry.id,name:entry.name??{en:entry.id,ru:entry.id},icon:entry.icon??''}));
  const pool=item?.pool?catalog.pools[item.pool]??[]:[];
  const setCard=(id:string)=>change(next=>{next.gear[slotId]??=emptyMmoGear();next.gear[slotId]!.card=id?{id,stars:0}:null;});
  return <div className={styles.gearEditor} aria-label={localizedUi(slot.name,locale)||slotId}>
    <div className={styles.weaponFields}>
      {onChoose?<Field label={t('Item','Предмет')}><Button variant="outline" onClick={()=>onChoose('item')}>{localized(item?.name,locale)||t('Choose equipment','Выбрать экипировку')}</Button></Field>
        :<Pick label={t('Item','Предмет')} items={items} value={gear.itemId} locale={locale} onChange={id=>change(next=>{selectMmoGear(next,slotId,id,catalog);})}/>}
      {onChoose?<Field label={localized(catalog.labels.expansionStats,locale)}><Button variant="outline" onClick={()=>onChoose('card')}>{localized(card?.name,locale)||t('Choose expansion card','Выбрать карту расширения')}</Button></Field>
        :<Pick label={localized(catalog.labels.expansionStats,locale)} items={cards} value={gear.card?.id??''} locale={locale} onChange={setCard}/>}
      {card&&<NumberField label={t('Card stars')} value={gear.card!.stars} max={card.maxStars} onChange={n=>change(next=>{next.gear[slotId]!.card!.stars=n??0;})}/>}
    </div>
    {item&&<>
      <p className={styles.note}>T{item.grade} · {localized(catalog.labels.equipmentTier,locale)} {item.tier}</p>
      <div className={styles.alignedBonusRows}>{item.base.map(stat=><div key={stat.prop} className={styles.detailRow}><strong>{localized(mmoAttribute(catalog,stat.prop)?.name,locale)||stat.prop}</strong><span>{formatValue(stat.value,!!mmoAttribute(catalog,stat.prop)?.percent,locale,2)}</span></div>)}</div>
      <h3>{localized(catalog.labels.randomStats,locale)}</h3>
      <p className={styles.note}>{t('Ranges describe the raw roll pool. Captured values may exceed them; keep the in-game value.','Диапазоны относятся к исходному пулу. Значение в захвате может быть выше — указывайте число из игры.')}</p>
      <div className={styles.matrixFields}>{gear.rolls.map((roll,index)=>{
        const range=mmoRollRange(catalog,roll.prop,item.quality),percent=!!mmoAttribute(catalog,roll.prop)?.percent;
        const options=pool.filter(prop=>prop===roll.prop||gear.rolls.filter((_,other)=>other!==index).filter(row=>row.prop===prop).length<(catalog.randomStats[prop]?.maxPerItem??1));
        return <div key={index}>
          <IconPick searchable tone="stat" label={`${localized(catalog.labels.randomStats,locale)} ${index+1}`} value={roll.prop} locale={locale}
            items={options.map(prop=>({id:prop,name:mmoAttribute(catalog,prop)?.name??{en:prop,ru:prop},icon:mmoAttribute(catalog,prop)?.icon??''}))}
            onChange={prop=>change(next=>{next.gear[slotId]!.rolls[index]={prop,value:prop?mmoRollRange(catalog,prop,item.quality)?.base??null:null};})}/>
          <NumberField label={t('Value')} value={roll.value} nullable percentage={percent} max={percent?10000:1e10} onChange={value=>change(next=>{next.gear[slotId]!.rolls[index]!.value=value;})}/>
          {range&&<p className={styles.note}>{t('Roll range')}: {formatValue(range.min,percent,locale,3)}–{formatValue(range.max,percent,locale,3)}</p>}
          <Button variant="ghost" size="sm" onClick={()=>change(next=>{next.gear[slotId]!.rolls.splice(index,1);})}>{t('Remove','Удалить')}</Button>
        </div>;
      })}</div>
      {gear.rolls.length<pool.length&&<Button variant="outline" size="sm" onClick={()=>change(next=>{next.gear[slotId]!.rolls.push({prop:'',value:null});})}>{t('Add random stat')}</Button>}
    </>}
  </div>;
}
