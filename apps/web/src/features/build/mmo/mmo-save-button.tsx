'use client';
import { fillText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import {useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Button,ExportButton,Modal,ModalBody,ModalFooter,ModalHeader,ModalTitle,Tooltip} from '@tof-hub/ui';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {localeText} from '@/lib/i18n/text';
import type {QueueJob} from '../../queue/client';
import {formatBuildDate} from '../presentation';
import type {BuildLocale} from '../types';
import styles from '../build.module.css';
import {mmoCardRole} from './model';
import {useMmoProfiles} from './mmo-build-info';
import {mmoProfileHref,mmoSaveBlock,saveMmoProfile,type MmoProfileSummary} from './profiles';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';

/**
 * "Save build" under the MMO card (as the Global SaveProfileButton): saves the signed capture as the public build of the
 * card's header role. Always shown; when saving is not possible, hovering says why. An occupied role asks first.
 */
export function MmoSaveButton({draft,catalog,locale,disabled,onSaved,onQueue}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;disabled?:boolean;
  onSaved:(message:string,href:string)=>void;onQueue?:(job:QueueJob|null)=>void}) {
  const t=localeText(locale);
  const block=useMemo(()=>mmoSaveBlock(draft,catalog),[draft,catalog]);
  const uid=draft.source&&block!=='test-capture'&&block!=='not-warp'?draft.source.capture.capture.subject.uid:null;
  const [version,setVersion]=useState(0);
  const profiles=useMmoProfiles(uid,version);
  const [confirm,setConfirm]=useState<MmoProfileSummary|null>(null);
  const [saving,setSaving]=useState(false);
  const [failure,setFailure]=useState('');
  const role=mmoCardRole(draft,catalog),roleName=localized(PLAYER_ROLE_LABELS[role], locale);
  const target=profiles?.find(profile=>profile.role===role)??null;
  const blocked=block==='no-capture'?t('Saving needs a card imported from a .tofbuild file: import the file from the capture app first.')
    :block==='test-capture'?t('Test-server, DEV-client and unresolved captures cannot be saved. Viewing and PNG export are available.')
    :block==='not-warp'?t('Only characters of known Warp servers can save MMO builds.')
    :block==='edited'?t('Only the unedited import can be saved. Import the file again or undo the value edits; role and background may change.')
    :profiles===null?t('Saved builds are unavailable: the server is not connected.')
    :profiles===undefined?t('Loading saved builds…'):null;
  const hint=blocked??`${t('Save as')} MMO · ${roleName} · UID ${uid}${target?` ${t('Already saved')} ${formatBuildDate(target.savedAt,'instant')}: ${t('you will be asked before overwriting.')}`:''}`;
  async function save(overwrite:boolean) {
    if(!uid)return;
    setSaving(true);setFailure('');setConfirm(null);
    const art={id:draft.art.id,zoom:draft.art.zoom,x:draft.art.x,y:draft.art.y,offsetX:draft.art.offsetX??0,offsetY:draft.art.offsetY??0};
    const result=await saveMmoProfile(draft,role,catalog.artworks.some(item=>item.id===art.id)?art:null,overwrite,onQueue??undefined,locale);
    setSaving(false);onQueue?.(null);
    if(result.ok){setVersion(n=>n+1);onSaved(fillText(t('MMO build {0} saved.', 'MMO-билд {0} сохранён.'), [roleName]),mmoProfileHref(uid,role));return;}
    if(result.reason==='exists'&&target){setConfirm(target);return;}
    setFailure(result.reason==='newer'?t('A newer capture is already saved for this role.')
      :result.reason==='unavailable'?t('Saved builds are unavailable: the server is not connected.')
      :result.reason==='busy'?`${t('Not saved.')} ${result.message}`
      :`${t('The server refused the card.')}${result.message?` ${result.message}`:''}`);
  }
  return <>
    <Tooltip portal content={failure||hint}><span className={styles.saveProfile} tabIndex={blocked?0:undefined}>
      <ExportButton tone="sky" busy={saving} disabled={disabled||!!blocked}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>}
        onClick={()=>{if(target)setConfirm(target);else void save(false);}}>{saving?t('Saving…'):t('Save build')}</ExportButton></span></Tooltip>
    {confirm&&typeof document!=='undefined'&&createPortal(
      <Modal appearance="tool" isOpen onClose={()=>setConfirm(null)} size="sm">
        <ModalHeader><ModalTitle>{t('Overwrite the build?')}</ModalTitle></ModalHeader>
        <ModalBody><p>{fillText(t('The MMO {0} build of UID {1} is already saved ({2}). Replace it with this card?', 'MMO-билд {0} для UID {1} уже сохранён ({2}). Заменить его этой карточкой?'), [roleName, uid, formatBuildDate(confirm.savedAt,'instant')])}</p></ModalBody>
        <ModalFooter><Button variant="secondary" size="sm" onClick={()=>setConfirm(null)}>{t('Cancel')}</Button>
          <Button size="sm" onClick={()=>void save(true)}>{t('Overwrite')}</Button></ModalFooter>
      </Modal>,document.body)}
  </>;
}
