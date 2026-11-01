'use client';
import { localized, localizedUi } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {WeaponConfiguration} from './weapon-configuration';
import {weaponUpgradeBounds,reconcileWeaponUpgrade} from './weapon-upgrades';
import {compareFoodBuffMagnitudes} from '../info-sections/food/sort-food';
import {useSiteHeaderInset} from '../../components/site-shell/use-site-header-inset';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode,type HTMLAttributes} from 'react';
import {Button,CatalogSearch,CatalogSort,EntityCard,EntityGrid,FilterChip,GameBadge,GameRichText,Modal,PickerActionCard} from '@tof-hub/ui';
import {ArtworkLinkInput} from './artwork-link-input';
import {ConsumableExpiryField} from './consumable-expiry';
import {DateTimeField,Field,NumberField} from './build-fields';
import type {BuildChange} from './build-editor';
import {GearEditor,GearPickerEditor} from './gear-editor';
import {centredArt,petModuleBudget,petModuleOptions,petModuleRanks,supportSystem,selectBuildWeapon,selectBuildMatrix,selectBuildPet,selectBuildPetModule,setBuildPetStars} from './model';
import {matchesPrimaryElement} from '@tof-hub/game-domain';
import {LoadoutBadges,LoadoutFilters} from '../info-sections/common/loadout-filters';
import {elementLabel,statLabel,formatValue} from './presentation';
import type {BuildCatalog,BuildDraft,BuildLocale,CatalogItem,ProfileCosmetic} from './types';
import styles from './build.module.css';

type ProfileKey='name'|'server'|'uid'|'title'|'signature'|'crew'|'characterTitle'|'level'|'cs'|'apexCs'|'avatarId'|'avatarFrameId'|'suppressorId';
type CombatKey='hp'|'endurance'|'crit'|'additionalCritRate'|'critDamage';
type ElementKey='attack'|'attackPercent'|'damage'|'resistance';
export type BuildEditTarget=`profile:${ProfileKey}`|`combat:${CombatKey}`|`element:${number}:${ElementKey}`|
  `weapon:${number}`|`weapon-config:${number}`|`weapon-stars:${number}`|`weapon-level:${number}`|`weapon-upgrade:${number}`|`matrix:${number}:${number}`|`matrix-stars:${number}:${number}`|
  `matrix-level:${number}:${number}`|`matrix-set:${number}:${number}`|`matrix-level-all:${number}`|`relic:${number}`|`relic-stars:${number}`|`relic-damage:${string}`|`relic-resistance:${string}`|`synthesis:${number}`|`computing:${number}`|`support:${number}`|
  `consumable:${number}`|`module:${number}`|`module-level:${number}`|`gear:${number}`|`gear-level:${number}`|`gear-stars:${number}`|`gear-stat:${number}:random:${number}`|`gear-stat:${number}:augment:${number}`|`gear-stat:${number}:rare:0`|'equipment'|'rv'|'pet'|'pet-name'|'pet-stars'|'pet-level'|'trait'|'trait-points'|'mark'|'enemy'|'art'|'support-all';
