'use client';
import { localized, localizedUi, translateUiText} from '@tof-hub/i18n';
import {Button} from '@tof-hub/ui';
import {localeText} from '@/lib/i18n/text';
import type {ReactNode} from 'react';
import {Field,NumberField,Pick} from '../build-fields';
import {characterTitleLabel} from '../character-title';
import type {BuildLocale,CatalogItem,LocalizedName} from '../types';
import {mmoWeaponMaxStars,mmoPetModuleLimit,mmoPetModuleChoices} from './model';
import {MmoGearEditor} from './mmo-gear-editor';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';
import styles from '../build.module.css';

export type MmoBuildChange=(mutate:(draft:MmoBuildDraft)=>void)=>void;
const label=(value:LocalizedName|null|undefined,locale:BuildLocale,fallback:string)=>({en:value?.en||fallback,ru:value?.ru||value?.en||fallback});
function Group({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}) {
  return <details className={styles.group} open={open||undefined}><summary>{title}</summary><div className={styles.groupBody}>{children}</div></details>;
}

export type MmoEditorSection='profile'|'stats'|'weapons'|'gear'|'brainfield'|'pet'|'food'|'art';
export function MmoBuildEditor({draft,catalog,locale,change,section,brainfieldIndex,onChoose,onChooseModule}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;change:MmoBuildChange;section?:MmoEditorSection;brainfieldIndex?:number;onChoose?:(slot:string,kind:'item'|'card')=>void;onChooseModule?:(slot:number)=>void}) {
  const t=localeText(locale);
  const attributeName=(prop:string)=>localized(catalog.attributes[prop]?.name, locale)||prop;
  const stat=(prop:string)=><NumberField key={prop} label={attributeName(prop)} value={draft.stats[prop]??null} nullable percentage={catalog.attributes[prop]?.percent} max={catalog.attributes[prop]?.percent?100:1e10} onChange={n=>change(d=>{d.stats[prop]=n;})}/>;
  const weapons:CatalogItem[]=catalog.weapons.map(weapon=>({id:weapon.id,name:{en:`${weapon.weapon.en} · ${weapon.name.en}`,ru:`${weapon.weapon.ru} · ${weapon.name.ru}`},icon:weapon.icon??''}));
  const pets:CatalogItem[]=catalog.pets.map(pet=>({id:pet.id,name:label(pet.name,locale,pet.id),icon:pet.portrait||pet.icon||''}));
  const foods:CatalogItem[]=catalog.foods.map(food=>({id:food.id,name:food.name,icon:food.icon??''}));
  const potions:CatalogItem[]=catalog.potions.map(potion=>({id:potion.id,name:potion.atkPercent===null?potion.name:{en:`${potion.name.en} · ATK +${potion.atkPercent}%`,ru:`${potion.name.ru} · АТК +${potion.atkPercent}%`},icon:potion.icon??''}));
  const moduleLimit=mmoPetModuleLimit(draft,catalog);
  const moduleLoad=draft.pet?.modules?.some(row=>!catalog.petModules?.some(module=>module.id===row.id))?null:(draft.pet?.modules??[]).reduce((sum,row)=>sum+(catalog.petModules?.find(module=>module.id===row.id)?.load??0),0);
  return <section className={styles.editor} aria-label={t('MMO build editor')}>
    {(!section||section==='profile'||section==='art')&&<Group title={t('Profile & artwork')} open><div className={styles.profileFields}>
      {(['name','uid','crew'] as const).map((key,index)=><Field key={key} label={[t('Name'),'UID',t('Crew','Гильдия')][index]!}><input value={draft.profile[key]} maxLength={key==='uid'?32:120} onChange={e=>change(d=>{d.profile[key]=e.target.value;})}/></Field>)}
      <Field label={t('Character title')}><input value={characterTitleLabel(draft.profile.characterTitle,catalog,locale)} maxLength={120} onChange={e=>change(d=>{d.profile.characterTitle=e.target.value;})}/></Field>
      <NumberField label={t('Character level')} value={draft.profile.level} max={1000} onChange={n=>change(d=>{d.profile.level=n??0;})}/>
      <NumberField label={t('Current CS')} value={draft.profile.cs} nullable onChange={n=>change(d=>{d.profile.cs=n;})}/>
      <Field label={t('Season')}><select value={draft.profile.season??''} onChange={e=>change(d=>{d.profile.season=e.target.value?Number(e.target.value):null;})}><option value="">—</option>{catalog.seasons.map(season=><option key={season.index} value={season.index}>{localized(season.name, locale)||season.index}</option>)}</select></Field>
      <Pick label={t('Avatar')} items={catalog.avatars} locale={locale} value={draft.profile.avatarId} onChange={id=>change(d=>{d.profile.avatarId=id;})}/>
      <Pick label={t('Avatar frame')} items={catalog.avatarFrames} locale={locale} value={draft.profile.avatarFrameId} onChange={id=>change(d=>{d.profile.avatarFrameId=id;})}/>
      <Pick label={t('Background artwork')} items={catalog.artworks} locale={locale} value={draft.art.id} onChange={id=>change(d=>{d.art.id=id;})}/>
      <Field label={t('Profile signature')}><textarea value={draft.profile.signature} rows={2} maxLength={500} onChange={e=>change(d=>{d.profile.signature=e.target.value;})}/></Field>
      {(['zoom','x','y'] as const).map((key,index)=><Field key={key} label={[t('Art scale'),t('Horizontal position'),t('Vertical position')][index]!}><div className={styles.rangeControl}><input type="range" min={key==='zoom'?0.25:0} max={key==='zoom'?3:100} step={key==='zoom'?0.01:1} value={draft.art[key]} onChange={event=>change(next=>{next.art[key]=Number(event.target.value);})}/><output>{Math.round(draft.art[key]*(key==='zoom'?100:1))}%</output></div></Field>)}
    </div></Group>}
    {(!section||section==='stats')&&<Group title={t('Attributes')} open={!!section}><p className={styles.note}>{t('Enter the values of the in-game attribute screens; leave a field empty when it is unknown.')}</p>
      <fieldset className={styles.subgroup}><legend>{t('Special')}</legend><div className={styles.fields}>{[...catalog.panels.special,...catalog.panels.elements.flatMap(row=>[row.attack,row.resistance])].map(stat)}</div></fieldset>
      <fieldset className={styles.subgroup}><legend>{t('Basic')}</legend><div className={styles.fields}>{catalog.panels.basic.map(stat)}</div></fieldset></Group>}
    {(!section||section==='weapons')&&<Group title={t('Weapons')} open={!!section}><div className={styles.fields}><Field label={t('Weapon mode')}><select value={draft.weaponMode??''} onChange={e=>change(d=>{d.weaponMode=e.target.value==='fixed'||e.target.value==='regular'?e.target.value:null;})}>
      <option value="">—</option><option value="regular">{localized(catalog.labels.regularMode, locale)}</option><option value="fixed">{localized(catalog.labels.fixedMode, locale)}</option></select></Field></div>
      {draft.weapons.map((weapon,index)=><fieldset key={index} className={styles.subgroup}><legend>{t('Weapon')} {index+1}</legend><div className={styles.weaponFields}>
        <Pick label={t('Weapon')} items={weapons} locale={locale} value={weapon.id} onChange={id=>change(d=>{d.weapons[index]={id,stars:Math.min(d.weapons[index]!.stars,mmoWeaponMaxStars(catalog,id))};})}/>
        <NumberField label={t('Advancement +N')} value={weapon.stars} max={mmoWeaponMaxStars(catalog,weapon.id)} onChange={n=>change(d=>{d.weapons[index]!.stars=n??0;})}/></div></fieldset>)}</Group>}
    {(!section||section==='gear')&&<Group title={t('Equipment')} open={!!section}>{catalog.slots.map(slot=><fieldset key={slot.id} className={styles.subgroup}><legend>{localizedUi(slot.name,locale)||slot.id}</legend><MmoGearEditor draft={draft} catalog={catalog} locale={locale} change={change} slotId={slot.id} onChoose={onChoose?kind=>onChoose(slot.id,kind):undefined}/></fieldset>)}</Group>}
    {(!section||section==='brainfield')&&<Group title={translateUiText("Brainfield", locale)} open={!!section}>{catalog.brainfield.filter((_,index)=>brainfieldIndex===undefined||index===brainfieldIndex).map(chain=><fieldset key={chain.name.en} className={styles.subgroup}><legend>{localized(chain.name, locale)}</legend><div className={styles.fields}>{chain.nodes.map(node=>
      <NumberField key={node.id} label={`${localized(node.name, locale)||node.id}${node.kind==='attribute'?'':' ★'}`} value={draft.brainfield[node.id]??0} max={node.maxLevel} onChange={n=>change(d=>{if(n)d.brainfield[node.id]=n;else delete d.brainfield[node.id];})}/>)}</div></fieldset>)}</Group>}
    {(!section||section==='pet')&&<Group title={translateUiText("Smart Servant", locale)} open={!!section}><div className={styles.fields}>
      <Pick label={translateUiText('Smart Servant', locale)} items={pets} locale={locale} value={draft.pet?.id??''} onChange={id=>change(d=>{d.pet=id?{id,level:1,inheritedAttack:null}:null;})}/>
      {draft.pet&&<NumberField label={t('Level')} value={draft.pet.level} min={1} max={catalog.pets.find(pet=>pet.id===draft.pet!.id)?.levels.length??1} onChange={n=>change(d=>{d.pet!.level=n??1;})}/>}
      {draft.pet&&<NumberField label={t('Stars')} value={draft.pet.stars??0} max={catalog.pets.find(pet=>pet.id===draft.pet!.id)?.maxAdvance??0} onChange={n=>change(d=>{d.pet!.stars=n??0;const slots=catalog.petModuleLimits?.[d.pet!.id]?.[n??0]?.slots; if(slots!==undefined)d.pet!.modules=d.pet!.modules?.filter(row=>row.slot<slots);})}/>}
      {draft.pet&&<NumberField label={t('Inherited ATK (in-game +value)')} value={draft.pet.inheritedAttack} nullable onChange={n=>change(d=>{d.pet!.inheritedAttack=n;})}/>}
    </div>{draft.pet&&(moduleLimit?<><p className={styles.note}>{t('Module load','Нагрузка модулей')}: {moduleLoad??'—'} / {moduleLimit.load}</p><div className={styles.fields}>{Array.from({length:moduleLimit.slots},(_,slot)=>{
      const id=draft.pet!.modules?.find(row=>row.slot===slot)?.id??'',module=catalog.petModules?.find(entry=>entry.id===id),label=`${t('Module','Модуль')} ${slot+1}`;
      return onChooseModule?<Field key={slot} label={label}><Button variant="outline" onClick={()=>onChooseModule(slot)}>{localized(module?.name,locale)||id||t('Choose module','Выбрать модуль')}</Button></Field>:<Pick key={slot} label={label} value={id} locale={locale} items={mmoPetModuleChoices(draft,catalog,slot).map(entry=>({id:entry.id,name:entry.name??{en:entry.id,ru:entry.id},icon:entry.icon??''}))} onChange={id=>change(next=>{next.pet!.modules=(next.pet!.modules??[]).filter(row=>row.slot!==slot);if(id)next.pet!.modules.push({slot,id});})}/>;
    })}</div></>:<p className={styles.note}>{t('MMO Smart Servant module data is unavailable.','Данные модулей смарт-серванта для MMO пока недоступны.')}</p>)}</Group>}
    {(!section||section==='food')&&<Group title={t('Food')} open={!!section}><div className={styles.fields}><Pick label={t('Dish')} items={foods} locale={locale} value={draft.consumables.food} onChange={id=>change(d=>{d.consumables.food=id;})}/><Pick label={t('ATK% dish')} items={potions} locale={locale} value={draft.consumables.potion} onChange={id=>change(d=>{d.consumables.potion=id;})}/></div></Group>}
  </section>;
}
