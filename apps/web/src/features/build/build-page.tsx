'use client';
import { fillText } from '@/lib/i18n/text';
import {localeText} from '@/lib/i18n/text';
import {loadLocalArtwork,saveLocalArtwork,saveLocalArtworkSettings,removeLocalArtwork} from '@/lib/local-artwork';
import {QueueNotice} from '../queue/queue-notice';
import type {QueueJob} from '../queue/client';
import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {RouteLoading} from '@/components/site-shell/route-loading';
import {Button,Dialog,ExportButton,ModeSwitcher,ServerModeSwitcher,Spinner,Toast,ToastMirror,useToast} from '@tof-hub/ui';
import {useRouter} from 'next/navigation';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import {useLocale} from '@/lib/i18n';
import {BuildInfoRail} from './build-info';
import {loadDomSnapshot,waitForDomSnapshotAssets} from '@/lib/dom-snapshot';
import {downloadPng} from '@/lib/download';
import {BuildCard,CardPreview} from './build-card';
import {lazy,Suspense} from 'react';
const BuildEditor=lazy(()=>import('./build-editor').then(module=>({default:module.BuildEditor})));
import {BuildInspection} from './build-inspection';
import {BuildEditing} from './build-editing';
import {setConsumableRemainingTime} from './consumable-expiry';
import {DRAFT_KEY,centredArt,randomLoadingArtwork,emptyDraft,restoreDraft,supportSystem,summaryStats} from './model';
import {BUILD_CARD_WIDTH,buildCardHeight,BUILD_EXPORT_SCALE} from './layout';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import styles from './build.module.css';
import {useDraftHistory,draftEditGroup,withCustomArtwork,withoutCustomArtwork,buildArtworkSettings,type BuildArtworkSettings} from './draft-history';
import {markCaptureEdit} from './capture-source';
import {verifyBuildCard} from './card-verification';
import {CaptureOriginNotice,captureOriginLabel} from './capture-origin';
import {ProfileMenu,SaveProfileButton} from './profile-bar';
import {draftUid,fetchProfiles,loadProfileDraft,profileArtwork,profileHref} from './profiles';
import {copyText} from '@/lib/clipboard';
import {checkRasterFile} from '@/lib/raster-file';
import {useSavedBuildRanking,type SavedRankingSource} from './use-saved-build-ranking';
import {BUILD_IMPORT_ROUTES,stashBuildImport,takeBuildImport,type BuildImportResult} from './import-handoff';
import type {MmoPageMismatchError} from './mmo/capture-import';
import {backpackForDraft,OPTIMIZER_STORAGE_KEY,restoreOptimizerSession,saveImportedBuild,syncDemoBuildToOptimizer} from './browser-storage';


/**
 * `profile`: a saved profile route (/tools/build/<uid>/[<slot>]/). The card is rebuilt from the saved capture and never
 * written to this browser's draft by editing; a deliberate file import replaces both browser views.
 */
