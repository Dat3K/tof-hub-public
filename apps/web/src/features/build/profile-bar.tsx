'use client';
import { fillText } from '@/lib/i18n/text';
import {localeText} from '@/lib/i18n/text';
import {getPlayerRoleLabel} from '@tof-hub/game-domain';
import {useEffect,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {Button,ExportButton,LoadingState,Modal,ModalBody,ModalFooter,ModalHeader,ModalTitle,Tooltip} from '@tof-hub/ui';
import {gameAsset} from '@tof-hub/game-assets';
import {ROLE_FILTER_OPTIONS} from '../simulacra/constants';
import {verifyBuildCard} from './card-verification';
import {restrictedCaptureOrigin} from './capture-origin';
import {elementLabel,formatBuildDate} from './presentation';
import {draftSlot,draftUid,fetchProfiles,profileArtwork,profileHref,profileSlot,saveProfile,type ProfileElement,type ProfileRole,type ProfileSummary} from './profiles';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import {InfoCard,InfoNote,ToolInfoModal} from '@/components/tool-rail/tool-info-modal';
import type {QueueJob} from '../queue/client';
import styles from './build.module.css';
import {DRAFT_KEY,restoreDraft} from './model';
import {SavedBuildLink} from './saved-build-link';

/** Role icons from the Simulacra role filter (healer = benediction). */
const ROLE_VARIANT={dps:'dps',healer:'benediction',tank:'tank'} as const;
const roleIcon=(role:ProfileRole)=>{const path=ROLE_FILTER_OPTIONS.find(option=>option.id===ROLE_VARIANT[role])?.iconPath;return path?gameAsset(path):undefined;};
const slotLabel=(role:ProfileRole,element:ProfileElement,locale:BuildLocale)=>`${getPlayerRoleLabel(role,locale)} · ${elementLabel(element,locale)}`;

/** The UID's saved profiles; `version` refetches after a save. Null while unknown or when the server has no store. */
function useProfiles(uid:string|null,version:number) {
  const [result,setResult]=useState<{uid:string;version:number;profiles:ProfileSummary[]|null}|null>(null);
  useEffect(()=>{
    if(!uid)return;
    const controller=new AbortController();
    fetchProfiles(uid,controller.signal).then(response=>{if(!controller.signal.aborted)setResult({uid,version,profiles:response.available?response.profiles:null});})
      .catch(()=>{if(!controller.signal.aborted)setResult({uid,version,profiles:null});});
    return ()=>controller.abort();
  },[uid,version]);
  return !uid?[]:result?.uid===uid&&result.version===version?result.profiles:undefined;
}

/**
 * Saved profiles modal opened from the ToolRail.
 */
export function SavedProfilesModal({
  isOpen,
  onClose,
  draft,
  catalog,
  locale,
  viewing,
  version,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  draft: BuildDraft;
  catalog: BuildCatalog;
  locale: BuildLocale;
  viewing?: { uid: string; slot: string | null };
  version: number;
  onImport?: () => void;
}) {
  const t = localeText(locale);
  const [ownUid,setOwnUid]=useState<string|null>(null);
  useEffect(()=>{
    const read=()=>{
      try {
        const own=viewing?restoreDraft(JSON.parse(localStorage.getItem(DRAFT_KEY)??'null'),catalog):draft;
        setOwnUid(!own||own.demo||restrictedCaptureOrigin(own)?null:draftUid(own));
      } catch {setOwnUid(null);}
    };
    read();window.addEventListener('storage',read);return()=>window.removeEventListener('storage',read);
  },[draft,catalog,viewing,isOpen]);
  const uid=ownUid;
  const profiles = useProfiles(uid, version);

  return (
    <ToolInfoModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={uid?`UID ${uid}`:t('Build card')}
      title={t('My builds')}
      intro={t(
        'Saved builds for each role and element combination. Save your card using "Save build" in the toolbar under the card.'
      )}
      closeLabel={t('Close')}
    >
      {!uid ? (
        <InfoCard>
          <h3 className="text-sm font-bold text-white">{t('No character UID on this card')}</h3>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            {t(
              'Import your .tofbuild capture to see this character’s saved builds in this browser.'
            )}
          </p>
          {onImport && (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onImport();
                }}
              >
                {t('Import .tofbuild', 'Импортировать .tofbuild')}
              </Button>
            </div>
          )}
        </InfoCard>
      ) : profiles === undefined ? (
        <LoadingState message={t('Loading your builds…')}/>
      ) : profiles === null ? (
        <InfoNote tone="amber">
          {t('Saved profiles are unavailable: the server is not connected.')}
        </InfoNote>
      ) : !profiles.length ? (
        <InfoCard>
          <p className="text-xs text-slate-300 leading-relaxed">
            {t(
              'No saved builds yet: save the card with the "Save build" button in the toolbar under the card.'
            )}
          </p>
        </InfoCard>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {profiles.map(profile=><SavedBuildLink key={profile.slot} uid={uid} profile={profile} catalog={catalog} locale={locale}
            current={viewing?.uid===uid&&viewing.slot===profile.slot} onOpen={onClose}/>)}
        </div>
      )}
    </ToolInfoModal>
  );
}

