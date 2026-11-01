'use client';
import type {TestServerParticipation} from '@tof-hub/contracts';
import type {Locale} from '@tof-hub/i18n';
import {formatDate} from '@/lib/i18n/format';
import {localeText} from '@/lib/i18n/text';
import {BuildTooltip,InspectionHeading} from '../build/build-inspection';
import styles from './player-identity.module.css';
import buildStyles from '../build/build.module.css';

/** Independent trigger keeps the untouched nickname selectable and copyable. */
export function TestServerBadge({servers,locale}:{servers:readonly TestServerParticipation[]|undefined;locale:Locale}) {
  const t=localeText(locale);
  if(!servers?.length)return null;
  const label=t('Seen on a test server');
  const date=(value:string|null)=>value?formatDate(value,locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):t('Date unknown');
  const source=(value:TestServerParticipation['firstTimeSource'])=>value==='import'?t('import date'):value==='scan'?t('scan time'):null;
  return <BuildTooltip portal delayMs={250} className={buildStyles.itemTooltip}
    content={<><InspectionHeading title={label}/><div className={styles.testServerDates}>{servers.map(server=>
      <section key={server.distribution}><strong>{server.distribution==='global-pioneer'?'Pioneer':server.distribution==='korea-dev'?'KR DEV':server.distribution==='taiwan-dev'?'TW DEV':t('Test server')}</strong>
        <div>{t('First seen')} <time dateTime={server.firstSeenAt??undefined}>{date(server.firstSeenAt)}</time>{source(server.firstTimeSource)&&<small> ({source(server.firstTimeSource)})</small>}</div>
        <div>{t('Last seen')} <time dateTime={server.lastSeenAt??undefined}>{date(server.lastSeenAt)}</time>{source(server.lastTimeSource)&&<small> ({source(server.lastTimeSource)})</small>}</div>
      </section>)}</div></>}>
    <button type="button" aria-label={label} className={styles.testServerBadge} onClick={event=>event.currentTarget.focus()}><span aria-hidden="true">T</span></button>
  </BuildTooltip>;
}
