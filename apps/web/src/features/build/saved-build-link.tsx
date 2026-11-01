import Link from 'next/link';
import {getPlayerRoleLabel} from '@tof-hub/game-domain';
import type {ProfileSummary} from '@tof-hub/contracts';
import {Hint} from '../players/player-identity';
import {elementLabel} from './presentation';
import {profileHref} from './profiles';
import {formatDate} from '@/lib/i18n/format';
import {localeText} from '@/lib/i18n/text';
import type {BuildCatalog,BuildLocale} from './types';
import styles from './saved-build-link.module.css';

export type ProfileLinkCatalog=Pick<BuildCatalog,'elementIcons'|'roleResonances'>;
/** The same saved-profile navigation in My builds and the public directory. */
export function SavedBuildLink({uid,profile,catalog,locale,presentation='card',current=false,onOpen,href}:{
  uid:string;profile:ProfileSummary;catalog:ProfileLinkCatalog;locale:BuildLocale;presentation?:'card'|'compact';current?:boolean;onOpen?:()=>void;href?:string;
}) {
  const t=localeText(locale),role=getPlayerRoleLabel(profile.role,locale),element=elementLabel(profile.element,locale);
  const icon=catalog.elementIcons[profile.element]?.icon;
  const date=formatDate(profile.savedAt,locale,{dateStyle:'medium',timeStyle:'short'},'—');
  return <Hint title={`${role} · ${element}`} text={`${t('Saved')}: ${date}`}>
    <Link href={href??profileHref(uid,profile.slot)} className={styles.link} data-presentation={presentation} data-element={profile.element}
      data-current={current||undefined} aria-current={current?'page':undefined} aria-label={`${role} · ${element} · UID ${uid}`} onClick={onOpen}>
      {icon&&<img src={icon} alt=""/>}
      <span className={styles.label}><b>{presentation==='card'?`${role} · ${element}`:element}</b>{presentation==='card'&&<small>{date}</small>}</span>
      <span className={styles.arrow} aria-hidden="true">{current?'✓':'›'}</span>
    </Link>
  </Hint>;
}