const EditingContext=createContext<{locked:boolean;open:boolean;label:(target:string)=>string;change?:BuildChange}>({locked:true,open:false,label:()=>''});
/** Shared edit/inspection state; each game mode owns its typed targets and mutations. */
export const BuildEditingProvider=EditingContext.Provider;
export function useBuildEditing(){return useContext(EditingContext);}
/** Adds interaction only in edit mode; capture delegation keeps nested Inspect buttons intact. */
export function useBuildEditable<Target extends string=BuildEditTarget>(){
  const {locked,label}=useBuildEditing();
  return (target:Target,presentation:'control'|'area'='control'):HTMLAttributes<HTMLElement>&{'data-build-edit':Target}=>({
    'data-build-edit':target,...(!locked&&presentation==='control'?{tabIndex:0,role:'button','aria-label':label(target)}:{}),
  });
}
type EditView={title:string;content?:ReactNode;choices?:CatalogItem[];value?:string;select?:(id:string)=>void;rank?:{value:number;values:number[];prefix:string;set:(value:number)=>void}};
function editView(target:BuildEditTarget,draft:BuildDraft,catalog:BuildCatalog,locale:BuildLocale,change:BuildChange,viewportTopInset=0):EditView {
  const t=localeText(locale);
  const [kind,key,sub]=target.split(':');
  const index=Number(key),slot=Number(sub);
  const numeric=(title:string,value:number|null,set:(d:BuildDraft,n:number|null)=>void,options:Partial<{min:number;max:number;percentage:boolean;nullable:boolean}>={}):EditView=>({title,content:<NumberField label={title} value={value} onChange={n=>change(d=>set(d,n))} {...options}/>});
  const rank=(title:string,value:number,max:number,set:(d:BuildDraft,n:number)=>void,prefix='★'):EditView=>({title,rank:{value,values:Array.from({length:max+1},(_,i)=>i),prefix,set:n=>change(d=>set(d,n))}});
  const choice=(title:string,choices:CatalogItem[],value:string,set:(d:BuildDraft,id:string)=>void):EditView=>({title,choices,value,select:id=>change(d=>set(d,id))});
  if(kind==='support-all')return {title:t('All Space Support modules'),rank:{value:draft.support.every(module=>module.level===draft.support[0]?.level)?draft.support[0]?.level??0:-1,values:[...new Set([0,...catalog.support.systemLevels.map(tier=>tier.maxModuleLevel)])].sort((a,b)=>a-b),prefix:'Lv. ',set:level=>change(d=>{d.support.forEach(module=>{module.level=Math.min(level,catalog.support.modules.find(item=>item.id===module.id)?.maxLevel??0);});})}};
  if(kind==='consumable'){
    const group=catalog.consumables[index],itemId=draft.consumables?.[index]||'';
    return {...choice(localizedUi(group.name, locale),group.items,itemId,(d,id)=>{d.consumables??=catalog.consumables.map(()=>'');d.consumables[index]=id;}),content:group.id!=='food'&&itemId?<ConsumableExpiryField draft={draft} itemId={itemId} locale={locale} change={change}/>:undefined};
  }
  const weapon=draft.weapons[index],matrix=weapon?.matrices[slot];
  const pet=catalog.pets.find(p=>p.id===draft.pet.id);
  if(kind==='weapon')return choice(`${t('Weapon')} ${index+1}`,catalog.weapons.map(w=>({...w,name:w.weapon})),weapon.id,(d,id)=>{selectBuildWeapon(d,index,id,catalog);});
  if(kind==='weapon-config')return {title:t('Weapon configuration'),content:<WeaponConfiguration draft={draft} catalog={catalog} index={index} locale={locale} change={change}/>};
  if(kind==='weapon-stars')return rank(t('Weapon advancement','Пробуждение оружия'),weapon.stars,6,(d,n)=>{d.weapons[index].stars=n;});
  if(kind==='weapon-level')return numeric(t('Weapon level'),weapon.level,(d,n)=>{d.weapons[index].level=n!;reconcileWeaponUpgrade(d.weapons[index],catalog);},{max:catalog.defaultLevels.weapon});
  if(kind==='weapon-upgrade'){
    const title=t('Weapon upgrade level'),bounds=weaponUpgradeBounds(weapon,catalog);
    return bounds?numeric(title,weapon.upgradeLevel??null,(d,n)=>{if(n===null)delete d.weapons[index].upgradeLevel;else d.weapons[index].upgradeLevel=n;},{...bounds,nullable:true}):{title,content:<p>{t('Upgrade stages are unavailable for this weapon level.')}</p>};
  }
  if(kind==='matrix')return choice(`${t('Matrix')} ${slot+1}`,catalog.matrices,matrix.id,(d,id)=>{selectBuildMatrix(d,index,slot,id,catalog);});
  if(kind==='matrix-set')return choice(t('Matrix set'),catalog.matrices,matrix.id,(d,id)=>{d.weapons[index].matrices.forEach((item,slot)=>{if(item.id===matrix.id)selectBuildMatrix(d,index,slot,id,catalog);});});
  if(kind==='matrix-level-all')return numeric(t('All matrix levels'),Math.max(...weapon.matrices.map(m=>m.level)),(d,n)=>{d.weapons[index].matrices.forEach(m=>{m.level=n!;});});
  if(kind==='matrix-stars')return rank(t('Matrix stars'),matrix.stars,3,(d,n)=>{d.weapons[index].matrices[slot].stars=n;});
  if(kind==='matrix-level')return numeric(t('Matrix level'),matrix.level,(d,n)=>{d.weapons[index].matrices[slot].level=n!;});
  if(kind==='relic')return choice(`${t('Relic')} ${index+1}`,catalog.relics,draft.relics[index].id,(d,id)=>{d.relics[index].id=id;});
  if(kind==='relic-resistance')return numeric(`${elementLabel(key,locale)} · ${t('Relic A4 RES %')}`,draft.relicResistance?.[key]??null,(d,n)=>{d.relicResistance??={};d.relicResistance[key]=n;},{percentage:true,nullable:true,max:10000});
  if(kind==='relic-damage')return numeric(`${elementLabel(key,locale)} · ${t('Relic A4 DMG %')}`,draft.relicDamage?.[key]??null,(d,n)=>{d.relicDamage??={};d.relicDamage[key]=n;},{percentage:true,nullable:true,max:10000});
  if(kind==='relic-stars')return rank(t('Relic stars'),draft.relics[index].stars,5,(d,n)=>{d.relics[index].stars=n;});
  if(kind==='synthesis')return rank(`${t('Synthesis')} · ${localized(catalog.weapons.find(w=>w.id===draft.synthesis[index].id)?.name, locale)??''}`,draft.synthesis[index].stage,catalog.synthesis.maxStage,(d,n)=>{d.synthesis[index].stage=n;},'S');
  if(kind==='computing')return rank(localizedUi({en:catalog.computing[index].label_en,ru:catalog.computing[index].label_ru},locale),draft.computing[index].level,catalog.computing[index].maxLevel,(d,n)=>{d.computing[index].level=n;delete d.computing[index].progress;},'Lv. ');
  if(kind==='support'){
    const module=catalog.support.modules[index];
    return rank(localizedUi({en:module.name_en,ru:module.name_ru},locale),draft.support[index].level,Math.min(module.maxLevel,supportSystem(draft,catalog).maxModuleLevel),(d,n)=>{d.support[index].level=n;},'Lv. ');
  }
  if(kind==='pet')return choice(localeText(locale)('Smart Servant'),catalog.pets,draft.pet.id,(d,id)=>{selectBuildPet(d,id,catalog);});
  if(kind==='pet-name'){
    const label=t('Smart Servant name');
    return {title:label,content:<Field label={label}><input maxLength={120} placeholder={localized(pet?.name, locale)??''} value={draft.pet.customName??''} onChange={event=>change(d=>{d.pet.customName=event.target.value;})}/></Field>};
  }
  if(kind==='pet-stars')return rank(t('Smart Servant stars'),draft.pet.stars,pet?.maxStars??0,(d,n)=>{setBuildPetStars(d,n,catalog);});
  if(kind==='pet-level')return numeric(t('Smart Servant level'),draft.pet.level,(d,n)=>{d.pet.level=n!;});
  if(kind==='module'){
    const budget=petModuleBudget(draft,catalog),options=petModuleOptions(draft,catalog,index);
    return {...choice(`${t('Module')} ${index+1}`,options,draft.pet.modules[index],(d,id)=>{selectBuildPetModule(d,index,id,catalog);}),content:<p className={styles.note}>{!pet?.modules.length?t('No modules available for this Smart Servant.'):<>{t('Load')}: {budget.used} / {budget.max}.{index>=budget.slots?` ${t('This module slot is locked at the current star level.')}`:budget.used>=budget.max?` ${t('Insufficient Load capacity: remove a module to free capacity.')}`:options.length<pet.modules.length?` ${t('Insufficient Load capacity: modules exceeding the limit are hidden.')}`:''}</>}</p>};
  }
  if(kind==='module-level'){
    const module=pet?.modules.find(m=>m.id===draft.pet.modules[index]);
    return {title:t('Module level'),rank:{value:draft.pet.moduleLevels?.[index]||module?.levels[0]?.level||0,values:petModuleRanks(draft,catalog,index).map(l=>l.level),prefix:'Lv. ',set:n=>change(d=>{d.pet.moduleLevels??=[0,0,0,0];d.pet.moduleLevels[index]=n;})}};
  }
  if(kind==='trait')return choice('Trait',catalog.weapons.filter(w=>w.traitIcon).map(w=>({...w,icon:w.traitIcon})),draft.traitId,(d,id)=>{d.traitId=id;});
  if(kind==='trait-points')return numeric(t('Trait points'),draft.traitPoints,(d,n)=>{d.traitPoints=n!;});
  if(kind==='mark'){
    const ownerIndex=draft.weapons.findIndex(w=>w.id===catalog.weaponMark.simulacrumId);
    if(ownerIndex>=0)return {...rank(t('Nan Yin advancement'),draft.weapons[ownerIndex].stars,6,(d,n)=>{d.weapons[ownerIndex].stars=n;},'A'),content:<p>{t('With Nan Yin A1 in the build, every equipped weapon is marked.')}</p>};
  }
  if(kind==='mark')return choice(localized(catalog.weaponMark.name, locale),[...draft.weapons.filter((w,i,all)=>all.findIndex(item=>item.id===w.id)===i).flatMap(w=>{const item=catalog.weapons.find(x=>x.id===w.id);return item?[{id:item.weaponId,name:item.weapon,icon:item.icon}]:[];})],draft.markWeaponId,(d,id)=>{d.markWeaponId=id;});
  if(kind==='enemy')return numeric(t('Enemy level','Уровень врага'),draft.enemyLevel,(d,n)=>{d.enemyLevel=n!;},{min:1,max:100});
  if(kind==='gear-level'){const g=draft.gear[index],meta=catalog.gear[index];return numeric(t('Enhancement'),g.enhancement,(d,n)=>{d.gear[index].enhancement=n!;},{max:meta.baseStats[g.titan?'titan':g.augmented?'augmented':'normal'].at(-1)!.level});}
  if(kind==='gear-stars')return rank(t('Equipment stars'),draft.gear[index].stars,catalog.reference.limits.maxNumOfRandomStatRolls,(d,n)=>{d.gear[index].stars=n;});
  if(kind==='gear-stat')return {title:`${localized(catalog.gear[index].name, locale)} · ${t('Stat')}`,content:<GearEditor viewportTopInset={viewportTopInset} draft={draft} catalog={catalog} locale={locale} change={change} index={index} focus={{kind:sub as 'random'|'augment'|'rare',index:Number(target.split(':')[3])}}/>};
  if(kind==='gear'||kind==='equipment')return {title:t('Equipment'),content:<GearPickerEditor key={target} viewportTopInset={viewportTopInset} draft={draft} catalog={catalog} locale={locale} change={change} index={kind==='gear'?index:0} bulk={kind==='equipment'}/>};
  if(kind==='rv')return {title:t('Roll value settings'),content:<div className={styles.fields}>
    <Field label={t('RV element')}><select value={draft.rv?.element||''} onChange={e=>change(d=>{d.rv??={element:'',includeCrit:true};d.rv.element=e.target.value;})}><option value="">{t('Auto · highest ATK')}</option>{Object.keys(catalog.elementIcons).map(id=><option key={id} value={id}>{elementLabel(id,locale)}</option>)}</select></Field>
    <Field label={t('RV weapon')}><select value={draft.rv?.weaponId||''} onChange={e=>change(d=>{d.rv??={element:'',includeCrit:true};d.rv.weaponId=e.target.value;})}><option value="">{t('Auto')}</option>{draft.weapons.map(w=>catalog.weapons.find(item=>item.id===w.id)).filter(w=>!!w).filter((w,i,all)=>all.findIndex(item=>item.id===w.id)===i).map(w=><option key={w.id} value={w.id}>{localized(w.weapon, locale)}</option>)}</select></Field>
    
  </div>};
  if(kind==='combat'){
    const field=key as CombatKey;
    const labels:Record<CombatKey,string>={hp:t('HP'),endurance:t('Endurance'),crit:t('Crit'),additionalCritRate:t('Additional crit rate %'),critDamage:t('Crit damage %')};
    return numeric(labels[field],draft.combat[field]??0,(d,n)=>{d.combat[field]=n!;},{percentage:field==='additionalCritRate'||field==='critDamage',max:field==='additionalCritRate'?1000:field==='critDamage'?10000:1e9});
  }
  if(kind==='element'){
    const field=sub as ElementKey,e=draft.combat.elements[index];
    const stat=field==='attack'?'Attack':field==='attackPercent'?'Attack %':field==='damage'?'Damage %':'Resistance';
    return numeric(`${elementLabel(e.id,locale)} · ${statLabel(stat,locale)}`,e[field]??0,(d,n)=>{d.combat.elements[index][field]=n!;},{percentage:field==='attackPercent'||field==='damage',nullable:field==='resistance',max:field==='attackPercent'||field==='damage'?10000:1e9});
  }
  // Scale and position live on the toolbar (and exact X/Y in the manual editor); this dialog only picks the image.
  if(kind==='art')return choice(t('Background'),catalog.artworks,draft.art.id,(d,id)=>{d.art={...centredArt(d.art),id};});
  const profile=key as ProfileKey;
  if(profile==='avatarId')return choice(t('Avatar'),catalog.avatars,draft.profile.avatarId,(d,id)=>{d.profile.avatarId=id;});
  if(profile==='avatarFrameId')return choice(t('Avatar frame'),catalog.avatarFrames,draft.profile.avatarFrameId||'',(d,id)=>{d.profile.avatarFrameId=id;});
  if(profile==='suppressorId')return choice(t('Suppressor','Сапрессор'),catalog.suppressors.map(s=>({id:s.id,name:{en:s.version||'Base',ru:s.version||'Базовый'},icon:s.icon})),draft.profile.suppressorId||'',(d,id)=>{d.profile.suppressorId=id;});
  if(profile==='apexCs')return {title:t('Maximum Combat Score'),content:<div className={styles.fields}><NumberField label={t('Maximum CS')} nullable value={draft.profile.apexCs??null} onChange={value=>change(d=>{d.profile.apexCs=value;})}/><DateTimeField label={t('Maximum CS reached (UTC)')} value={draft.profile.apexGsAchievedAt??null} locale={locale} onChange={value=>change(d=>{d.profile.apexGsAchievedAt=value;})}/></div>};
  if(profile==='level'||profile==='cs')return numeric(profile==='level'?t('Character level'):'GS',draft.profile[profile]??0,(d,n)=>{d.profile[profile]=n!;},{max:profile==='level'?Math.max(...Object.keys(catalog.reference.resistanceFormula.constants).map(Number)):1e9});
  const labels:Record<string,string>={name:t('Name'),server:t('Server'),uid:'UID',title:t('Build title'),signature:t('Profile signature'),crew:t('Crew','Гильдия'),characterTitle:t('Character title')};
  return {title:labels[profile],content:<Field label={labels[profile]}>{profile==='signature'?<textarea rows={3} maxLength={500} value={draft.profile.signature} onChange={e=>change(d=>{d.profile.signature=e.target.value;})}/>:<input value={draft.profile[profile]||''} maxLength={profile==='uid'?32:120} onChange={e=>change(d=>{d.profile[profile]=e.target.value;})}/>}</Field>};
}

