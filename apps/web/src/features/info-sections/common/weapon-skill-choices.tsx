'use client';
import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {GameRichText,Tooltip} from '@tof-hub/ui';
import {useState} from 'react';
import {useSiteHeaderInset} from '../../../components/site-shell/use-site-header-inset';
import type {WeaponSkillChoice} from './weapon-options';
import styles from './weapon-skill-choices.module.css';
/** Ordered Scatter slots or a single weapon mode, shared by display and editors. */
export function WeaponSkillChoices({options,value,onChange,locale,presentation='labels',kind='scatter'}:{options:WeaponSkillChoice[];value?:string[];onChange?:(slot:number,id:string)=>void;locale:Locale;presentation?:'labels'|'icons';kind?:'scatter'|'mode'}) {
  const t=localeText(locale);
  const [active,setActive]=useState(false);
  const viewportTopInset=useSiteHeaderInset(active);
  return <div className={styles.slots} data-presentation={presentation} data-kind={kind} aria-label={kind==='mode'?t('Weapon mode'):t('Scatter Techniques')}>
    {(kind==='mode'?[0]:[0,1]).map(index=>{
      const skill=options.find(option=>option.id===value?.[index]);
      const label=kind==='mode'?t('Weapon mode'):`${t('Scatter Technique')} ${index+1}`;
      return <Tooltip key={index} disabled={!skill} portal onOpenChange={setActive} viewportTopInset={viewportTopInset} content={skill?<div className={styles.description}><strong>{localized(skill.name, locale)}</strong><GameRichText text={localized(skill.description, locale)} density="compact"/></div>:undefined}><div className={styles.slot} aria-label={localized(skill?.name, locale)} tabIndex={onChange?undefined:0}>
        {skill?.icon&&<img src={skill.icon} alt=""/>}
        {presentation==='icons'&&!skill&&<span className={styles.empty}>{index+1} · —</span>}
        {onChange?<select aria-label={label} value={skill?.id??''} onChange={event=>onChange(index,event.target.value)}><option value="">{label} · —</option>{options.map(option=><option key={option.id} value={option.id}>{localized(option.name, locale)}</option>)}</select>:presentation==='labels'?<span>{localized(skill?.name, locale)??`${index+1} · —`}</span>:null}
      </div></Tooltip>;
    })}
    {kind==='mode'&&presentation==='icons'&&<span className={styles.modeName} data-hint-overflow>{localized(options.find(option=>option.id===value?.[0])?.name, locale)??t('Mode · —')}</span>}
  </div>;
}
