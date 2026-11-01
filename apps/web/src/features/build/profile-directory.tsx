'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Button,CatalogControls,CatalogCounter,CatalogSearch,CatalogSort,EmptyState,FilterChip,FilterGroup,LoadingState,ProfileAvatar,Spinner,type ProfileAvatarImage} from '@tof-hub/ui';
import {BuildProfileDirectoryQuerySchema,PROFILE_ELEMENTS,PROFILE_ROLES,type BuildProfileDirectoryEntry,type BuildProfileDirectoryQuery,type BuildProfileDirectoryResponse} from '@tof-hub/contracts';
import {getPlayerRoleLabel} from '@tof-hub/game-domain';
import {useLocale} from '@/lib/i18n';
import {localeText} from '@/lib/i18n/text';
import {formatDate,formatNumber} from '@/lib/i18n/format';
import {Hint,Nickname,RegionCell,RegionFilters} from '../players/player-identity';
import {SavedBuildLink,type ProfileLinkCatalog} from './saved-build-link';
import {elementLabel} from './presentation';
import styles from './profile-directory.module.css';

export interface ProfileDirectoryCatalog extends ProfileLinkCatalog {
  avatars:Record<string,ProfileAvatarImage>;frames:Record<string,ProfileAvatarImage>;avatarAliases:Record<string,string>;
  regions:{code:string;name:string}[];
}
const defaults=BuildProfileDirectoryQuerySchema.parse({});
const roleVariants={dps:'dps',healer:'benediction',tank:'tank'} as const;
const elementVariants={Frost:'frost',Volt:'volt',Flame:'flame',Physical:'phys',Altered:'altered'} as const;
function queryParams(query:BuildProfileDirectoryQuery) {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==''&&value!==defaults[key as keyof BuildProfileDirectoryQuery])params.set(key,String(value));
  return params;
}