export function BuildPage({catalog,profile,preview}:{catalog:BuildCatalog;profile?:{uid:string;slot:string|null};preview?:BuildDraft}) {
  const {locale}=useLocale();
  const t=localeText(locale);
  const router=useRouter();
  const undoHistory=useDraftHistory(()=>({draft:emptyDraft(catalog),customArt:''}));
  const {draft,customArt}=undoHistory.history.present;
  const cardHeight=buildCardHeight(summaryStats(draft,catalog).length);
  const [ready,setReady]=useState(false);
  const [confirmClear,setConfirmClear]=useState(false);
  const closeClear=useCallback(()=>setConfirmClear(false),[]);
  const clearInset=useSiteHeaderInset(confirmClear);
  const [confirmDemoEdit,setConfirmDemoEdit]=useState(false);
  const demoEditInset=useSiteHeaderInset(confirmDemoEdit);
  const {notify,dismiss}=useToast(),noticeId=useId();
  const shareNoticeId=useId();
  const setNotice=useCallback((message:string)=>{if(message)notify(message,{id:noticeId});else dismiss(noticeId);},[notify,dismiss,noticeId]);
  const [scale,setScale]=useState(1);
  const [full,setFull]=useState(false);
  const [cardFullscreen,setCardFullscreen]=useState(false);
  const [manualEditor,setManualEditor]=useState(false);
  const [importing,setImporting]=useState(false);
  /** The import or save waiting in the shared queue (docs/architecture/job-queue.md). */
  const [queueJob,setQueueJob]=useState<QueueJob|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const toolbar=useRef<HTMLDivElement>(null);
  const artInput=useRef<HTMLInputElement>(null);
  const moreActions=useRef<HTMLDetailsElement>(null);
  const artMenu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    // Toolbar menus (More actions, Background) close on an outside press or Escape.
    const menus=()=>[moreActions.current,artMenu.current].filter((menu):menu is HTMLDetailsElement=>!!menu);
    const outside=(event:PointerEvent)=>{for(const menu of menus())if(event.target instanceof Node&&!menu.contains(event.target))menu.removeAttribute('open');};
    const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;for(const menu of menus())if(menu.open){menu.removeAttribute('open');menu.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  const editorHeading=useRef<HTMLDivElement>(null);
  const [exporting,setExporting]=useState(false);
  const [editingLocked,setEditingLocked]=useState(true);

  const [positioningArt,setPositioningArt]=useState(false);
  const [artPickerRequest,setArtPickerRequest]=useState(0);
  const artPositionControl=useRef<HTMLDivElement>(null);
  const artPreview=useRef<{x:number;y:number;paint:(zoom:number)=>void}|null>(null);
  const stage=useRef<HTMLDivElement>(null);
  const card=useRef<HTMLElement>(null);
  const artworkUrls=useRef(new Set<string>());
  const artworkFiles=useRef(new Map<string,Blob>());
  const savedArtworkUrl=useRef('');
  const pendingArtworkUrl=useRef('');
  const [artworkRestored,setArtworkRestored]=useState(false);
  const artGroup=useRef(0);
  const currentDraft=useRef(draft);
  useEffect(()=>{currentDraft.current=draft;},[draft]);
  const saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [profileError,setProfileError]=useState('');
  const [resolvedProfileSlot,setResolvedProfileSlot]=useState<string|null>(profile?.slot??null);
  const [profilesVersion,setProfilesVersion]=useState(0);
  const savedProfile=!!profile&&!preview;
  useLayoutEffect(()=>{
    if(!savedProfile&&!cardFullscreen)return;
    const root=document.documentElement,body=document.body;
    const previousRootOverflow=root.style.overflow,previousBodyOverflow=body.style.overflow;
    window.scrollTo(0,0);
    root.style.overflow='hidden';body.style.overflow='hidden';
    return()=>{root.style.overflow=previousRootOverflow;body.style.overflow=previousBodyOverflow;};
  },[savedProfile,cardFullscreen]);
  const [savedRankingSource,setSavedRankingSource]=useState<SavedRankingSource|null>(null);
  const rankingSource=profile?.uid===savedRankingSource?.uid?savedRankingSource:null;
  const rankingEdited=!!draft.captureSource&&(
    (draft.captureSource.kind==='manual'&&!!draft.captureSource.signature)||
    (!!rankingSource&&draft.captureSource.digest===rankingSource.digest&&JSON.stringify(draft.gear)!==rankingSource.gear));
  const ranking=useSavedBuildRanking(draft,catalog,rankingSource,!rankingEdited);
  /** The Optimizer store's backpack of the same file; reread after imports and writes from the Optimizer tab. */
  const [backpackVersion,setBackpackVersion]=useState(0);
  useEffect(()=>{
    const reread=()=>setBackpackVersion(n=>n+1);
    window.addEventListener('storage',reread);
    return ()=>window.removeEventListener('storage',reread);
  },[]);
  const backpack=useMemo(()=>backpackForDraft(draft,catalog),
    [draft.demo,draft.captureSource?.digest,backpackVersion,catalog]);
  // The demo card's "Import your build" opens the capture app dialog first: a .tofbuild needs the app.
  const [appRequest,setAppRequest]=useState(0);
  useEffect(()=>{
    if(!profile)return;
    setEditingLocked(true);setManualEditor(false);setPositioningArt(false);setFull(false);
    setResolvedProfileSlot(profile.slot);
    setSavedRankingSource(null);
    if(preview){currentDraft.current=preview;undoHistory.reset({draft:preview,customArt:''});setProfileError('');setReady(true);return;}
    // A saved profile: the open slot, or the UID's first profile when the URL names none.
    const controller=new AbortController();
    (async()=>{
      try {
        const slot=profile.slot??(await fetchProfiles(profile.uid,controller.signal)).profiles[0]?.slot;
        if(!slot){setProfileError(t('This UID has no saved profiles.'));return;}
        setResolvedProfileSlot(slot);
        const loaded=await loadProfileDraft(profile.uid,slot,catalog,locale,controller.signal);
        if(controller.signal.aborted)return;
        if(loaded.captureSource)setSavedRankingSource({uid:profile.uid,slot,digest:loaded.captureSource.digest,gear:JSON.stringify(loaded.gear)});
        currentDraft.current=loaded;undoHistory.reset({draft:loaded,customArt:''});setProfileError('');
      } catch(error) {
        if(!controller.signal.aborted)setProfileError(error instanceof Error&&error.message==='not-found'?t('This profile is not saved.'):t('The profile could not be loaded.'));
      } finally {if(!controller.signal.aborted)setReady(true);}
    })();
    return ()=>controller.abort();
    // The profile's own locale is applied once; switching the site language keeps the card.
  },[catalog,profile?.uid,profile?.slot,preview]);
  useEffect(()=>{
    if(profile)return;
    let active=true;
    void (async()=>{try {
      const stored=localStorage.getItem(DRAFT_KEY);
      if(stored){const restored=restoreDraft(JSON.parse(stored),catalog);if(restored){
        let refreshed=restored;
        if(restored.captureSource?.kind==='file')try {const {refreshCapturedDraft}=await import('./capture-import');refreshed=await refreshCapturedDraft(restored,catalog,locale);}catch {if(active)setNotice(t('Could not refresh the saved capture. Its cached values are still shown.'));}
        if(!active)return;
        undoHistory.reset({draft:{...refreshed,updatedAt:refreshed.updatedAt??new Date().toISOString()},customArt:''});
      }else if(active)setNotice(t('The saved draft could not be restored.'));}
      else undoHistory.reset({draft:{...structuredClone(catalog.demoDraft),updatedAt:new Date().toISOString()},customArt:''});
    } catch {if(active)setNotice(t('Browser storage is unavailable.'));}
    if(active)setReady(true);})();
    return()=>{active=false;};
    // Locale changes do not reload or replace the user's draft.
  },[catalog]);
  // A Gacha file imported on the MMO page arrives here once, after the stored draft is restored.
  useEffect(()=>{
    if(!ready||profile)return;
    const handed=takeBuildImport('gacha');
    if(handed)void importCapture(handed);
  },[ready,profile]);
  useEffect(()=>{
    if(!ready||profile)return;
    let active=true;
    void loadLocalArtwork<BuildArtworkSettings|BuildDraft['art']>('build').then(saved=>{
      if(!active||!saved||artworkFiles.current.size)return;
      const settings=saved.settings;
      const art='version' in settings?settings.art:settings;
      if(![art.x,art.y,art.zoom].every(Number.isFinite)||art.zoom<=0)return;
      const url=URL.createObjectURL(saved.file);
      artworkUrls.current.add(url);artworkFiles.current.set(url,saved.file);savedArtworkUrl.current=url;
      const present=undoHistory.current.current.present;
      const siteArt=profileArtwork('version' in settings?settings.siteArt:centredArt({...present.draft.art,zoom:1}),catalog,draftUid(present.draft)??'local')??centredArt({...present.draft.art,zoom:1});
      const next={...present,draft:{...present.draft,art:{...present.draft.art,...art}},siteArt,customArt:url};
      currentDraft.current=next.draft;undoHistory.reset(next);
    }).catch(()=>{}).finally(()=>{if(active)setArtworkRestored(true);});
    return()=>{active=false;};
  },[ready,profile]);
  useEffect(()=>{
    if(!artworkRestored||profile)return;
    try {
      if(customArt){
        const file=artworkFiles.current.get(customArt);
        const settings=buildArtworkSettings(undoHistory.current.current.present);
        if(savedArtworkUrl.current===customArt)saveLocalArtworkSettings('build',settings);
        else if(file&&pendingArtworkUrl.current!==customArt){pendingArtworkUrl.current=customArt;void saveLocalArtwork('build',file,settings).then(()=>{
          const latest=undoHistory.current.current.present;
          if(latest.customArt===customArt){savedArtworkUrl.current=customArt;saveLocalArtworkSettings('build',buildArtworkSettings(latest));}
        }).catch(()=>setNotice(t('The browser could not save your background.'))).finally(()=>{if(pendingArtworkUrl.current===customArt)pendingArtworkUrl.current='';});}
      }else if(savedArtworkUrl.current||pendingArtworkUrl.current){savedArtworkUrl.current='';pendingArtworkUrl.current='';void removeLocalArtwork('build').catch(()=>setNotice(t('Could not remove the saved background.')));}
    }catch {setNotice(t('The browser could not save background settings.'));}
  },[artworkRestored,customArt,draft.art,profile]);
  useLayoutEffect(()=>{
    const node=stage.current;if(!node)return;
    const resize=()=>{
      if(cardFullscreen){setScale(Math.min(node.clientWidth/BUILD_CARD_WIDTH,node.clientHeight/cardHeight));return;}
      const top=node.getBoundingClientRect().top+window.scrollY;
      node.closest<HTMLElement>('[data-static]')?.style.setProperty('--build-toolbar-height',`${toolbar.current?.offsetHeight??48}px`);
      const availableHeight=Math.max(1,window.innerHeight-top-(toolbar.current?.offsetHeight??48)-24);
      setScale(full?1:Math.min(1,node.clientWidth/BUILD_CARD_WIDTH,availableHeight/cardHeight));
    };
    const observer=new ResizeObserver(resize);observer.observe(node);if(toolbar.current)observer.observe(toolbar.current);resize();
    window.addEventListener('resize',resize);
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize);};
  },[full,cardFullscreen,cardHeight,ready,manualEditor,editingLocked]);
  useEffect(()=>{
    if(!ready)return;
    const node=stage.current;if(!node)return;
    const exit=()=>{
      setCardFullscreen(false);
      if(document.fullscreenElement===node)void document.exitFullscreen().catch(()=>{});
    };
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&cardFullscreen){event.preventDefault();exit();return;}
      if(event.key!=='F11'||event.ctrlKey||event.altKey||event.metaKey)return;
      event.preventDefault();if(event.repeat)return;
      if(cardFullscreen||document.fullscreenElement===node){exit();return;}
      setPositioningArt(false);setCardFullscreen(true);
      // Keep the card-only viewport even when the browser denies the native fullscreen request.
      if(node.requestFullscreen)void node.requestFullscreen().catch(()=>{});
    };
    const changed=()=>setCardFullscreen(document.fullscreenElement===node);
    window.addEventListener('keydown',keydown,true);
    document.addEventListener('fullscreenchange',changed);
    return()=>{window.removeEventListener('keydown',keydown,true);document.removeEventListener('fullscreenchange',changed);};
  },[ready,cardFullscreen]);
  useEffect(()=>()=>{for(const url of artworkUrls.current)URL.revokeObjectURL(url);if(saveTimer.current)clearTimeout(saveTimer.current);},[]);
  useEffect(()=>{
    if(!ready)return;
    if(profile)return;
    const flush=()=>{try {const pending=artPreview.current;const saved=pending?{...currentDraft.current,art:{...currentDraft.current.art,offsetX:pending.x,offsetY:pending.y}}:currentDraft.current;localStorage.setItem(DRAFT_KEY,JSON.stringify(saved));if(savedArtworkUrl.current&&savedArtworkUrl.current===undoHistory.current.current.present.customArt)saveLocalArtworkSettings('build',buildArtworkSettings({...undoHistory.current.current.present,draft:saved}));}catch {/* The save effect reports storage failures. */}};
    window.addEventListener('pagehide',flush);
    return ()=>{window.removeEventListener('pagehide',flush);flush();};
  },[ready]);
  useEffect(()=>{
    if(!ready||profile)return;
    saveTimer.current=setTimeout(()=>{
      try {localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}
      catch {setNotice(t('The draft could not be saved. Keep this tab open or export the card.'));}
    },300);
    return ()=>{if(saveTimer.current)clearTimeout(saveTimer.current);};
  },[draft,ready]);
  useEffect(()=>{
    if(!positioningArt)return;
    artGroup.current++;
    artPositionControl.current?.focus({preventScroll:true});
    const image=card.current?.querySelector<HTMLElement>('.hero-art');
    const bounds=card.current?.getBoundingClientRect();
    if(!image||!bounds)return;
    let frame=0;
    let pointer:{x:number;y:number}|null=null;
    const preview={x:currentDraft.current.art.offsetX??0,y:currentDraft.current.art.offsetY??0,paint:(zoom:number)=>{image.style.transform=`translate(${preview.x}%, ${preview.y}%) scale(${zoom})`;}};
    artPreview.current=preview;
    image.style.willChange='transform';
    const paint=()=>{frame=0;preview.paint(currentDraft.current.art.zoom);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    // Press anywhere on the card and drag; the overlay covers every card control while positioning.
    const control=artPositionControl.current;
    const down=(event:PointerEvent)=>{if(event.button!==0)return;event.preventDefault();control?.setPointerCapture(event.pointerId);pointer={x:event.clientX,y:event.clientY};};
    const move=(event:PointerEvent)=>{
      if(!pointer||!(event.buttons&1)){pointer=null;return;}
      preview.x+=(event.clientX-pointer.x)/bounds.width*100;preview.y+=(event.clientY-pointer.y)/bounds.height*100;schedule();
      pointer={x:event.clientX,y:event.clientY};
    };
    const up=()=>{pointer=null;};
    control?.addEventListener('pointerdown',down);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
    const keys=(event:KeyboardEvent)=>{
      const delta=event.shiftKey?5:1;
      const moves:Record<string,[number,number]>={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
      const move=moves[event.key];
      if(move&&!(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))){event.preventDefault();preview.x+=move[0];preview.y+=move[1];schedule();}
    };
    const finish=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setPositioningArt(false);}};
    window.addEventListener('pointermove',move);
    window.addEventListener('keydown',keys);
    window.addEventListener('keydown',finish);
    return ()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('keydown',keys);window.removeEventListener('keydown',finish);
      control?.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
      if(frame)cancelAnimationFrame(frame);
      preview.paint(currentDraft.current.art.zoom);
      image.style.willChange='';
      artPreview.current=null;
      const previous=undoHistory.current.current.present;
      const next={...previous,draft:{...previous.draft,art:{...previous.draft.art,offsetX:preview.x,offsetY:preview.y},updatedAt:new Date().toISOString()}};
      currentDraft.current=next.draft;undoHistory.commit(next,`art-position:${artGroup.current}`,true);
    };
  },[positioningArt]);
  useLayoutEffect(()=>{artPreview.current?.paint(draft.art.zoom);},[draft.art.zoom]);
  const change=(mutate:(d:BuildDraft)=>void)=>{
    if(importing)return;
    const previous=undoHistory.current.current.present;
    const next=structuredClone(previous.draft);mutate(next);
    next.updatedAt=new Date().toISOString();
    const cap=supportSystem(next,catalog).maxModuleLevel;
    next.support.forEach(m=>{m.level=Math.min(m.level,cap);});
    markCaptureEdit(previous.draft,next);
    const group=positioningArt?`art-position:${artGroup.current}`:draftEditGroup(previous.draft,next);
    currentDraft.current=next;undoHistory.commit({...previous,draft:next,customArt:next.art.id!==previous.draft.art.id?'':previous.customArt,
      siteArt:next.art.id!==previous.draft.art.id?undefined:previous.siteArt},group,positioningArt);
  };
  useEffect(()=>{
    const retained=new Set([...undoHistory.history.past,undoHistory.history.present,...undoHistory.history.future].map(snapshot=>snapshot.customArt));
    for(const url of artworkUrls.current)if(!retained.has(url)){URL.revokeObjectURL(url);artworkUrls.current.delete(url);artworkFiles.current.delete(url);}
  },[undoHistory.history]);
  const travel=(direction:'undo'|'redo')=>{
    if(positioningArt||exporting||importing)return;
    const snapshot=undoHistory.step(direction);
    currentDraft.current=snapshot.draft;setNotice('');
  };
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey||positioningArt||exporting)return;
      if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      const key=event.key.toLowerCase();
      const direction=key==='z'?(event.shiftKey?'redo':'undo'):key==='y'?'redo':null;
      if(direction){event.preventDefault();travel(direction);}
    };
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
  });
  function replaceDraft(next:BuildDraft,options:{randomizeBackground?:boolean}={}) {
    setSavedRankingSource(null);
    const replacement=structuredClone(next);replacement.updatedAt=new Date().toISOString();
    const previous=undoHistory.current.current.present;
    const randomBackground=options.randomizeBackground?randomLoadingArtwork(catalog,Math.random,previous.draft.art.id):'';
    const keepArt=!replacement.art.id&&!randomBackground;
    if(randomBackground)replacement.art={...centredArt(replacement.art),id:randomBackground};
    else if(keepArt)replacement.art=previous.draft.art.id||previous.customArt?{...previous.draft.art}:{...replacement.art,id:randomLoadingArtwork(catalog)};
    currentDraft.current=replacement;undoHistory.commit({draft:replacement,customArt:keepArt?previous.customArt:'',siteArt:keepArt?previous.siteArt:undefined});setNotice('');
    if(saveTimer.current)clearTimeout(saveTimer.current);
    let saved=true;
    if(profile)return saved;
    try {localStorage.setItem(DRAFT_KEY,JSON.stringify(replacement));}catch {saved=false;setNotice(t('The draft could not be saved.'));}
    return saved;
  }
  function resetArtwork(){undoHistory.commit(withoutCustomArtwork(undoHistory.current.current.present));}
  /** A file chosen here, or a server result handed over by the MMO page (import-handoff.ts). */
  async function importCapture(source:File|BuildImportResult) {
    setImporting(true);setNotice('');
    try {
      const {importBuildCapture,buildCaptureFromResult,serverRefusalNotice}=await import('./capture-import');
      const handedOver=!(source instanceof File);
      const imported=handedOver?await buildCaptureFromResult(source,catalog,locale):await importBuildCapture(source,catalog,locale,setQueueJob),next=imported.draft;
      // Values the catalog does not know stay empty; their list is in the capture-date tooltip (no block moves the page).
      const missing=next.captureSource?.unresolved?.length??0;
      replaceDraft(next,{randomizeBackground:true});
      const {failed}=saveImportedBuild({...imported,draft:currentDraft.current},catalog);
      setBackpackVersion(n=>n+1);
      setNotice((handedOver?t('The file was imported on the MMO page and opened here. '):'')+(failed.length?t('Build imported, but browser storage could not save both pages.')
        :missing?fillText(t('Build and Optimizer filled from the file. Part of the profile was not captured at game login: {0}, listed in capture info.', 'Билд и оптимайзер заполнены из файла. Часть профиля не была заснята при входе в игру ({0}), список — в подсказке о скане.'), [missing])
        :t('Build and Optimizer filled from the file.'))
        +serverRefusalNotice(imported.serverRefusal,locale,imported.outdatedExporter));
    } catch(error) {
      // A login snapshot under flat/unknown temporary ATK cannot be corrected: ask for a clean capture.
      if(error instanceof Error&&error.name==='TemporaryAttackError')setNotice(fillText(t('At login, temporary ATK buffs were active ({0}). Leave combat, wait for them to expire, re-enter the game and capture again.', 'При входе были активны временные бафы ATK ({0}). Выйдите из боя, дождитесь окончания бафов, перезайдите в игру и снимите заново.'), [(error as Error&{buffs:string}).buffs]));
      // A file refused by the first gate (wrong type, damaged, cut off) says why.
      else if(error instanceof Error&&error.name==='SealedFileError')setNotice(`${t('Could not import the .tofbuild file.')} ${error.message}`);
      // The other mode's file: its server result moves to that page, which shows the card (no second upload).
      else if(error instanceof Error&&error.name==='MmoPageMismatchError') {
        const mismatch=error as MmoPageMismatchError;
        if(stashBuildImport(mismatch.result))router.push(BUILD_IMPORT_ROUTES[mismatch.target]);else setNotice(error.message);
      }
      else setNotice(`${t('Could not import the .tofbuild file. Check the file and server connection.')}${error instanceof Error&&error.message?` ${error.message}`:''}`);
    }
    finally {setImporting(false);setQueueJob(null);}
  }
  async function exportPng() {
    if(!card.current)return;
    // Verification and rendering must use the same immutable snapshot, including across awaits and offline repeats.
    const exportDraft=structuredClone(draft);
    const exportBackpack=backpack?structuredClone(backpack):undefined;
    const exportRanking=ranking?structuredClone(ranking):undefined;
    setExporting(true);setNotice('');
    let container:HTMLDivElement|null=null;
    try {
      const [library,provenance,{createBuildExportCard}]=await Promise.all([
        loadDomSnapshot(),verifyBuildCard(exportDraft,catalog),import('./build-export-card'),
      ]);
      container=document.createElement('div');container.className=styles.preview;
      container.style.cssText=`position:fixed;left:-20000px;top:0;width:${BUILD_CARD_WIDTH}px;height:${cardHeight}px;pointer-events:none;`;
      const clone=createBuildExportCard({draft:exportDraft,catalog,locale,customArt,backpack:exportBackpack,ranking:exportRanking,rankingEdited});
      clone.removeAttribute('data-stat-highlight');
      clone.removeAttribute('data-editing');
      clone.querySelectorAll('.module-edit-level,.matrix-edit-level,.mark-edit-control,.art-edit-control,[data-capture-flag]').forEach(node=>node.remove());
      // Keep a clear demo label in exported sample cards; regular cards retain the profile signature.
      clone.querySelectorAll('.demo-cta').forEach(node=>{const signature=document.createElement('p');signature.className=exportDraft.demo?'profile-signature tof-demo-label':'profile-signature';signature.textContent=exportDraft.demo?t('DEMO PROFILE'):(exportDraft.profile.signature||'—');node.replaceWith(signature);});
      // User-authored signatures stay literal text in the PNG; typed HTML tags are never parsed as markup.
      if(!exportDraft.demo)clone.querySelectorAll('.profile-signature').forEach(node=>{node.textContent=exportDraft.profile.signature||'—';});
      clone.querySelectorAll('[data-build-edit]').forEach(node=>{node.removeAttribute('data-build-edit');node.removeAttribute('role');node.removeAttribute('tabindex');});
      clone.querySelectorAll('[data-matrix-highlight]').forEach(node=>node.removeAttribute('data-matrix-highlight'));
      // Inline number fields (enemy level while editing) keep their live value only as a DOM property, which cloneNode
      // drops: print each one as plain text with the original field's current value.
      clone.querySelectorAll<HTMLInputElement>('input[data-build-edit-skip]').forEach(input=>{
        const text=document.createElement('b');text.className=input.className.replace(/\S*inlineNumber\S*/g,'').trim()||'level-value';
        text.textContent=input.value;input.replaceWith(text);
      });
      const exportProvenance=exportDraft.demo?'demo':provenance;
      clone.querySelectorAll('[data-export-active]').forEach(node=>node.removeAttribute('data-export-active'));
      clone.querySelector(`[data-export-provenance="${exportProvenance}"]`)?.setAttribute('data-export-active','');
      clone.style.transform='none';container.appendChild(clone);document.body.appendChild(container);
      await waitForDomSnapshotAssets(clone);
      const png=await library.toPng(clone,{pixelRatio:BUILD_EXPORT_SCALE,width:BUILD_CARD_WIDTH,height:cardHeight,cacheBust:false});
      downloadPng(png,`tof-build-${(exportDraft.profile.name||'wanderer').replace(/[^\p{L}\p{N}_-]/gu,'-')}.png`);
      const status=exportProvenance==='demo'?t('Demo'):exportProvenance==='verified'?t('Verified'):exportProvenance==='edited'?t('Edited'):captureOriginLabel(exportProvenance,locale,'export',exportDraft.captureSource?.capture.capture.scan?.distribution);
      setNotice(fillText(t('PNG exported · {0} × {1} · {2}', 'PNG экспортирован · {0} × {1} · {2}'), [BUILD_CARD_WIDTH*BUILD_EXPORT_SCALE, cardHeight*BUILD_EXPORT_SCALE, status]));
    } catch {setNotice(t('PNG export failed. Try again after the images have loaded.'));}
    finally {container?.remove();setExporting(false);}
  }
  async function shareSavedProfile() {
    if(!profile)return;
    const slot=resolvedProfileSlot??profile.slot;
    if(!slot)return;
    const copied=await copyText(new URL(profileHref(profile.uid,slot),window.location.origin).toString());
    notify(copied?t('Card link copied to clipboard.'):t('Could not copy the card link.'),{id:shareNoticeId,tone:copied?'info':'error'});
  }
  if(!ready)return <RouteLoading/>;
  return <div className={styles.page} data-static={savedProfile||(!manualEditor&&!full)}><h1 className="sr-only">{t('Build card')}</h1>
    <CaptureOriginNotice draft={draft} locale={locale}/>
    {/* Phones in portrait: the 1760px card is not readable, so only this prompt is shown until the device is turned. */}
    <div className={styles.rotateNotice} role="status"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="15" y="6" width="18" height="30" rx="3"/><path d="M24 31.5h.01"/><path d="M8 30a16 16 0 0 0 13 13.5"/><path d="M17 41l4 2.5-1.5 4"/></svg>
      <strong>{t('Turn your device')}</strong>
      <span>{t('The build card is wide: hold the phone horizontally to view and edit it.')}</span></div><BuildInfoRail appRequest={appRequest} locale={locale} catalog={catalog} draft={draft} viewing={profile} profilesVersion={profilesVersion} onImport={()=>{if(!importing&&!exporting&&!positioningArt)fileInput.current?.click();}}/>
    <div ref={toolbar} className={styles.exportAction} style={{width:BUILD_CARD_WIDTH*scale}}>
      <div className={`${styles.toolbarGroup} ${savedProfile?styles.shareNoticeAnchor:''}`} role="group" aria-label={t('Editing')}>
        {savedProfile&&<ToastMirror id={shareNoticeId} className={styles.shareNoticeMirror}/>}
        {!savedProfile&&<ServerModeSwitcher value="gacha" ariaLabel={t('Game mode')} onChange={mode=>{if(mode==='mmo')router.push('/tools/build/mmo/');}}/>}
        {savedProfile?<button type="button" className={styles.toolbarEdit} disabled={!!profileError||(!resolvedProfileSlot&&!profile?.slot)} onClick={()=>void shareSavedProfile()}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg><span>{t('Share card')}</span></button>:<label className={styles.toolbarEdit}><input aria-label={t('Lock editing')} type="checkbox" disabled={!ready} checked={editingLocked} onChange={e=>{if(!e.target.checked&&draft.demo){setConfirmDemoEdit(true);return;}setEditingLocked(e.target.checked);setPositioningArt(false);if(e.target.checked){setFull(false);setManualEditor(false);}else if(window.innerWidth<760)setFull(true);}}/><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={editingLocked?"M8 10V6a4 4 0 0 1 8 0v4":"M8 10V6a4 4 0 0 1 8 0"}/></svg><span>{editingLocked?t('Edit card'):t('Finish editing')}</span></label>}
        {!savedProfile&&<div className={styles.historyControls}><Button variant="ghost" aria-label={t('Undo')} data-hint={t('Undo · Ctrl/Cmd+Z')} disabled={!undoHistory.history.past.length||positioningArt||exporting} onClick={()=>travel('undo')}>↶</Button><Button variant="ghost" aria-label={t('Redo')} data-hint={t('Redo · Ctrl/Cmd+Shift+Z')} disabled={!undoHistory.history.future.length||positioningArt||exporting} onClick={()=>travel('redo')}>↷</Button></div>}
      </div>
      {!savedProfile&&<div className={`${styles.toolbarGroup} ${styles.toolbarSettings}`} role="group" aria-label={t('Card settings')}>{!editingLocked&&<label className={styles.toolbarManual}><input type="checkbox" checked={manualEditor} onChange={event=>{setManualEditor(event.target.checked);if(!event.target.checked)setFull(false);}}/>{t('Advanced editor')}</label>}<details ref={moreActions} className={styles.toolbarMore}><summary role="button" aria-label={t('More actions')} data-hint={t('More actions')}>···</summary><div className={styles.toolbarMenu} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button'))moreActions.current?.removeAttribute('open');}}><Button variant="ghost" disabled={!ready} onClick={()=>{const example=restoreDraft({...catalog.demoDraft,demo:true},catalog);if(example){const observedAt=Date.now();for(const [id,seconds] of Object.entries(catalog.demoConsumableRemainingSeconds??{}))setConsumableRemainingTime(example,id,seconds,observedAt);if(replaceDraft(example)){const synced=syncDemoBuildToOptimizer(currentDraft.current,catalog);setNotice(synced?t('Test data filled all build sections and refreshed Optimizer.'):
          t('Test data filled the build, but Optimizer could not be refreshed.'));}}else setNotice(t('Test data is unavailable. Regenerate the build catalog.'));}}>{t('Test data')}</Button><Button variant="ghost" className={styles.clearAction} disabled={!ready||importing||exporting||positioningArt} onClick={()=>{moreActions.current?.querySelector('summary')?.focus({preventScroll:true});setConfirmClear(true);}}>{t('Clear')}</Button></div></details><details ref={artMenu} className={`${styles.toolbarMore} ${styles.toolbarArt}`}><summary role="button" aria-label={t('Background')} data-hint={t('Background')}><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg><span>{t('Background')}</span></summary>
        {/* Choose, move and scale the background; buttons close the menu (moving needs the card free), the slider does not. */}
        <div className={`${styles.toolbarMenu} ${styles.artMenu}`} role="group" aria-label={t('Background')} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button'))artMenu.current?.removeAttribute('open');}}><Button variant="outline" disabled={!ready||exporting||importing} onClick={()=>setArtPickerRequest(n=>n+1)}>{t('Choose background')}</Button><input ref={artInput} hidden aria-label={t('Background image file')} type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(!await checkRasterFile(file)){setNotice(t('Use a valid PNG, JPEG or WebP up to 20 MB and 25 megapixels.'));return;}
      const url=URL.createObjectURL(file);artworkUrls.current.add(url);artworkFiles.current.set(url,file);
      const present=undoHistory.current.current.present;
      // A new image starts centred; the zoom stays as chosen.
      undoHistory.commit(withCustomArtwork(present,url));e.target.value='';
      }}/><Button variant="outline" aria-pressed={positioningArt} onClick={()=>setPositioningArt(active=>!active)}>{positioningArt?t('Done positioning'):t('Move background')}</Button><label className={styles.artScale}><span>{t('Art scale')}</span><input aria-label={t('Art scale')} type="range" min="0.25" max="3" step="0.01" value={draft.art.zoom} onChange={event=>change(d=>{d.art.zoom=Number(event.target.value);})}/><output>{Math.round(draft.art.zoom*100)}%</output></label>{customArt&&<Button variant="ghost" onClick={resetArtwork}>{t('Reset artwork')}</Button>}</div></details></div>}
      <div className={styles.toolbarRight} role="group" aria-label={t('Rating and export')}><div className={styles.rvToggle}><ModeSwitcher value={draft.rv?.mode??'grv'} ariaLabel={t('Roll Value mode')} dataAttribute="data-rv-mode"
        options={[{value:'grv',label:t('Global RV'),tone:'sky'},{value:'prv',label:t('Personal RV'),tone:'gold'}]}
        onChange={mode=>{if(ready)change(d=>{d.rv={...d.rv,element:d.rv?.element??'',includeCrit:true,mode};});}}/></div>{!savedProfile&&<SaveProfileButton draft={draft} catalog={catalog} locale={locale} viewing={!!profile} customArt={!!customArt} siteArt={undoHistory.history.present.siteArt} disabled={!ready||importing||exporting} onQueue={setQueueJob}
        onSaved={(message,href)=>{setProfilesVersion(n=>n+1);const url=new URL(href,window.location.origin).toString();notify(<div className={styles.profileSavedNotice}><span>{message}</span><span className={styles.profileSavedNoticeUrl}>{url}</span><Button variant="outline" size="sm" onClick={async()=>{const copied=await copyText(url);notify(copied?t('Card link copied to clipboard.'):t('Could not copy the card link.'),{id:noticeId});}}>{t('Copy link')}</Button></div>,{id:noticeId});}}/>}<ExportButton busy={exporting} disabled={!ready} onClick={exportPng}>{exporting?t('Exporting…'):t('Export PNG')}</ExportButton></div>
    </div>
    <input ref={fileInput} hidden type="file" accept=".tofbuild,.json" aria-label={t('Build capture file')} onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';if(file)void importCapture(file);
    }}/>
    <BuildEditing artPickerRequest={artPickerRequest} onDemoEditRequest={()=>setConfirmDemoEdit(true)} onPositionArtwork={()=>setPositioningArt(true)} onArtworkUpload={()=>artInput.current?.click()} locked={editingLocked||importing||cardFullscreen} draft={draft} catalog={catalog} locale={locale} change={change}><BuildInspection locale={locale}><div ref={stage} className={styles.stage} data-card-fullscreen={cardFullscreen||undefined} inert={cardFullscreen}><CardPreview scale={scale} height={cardHeight} overlay={positioningArt&&<div ref={artPositionControl} className={styles.artPositionControl} role="button" tabIndex={0} aria-label={t('Move background: drag anywhere on the card, arrow keys to adjust, Enter or Escape to finish')} onKeyDown={event=>{
      if(['Escape','Enter',' '].includes(event.key)){event.preventDefault();setPositioningArt(false);return;}
    }}><span>{t('Drag the picture · Done positioning or Esc to finish')}</span></div>}><BuildCard key={cardFullscreen?"fullscreen":"preview"} draft={draft} catalog={catalog} locale={locale} ranking={ranking} rankingEdited={rankingEdited} cardRef={card} customArt={customArt} backpack={backpack} onImportRequest={()=>setAppRequest(n=>n+1)}/></CardPreview></div></BuildInspection></BuildEditing>
    {importing&&!queueJob&&<Toast eventKey="build-file-upload" duration={null}><div className="flex items-center gap-2"><Spinner size="sm" aria-label={t('Uploading')}/><span>{t('Preparing and sending the build file to the server…')}</span></div></Toast>}
    <QueueNotice job={queueJob} locale={locale}/>
    <Dialog isOpen={confirmClear} onClose={closeClear} appearance="table" type="warning" viewportTopInset={clearInset}
      title={t('Clear this build?')}
      description={t('The current build will be cleared in this browser. Saved profiles and uploaded data will remain.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Clear')}
      onConfirm={()=>{if(!ready||importing||exporting||positioningArt)return;closeClear();replaceDraft(emptyDraft(catalog));}}/>
    <Dialog isOpen={confirmDemoEdit} onClose={()=>setConfirmDemoEdit(false)} appearance="table" type="warning" viewportTopInset={demoEditInset}
      title={t('Replace test data to edit?')}
      description={t('The demo build will be cleared from this browser. You can start editing an empty build right away.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Clear and edit')}
      onConfirm={()=>{if(!ready||importing||exporting||positioningArt)return;setConfirmDemoEdit(false);replaceDraft(emptyDraft(catalog));setEditingLocked(false);if(window.innerWidth<760)setFull(true);}}/>
    <Toast eventKey={profileError} tone="error">{profileError}</Toast>
    {manualEditor&&<><div ref={editorHeading} className={styles.editorHeading}><div><h2>{t('Advanced editor')}</h2><p>{t('Drafts save in this browser. Custom artwork lasts for this session.')}</p></div></div><Suspense fallback={<p role="status" className={styles.note}>{t('Loading advanced editor…')}</p>}><BuildEditor draft={draft} catalog={catalog} locale={locale} change={change}/></Suspense></>}
  </div>;
}
