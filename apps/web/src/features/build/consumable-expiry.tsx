'use client';
import { fillText, localeText } from '@/lib/i18n/text';

import {useEffect,useState} from 'react';
import type {BuildDraft,BuildLocale} from './types';
import type {BuildChange} from './build-editor';
import {DateTimeField} from './build-fields';
import {formatBuildDate} from './presentation';
import styles from './build.module.css';

/** Convert a game snapshot once; reopening a tooltip must not restart the timer. */
export function setConsumableRemainingTime(draft:BuildDraft,itemId:string,remainingSeconds:number,observedAt:number) {
  if(!Number.isFinite(remainingSeconds)||remainingSeconds<0||!Number.isFinite(observedAt))throw new Error('Invalid consumable lifetime');
  const expiresAt=new Date(observedAt+remainingSeconds*1000).toISOString();
  draft.consumableExpiresAt??={};
  draft.consumableExpiresAt[itemId]=expiresAt;
}

export function ConsumableExpiryField({draft,itemId,locale,change}:{draft:BuildDraft;itemId:string;locale:BuildLocale;change:BuildChange}) {
  return <DateTimeField label={localeText(locale)('Effect expires (UTC)')} value={draft.consumableExpiresAt?.[itemId]??null} onChange={value=>change(d=>{
    d.consumableExpiresAt??={};
    if(value)d.consumableExpiresAt[itemId]=value;
    else delete d.consumableExpiresAt[itemId];
  })}/>;
}

export function ConsumableExpiry({expiresAt,locale}:{expiresAt?:string;locale:BuildLocale}) {
  // Known on the first render so the tooltip is measured at its final height.
  const [now,setNow]=useState<number|null>(()=>Date.now());
  useEffect(()=>{
    if(!expiresAt)return;
    const update=()=>setNow(Date.now());
    update();const timer=setInterval(update,1000*30);
    return()=>clearInterval(timer);
  },[expiresAt]);
  if(!expiresAt||!Number.isFinite(Date.parse(expiresAt)))return null;
  // Minutes left; negative once the effect ended. The item stays on the card either way: its stats were captured with it.
  const left=now===null?null:Math.ceil((Date.parse(expiresAt)-now)/60000);
  const span=Math.abs(left??0),days=Math.floor(span/1440),hours=Math.floor(span%1440/60),minutes=span%60;
  const duration=[
    days>0?new Intl.NumberFormat(locale,{style:'unit',unit:'day',unitDisplay:'short'}).format(days):'',
    hours>0?new Intl.NumberFormat(locale,{style:'unit',unit:'hour',unitDisplay:'short'}).format(hours):'',
    new Intl.NumberFormat(locale,{style:'unit',unit:'minute',unitDisplay:'short'}).format(minutes),
  ].filter(Boolean).join(' ');
  const ended=left!==null&&left<=0;
  return <div className={styles.itemEffects} data-consumable-expiry>
    <div className={styles.detailRow}><strong>{ended?(localeText(locale)('Expired')):(localeText(locale)('Expires'))}</strong><time dateTime={expiresAt}>{formatBuildDate(expiresAt,'instant')}</time></div>
    {left!==null&&<div className={styles.detailRow}><strong>{ended?(localeText(locale)('Ended', 'Действие закончилось')):(localeText(locale)('Remaining', 'Осталось'))}</strong><b>{ended?fillText(localeText(locale)('{0} ago','{0} назад'),[duration]):duration}</b></div>}
    {ended&&<span>{localeText(locale)('The card stats were captured while the effect was active.')}</span>}
  </div>;
}
