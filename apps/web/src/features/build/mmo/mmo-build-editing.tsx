'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {localized,localizedUi} from '@tof-hub/i18n';
import {Button,CatalogSearch,EntityCard,EntityGrid,FilterChip,GameRichText,Modal} from '@tof-hub/ui';
import {fillMmoText,mmoCardParams,normalizeElement} from '@tof-hub/game-domain';
import {localeText} from '@/lib/i18n/text';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import {BuildEditingProvider,useBuildEditable} from '../build-editing';
import {Field,NumberField} from '../build-fields';
import {characterTitleLabel} from '../character-title';
import {ArtworkLinkInput} from '../artwork-link-input';
import {LoadoutBadges,LoadoutFilters} from '../../info-sections/common/loadout-filters';
import type {BuildLocale,CatalogItem} from '../types';
import {MmoBuildEditor,type MmoBuildChange} from './mmo-build-editor';
import {MmoGearEditor} from './mmo-gear-editor';
import {emptyMmoGear,mmoAttribute,mmoCardSets,mmoWeaponMaxStars,selectMmoGear,mmoPetModuleChoices} from './model';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';
import styles from '../build.module.css';
import mmo from './mmo-build.module.css';

export type MmoEditTarget=`profile:${keyof MmoBuildDraft['profile']}`|`stat:${string}`|`weapon:${number}`|`weapon-stars:${number}`|
  `gear:${string}`|`gear-item:${string}`|`card:${string}`|`brainfield:${number}`|`pet-module:${number}`|`consumable:${'food'|'potion'}`|'pet'|'pet-details'|'weapon-mode'|'art'|'art-position'|'stats'|'equipment';
export const useMmoEditable=()=>useBuildEditable<MmoEditTarget>();
const MmoEditContext=createContext<(target:MmoEditTarget)=>void>(()=>{});
export const useMmoEditRequest=()=>useContext(MmoEditContext);

function targetTitle(target:MmoEditTarget,catalog:MmoBuildCatalog,locale:BuildLocale):string {
  const t=localeText(locale),[kind,key]=target.split(':');
  const profile:Record<string,string>={name:t('Name'),uid:'UID',crew:t('Crew','Гильдия'),characterTitle:t('Character title'),signature:t('Profile signature'),avatarId:t('Avatar'),avatarFrameId:t('Avatar frame'),level:t('Character level'),cs:t('Current CS'),season:t('MMO season')};
  if(kind==='profile')return profile[key]??key;
  if(kind==='stat')return localized(mmoAttribute(catalog,key)?.name,locale)||key;
  if(kind==='weapon')return `${t('Weapon')} ${Number(key)+1}`;
  if(kind==='weapon-stars')return t('Advancement +N');
  if(['gear','gear-item','card'].includes(kind))return `${kind==='card'?t('Expansion card','Карта расширения'):t('Equipment')} · ${localizedUi(catalog.slots.find(slot=>slot.id===key)?.name,locale)||key}`;
  if(kind==='brainfield')return localized(catalog.brainfield[Number(key)]?.name,locale)||'Brainfield';
  if(kind==='pet-module')return `${t('Module','Модуль')} ${Number(key)+1}`;
  if(kind==='consumable')return key==='food'?t('Dish'):t('ATK% dish');
  const labels:Record<string,string>={pet:'Smart Servant','pet-details':'Smart Servant','weapon-mode':t('Weapon mode'),art:t('Background'),'art-position':t('Artwork position'),stats:t('Attributes'),equipment:t('Equipment')};
  return labels[kind]??kind;
}