/**
 * "Profiles" menu in the toolbar (docs/imports.md): the UID's saved builds, each
 * opening /tools/build/<uid>/<role>-<element>/; on a profile page also the way back to the own card.
 */
export function ProfileMenu({draft,catalog,locale,viewing,version,menuRef}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;
  /** The profile route being shown (`uid` and its open slot); absent on the own card. */
  viewing?:{uid:string;slot:string|null};version:number;menuRef:RefObject<HTMLDetailsElement|null>}) {
  const t=localeText(locale);
  const uid=restrictedCaptureOrigin(draft)?null:viewing?.uid??draftUid(draft);
  const profiles=useProfiles(uid,version);
  // Only cards with a character UID (imported or a profile page) have profiles to show.
  if(!uid)return null;
  return <details ref={menuRef} className={`${styles.toolbarMore} ${styles.toolbarArt}`}>
    <summary role="button" aria-label={t('Saved profiles')}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      <span>{t('Profiles')}</span>{profiles?.length?<b className={styles.menuCount}>{profiles.length}</b>:null}</summary>
    <div className={`${styles.toolbarMenu} ${styles.profileMenu}`} onClick={event=>{if(event.target instanceof Element&&event.target.closest('a'))menuRef.current?.removeAttribute('open');}}>
      <p className={styles.menuHead}>UID {uid}</p>
      {profiles==null?<p className={styles.note}>{t('Saved profiles are unavailable here.')}</p>
        :!profiles.length?<p className={styles.note}>{t('No saved builds yet: save the card with "Save build".')}</p>
        :profiles.map(profile=><Link key={profile.slot} className={styles.profileItem} href={profileHref(uid,profile.slot)} aria-current={viewing?.slot===profile.slot?'page':undefined}
          data-role={profile.role}><img src={catalog.elementIcons[profile.element]?.icon??roleIcon(profile.role)} alt=""/>
          <span>{slotLabel(profile.role,profile.element,locale)}</span><small>{formatBuildDate(profile.savedAt,'instant',false)}</small></Link>)}
      {viewing&&<Link className={styles.profileItem} href="/tools/build/">{t('← My card')}</Link>}
    </div>
  </details>;
}

/**
 * "Save build" in the toolbar: saves the card's signed capture as the profile of its role and rated element. Always
 * shown; when saving is not possible, hovering says why. An occupied slot asks before it is overwritten.
 */
