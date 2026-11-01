import { localized, translateUiText } from '@tof-hub/i18n';
import {useBuildEditable} from './build-editing';
import {InspectionStars} from './build-inspection';
import {Stars} from './stars';
import {StatLink,ENHANCEMENT_SOURCES} from './stat-highlight';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import styles from './weapon-identity.module.css';

/** The same saved weapon identity in Build and compact loadout summaries. */
export function WeaponIdentity({weapon,item,index,locale,enhanced=false,presentation='card'}:{weapon:BuildDraft['weapons'][number];item:BuildCatalog['weapons'][number]|undefined;index:number;locale:BuildLocale;enhanced?:boolean;presentation?:'card'|'summary'}) {
  const edit=useBuildEditable();
  return <div className={`weapon-identity${presentation==='summary'?` ${styles.summary}`:''}`}>
    <StatLink types={enhanced?ENHANCEMENT_SOURCES:'Unchanged weapon progression'} inspectTypes={[]} sourceChannel={ENHANCEMENT_SOURCES}><div className="weapon-name-row"><div className="weapon-title weapon-label" {...edit(`weapon:${index}`)} data-hint-overflow>{localized(item?.weapon, locale)||weapon.capturedId||'—'}</div><span className="weapon-level-label" {...edit(`weapon-level:${index}`)}>{translateUiText('Lv.', locale)} {weapon.level}</span></div></StatLink>
    <div className="weapon-meta"><span className="weapon-simulacrum">{localized(item?.name, locale)||'—'}</span><span aria-hidden="true">·</span><span {...edit(`weapon-stars:${index}`)}><InspectionStars value={weapon.stars}/></span><span aria-hidden="true">·</span><span className="weapon-level-label" {...edit(`weapon-upgrade:${index}`)}>Up. {weapon.upgradeLevel??'—'}</span></div>
    {presentation==='card'&&<div className="weapon-progression-row"><div className="weapon-stars" {...edit(`weapon-stars:${index}`)}><Stars value={weapon.stars}/></div></div>}
  </div>;
}