/** MMO targets use Global's edit state, inspection suppression, modal, fields and catalog cards. */
export function MmoBuildEditing({draft,catalog,locale,change,locked,children,request}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;change:MmoBuildChange;locked:boolean;children:ReactNode;request?:{target:MmoEditTarget;id:number}}) {
  const t=localeText(locale);
  const [target,setTarget]=useState<MmoEditTarget|null>(null),[query,setQuery]=useState('');
  const [elements,setElements]=useState<string[]>([]),[roles,setRoles]=useState<string[]>([]);
  const [season,setSeason]=useState(''),[grade,setGrade]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const returnFocus=useRef<{target:MmoEditTarget;node:HTMLElement}|null>(null);
  const open=useCallback((next:MmoEditTarget)=>{setQuery('');setElements([]);setRoles([]);setSeason('');setGrade('');setTarget(next);},[]);
  const close=()=>{
    const previous=returnFocus.current;returnFocus.current=null;setTarget(null);
    // Removing/replacing an item can replace its trigger node. Restore the equivalent
    // field after React commits; the shared Modal handles the normal connected trigger.
    if(previous)requestAnimationFrame(()=>{
      if(previous.node.isConnected)return;
      const candidates=Array.from(document.querySelectorAll<HTMLElement>(`[data-mmo-card] [data-build-edit="${CSS.escape(previous.target)}"]`));
      (candidates.find(node=>node.matches('button,[tabindex]'))??candidates[0]?.querySelector<HTMLElement>('button,[tabindex]'))?.focus({preventScroll:true});
    });
  };
  const presentation=target==='art'||target==='art-position';
  const visible=!!target&&(!locked||presentation);
  useEffect(()=>{if(visible)setFiltersOpen(window.innerHeight>600);},[visible,target]);
  useEffect(()=>{if(request)open(request.target);},[request,open]);
  useEffect(()=>{if(locked)setTarget(null);},[locked]);
  const inset=useSiteHeaderInset(visible);
  const title=target?targetTitle(target,catalog,locale):'';
  const state=useMemo(()=>({locked,open:visible,label:(value:string)=>`${t('Edit')} · ${targetTitle(value as MmoEditTarget,catalog,locale)}`}),[locked,visible,catalog,locale,t]);
  const [kind,key]=target?.split(':')??[];
  const cardCounts=new Map(mmoCardSets(draft,catalog).map(set=>[set.card.id,set.count]));
  const index=Number(key);
  let items:CatalogItem[]|undefined,value='',select:((id:string)=>void)|undefined,content:ReactNode;
  const choose=(choices:CatalogItem[],current:string,mutate:(next:MmoBuildDraft,id:string)=>void)=>{
    items=choices;value=current;select=id=>{change(next=>mutate(next,id));if(kind==='gear-item'||kind==='card')open(`gear:${key}`);else if(kind==='pet-module')open('pet-details');else close();};
  };
  const catalogItem=(entry:{id:string;name?:CatalogItem['name']|null;icon?:string|null}):CatalogItem=>({id:entry.id,name:entry.name??{en:entry.id,ru:entry.id},icon:entry.icon??''});
  if(kind==='weapon')choose(catalog.weapons.map(weapon=>({...catalogItem(weapon),name:weapon.weapon,elements:weapon.elements,roles:[weapon.role]})),draft.weapons[index]?.id??'',(next,id)=>{next.weapons[index]={id,stars:Math.min(next.weapons[index]!.stars,mmoWeaponMaxStars(catalog,id))};});
  if(kind==='gear-item')choose(catalog.gear.filter(item=>item.slot===key&&(!season||String(item.season)===season)&&(!grade||String(item.grade)===grade)).map(item=>({...catalogItem(item),roles:item.role?[item.role==='healer'?'benediction':item.role]:[]})),draft.gear[key]?.itemId??'',(next,id)=>selectMmoGear(next,key,id,catalog));
  if(kind==='card')choose(catalog.cards.filter(card=>card.slots.includes(key)&&(!season||String(card.season)===season)&&(!grade||card.quality===grade)).map(catalogItem),draft.gear[key]?.card?.id??'',(next,id)=>{next.gear[key]??=emptyMmoGear();next.gear[key]!.card=id?{id,stars:0}:null;});
  if(kind==='pet')choose(catalog.pets.map(pet=>({...catalogItem(pet),icon:pet.portrait||pet.icon||'',elements:pet.element?[normalizeElement(pet.element)]:[]})),draft.pet?.id??'',(next,id)=>{next.pet=id?{id,level:1,inheritedAttack:null}:null;});
  if(kind==='pet-module')choose(mmoPetModuleChoices(draft,catalog,index).map(catalogItem),draft.pet?.modules?.find(row=>row.slot===index)?.id??'',(next,id)=>{if(next.pet){next.pet.modules=(next.pet.modules??[]).filter(row=>row.slot!==index);if(id)next.pet.modules.push({slot:index,id});}});
  if(kind==='consumable')choose((key==='food'?catalog.foods:catalog.potions).map(catalogItem),draft.consumables[key as 'food'|'potion'],(next,id)=>{next.consumables[key as 'food'|'potion']=id;});
  if(kind==='art')choose(catalog.artworks,draft.art.id,(next,id)=>{next.art={id,zoom:1,x:50,y:50};});
  if(kind==='profile'&&(key==='avatarId'||key==='avatarFrameId'))choose(key==='avatarId'?catalog.avatars:catalog.avatarFrames,draft.profile[key],(next,id)=>{next.profile[key]=id;});
  if(kind==='profile'&&!items){
    if(key==='level'||key==='cs')content=<NumberField label={title} value={draft.profile[key]} nullable={key==='cs'} max={key==='level'?1000:1e10} onChange={n=>change(next=>{if(key==='level')next.profile.level=n??1;else next.profile.cs=n;})}/>;
    else if(key==='season')content=<Field label={title}><select value={draft.profile.season??''} onChange={event=>change(next=>{next.profile.season=event.target.value?Number(event.target.value):null;})}><option value="">—</option>{catalog.seasons.map(item=><option key={item.index} value={item.index}>{localized(item.name,locale)}</option>)}</select></Field>;
    else {const field=key as 'name'|'uid'|'crew'|'characterTitle'|'signature';content=<Field label={title}>{field==='signature'?<textarea value={draft.profile.signature} rows={3} maxLength={500} onChange={event=>change(next=>{next.profile.signature=event.target.value;})}/>:<input value={field==='characterTitle'?characterTitleLabel(draft.profile.characterTitle,catalog,locale):draft.profile[field]} maxLength={field==='uid'?32:120} onChange={event=>change(next=>{next.profile[field]=event.target.value;})}/>}</Field>;}
  }
  if(kind==='stat')content=<NumberField label={title} value={draft.stats[key]??null} nullable percentage={catalog.attributes[key]?.percent} max={catalog.attributes[key]?.percent?10000:1e10} onChange={n=>change(next=>{next.stats[key]=n;})}/>;
  if(kind==='weapon-stars')content=<div className={styles.rankChoices}>{Array.from({length:mmoWeaponMaxStars(catalog,draft.weapons[index]?.id??'')+1},(_,n)=><FilterChip key={n} variant="ssr" active={draft.weapons[index]!.stars===n} onClick={()=>{change(next=>{next.weapons[index]!.stars=n;});close();}}>+{n}</FilterChip>)}</div>;
  if(kind==='weapon-mode')content=<Field label={title}><select value={draft.weaponMode??''} onChange={event=>change(next=>{next.weaponMode=event.target.value==='fixed'?'fixed':event.target.value==='regular'?'regular':null;})}><option value="">—</option>{(['regular','fixed'] as const).map(mode=><option key={mode} value={mode}>{localized(catalog.labels[mode==='fixed'?'fixedMode':'regularMode'],locale)}</option>)}</select></Field>;
  if(kind==='gear')content=<MmoGearEditor slotId={key} draft={draft} catalog={catalog} locale={locale} change={change} onChoose={which=>open(`${which==='item'?'gear-item':'card'}:${key}`)}/>;
  if(kind==='brainfield'||kind==='stats'||kind==='equipment'||kind==='pet-details')content=<MmoBuildEditor draft={draft} catalog={catalog} locale={locale} change={change} section={kind==='stats'?'stats':kind==='equipment'?'gear':kind==='pet-details'?'pet':'brainfield'} brainfieldIndex={kind==='brainfield'?index:undefined} onChoose={(slot,which)=>open(`${which==='item'?'gear-item':'card'}:${slot}`)} onChooseModule={slot=>open(`pet-module:${slot}`)}/>;
  if(kind==='art-position')content=<div className={styles.fields}>{(['zoom','x','y','offsetX','offsetY'] as const).map((field,index)=><Field key={field} label={[t('Art scale'),t('Horizontal position'),t('Vertical position'),t('Horizontal offset','Смещение по горизонтали'),t('Vertical offset','Смещение по вертикали')][index]!}><div className={styles.rangeControl}><input type="range" min={field==='zoom'?.25:field.startsWith('offset')?-100:0} max={field==='zoom'?3:100} step={field==='zoom'?.01:1} value={draft.art[field]??0} onChange={event=>change(next=>{next.art[field]=Number(event.target.value);})}/><output>{Math.round((draft.art[field]??0)*(field==='zoom'?100:1))}%</output></div></Field>)}</div>;
  const choices=items?.filter(item=>(!elements.length||item.elements?.some(element=>elements.includes(element)))&&(!roles.length||item.roles?.some(role=>roles.includes(role)))&&`${localized(item.name,locale)} ${item.name.en} ${item.name.ru} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const activate=(node:Element)=>{
    if(node.closest('[data-build-edit-skip]'))return false;
    const editable=node.closest<HTMLElement>('[data-build-edit]');
    if(!editable)return false;
    const control=node.closest<HTMLElement>('button,[tabindex="0"]')??editable;
    control.focus({preventScroll:true});returnFocus.current={target:editable.dataset.buildEdit as MmoEditTarget,node:control};
    open(editable.dataset.buildEdit as MmoEditTarget);return true;
  };
  return <BuildEditingProvider value={state}><MmoEditContext.Provider value={open}><div onClickCapture={event=>{if(!locked&&event.target instanceof Element&&activate(event.target)){event.preventDefault();event.stopPropagation();}}} onKeyDownCapture={event=>{if(!locked&&!visible&&['Enter',' '].includes(event.key)&&event.target instanceof Element&&activate(event.target)){event.preventDefault();event.stopPropagation();}}}>{children}</div>
    <Modal appearance="tool" isOpen={visible} onClose={close} viewportTopInset={inset} size={items?'picker':['gear','equipment','brainfield','stats','pet-details'].includes(kind??'')?'xl':'sm'} ariaLabel={title}>
      <Modal.Header actions={items?<Button variant="outline" onClick={()=>select?.('')}>{t('Remove','Убрать')}</Button>:undefined}><Modal.Title>{title}</Modal.Title></Modal.Header>
      <Modal.Body>{items&&<Modal.Controls className="info-ui" style={{padding:'0 0 12px'}}><CatalogSearch value={query} onChange={setQuery} placeholder={t('Search…')} debounceMs={100}/>
        {['weapon','pet','gear-item','card'].includes(kind??'')&&<details className={mmo.pickerFilters} open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}><summary>{t('Filters','Фильтры')}</summary><div>
        <LoadoutFilters locale={locale} elements={kind==='weapon'||kind==='pet'?{selected:elements,onChange:setElements}:undefined} roles={kind==='weapon'||kind==='gear-item'?{selected:roles,onChange:setRoles}:undefined}/>
        {kind==='gear-item'&&<div className={styles.fields}><Field label={t('Season')}><select value={season} onChange={event=>setSeason(event.target.value)}><option value="">{t('All')}</option>{[...new Set(catalog.gear.filter(item=>item.slot===key).map(item=>item.season))].sort((a,b)=>b-a).map(n=><option key={n} value={n}>{localized(catalog.seasons.find(item=>item.index===n)?.name,locale)||`S${n}`}</option>)}</select></Field><Field label={t('Tier','Тир')}><select value={grade} onChange={event=>setGrade(event.target.value)}><option value="">{t('All')}</option>{[...new Set(catalog.gear.filter(item=>item.slot===key).map(item=>item.grade))].sort((a,b)=>b-a).map(n=><option key={n} value={n}>T{n}</option>)}</select></Field></div>}
        {kind==='card'&&<div className={styles.fields}><Field label={t('Rarity')}><select value={grade} onChange={event=>setGrade(event.target.value)}><option value="">{t('All')}</option>{[...new Set(catalog.cards.filter(card=>card.slots.includes(key)).map(card=>card.quality))].map(quality=><option key={quality} value={quality}>{quality}</option>)}</select></Field></div>}
        </div></details>}
        {kind==='art'&&<ArtworkLinkInput catalog={catalog} locale={locale} onSelect={(id,options)=>{change(next=>{next.art={id,zoom:1,x:50,y:50};});if(!options?.keepOpen)close();}} onAutoClose={close}/>}
        <div className={styles.pickerStatus}>{choices?.length} {t('items','предм.')}</div></Modal.Controls>}
      <div className={`info-ui ${styles.cardEditPanel}`}>
        {kind==='profile'&&(key==='avatarId'||key==='avatarFrameId')&&<Button variant="outline" onClick={()=>open(key==='avatarId'?'profile:avatarFrameId':'profile:avatarId')}>{key==='avatarId'?t('Choose avatar frame'):t('Choose avatar')}</Button>}
        {content}
        {kind==='pet'&&draft.pet&&<Button variant="outline" onClick={()=>open('pet-details')}>{t('Level')} · {t('Inherited ATK (in-game +value)')}</Button>}
        {kind==='art'&&<Button variant="outline" onClick={()=>open('art-position')}>{t('Move background')}</Button>}
        {items&&<EntityGrid columns={5} gap="sm" empty={!choices?.length} emptyTitle={t('No results')} emptyDescription={t('Try another search or element filter.')}>
          {choices?.map(item=>{const weapon=kind==='weapon'?catalog.weapons.find(entry=>entry.id===item.id):undefined,gear=kind==='gear-item'?catalog.gear.find(entry=>entry.id===item.id):undefined,card=kind==='card'?catalog.cards.find(entry=>entry.id===item.id):undefined,module=kind==='pet-module'?catalog.petModules?.find(entry=>entry.id===item.id):undefined;
            return <EntityCard key={item.id} presentation="picker" title={localized(item.name,locale)} image={item.icon} selected={item.id===value} dataId={item.id} onClick={()=>select?.(item.id)}
              subtitle={weapon?localized(weapon.name,locale):gear?`T${gear.grade} · ${localized(catalog.labels.equipmentTier,locale)} ${gear.tier}`:card?`★0–${card.maxStars} · ${t('Active')} 1/${card.maxSuit}`:module?`${t('Level')} ${module.level} · ${t('Load','Нагрузка')} ${module.load}`:undefined}
              badges={weapon||gear||kind==='pet'?[<LoadoutBadges key="loadout" locale={locale} elements={item.elements??[]} role={weapon?.role??(gear?.role==='healer'?'benediction':gear?.role??'')}/>]:undefined}
              footerSlot={card?.description?<GameRichText density="compact" text={fillMmoText(localized(card.description,locale),mmoCardParams(card.params,(cardCounts.get(card.id)??0)+(draft.gear[key]?.card?.id===card.id?0:1)))}/>:module?.description?<GameRichText density="compact" text={localized(module.description,locale)}/>:undefined}
              aspectRatio="square" artZoom={kind==='pet'?1:undefined} artPosition={kind==='pet'?'center':undefined} showTransparencyCheckerboard={false}/>;
          })}</EntityGrid>}
      </div></Modal.Body>
      {!items&&<Modal.Footer><Button onClick={close}>{t('Done')}</Button></Modal.Footer>}
    </Modal></MmoEditContext.Provider></BuildEditingProvider>;
}

/** Advanced editor keeps the same catalog dialogs as clicks on the card. */
export function MmoAdvancedEditor(props:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;change:MmoBuildChange}) {
  const open=useMmoEditRequest();
  return <MmoBuildEditor {...props} onChoose={(slot,kind)=>open(`${kind==='item'?'gear-item':'card'}:${slot}`)} onChooseModule={slot=>open(`pet-module:${slot}`)}/>;
}
