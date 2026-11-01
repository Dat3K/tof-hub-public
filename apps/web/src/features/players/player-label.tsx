import {nicknameParts} from './nickname-parts';
import styles from './player-identity.module.css';

// Plain player labels without the Build tooltip dependencies of player-identity (light enough for hub previews).

/** Shared text presentation for nickname links and copyable player identities. */
export function NicknameLabel({nickname,blankName='blank'}:{nickname:string|null;blankName?:string}) {
  if(nickname===null)return <>—</>;
  const parts=nicknameParts(nickname);
  return <>{parts.length?parts.map((part,index)=>part.blank?<span key={index} className={styles.blankName}>{blankName}</span>:part.text):<span className={styles.blankName}>{blankName}</span>}</>;
}

export function RegionCode({region}:{region:string|null|undefined}) {
  return <b className={styles.regionCode} data-region={region??undefined}>{region??'—'}</b>;
}