export function SaveProfileButton({draft,catalog,locale,viewing,customArt,siteArt,disabled,onSaved,onQueue}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;
  viewing:boolean;customArt:boolean;siteArt?:BuildDraft['art'];disabled?:boolean;onSaved:(message:string,href:string)=>void;
  /** The save's place in the shared queue (shown by the page); null once it finished. */
  onQueue?:(job:QueueJob|null)=>void}) {
  const t=localeText(locale);
  const uid=restrictedCaptureOrigin(draft)?null:draftUid(draft);
  const [version,setVersion]=useState(0);
  const profiles=useProfiles(viewing?null:uid,version);
  const [verified,setVerified]=useState<boolean|null>(null);
  const [confirm,setConfirm]=useState<ProfileSummary|null>(null);
  const [saving,setSaving]=useState(false);
  const [failure,setFailure]=useState('');
  // Saving needs the unedited card; checked after edits settle.
  useEffect(()=>{
    if(viewing||!draft.captureSource?.signature){setVerified(false);return;}
    let live=true;setVerified(null);
    const timer=setTimeout(()=>{verifyBuildCard(draft,catalog).then(state=>{if(live)setVerified(state==='verified');}).catch(()=>{if(live)setVerified(false);});},400);
    return ()=>{live=false;clearTimeout(timer);};
  },[draft,catalog,viewing]);
  const slot=draftSlot(draft,catalog);
  const target=slot?profiles?.find(profile=>profile.slot===profileSlot(slot.role,slot.element))??null:null;
  const blocked=viewing?t('This is a saved profile. Save your own card on the Build card page.')
    :restrictedCaptureOrigin(draft)?t('Test-server and unresolved captures cannot be saved. Viewing, calculations and PNG export are available.')
    :!draft.captureSource?t('Saving needs a card imported from a .tofbuild file: import the file from the capture app first.')
    :!draft.captureSource.signature?t('This card was imported before signing: import the .tofbuild file again.')
    :verified===false?t('Only an unedited card can be saved (Verified). Undo the value edits or import the file again.')
    :!slot?t('Choose the card element first.')
    :profiles===null&&uid?t('Profiles are unavailable: the server is not connected.')
    :profiles===undefined&&uid?t('Loading saved builds…'):null;
  const hint=blocked??(verified===null?t('Checking the card…')
    :`${t('Save as')} ${slotLabel(slot!.role,slot!.element,locale)} · UID ${uid}${target?` ${t('Already saved')} ${formatBuildDate(target.savedAt,'instant')}: ${t('you will be asked before overwriting.')}`:''}${customArt?` ${t('Your own background stays in this browser and is not included in the public profile.')}`:''}`);
  async function save(overwrite:boolean) {
    if(restrictedCaptureOrigin(draft))return;
    if(!slot)return;
    setSaving(true);setFailure('');setConfirm(null);
    const art=profileArtwork(customArt?siteArt:draft.art,catalog,`${uid}:${profileSlot(slot.role,slot.element)}`);
    const result=await saveProfile(draft,slot,art,overwrite,onQueue,locale);
    setSaving(false);onQueue?.(null);
    if(result.ok){setVersion(n=>n+1);onSaved(fillText(t('Profile {0} saved.', 'Профиль {0} сохранён.'), [slotLabel(slot.role,slot.element,locale)]),profileHref(uid!,result.slot));return;}
    if(result.reason==='exists'&&target){setConfirm(target);return;}
    setFailure(result.reason==='newer'?t('A newer capture is already saved in this profile.')
      :result.reason==='unavailable'?t('Profiles are unavailable: the server is not connected.')
      :result.reason==='busy'?`${t('Not saved.')} ${result.message}`
      :t('The server refused the card: save an unedited card imported from a .tofbuild file.'));
  }
  return <>
    <Tooltip portal content={failure||hint}><span className={styles.saveProfile} tabIndex={blocked?0:undefined}>
      {/* Same shape as Export PNG beside it, in the sky tone. */}
      <ExportButton tone="sky" busy={saving} disabled={disabled||!!blocked||verified===null}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>}
        onClick={()=>{if(target)setConfirm(target);else void save(false);}}>{saving?t('Saving…'):t('Save build')}</ExportButton></span></Tooltip>
    {confirm&&typeof document!=='undefined'&&createPortal(
      <Modal appearance="tool" isOpen onClose={()=>setConfirm(null)} size="sm">
        <ModalHeader><ModalTitle>{t('Overwrite the profile?')}</ModalTitle></ModalHeader>
        <ModalBody><p>{fillText(t('The {0} profile of UID {1} is already saved ({2}). Replace it with this card?', 'Профиль {0} для UID {1} уже сохранён ({2}). Заменить его этой карточкой?'), [slotLabel(confirm.role,confirm.element,locale), uid, formatBuildDate(confirm.savedAt,'instant')])}</p></ModalBody>
        <ModalFooter><Button variant="secondary" size="sm" onClick={()=>setConfirm(null)}>{t('Cancel')}</Button>
          <Button size="sm" onClick={()=>void save(true)}>{t('Overwrite')}</Button></ModalFooter>
      </Modal>,
      document.body,
    )}
  </>;
}