export function BuildEditing({locked,draft,catalog,locale,change,children,onArtworkSelect,onPositionArtwork,onArtworkUpload,onDemoEditRequest,artPickerRequest=0}:{/** Bump to open the background picker; it opens with the lock on too (the art keeps a card Verified). */artPickerRequest?:number;onArtworkSelect?:()=>void;onPositionArtwork?:()=>void;onArtworkUpload?:()=>void;onDemoEditRequest?:()=>void;locked:boolean;draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;change:BuildChange;children:ReactNode}){
  const [target,setTarget]=useState<BuildEditTarget|null>(null);
  const [query,setQuery]=useState('');
  const [foodSort,setFoodSort]=useState('buffDesc');
  const [elements,setElements]=useState<string[]>([]);
  const [roles,setRoles]=useState<string[]>([]);
  const [quality,setQuality]=useState('all');
  const [properties,setProperties]=useState<string[]>([]);
  const t=localeText(locale);
  const close=useCallback(()=>{setTarget(null);setQuery('');setElements([]);setRoles([]);setQuality('all');setProperties([]);},[]);
  // The background picker is available with the lock on; every other target needs unlocking.
  const visible=!!target&&(!locked||target==='art');
  useEffect(()=>{if(artPickerRequest){setQuery('');setTarget('art');}},[artPickerRequest]);
  const viewportTopInset=useSiteHeaderInset(visible);
  const view=target?editView(target,draft,catalog,locale,change,viewportTopInset):null;
  const open=(node:Element)=>{
    // Self-contained controls (role/element pickers) handle their own clicks in both modes.
    if(node.closest('[data-build-edit-skip]'))return false;
    const editable=node.closest<HTMLElement>('[data-build-edit]');
    if(!editable)return false;
    if(draft.demo){onDemoEditRequest?.();return true;}
    const source=node.closest<HTMLElement>('button,[tabindex="0"]')??editable.querySelector<HTMLElement>('button,[tabindex="0"]')??editable;
    source.focus({preventScroll:true});setQuery('');setElements([]);setRoles([]);setQuality('all');setProperties([]);setTarget(editable.dataset.buildEdit as BuildEditTarget);return true;
  };
  const filterKind=target?.split(':')[0];
  const foodPicker=filterKind==='consumable'&&catalog.consumables[Number(target?.split(':')[1])]?.id==='food';
  const petPicker=filterKind==='pet';
  const elementalPicker=foodPicker||petPicker||['weapon','trait','matrix','matrix-set'].includes(filterKind??'');
  const rarityPicker=['matrix','matrix-set','relic'].includes(filterKind??'');
  const suppressorPicker=target==='profile:suppressorId';
  const cosmeticPicker=target==='profile:avatarId'||target==='profile:avatarFrameId';
  const choices=view?.choices?.filter(item=>{
    const weapon=catalog.weapons.find(w=>w.id===item.id);
    const pet=catalog.pets.find(candidate=>candidate.id===item.id);
    const inheritedPetElements=pet?.stats?.inheritance.flatMap(entry=>entry.elements)??[];
    const itemElements=weapon?[weapon.elements[0]]:pet?[...new Set([...(pet.elements??[]),...inheritedPetElements])]:item.elements??[];
    const itemRoles=weapon?[weapon.role]:item.roles??[];
    if(elementalPicker&&elements.length&&!itemElements.some(element=>matchesPrimaryElement(element,elements)))return false;
    if(elementalPicker&&!foodPicker&&roles.length&&!itemRoles.some(role=>roles.includes(role)))return false;
    if(rarityPicker&&quality!=='all'&&item.quality!==quality)return false;
    if(filterKind==='relic'&&properties.length&&!properties.includes(item.property??''))return false;
    return `${item.name.en} ${item.name.ru} ${weapon?.name.en??''} ${weapon?.name.ru??''}`.toLowerCase().includes(query.toLowerCase().trim());
  });
  if(foodPicker)choices?.sort((a,b)=>foodSort==='nameAsc'?localized(a.name, locale).localeCompare(localized(b.name, locale)):compareFoodBuffMagnitudes(a.foodBuff??{percentage:0,flat:0},b.foodBuff??{percentage:0,flat:0},foodSort==='buffAsc'?'asc':'desc')||a.id.localeCompare(b.id,undefined,{numeric:true}));
  if(suppressorPicker)choices?.sort((a,b)=>b.id.localeCompare(a.id,undefined,{numeric:true}));
  const select=(id:string,options?:{keepOpen?:boolean})=>{if(target==='art')onArtworkSelect?.();view?.select?.(id);if(!options?.keepOpen)close();};
  const openEdit=visible;
  const context=useMemo(()=>({locked,open:openEdit,change,label:(target:string)=>`${localeText(locale)('Edit')} · ${editView(target as BuildEditTarget,draft,catalog,locale,change).title}`}),[locked,openEdit,draft,catalog,locale,change]);
  return <EditingContext.Provider value={context}><div onClickCapture={event=>{
    if(!locked&&event.target instanceof Element&&open(event.target)){event.preventDefault();event.stopPropagation();}
  }} onKeyDownCapture={event=>{
    if(!locked&&!target&&(event.key==='Enter'||event.key===' ')&&event.target instanceof Element&&open(event.target)){event.preventDefault();event.stopPropagation();}
  }}>{children}</div>
  <Modal appearance="tool" viewportTopInset={viewportTopInset} isOpen={visible} onClose={close} size={target==='mark'&&view?.choices?'lg':view?.choices?'picker':target?.startsWith('gear:')||target==='equipment'?'xl':target?.startsWith('gear')?'lg':'sm'} ariaLabel={view?.title}>
    <Modal.Header actions={view?.choices?<Button variant="outline" className="tool-panel-remove" onClick={()=>select('')}>{target==='art'?t('No background'):t('Remove','Убрать')}</Button>:undefined}><Modal.Title>{view?.title}</Modal.Title></Modal.Header>
    {view?.choices&&<Modal.Controls className="info-ui">
      {target!=='mark'&&<CatalogSearch value={query} onChange={setQuery} placeholder={t('Search…')} debounceMs={100}/>}
      {foodPicker?<div className={styles.foodPickerControls}>
        <LoadoutFilters locale={locale} elements={{selected:elements,onChange:setElements}}/>
        <CatalogSort label={t('Sort')} value={foodSort} onChange={setFoodSort} options={[{value:'buffDesc',label:t('Buff: strongest first')},{value:'buffAsc',label:t('Buff: weakest first')},{value:'nameAsc',label:t('Name: A–Z')}]} />
      </div>:<>
        <LoadoutFilters locale={locale} elements={elementalPicker?{selected:elements,onChange:setElements}:undefined} roles={elementalPicker&&!petPicker?{selected:roles,onChange:setRoles}:undefined} quality={rarityPicker?{selected:quality,onChange:setQuality}:undefined} properties={filterKind==='relic'?{selected:properties,onChange:setProperties}:undefined}/>
      </>}
      {target==='art'&&<ArtworkLinkInput catalog={catalog} locale={locale} onSelect={select} onAutoClose={close}/>}
      {cosmeticPicker&&<ArtworkLinkInput catalog={catalog} locale={locale} items={target==='profile:avatarId'?catalog.avatars:catalog.avatarFrames} label={view?.title??''} onSelect={select} onAutoClose={close}/>}
      <div className={styles.pickerStatus}><span>{choices?.length} {t('items','предм.')}</span></div>
    </Modal.Controls>}
    <Modal.Body><div className={`info-ui ${styles.cardEditPanel}`}>
      {target==='profile:avatarId'&&<Button variant="outline" onClick={()=>{setTarget('profile:avatarFrameId');setQuery('');}}>{t('Choose avatar frame')}</Button>}
      {target==='profile:avatarFrameId'&&<Button variant="outline" onClick={()=>{setTarget('profile:avatarId');setQuery('');}}>{t('Choose avatar')}</Button>}
      {target?.startsWith('module:')&&!draft.pet.id&&<Button onClick={()=>setTarget('pet')}>{t('Choose Smart Servant first')}</Button>}
      {view?.content}
      {view?.rank&&<div className={styles.rankChoices} aria-label={view.title}>{view.rank.values.map(n=><FilterChip key={n} variant="ssr" active={view.rank!.value===n} onClick={()=>{view.rank!.set(n);close();}}>{view.rank!.prefix}{n}</FilterChip>)}</div>}
      {view?.choices&&<>
        <EntityGrid columns={suppressorPicker||target==='mark'?3:5} gap="sm" empty={!choices?.length} emptyTitle={t('No results')} emptyDescription={t('Try another search or element filter.')}>
          {target==='art'&&onArtworkUpload&&<PickerActionCard icon="📷" title={t('Your image')} description={t('PNG, JPEG or WebP up to 20 MB')} onClick={()=>{close();onArtworkUpload();}}/>}
          {choices?.map(item=>{
            const weapon=['weapon','trait'].includes(filterKind??'')?catalog.weapons.find(w=>w.id===item.id):undefined;
            if(suppressorPicker){
              const stats=catalog.suppressors.find(s=>s.id===item.id)?.stats;
              return <EntityCard key={item.id} presentation="picker-compact" title={localized(item.name, locale)} image={item.icon} artZoom={1} selected={view.value===item.id} dataId={item.id} onClick={()=>select(item.id)} subtitle={view.value===item.id?t('Selected'):undefined}
                description={stats?<>{t('ATK')} +{formatValue(stats.atk,false,locale,0)} · {t('Crit')} +{formatValue(stats.crit,false,locale,0)}<br/>HP +{formatValue(stats.hp,false,locale,0)} · {t('RES','Сопр.')} +{formatValue(stats.res,false,locale,0)}</>:undefined}/>;
            }
            return <EntityCard key={item.id} presentation="picker" title={localized(item.name, locale)} subtitle={weapon?(filterKind==='weapon'?localized(weapon.name, locale):localized(weapon.weapon, locale)):undefined} image={item.icon}
              badges={weapon?[<LoadoutBadges key="loadout" elements={weapon.elements} role={weapon.role} locale={locale}/>]:['matrix','matrix-set'].includes(filterKind??'')?(item.elementLoadouts??(item.elements??[]).map(element=>[element])).map(elements=><LoadoutBadges key={elements.join("-")} elements={elements} role="" locale={locale}/>):[]}
              raritySlot={item.quality?<GameBadge variant={item.quality.toLowerCase() as 'ssr'|'sr'} size="sm">{item.quality}</GameBadge>:undefined}
              footerSlot={filterKind==='consumable'&&item.description?<GameRichText density="compact" text={localized(item.description, locale)}/>:undefined}
              aspectRatio="square" artZoom={Math.max((item as ProfileCosmetic).canvas?.width??1,(item as ProfileCosmetic).canvas?.height??1)} artPosition={`${((item as ProfileCosmetic).canvas?.centerX??.5)*100}% ${((item as ProfileCosmetic).canvas?.centerY??.5)*100}%`} showTransparencyCheckerboard={false} selected={view.value===item.id} dataId={item.id} onClick={()=>select(item.id)}/>;
          })}
        </EntityGrid>
      </>}
    </div></Modal.Body>
    <Modal.Footer>{target==='art'&&onPositionArtwork&&<Button variant="outline" onClick={()=>{close();onPositionArtwork();}}>{t('Move background')}</Button>}<Button onClick={close}>{t('Done')}</Button></Modal.Footer>
  </Modal></EditingContext.Provider>;
}
