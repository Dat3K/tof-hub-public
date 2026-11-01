'use client';
import { fillText } from '@/lib/i18n/text';
import {localeText} from '@/lib/i18n/text';
import {useState} from 'react';
import type {BuildDraft,BuildLocale} from './types';
import styles from './build.module.css';
import {formatBuildDate} from './presentation';

const DAY=86_400_000;
// The stored reset time is a civil game-clock value whose zone is unconfirmed (observed +2 h vs UTC).
// Any real zone lies within UTC−12…UTC+14, so status near the boundary stays approximate.
const ZONE_BEFORE=14*3_600_000,ZONE_AFTER=12*3_600_000;

export type SupportResetState='unknown'|'cooldown'|'soon'|'ready';
export interface SupportResetStatus {state:SupportResetState;lastReset:number|null;availableAt:number|null;days:number|null}

/** Civil "YYYY-MM-DDTHH:mm:ss(.sss)" from the capture, read as clock fields (not converted to the viewer's zone). */
export function parseCivilTime(value:string|null|undefined):number|null {
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value??'');
  if(!match)return null;
  const [,y,mo,d,h,mi,s,ms='0']=match;
  return Date.UTC(+y,+mo-1,+d,+h,+mi,+s,Number(ms.padEnd(3,'0')));
}

export function supportResetStatus(stored:string|null|undefined,cooldownDays:number|undefined,now:number):SupportResetStatus {
  const lastReset=parseCivilTime(stored);
  if(lastReset===null||!cooldownDays)return {state:'unknown',lastReset,availableAt:null,days:null};
  const availableAt=lastReset+cooldownDays*DAY,remaining=availableAt-now;
  // Whole days left in every possible zone; matches the game's rounded-down "Resets in 28d".
  if(remaining>ZONE_BEFORE)return {state:'cooldown',lastReset,availableAt,days:Math.floor((remaining-ZONE_BEFORE)/DAY)};
  if(remaining<-ZONE_AFTER)return {state:'ready',lastReset,availableAt,days:0};
  return {state:'soon',lastReset,availableAt,days:0};
}

export function SupportResetDetails({draft,cooldownDays,locale}:{draft:BuildDraft;cooldownDays:number|undefined;locale:BuildLocale}) {
  const [now]=useState(()=>Date.now());
  const t=localeText(locale);
  const captured=draft.captureSource?.capture;
  const status=supportResetStatus(captured?.support?.reset.storedCivilTime,cooldownDays,now);
  // Keep the game-clock fields unchanged; the build card labels them UTC by display convention.
  const formatResetTime=(value:number)=>`${formatBuildDate(value,'civil')} UTC`;
  const verdict={
    cooldown:fillText(t('At least {0} d left', 'Осталось не меньше {0} дн.'), [status.days]),
    soon:t('Within the next hours'),
    ready:t('Available now'),
    unknown:'',
  }[status.state];
  return <div className={styles.itemEffects} data-support-reset={status.state}>
    {cooldownDays?<p className={styles.supportResetRule}>{fillText(t('Module levels can be reset once every {0} days.', 'Сброс уровней модулей доступен раз в {0} дн.'), [cooldownDays])}</p>:null}
    {status.state==='unknown'?<p className={styles.supportResetRule}>{t('Date of the last reset is unknown.')}</p>:<>
      {status.state!=='ready'&&<div className={styles.detailRow}><strong>{t('Available')}</strong><time dateTime={new Date(status.availableAt!).toISOString().slice(0,19)}>{formatResetTime(status.availableAt!)}</time></div>}
      <div className={styles.detailRow}><strong>{t('Status')}</strong><b>{verdict}</b></div>
      <div className={styles.detailRow}><strong>{t('Last reset')}</strong><time dateTime={new Date(status.lastReset!).toISOString().slice(0,19)}>{formatResetTime(status.lastReset!)}</time></div>
    </>}
  </div>;
}
