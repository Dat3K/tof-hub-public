'use client';
import { fillText } from '@/lib/i18n/text';
import {localeText} from '@/lib/i18n/text';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Button,Dialog,ExportButton,ServerModeSwitcher,Spinner,Toast,useToast} from '@tof-hub/ui';
import {QueueNotice} from '../../queue/queue-notice';
import type {QueueJob} from '../../queue/client';
import type {MmoMissingPart,MmoPageMismatchError} from './capture-import';
import {BUILD_IMPORT_ROUTES,stashBuildImport,takeBuildImport,type BuildImportResult} from '../import-handoff';
import {RouteLoading} from '@/components/site-shell/route-loading';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import {loadDomSnapshot,waitForDomSnapshotAssets} from '@/lib/dom-snapshot';
import {downloadPng} from '@/lib/download';
import {useLocale} from '@/lib/i18n';
import {BuildInspection} from '../build-inspection';
import {CardPreview} from '../card-preview';
import {BUILD_CARD_HEIGHT,BUILD_CARD_WIDTH,BUILD_EXPORT_SCALE} from '../layout';
import {MmoBuildCard} from './mmo-build-card';
import {MmoBuildEditing,MmoAdvancedEditor,type MmoEditTarget} from './mmo-build-editing';
import {draftEditGroup,useDraftHistory} from '../draft-history';
import {mmoDraftFromCapture} from './capture-import';
import {mmoCardEdited,verifyMmoBuildCard} from './profiles';
import {captureOriginLabel} from '../capture-origin';
import Link from 'next/link';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {MMO_DRAFT_KEY,emptyMmoDraft,restoreMmoDraft} from './model';
import {demoMmoDraft} from './demo';
import {MmoBuildInfoRail,useMmoProfiles} from './mmo-build-info';
import {MmoSaveButton} from './mmo-save-button';
import {fetchMmoProfiles,loadMmoProfileDraft,mmoProfileHref,type MmoProfileRole} from './profiles';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';
import styles from '../build.module.css';

/**
 * /tools/build/mmo/: the MMO (Warp) card. The own draft stays in this browser; an unedited import can be saved as the
 * public build of its role. `profile`: a public build at /tools/build/mmo/<uid>/<role>/ (read-only).
 */