export function ProfileDirectory({catalog}:{catalog:ProfileDirectoryCatalog}) {
  const {locale}=useLocale(),t=localeText(locale),searchParams=useSearchParams(),urlQuery=searchParams.toString();
  const query=useMemo(()=>{
    const parsed=BuildProfileDirectoryQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(urlQuery)));
    return parsed.success?parsed.data:defaults;
  },[urlQuery]);
  const params=queryParams(query).toString(),[retry,setRetry]=useState(0),key=`${params}|${retry}`;
  const [result,setResult]=useState<{key:string;data?:BuildProfileDirectoryResponse;error?:boolean}|null>(null);
  const loading=result?.key!==key;
  const data=!loading?result?.data:undefined,error=!loading&&result?.error;
  const update=useCallback((patch:Partial<BuildProfileDirectoryQuery>)=>{
    const next=queryParams({...query,offset:0,...patch});
    window.history.replaceState(null,'',`${window.location.pathname}${next.size?`?${next}`:''}`);
  },[query]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/v1/build/profiles?${params}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json() as BuildProfileDirectoryResponse;
      if(!controller.signal.aborted)setResult({key,data});
    }).catch(()=>{if(!controller.signal.aborted)setResult({key,error:true});});
    return()=>controller.abort();
  },[params,key]);
  const [moreState,setMoreState]=useState<{key:string;status:'loading'|'error'|'idle'}|null>(null);
  const [moreAttempt,setMoreAttempt]=useState(0);
  const moreRef=useRef<HTMLDivElement>(null);
  const loadingMore=moreState?.key===key&&moreState.status==='loading';
  const moreError=moreState?.key===key&&moreState.status==='error';
  const loadedCount=data?.entries.length??0,nextOffset=query.offset+loadedCount;
  const canLoadMore=!!data&&loadedCount>0&&nextOffset<data.filtered&&nextOffset<=100_000;
  useEffect(()=>{
    const sentinel=moreRef.current;
    if(!sentinel||loading||!canLoadMore||typeof IntersectionObserver==='undefined')return;
    const controller=new AbortController();
    let requested=false;
    const rows=sentinel.closest(`.${styles.board}`)?.querySelectorAll(`.${styles.table} [role="rowgroup"] > [role="row"]`);
    const target=rows&&rows.length>15?rows[rows.length-15]!:sentinel;
    const observer=new IntersectionObserver(entries=>{
      if(requested||!entries.some(entry=>entry.isIntersecting))return;
      requested=true;observer.disconnect();setMoreState({key,status:'loading'});
      const append=(page:BuildProfileDirectoryResponse)=>{
        if(!page.available||!page.entries.length)throw new Error('Profile page unavailable');
        setResult(current=>current?.key===key&&current.data?{...current,data:{...current.data,entries:[...current.data.entries,...page.entries]}}:current);
        setMoreState({key,status:'idle'});
      };
      const pageParams=queryParams({...query,offset:nextOffset}).toString();
      fetch(`/api/v1/build/profiles?${pageParams}`,{signal:controller.signal,cache:'no-store'})
        .then(async response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json() as BuildProfileDirectoryResponse;})
        .then(append)
        .catch(()=>{if(!controller.signal.aborted)setMoreState({key,status:'error'});});
    },{rootMargin:'200px 0px'});
    observer.observe(target);
    if(target!==sentinel)observer.observe(sentinel);
    return()=>{observer.disconnect();controller.abort();};
    // The page request uses the current filters and sort from `key`.
  },[canLoadMore,key,loading,loadedCount,moreAttempt]);
  const hasFilters=!!query.q||!!query.region||!!query.role||!!query.element;
  const copy={blankName:t('blank'),blankNameHint:t('Invisible characters:'),nicknameCopied:t('Nickname copied')};
  const roles=PROFILE_ROLES.filter(role=>!query.role||query.role===role);
  return <div className={`info-ui ${styles.page}`} style={{'--role-columns':roles.length} as CSSProperties}>
    <h1 className="sr-only">{t('All profiles')}</h1>
    <CatalogControls ariaLabel={t('Profile filters')} textSelectable>
      <CatalogSearch value={query.q} onChange={q=>update({q})} placeholder={t('Search nickname, UID or server…')} clearAriaLabel={t('Clear search')}/>
      <CatalogControls.Middle><CatalogControls.Left>
        <RegionFilters regions={catalog.regions} value={query.region??null} onChange={region=>update({region:region as BuildProfileDirectoryQuery['region']??undefined})} label={t('Region')} allLabel={t('All')}/>
        <FilterGroup label={t('Role')}><FilterChip value="all" variant="all" active={!query.role} onClick={()=>update({role:undefined})}>{t('All')}</FilterChip>
          {PROFILE_ROLES.map(role=><FilterChip key={role} value={role} variant={roleVariants[role]} icon={catalog.roleResonances.items.find(item=>item.id===role)?.icon} active={query.role===role} onClick={()=>update({role})}>
            {getPlayerRoleLabel(role,locale)}
          </FilterChip>)}</FilterGroup>
        <FilterGroup label={t('Element','Стихия')}><FilterChip value="all" variant="all" active={!query.element} onClick={()=>update({element:undefined})}>{t('All')}</FilterChip>
          {PROFILE_ELEMENTS.map(element=><FilterChip key={element} value={element} variant={elementVariants[element]} icon={catalog.elementIcons[element]?.icon} active={query.element===element} onClick={()=>update({element})}>
            {elementLabel(element,locale)}
          </FilterChip>)}</FilterGroup>
      </CatalogControls.Left></CatalogControls.Middle>
      <CatalogControls.Bottom><CatalogCounter count={data?.filtered??0} total={data?.total??0} entityLabel={t('characters')}
        formatString={(count,total)=><span>{t('Characters')}: <strong>{formatNumber(count,locale)}</strong> {t('of')} <strong>{formatNumber(total,locale)}</strong></span>}/>
        <div className={styles.filterActions}>
          {hasFilters&&<Button size="sm" variant="secondary" onClick={()=>update({q:'',region:undefined,role:undefined,element:undefined})}>{t('Reset filters')}</Button>}</div>
      </CatalogControls.Bottom>
    </CatalogControls>
    <section className={styles.board} aria-label={t('Saved builds')} aria-busy={loading}>
      <header className={styles.boardHead}><h2>{t('Saved builds')}</h2>
        <CatalogSort value={query.sort==='name'?'name-asc':query.sort} onChange={sort=>update({sort:sort as BuildProfileDirectoryQuery['sort']})} label={t('Order')} options={[
          {value:'updated',label:t('Saved: newest → oldest')},
          {value:'updated-asc',label:t('Saved: oldest → newest')},
          {value:'name-asc',label:t('Nickname: A → Z'),dividerBefore:true},
          {value:'name-desc',label:t('Nickname: Z → A')},
          {value:'builds',label:t('Builds: most → fewest'),dividerBefore:true},
          {value:'builds-asc',label:t('Builds: fewest → most')},
        ]}/></header>
      {loading?<LoadingState message={t('Loading profiles…')}/>:error?<EmptyState title={t('Could not load profiles')}
        description={t('Please try again.')} action={<Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</Button>}/>
        :!data?.available?<EmptyState title={t('Profiles are unavailable')} description={t('The profile database is not connected.')}/>
        :!data.entries.length?<EmptyState title={hasFilters?t('No matching profiles'):t('No saved builds yet')}
          description={hasFilters?t('Try another nickname, UID or filter.'):t('Import your .tofbuild and save your first build from the card.')}
          action={hasFilters?<Button variant="secondary" onClick={()=>update({q:'',region:undefined,role:undefined,element:undefined,offset:0})}>{t('Reset filters')}</Button>:<Link href="/tools/build/" className={styles.ownCard}>{t('Open Build card')}</Link>}/>
        :<><div role="table" aria-label={t('Character profiles')} className={styles.table}>
          <div role="row" className={styles.tableHead}><span role="columnheader">{t('Server')}</span><span role="columnheader">{t('Character')}</span>
            <span role="columnheader" className={styles.roleHeads}>{roles.map(role=><span key={role}><img src={catalog.roleResonances.items.find(item=>item.id===role)?.icon} alt=""/>{getPlayerRoleLabel(role,locale)}</span>)}</span>
            <span role="columnheader">{t('Updated','Обновлён')}</span></div>
          <div role="rowgroup">{data.entries.map(player=><div role="row" className={styles.row} key={player.uid}>
            <RegionCell player={player}/>
            <div role="cell" className={styles.character}>
              <ProfileAvatar size={38} avatar={catalog.avatars[player.avatarId??'']??catalog.avatars[catalog.avatarAliases[player.avatarId??'']]} frame={catalog.frames[player.avatarFrameId??'']}><span className={styles.placeholder}>—</span></ProfileAvatar>
              <span className={styles.identity}><Nickname nickname={player.name} uid={player.uid} copy={copy}/><small>UID {player.uid}</small></span>
            </div>
            <div role="cell" className={styles.builds}>{roles.map(role=>{
              const profiles=player.profiles.filter(profile=>profile.role===role).sort((a,b)=>PROFILE_ELEMENTS.indexOf(a.element)-PROFILE_ELEMENTS.indexOf(b.element));
              return <div key={role} className={styles.roleGroup}><span className={styles.mobileRole}><img src={catalog.roleResonances.items.find(item=>item.id===role)?.icon} alt=""/>{getPlayerRoleLabel(role,locale)}</span>
                <div className={styles.links}>{profiles.length?profiles.map(profile=><SavedBuildLink key={profile.slot} uid={player.uid} profile={profile} catalog={catalog} locale={locale} presentation="compact"/>):<span className={styles.noBuild}>—</span>}</div></div>;
            })}</div>
            <div role="cell" className={styles.updated}><Hint title={formatDate(player.updatedAt,locale,{dateStyle:'medium',timeStyle:'short'})}>
              <time dateTime={player.updatedAt}>{formatDate(player.updatedAt,locale,{day:'2-digit',month:'2-digit',year:'numeric'})}</time>
            </Hint><small>{formatNumber(player.profiles.length,locale)} {t(player.profiles.length===1?'build':'builds','билд.')}</small></div>
          </div>)}</div>
        </div><footer className={styles.pagination}><span>{formatNumber(query.offset+1,locale)}–{formatNumber(query.offset+data.entries.length,locale)} {t('of')} {formatNumber(data.filtered,locale)}</span>
          <div ref={moreRef} className={styles.loadMore} aria-hidden={!loadingMore&&!moreError}>{loadingMore?<Spinner size="sm" aria-label={t('Loading more profiles')}/>:moreError?<Button variant="ghost" size="sm" onClick={()=>{setMoreState(null);setMoreAttempt(value=>value+1);}}>{t('Retry loading')}</Button>:null}</div>
        </footer></>}
    </section>
  </div>;
}
