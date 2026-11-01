'use client';
import { localized, localizedUi } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {useState} from 'react';
import {Button,FilterChip,Tooltip} from '@tof-hub/ui';
import {getBuildRollQuality} from '@tof-hub/game-domain';
import {Field,NumberField,IconPick} from './build-fields';
import {analyzeGear,gearAugmentOptions,gearBaseStats,titanMaximums,enhanceAllGear} from './model';
import {formatValue,formatStatMaximum,statLabel,statIcon} from './presentation';
import {GearOcrImport} from './gear-ocr-import';
import {parseGearCard} from './gear-ocr';
import type {BuildChange} from './build-editor';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import styles from './build.module.css';

type Focus={kind:'random'|'augment'|'rare';index:number};
type Props={draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;change:BuildChange;index:number;viewportTopInset:number;focus?:Focus;presentation?:'inline'|'panel';bulk?:boolean};

function AllGearEnhancement({draft,catalog,locale,change}:Pick<Props,'draft'|'catalog'|'locale'|'change'>) {
  const t=localeText(locale);
  const [enhancement,setEnhancement]=useState<number|null>(null),[stars,setStars]=useState<number|null>(null);
  const [stage,setStage]=useState<''|'normal'|'augmented'|'titan'>('');
  const maximum=Math.max(...catalog.gear.flatMap(item=>Object.values(item.baseStats).map(levels=>levels.at(-1)!.level)));
  const advanced=stage==='augmented'||stage==='titan';
  return <section className={styles.bulkGear} aria-label={t('All equipment slots')}>
    <div><strong>{t('Enhance all equipment')}</strong><span>{draft.gear.length} {t('slots · one action')}</span></div>
    <div className={styles.bulkGearFields}>
      <NumberField label={t('Enhancement for all slots')} nullable value={enhancement} max={maximum} onChange={setEnhancement}/>
      <Field label={t('Stars for all slots')}><select value={advanced?catalog.reference.limits.maxNumOfRandomStatRolls:stars??''} disabled={advanced} onChange={event=>setStars(event.target.value===''?null:Number(event.target.value))}><option value="">{t('Keep current')}</option>{Array.from({length:catalog.reference.limits.maxNumOfRandomStatRolls+1},(_,n)=><option key={n} value={n}>★{n}</option>)}</select></Field>
      <Field label={t('Stage for all slots')}><select value={stage} onChange={event=>setStage(event.target.value as typeof stage)}><option value="">{t('Keep current')}</option><option value="normal">SSR</option><option value="augmented">{t('Augmented','Улучшено')}</option><option value="titan">{t('Titan')}</option></select></Field>
    </div>
    <p>{t('An empty enhancement keeps current levels. Each slot respects its generated level cap. Augmented and Titan stages use full stars.')}</p>
    <Button variant="outline" disabled={enhancement===null&&stars===null&&!stage} onClick={()=>change(d=>enhanceAllGear(d,catalog,{enhancement,stars,stage}))}>{t('Apply to all')} {draft.gear.length}</Button>
  </section>;
}

export function GearPickerEditor(props:Props) {
  const [index,setIndex]=useState(props.index);
  return <div className={styles.gearEditor}>
    {props.bulk&&<AllGearEnhancement {...props}/>}
    <div className={styles.gearSlotTabs} role="tablist" aria-label={localeText(props.locale)('Equipment slot', 'Слот экипировки')} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const last=props.catalog.gear.length-1;
      const next=event.key==='Home'?0:event.key==='End'?last:(index+(event.key==='ArrowRight'?1:-1)+last+1)%(last+1);
      setIndex(next);event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }}>{props.catalog.gear.map((item,i)=><button type="button" role="tab" key={item.id} tabIndex={i===index?0:-1} aria-selected={i===index} aria-label={localizedUi(item.name,props.locale)} data-hint={localizedUi(item.name,props.locale)} onClick={()=>setIndex(i)}><img src={item.icons.normal} alt=""/><span>{localizedUi(item.name,props.locale)}</span></button>)}</div>
    <div role="tabpanel" aria-label={props.catalog.gear[index].name[props.locale]}><GearEditor {...props} index={index} presentation="panel"/></div>
  </div>;
}