export function MmoBuildPage({catalog,profile}:{catalog:MmoBuildCatalog;profile?:{uid:string;role:MmoProfileRole|null}}) {
  const {locale}=useLocale();
  const t=localeText(locale);
  const router=useRouter();
  const undoHistory=useDraftHistory<MmoBuildDraft>(()=>({draft:emptyMmoDraft(catalog),customArt:''}));
  const {draft}=undoHistory.history.present;
  const setDraft=(next:MmoBuildDraft)=>{undoHistory.reset({draft:next,customArt:''});};
  const [ready,setReady]=useState(false);
  const [editing,setEditing]=useState(false),[manualEditor,setManualEditor]=useState(false);
  const [confirmDemoEdit,setConfirmDemoEdit]=useState(false),[appRequest,setAppRequest]=useState(0);
  const demoInset=useSiteHeaderInset(confirmDemoEdit);
  const [editRequest,setEditRequest]=useState<{target:MmoEditTarget;id:number}>();
  const requestEdit=(target:MmoEditTarget)=>setEditRequest(previous=>({target,id:(previous?.id??0)+1}));
  const [exporting,setExporting]=useState(false);
  const [confirmClear,setConfirmClear]=useState(false);
  const [importing,setImporting]=useState(false);
  const [queueJob,setQueueJob]=useState<QueueJob|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const clearInset=useSiteHeaderInset(confirmClear);
  const [scale,setScale]=useState(1);
  const {notify,dismiss}=useToast(),noticeId=useId();
  const setNotice=useCallback((message:string)=>{if(message)notify(message,{id:noticeId});else dismiss(noticeId);},[notify,dismiss,noticeId]);
  const stage=useRef<HTMLDivElement>(null),card=useRef<HTMLElement>(null),moreActions=useRef<HTMLDetailsElement>(null),artMenu=useRef<HTMLDetailsElement>(null);
  const [profileError,setProfileError]=useState<'not-found'|'unavailable'|null>(null);
  const [viewRole,setViewRole]=useState<MmoProfileRole|null>(profile?.role??null);
  const [savedVersion,setSavedVersion]=useState(0);
  const viewedProfiles=useMmoProfiles(profile?.uid??null,0);
  const ownUid=!profile&&!draft.demo?draft.source?.capture.capture.subject.uid??null:null;

  // A public build: rebuilt from its signed capture; the own draft in this browser is left as it is.
  useEffect(()=>{
    if(!profile)return;
    const controller=new AbortController();
    setReady(false);setProfileError(null);
    void (async()=>{try {
      const role=profile.role??(await fetchMmoProfiles(profile.uid,controller.signal)).profiles[0]?.role??null;
      if(!role)throw new Error('not-found');
      const loaded=await loadMmoProfileDraft(profile.uid,role,catalog,controller.signal);
      if(controller.signal.aborted)return;
      setDraft(loaded);setViewRole(role);
    } catch(error) {if(!controller.signal.aborted)setProfileError(error instanceof Error&&error.message==='not-found'?'not-found':'unavailable');}
    finally {if(!controller.signal.aborted)setReady(true);}})();
    return ()=>controller.abort();
  },[catalog,profile?.uid,profile?.role]);
  useEffect(()=>{
    if(profile)return;
    try {
      const stored=localStorage.getItem(MMO_DRAFT_KEY);
      const restored=stored?restoreMmoDraft(JSON.parse(stored),catalog):null;
      if(stored&&!restored)setNotice(t('The saved draft could not be restored.'));
      // A stored demo is never user data: rebuild it so it follows the current sample.
      setDraft(restored&&!restored.demo?restored:{...demoMmoDraft(catalog),updatedAt:new Date().toISOString()});
    } catch {setNotice(t('Browser storage is unavailable.'));}
    setReady(true);
    // Locale changes do not reload the user's draft.
  },[catalog]);
  // An MMO file imported on the Gacha Build page arrives here once, after the stored draft is restored.
  useEffect(()=>{
    if(!ready||profile)return;
    const handed=takeBuildImport('mmo');
    if(handed)void importCapture(handed);
  },[ready]);
  useEffect(()=>{
    if(!ready||profile)return;
    const timer=setTimeout(()=>{try {localStorage.setItem(MMO_DRAFT_KEY,JSON.stringify(draft));}catch {setNotice(t('The draft could not be saved. Keep this tab open or export the card.'));}},300);
    return ()=>clearTimeout(timer);
  },[draft,ready]);
  useLayoutEffect(()=>{
    const node=stage.current;if(!node)return;
    const resize=()=>{
      const top=node.getBoundingClientRect().top+window.scrollY;
      const available=Math.max(1,window.innerHeight-top-24);
      setScale(Math.min(1,node.clientWidth/BUILD_CARD_WIDTH,editing?1:available/BUILD_CARD_HEIGHT));
    };
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    window.addEventListener('resize',resize);
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize);};
  },[ready,editing]);
  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(moreActions.current&&event.target instanceof Node&&!moreActions.current.contains(event.target))moreActions.current.removeAttribute('open');if(artMenu.current&&event.target instanceof Node&&!artMenu.current.contains(event.target))artMenu.current.removeAttribute('open');};
    document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);
  },[]);

  const change=(mutate:(next:MmoBuildDraft)=>void)=>{
    const previous=undoHistory.current.current.present.draft,next=structuredClone(previous);mutate(next);next.updatedAt=new Date().toISOString();
    const restored=restoreMmoDraft(next,catalog);
    if(restored)undoHistory.commit({draft:restored,customArt:''},draftEditGroup(previous,restored));
  };
  useEffect(()=>{
    if(profile)return;
    const keyboard=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey||!['z','y'].includes(event.key.toLowerCase()))return;
      if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(importing||exporting)return;
      event.preventDefault();undoHistory.step(event.shiftKey||event.key.toLowerCase()==='y'?'redo':'undo');
    };
    window.addEventListener('keydown',keyboard);return ()=>window.removeEventListener('keydown',keyboard);
  },[profile,importing,exporting,undoHistory]);
  useEffect(()=>{
    if(!ready||profile)return;
    const flush=()=>{try{localStorage.setItem(MMO_DRAFT_KEY,JSON.stringify(undoHistory.current.current.present.draft));}catch{/* The debounced save reports errors. */}};
    window.addEventListener('pagehide',flush);return ()=>window.removeEventListener('pagehide',flush);
  },[ready,profile,undoHistory.current]);
  /** A file chosen here, or a server result handed over by the Gacha Build page (import-handoff.ts). */
  async function importCapture(source:File|BuildImportResult) {
    setImporting(true);setNotice('');
    try {
      const {importMmoCapture,mmoCaptureFromResult}=await import('./capture-import');
      const handedOver=!(source instanceof File);
      const imported=handedOver?mmoCaptureFromResult(source,catalog,locale):await importMmoCapture(source,catalog,locale,setQueueJob);
      setDraft(imported.draft);setEditing(false);setManualEditor(false);
      const parts:Record<MmoMissingPart,string>={brainfield:'Brainfield',cards:t('expansion cards'),mode:t('weapon mode'),
        pet:'Smart Servant',weapons:t('weapons'),gear:t('equipment'),panel:t('attributes')};
      setNotice([handedOver?t('The file was imported on the Build page and opened here.'):'',
        t('The MMO card is filled from the file.'),
        imported.missing.length?fillText(t('Not received at this login: {0}.', 'Не пришло при этом входе: {0}.'), [imported.missing.map(part=>parts[part]).join(', ')]):'',
        imported.devClient?fillText(t('{0} DEV client: the card is shown, the player was not saved.', '{0} DEV-клиент: карточка показана, игрок не сохранён.'), [imported.devClient==='korea-dev'?'Korea':'Taiwan']):'',
        imported.outdatedExporter?fillText(t('The capture app is older than {0}: the player was not saved.', 'Приложение захвата старше {0}: игрок не сохранён.'), [imported.outdatedExporter]):'',
        imported.serverRefusal==='unknown-server'?t('The server is not in the site catalog: the player was not saved.'):''].filter(Boolean).join(' '));
    } catch(error) {
      // The other mode's file: its server result moves to that page, which shows the card (no second upload).
      if(error instanceof Error&&error.name==='MmoPageMismatchError'&&stashBuildImport((error as MmoPageMismatchError).result)) {
        router.push(BUILD_IMPORT_ROUTES[(error as MmoPageMismatchError).target]);return;
      }
      setNotice(error instanceof Error&&['SealedFileError','MmoPageMismatchError'].includes(error.name)?error.message
        :`${t('Could not import the .tofbuild file.')}${error instanceof Error&&error.message?` ${error.message}`:''}`);
    } finally {setImporting(false);setQueueJob(null);}
  }
  async function exportPng() {
    if(!card.current)return;
    const exportDraft=structuredClone(draft);
    setExporting(true);setNotice('');
    let container:HTMLDivElement|null=null;
    try {
      const [library,provenance,{createBuildExportNode}]=await Promise.all([loadDomSnapshot(),exportDraft.demo?Promise.resolve('demo' as const):verifyMmoBuildCard(exportDraft,catalog),import('../build-export-card')]);
      container=document.createElement('div');container.className=styles.preview;
      container.style.cssText=`position:fixed;left:-20000px;top:0;width:${BUILD_CARD_WIDTH}px;height:${BUILD_CARD_HEIGHT}px;pointer-events:none;`;
      const clone=createBuildExportNode(<MmoBuildCard draft={exportDraft} catalog={catalog} locale={locale}/>);
      clone.removeAttribute('data-stat-highlight');clone.removeAttribute('data-editing');
      clone.querySelectorAll('.art-edit-control').forEach(node=>node.remove());
      clone.querySelectorAll('[data-build-edit]').forEach(node=>{node.removeAttribute('data-build-edit');node.removeAttribute('role');node.removeAttribute('tabindex');});
      clone.querySelectorAll('.demo-cta').forEach(node=>{const label=document.createElement('p');label.className='profile-signature tof-demo-label';label.textContent=t('DEMO PROFILE');node.replaceWith(label);});
      clone.querySelector(`[data-export-provenance="${provenance}"]`)?.setAttribute('data-export-active','');
      clone.querySelectorAll('[data-stat-match],[data-stat-source-match]').forEach(node=>{node.removeAttribute('data-stat-match');node.removeAttribute('data-stat-source-match');});
      container.appendChild(clone);document.body.appendChild(container);
      await waitForDomSnapshotAssets(clone,{freezeAnimations:true});
      const png=await library.toPng(clone,{pixelRatio:BUILD_EXPORT_SCALE,width:BUILD_CARD_WIDTH,height:BUILD_CARD_HEIGHT,cacheBust:false});
      downloadPng(png,`tof-mmo-build-${(exportDraft.profile.name||'wanderer').replace(/[^\p{L}\p{N}_-]/gu,'-')}.png`);
      const status=provenance==='demo'?t('Demo'):provenance==='verified'?t('Verified'):provenance==='edited'?t('Edited'):captureOriginLabel(provenance,locale,'export',exportDraft.source?.capture.capture.scan?.distribution);
      setNotice(fillText(t('PNG exported · {0} × {1} · {2}', 'PNG экспортирован · {0} × {1} · {2}'), [BUILD_CARD_WIDTH*BUILD_EXPORT_SCALE, BUILD_CARD_HEIGHT*BUILD_EXPORT_SCALE,status]));
    } catch {setNotice(t('PNG export failed. Try again after the images have loaded.'));}
    finally {container?.remove();setExporting(false);}
  }

  const openImport=()=>{if(!importing&&!exporting)fileInput.current?.click();};
  if(!ready)return <RouteLoading/>;
  const viewing=profile?{uid:profile.uid,role:viewRole}:undefined;
  return <div className={styles.page} data-static={!editing}><h1 className="sr-only">{t('MMO build card')}</h1>
    <div className={styles.rotateNotice} role="status"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="15" y="6" width="18" height="30" rx="3"/><path d="M24 31.5h.01"/><path d="M8 30a16 16 0 0 0 13 13.5"/><path d="M17 41l4 2.5-1.5 4"/></svg>
      <strong>{t('Turn your device')}</strong><span>{t('The build card is wide: hold the phone horizontally to view and edit it.')}</span></div>
    <MmoBuildInfoRail locale={locale} catalog={catalog} onImport={()=>{if(profile)router.push('/tools/build/mmo/');else openImport();}} uid={ownUid} viewing={viewing} version={savedVersion} appRequest={appRequest}/>
    <div className={styles.exportAction} style={{width:BUILD_CARD_WIDTH*scale}}>
      <div className={styles.toolbarGroup} role="group" aria-label={t('Editing')}>
        <ServerModeSwitcher value="mmo" ariaLabel={t('Game mode')} onChange={mode=>{if(mode==='gacha')router.push('/tools/build/');}}/>
        {profile?<>
          {/* A public build: the character's other roles and the way back to the own card. */}
          {viewedProfiles?.map(entry=><Link key={entry.role} className={styles.toolbarEdit} href={mmoProfileHref(profile.uid,entry.role)} aria-current={entry.role===viewRole?'page':undefined}>
            <span>{PLAYER_ROLE_LABELS[entry.role][locale]}</span></Link>)}
          <Link className={styles.toolbarEdit} href="/tools/build/mmo/"><span>{t('← My card')}</span></Link>
        </>:<label className={styles.toolbarEdit}><input aria-label={t('Lock editing')} type="checkbox" checked={!editing} disabled={importing||exporting} onChange={event=>{if(!event.target.checked&&draft.demo){setConfirmDemoEdit(true);return;}setEditing(!event.target.checked);if(event.target.checked)setManualEditor(false);}}/><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={editing?'M8 10V6a4 4 0 0 1 8 0':'M8 10V6a4 4 0 0 1 8 0v4'}/></svg><span>{editing?t('Finish editing'):t('Edit card')}</span></label>}
        {!profile&&<div className={styles.historyControls}><Button variant="ghost" aria-label={t('Undo')} data-hint={t('Undo · Ctrl/Cmd+Z')} disabled={!undoHistory.history.past.length||importing||exporting} onClick={()=>undoHistory.step('undo')}>↶</Button><Button variant="ghost" aria-label={t('Redo')} data-hint={t('Redo · Ctrl/Cmd+Shift+Z')} disabled={!undoHistory.history.future.length||importing||exporting} onClick={()=>undoHistory.step('redo')}>↷</Button></div>}
      </div>
      {!profile&&<div className={`${styles.toolbarGroup} ${styles.toolbarSettings}`} role="group" aria-label={t('Card settings')}>{editing&&<label className={styles.toolbarManual}><input type="checkbox" checked={manualEditor} onChange={event=>setManualEditor(event.target.checked)}/>{t('Advanced editor')}</label>}
        <details ref={moreActions} className={styles.toolbarMore}><summary role="button" aria-label={t('More actions')} data-hint={t('More actions')}>···</summary>
        <div className={styles.toolbarMenu} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button'))moreActions.current?.removeAttribute('open');}}>
          <Button variant="ghost" onClick={()=>{setDraft({...demoMmoDraft(catalog),updatedAt:new Date().toISOString()});setEditing(false);setManualEditor(false);setNotice(t('Test data filled the card.'));}}>{t('Test data')}</Button>
          {draft.source&&!draft.demo&&<Button variant="ghost" disabled={!mmoCardEdited(draft,catalog)} onClick={()=>{const source=draft.source!;const restored=mmoDraftFromCapture(source.capture,catalog).draft;change(next=>{Object.assign(next,restored,{source,art:next.art,role:next.role});});}}>{t('Restore imported values','Восстановить данные импорта')}</Button>}
          <Button variant="ghost" className={styles.clearAction} onClick={()=>setConfirmClear(true)}>{t('Clear')}</Button></div></details>
        <details ref={artMenu} className={`${styles.toolbarMore} ${styles.toolbarArt}`}><summary role="button" aria-label={t('Background')} data-hint={t('Background')}><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg><span>{t('Background')}</span></summary>
          <div className={`${styles.toolbarMenu} ${styles.artMenu}`} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button'))artMenu.current?.removeAttribute('open');}}>
            <Button variant="outline" disabled={importing||exporting} onClick={()=>requestEdit('art')}>{t('Choose background')}</Button>
            <Button variant="outline" disabled={importing||exporting} onClick={()=>requestEdit('art-position')}>{t('Move background')}</Button>
            <Button variant="ghost" disabled={importing||exporting} onClick={()=>change(next=>{next.art={id:next.art.id,zoom:1,x:50,y:50};})}>{t('Reset artwork')}</Button>
          </div></details></div>}
      <div className={styles.toolbarRight} role="group" aria-label={t('Export')}>
        {!profile&&<MmoSaveButton draft={draft} catalog={catalog} locale={locale} disabled={importing||exporting} onQueue={setQueueJob}
          onSaved={(message,href)=>{setSavedVersion(n=>n+1);setNotice(message);router.prefetch(href);}}/>}
        <ExportButton busy={exporting} disabled={!!profileError} onClick={exportPng}>{exporting?t('Exporting…'):t('Export PNG')}</ExportButton></div>
    </div>
    <input ref={fileInput} hidden type="file" accept=".tofbuild,.json" aria-label={t('MMO build capture file')} onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';if(file)void importCapture(file);
    }}/>
    {importing&&!queueJob&&<Toast eventKey="mmo-build-file-upload" duration={null}><div className="flex items-center gap-2"><Spinner size="sm" aria-label={t('Uploading')}/><span>{t('Preparing and sending the build file to the server…')}</span></div></Toast>}
    <QueueNotice job={queueJob} locale={locale}/>
    {profileError?<div className={styles.editorHeading}><div><h2>{profileError==='not-found'?t('No public MMO build here'):t('Public builds are unavailable')}</h2>
      <p>{profileError==='not-found'?t('This character has no saved MMO build for this role.'):t('The server is not connected. Try again later.')}</p></div></div>
      :<MmoBuildEditing locked={!editing||!!profile||importing||exporting} draft={draft} catalog={catalog} locale={locale} change={change} request={editRequest}><BuildInspection locale={locale}><div ref={stage} className={styles.stage}><CardPreview scale={scale}><MmoBuildCard draft={draft} catalog={catalog} locale={locale} cardRef={card}
        onRoleChange={profile?undefined:role=>change(next=>{if(role)next.role=role;else delete next.role;})}
          onSeasonChange={profile||importing||exporting?undefined:season=>change(next=>{next.profile.season=season;})}
          onImportRequest={profile?undefined:()=>setAppRequest(n=>n+1)}/></CardPreview></div></BuildInspection>
    {manualEditor&&editing&&!profile&&<><div className={styles.editorHeading}><div><h2>{t('Advanced editor')}</h2><p>{t('Drafts save in this browser. A public build keeps the imported values: edits stay in this browser only.')}</p></div></div>
      <MmoAdvancedEditor draft={draft} catalog={catalog} locale={locale} change={change}/></>}
    </MmoBuildEditing>}
    <Dialog isOpen={confirmDemoEdit} onClose={()=>setConfirmDemoEdit(false)} appearance="table" type="warning" viewportTopInset={demoInset}
      title={t('Start editing?','Начать редактирование?')} description={t('The demo build will be cleared from this browser. You can start editing an empty build right away.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Start editing','Начать редактирование')} onConfirm={()=>{setConfirmDemoEdit(false);setDraft(emptyMmoDraft(catalog));setEditing(true);}}/>
    <Dialog isOpen={confirmClear} onClose={()=>setConfirmClear(false)} appearance="table" type="warning" viewportTopInset={clearInset}
      title={t('Clear this build?')} description={t('The current MMO card will be cleared in this browser.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Clear')} onConfirm={()=>{setConfirmClear(false);setDraft({...emptyMmoDraft(catalog),updatedAt:new Date().toISOString()});}}/>
  </div>;
}
