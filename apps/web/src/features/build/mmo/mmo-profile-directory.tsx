'use client';
import {useCallback,useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Button,CatalogControls,CatalogCounter,CatalogSearch,EmptyState,FilterChip,FilterGroup,LoadingState} from '@tof-hub/ui';
import {MmoProfileDirectoryQuerySchema,getServerById,type MmoProfileDirectoryQuery,type MmoProfileDirectoryResponse} from '@tof-hub/contracts';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {useLocale} from '@/lib/i18n';
import {localeText} from '@/lib/i18n/text';
import {formatDate,formatNumber} from '@/lib/i18n/format';
import {Hint,Nickname} from '../../players/player-identity';
import styles from '../profile-directory.module.css';
import {MmoSavedBuildLink} from './mmo-build-info';
import {MMO_PROFILE_ROLES,fetchMmoDirectory} from './profiles';
import type {MmoBuildCatalog} from './types';

const defaults=MmoProfileDirectoryQuerySchema.parse({});
// Balance has no role colour among the shared filter variants: it uses the neutral chip.
const roleVariants={dps:'dps',healer:'benediction',tank:'tank',balance:'default'} as const;

/** /tools/build/mmo/profiles/: every public MMO build, one row per character (the Global "All profiles" layout). */
export function MmoProfileDirectory({catalog}:{catalog:Pick<MmoBuildCatalog,'roleResonances'>}) {
  const {locale}=useLocale(),t=localeText(locale),searchParams=useSearchParams(),urlQuery=searchParams.toString();
  const query=useMemo(()=>{
    const parsed=MmoProfileDirectoryQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(urlQuery)));
    return parsed.success?parsed.data:defaults;
  },[urlQuery]);
  const [retry,setRetry]=useState(0),[pages,setPages]=useState(1);
  const key=`${query.q}|${query.role??''}|${retry}|${pages}`;
  const [result,setResult]=useState<{key:string;data?:MmoProfileDirectoryResponse;error?:boolean}|null>(null);
  const loading=result?.key!==key,data=!loading?result?.data:undefined,error=!loading&&result?.error;
  const update=useCallback((patch:Partial<MmoProfileDirectoryQuery>)=>{
    const next=new URLSearchParams();
    for(const [name,value] of Object.entries({...query,...patch}))if(value!==undefined&&value!==''&&value!==defaults[name as keyof MmoProfileDirectoryQuery])next.set(name,String(value));
    next.delete('offset');setPages(1);
    window.history.replaceState(null,'',`${window.location.pathname}${next.size?`?${next}`:''}`);
  },[query]);
  useEffect(()=>{
    const controller=new AbortController();
    fetchMmoDirectory({q:query.q,role:query.role,offset:0,limit:Math.min(50,defaults.limit*pages)},controller.signal)
      .then(data=>{if(!controller.signal.aborted)setResult({key,data});})
      .catch(()=>{if(!controller.signal.aborted)setResult({key,error:true});});
    return ()=>controller.abort();
  },[key]);
  const roles=MMO_PROFILE_ROLES.filter(role=>!query.role||query.role===role);
  const roleIcon=(role:string)=>catalog.roleResonances.find(item=>item.id===role)?.icon;
  const hasFilters=!!query.q||!!query.role;
  const copy={blankName:t('blank'),blankNameHint:t('Invisible characters:'),nicknameCopied:t('Nickname copied')};
  return <div className={`info-ui ${styles.page}`} style={{'--role-columns':roles.length} as CSSProperties}>
    <h1 className="sr-only">{t('Public MMO builds')}</h1>
    <CatalogControls ariaLabel={t('MMO build filters')} textSelectable>
      <CatalogSearch value={query.q} onChange={q=>update({q})} placeholder={t('Search nickname or UID…')} clearAriaLabel={t('Clear search')}/>
      <CatalogControls.Middle><CatalogControls.Left>
        <FilterGroup label={t('Role')}><FilterChip value="all" variant="all" active={!query.role} onClick={()=>update({role:undefined})}>{t('All')}</FilterChip>
          {MMO_PROFILE_ROLES.map(role=><FilterChip key={role} value={role} variant={roleVariants[role]} icon={roleIcon(role)} active={query.role===role} onClick={()=>update({role})}>
            {PLAYER_ROLE_LABELS[role][locale]}</FilterChip>)}</FilterGroup>
      </CatalogControls.Left></CatalogControls.Middle>
      <CatalogControls.Bottom><CatalogCounter count={data?.total??0} total={data?.total??0} entityLabel={t('characters')}
        formatString={count=><span>{t('Characters')}: <strong>{formatNumber(count,locale)}</strong></span>}/>
        <div className={styles.filterActions}>{hasFilters&&<Button size="sm" variant="secondary" onClick={()=>update({q:'',role:undefined})}>{t('Reset filters')}</Button>}</div>
      </CatalogControls.Bottom>
    </CatalogControls>
    <section className={styles.board} aria-label={t('Public MMO builds')} aria-busy={loading}>
      <header className={styles.boardHead}><h2>{t('Public MMO builds')}</h2></header>
      {loading&&!result?.data?<LoadingState message={t('Loading MMO builds…')}/>
        :error?<EmptyState title={t('Could not load MMO builds')} description={t('Please try again.')}
          action={<Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</Button>}/>
        :data&&!data.available?<EmptyState title={t('Builds are unavailable')} description={t('The profile database is not connected.')}/>
        :data&&!data.entries.length?<EmptyState title={hasFilters?t('No matching builds'):t('No public MMO builds yet')}
          description={hasFilters?t('Try another nickname, UID or role.'):t('Import your MMO .tofbuild and save it from the card.')}
          action={<Link href="/tools/build/mmo/" className={styles.ownCard}>{t('Open MMO card')}</Link>}/>
        :data&&<><div role="table" aria-label={t('MMO builds')} className={styles.table}>
          <div role="row" className={styles.tableHead}><span role="columnheader">{t('Server')}</span><span role="columnheader">{t('Character')}</span>
            <span role="columnheader" className={styles.roleHeads}>{roles.map(role=><span key={role}><img src={roleIcon(role)} alt=""/>{PLAYER_ROLE_LABELS[role][locale]}</span>)}</span>
            <span role="columnheader">{t('Updated','Обновлён')}</span></div>
          <div role="rowgroup">{data.entries.map(player=><div role="row" className={styles.row} key={player.uid}>
            <div role="cell">{(player.serverId&&getServerById(player.serverId)?.name)||'—'}</div>
            <div role="cell" className={styles.character}><span className={styles.identity}><Nickname nickname={player.name} uid={player.uid} copy={copy}/><small>UID {player.uid}</small></span></div>
            <div role="cell" className={styles.builds}>{roles.map(role=>{
              const profile=player.profiles.find(entry=>entry.role===role);
              return <div key={role} className={styles.roleGroup}><span className={styles.mobileRole}><img src={roleIcon(role)} alt=""/>{PLAYER_ROLE_LABELS[role][locale]}</span>
                <div className={styles.links}>{profile?<MmoSavedBuildLink uid={player.uid} profile={profile} catalog={catalog} locale={locale} presentation="compact"/>:<span className={styles.noBuild}>—</span>}</div></div>;
            })}</div>
            <div role="cell" className={styles.updated}><Hint title={formatDate(player.updatedAt,locale,{dateStyle:'medium',timeStyle:'short'})}>
              <time dateTime={player.updatedAt}>{formatDate(player.updatedAt,locale,{day:'2-digit',month:'2-digit',year:'numeric'})}</time></Hint></div>
          </div>)}</div>
        </div>
        {data.entries.length<data.total&&pages*defaults.limit<50&&<footer className={styles.pagination}><Button variant="ghost" size="sm" onClick={()=>setPages(value=>value+1)}>{t('Show more')}</Button></footer>}</>}
    </section>
  </div>;
}