/** One stat form for the full dialog, manual editor and individual stat editing. */
export function GearEditor({draft,catalog,locale,change,index,viewportTopInset,focus,presentation='inline'}:Props) {
  const g=draft.gear[index],meta=catalog.gear[index];
  const analysis=analyzeGear(g,catalog),maxima=titanMaximums(g,catalog);
  const t=localeText(locale);
  const stage=g.titan?'titan':g.augmented?'augmented':'normal';
  const enhanced=stage!=='normal';
  const format=(value:number,percentage=false,digits=2)=>formatValue(value,percentage,locale,digits);
  const stages=[{id:'normal',label:'SSR'},{id:'augmented',label:t('Augmented','Улучшено')},{id:'titan',label:'Titan'}] as const;
  const setStage=(value:typeof stage)=>change(d=>{
    const gear=d.gear[index];gear.titan=value==='titan';gear.augmented=value!=='normal';
    gear.enhancement=Math.min(gear.enhancement,meta.baseStats[value].at(-1)!.level);
    if(value!=='normal')gear.stars=catalog.reference.limits.maxNumOfRandomStatRolls;
  });
  const statItems=meta.allowedStats.map(id=>({id,name:{en:statLabel(id,'en'),ru:statLabel(id,'ru')},icon:statIcon(id,catalog)}));
  const possibleAugments=[...new Set(g.augments.flatMap((_,j)=>gearAugmentOptions(g,catalog,j)))];
  return <div className={styles.gearForm} data-gear-editor={meta.id}>
    {!focus&&<>
      <div className={styles.gearEditorHeader}>
        <img className={styles.gearEditorArt} src={meta.icons[stage]} alt=""/>
        <div className={styles.gearEditorIdentity}><strong>{localizedUi(meta.name, locale)} <span>+{g.enhancement}</span></strong>
          {presentation==='panel'?<div className={styles.gearStageChoices} role="group" aria-label={t('Augmentation stage')}>{stages.map(item=><FilterChip key={item.id} active={stage===item.id} onClick={()=>setStage(item.id)}>{item.label}</FilterChip>)}</div>:<Field label={t('Augmentation stage')}><select value={stage} onChange={e=>setStage(e.target.value as typeof stage)}>{stages.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>}
          <div className={styles.gearStarChoices} role="group" aria-label={t('Gear stars')}>{Array.from({length:catalog.reference.limits.maxNumOfRandomStatRolls},(_,i)=>i+1).map(stars=><button type="button" key={stars} aria-label={`★${stars}`} aria-pressed={g.stars===stars} onClick={()=>change(d=>{d.gear[index].stars=stars;})}>{stars<=g.stars?'★':'☆'}</button>)}</div>
        </div>
        <div className={styles.gearProgressFields}><NumberField label={t('Enhancement')} value={g.enhancement} max={meta.baseStats[stage].at(-1)!.level} onChange={value=>change(d=>{d.gear[index].enhancement=value!;})}/><Field label={t('Equipped')}><input type="checkbox" checked={g.equipped} onChange={e=>change(d=>{d.gear[index].equipped=e.target.checked;})}/></Field></div>
      </div>
      <details className={styles.gearDisclosure}><summary>{t('Summary')}</summary><div>{gearBaseStats(g,catalog).map(stat=><span key={stat.label}><img src={statIcon(stat.label,catalog)} alt=""/>{statLabel(stat.label,locale)} <b>{format(stat.value)}</b></span>)}</div></details>
    </>}
    {(!focus||focus.kind==='random')&&<section className={styles.gearStatSection}>
      <h3>{t('Random stats')}{enhanced&&<span> · {stage==='titan'?t('Titan'):t('Augmented','Улучшенные')}</span>}
        {!focus&&<GearOcrImport locale={locale} onText={text=>{
          const card=parseGearCard(text,{random:meta.allowedStats.map(type=>({type,percent:!!catalog.reference.statTypes[type]?.isPercentageBased})),
            augment:Object.keys(catalog.reference.statTypes).map(type=>({type,percent:!!catalog.reference.statTypes[type]?.isPercentageBased})),
            rare:catalog.reference.titanRare.items.map(item=>({id:item.id,names:[item.nameEn,item.nameRu]})),maxRandom:g.rows.length,maxAugment:g.augments.length});
          const filled=card.random.filter(stat=>stat.value!==undefined).length+card.augments.filter(stat=>stat.value!==undefined).length+(card.rare?1:0);
          if(!filled)return 0;
          change(d=>{
            const gear=d.gear[index],maxLevel=meta.baseStats[gear.titan?'titan':gear.augmented?'augmented':'normal'].at(-1)!.level;
            // The card shows the piece as it is now: a plain piece's current value is also its original.
            card.random.forEach((stat,j)=>{
              if(j>=gear.rows.length||stat.value===undefined)return;
              const previous=gear.rows[j];
              gear.rows[j]={type:stat.type,value:stat.value,beforeTitan:gear.titan||gear.augmented?(previous.type===stat.type?previous.beforeTitan:null):stat.value};
            });
            card.augments.forEach((stat,j)=>{if(j<gear.augments.length&&stat.value!==undefined)gear.augments[j]={type:stat.type,value:stat.value};});
            if(card.rare&&gear.titan){gear.rareId=card.rare.id;gear.rareLevel=card.rare.level;}
            if(card.enhancement!==undefined)gear.enhancement=Math.min(card.enhancement,maxLevel);
          });
          return filled;
        }}/>}
      </h3>
      {g.rows.map((row,j)=>{
        if(focus&&focus.index!==j)return null;
        const bounds=catalog.reference.statTypes[row.type],percentage=!!bounds?.isPercentageBased;
        const rolls=analysis.rolls[j];
        const quality=bounds?getBuildRollQuality(row.beforeTitan===null?null:row.beforeTitan-bounds.randomStatDefaultValue,rolls,bounds):null;
        const maximum=maxima.random[j];
        return <fieldset key={j} className={styles.gearStatRow} data-enhanced={enhanced}><legend>{t('Random stat')} {j+1}</legend>
          <Tooltip portal viewportTopInset={viewportTopInset} content={`${t('Rolls')}: ${rolls??'?'}${quality===null?'':` · ${format(quality,true,0)}`}`}><span className={styles.gearRollCount} tabIndex={0}>×{rolls??'?'}</span></Tooltip>
          <IconPick tone="stat" label={t('Stat')} value={row.type} items={statItems} locale={locale} onChange={type=>change(d=>{d.gear[index].rows[j]={type,value:0,beforeTitan:null};})}/>
          {enhanced?<>
            <NumberField label={t('Before Titan','До Titan')+(percentage?' %':'')} value={row.beforeTitan} percentage={percentage} nullable onChange={value=>change(d=>{d.gear[index].rows[j].beforeTitan=value;})}/>
            <div className={styles.gearStatIncrease}><span>{t('Increase')}</span><output>{row.beforeTitan===null?'—':`+${format(row.value-row.beforeTitan,percentage)}`}</output></div>
            <NumberField label={t('Current value')+(percentage?' %':'')} value={row.value} percentage={percentage} onChange={value=>change(d=>{d.gear[index].rows[j].value=value!;})}/>
          </>:<NumberField label={t('Current value')+(percentage?' %':'')} value={row.value} percentage={percentage} onChange={value=>change(d=>{d.gear[index].rows[j].value=value!;d.gear[index].rows[j].beforeTitan=value;})}/>}
          {focus&&<p className={styles.note}>{t('Maximum after Titan')}: {maximum===null?'—':formatStatMaximum(maximum,percentage,locale)}</p>}
        </fieldset>;
      })}
      {!focus&&<p className={styles.gearValidation} data-valid={!!analysis.combinations.length} role="status">{analysis.combinations.length?t('Valid roll history'):t('Random stats do not match the selected star count. Check the pre-Titan values.')}</p>}
    </section>}
    {enhanced&&(!focus||focus.kind==='augment')&&<section className={styles.gearStatSection}><h3>{t('Augmentation stats','Дополнительные статы')}</h3>{g.augments.map((stat,j)=>focus&&focus.index!==j?null:<div key={j} className={styles.gearAugmentRow}>
      <IconPick tone="stat" label={`${t('Added Titan stat')} ${j+1}`} items={gearAugmentOptions(g,catalog,j).map(id=>({id,name:{en:statLabel(id,'en'),ru:statLabel(id,'ru')},icon:statIcon(id,catalog)}))} value={stat.type} locale={locale} onChange={type=>change(d=>{d.gear[index].augments[j]={type,value:0};})}/>
      <NumberField label={t('Value')+(catalog.reference.statTypes[stat.type]?.isPercentageBased?' %':'')} value={stat.value} percentage={catalog.reference.statTypes[stat.type]?.isPercentageBased} onChange={value=>change(d=>{d.gear[index].augments[j].value=value!;})}/>
    </div>)}<p className={styles.note}>{t('Possible augmentation stats')}: {possibleAugments.map(id=>statLabel(id,locale)).join(' · ')||'—'}</p></section>}
    {g.titan&&(!focus||focus.kind==='rare')&&<section className={styles.gearStatSection}><h3>{t('Titan rare stat')}</h3><div className={styles.gearAugmentRow}>
      <IconPick tone="rare" label={t('Rare Titan stat')} value={g.rareId} locale={locale} items={catalog.reference.titanRare.items.filter(item=>meta.rarePool.includes(item.id)).map(item=>({id:item.id,name:{en:item.nameEn,ru:item.nameRu},icon:catalog.statIcons[item.id]?.icon??''}))} onChange={id=>change(d=>{d.gear[index].rareId=id;d.gear[index].rareLevel=id?catalog.reference.titanRare.items.find(item=>item.id===id)!.levels[0]:0;})}/>
      <Field label={t('Rare level')}><select value={g.rareLevel} onChange={e=>change(d=>{d.gear[index].rareLevel=Number(e.target.value);})}><option value={0}>—</option>{catalog.reference.titanRare.items.find(item=>item.id===g.rareId)?.levels.map(level=><option key={level} value={level}>{level}</option>)}</select></Field>
      {/* The game's Augmentation Count; filled from a .tofbuild of the own profile, empty when unknown. */}
      <div className={styles.gearAugmentCountField}><NumberField nullable label={t('Augmentation Count (Titan clicks)')} value={g.augmentCount??null} max={100000} onChange={value=>change(d=>{d.gear[index].augmentCount=value;})}/></div>
    </div></section>}
    {!focus&&<>
      <details className={styles.gearDisclosure}><summary>{t('Max Titan preview')}</summary><div>{g.rows.map((row,j)=>row.type&&<span key={j}><img src={statIcon(row.type,catalog)} alt=""/>{statLabel(row.type,locale)} <b>{maxima.random[j]===null?'—':formatStatMaximum(maxima.random[j]!,!!catalog.reference.statTypes[row.type]?.isPercentageBased,locale)}</b></span>)}</div></details>
    </>}
  </div>;
}
