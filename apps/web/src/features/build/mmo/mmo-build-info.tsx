'use client';
import { localized, translateUiText } from '@tof-hub/i18n';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Button,LoadingState} from '@tof-hub/ui';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {localeText} from '@/lib/i18n/text';
import {formatDate} from '@/lib/i18n/format';
import {ToolRail,RailGlyph} from '@/components/tool-rail/tool-rail';
import {CaptureAppModal} from '@/components/tool-rail/capture-app-modal';
import {InfoCard,InfoNote,RulePoint,SectionHeading,ToolInfoModal} from '@/components/tool-rail/tool-info-modal';
import {Hint} from '../../players/player-identity';
import type {BuildLocale} from '../types';
import {MMO_PROFILES_HREF,fetchMmoProfiles,mmoProfileHref,type MmoProfileRole,type MmoProfileSummary} from './profiles';
import type {MmoBuildCatalog} from './types';
import linkStyles from '../saved-build-link.module.css';

/** The UID's public MMO builds; `version` refetches after a save. Null when the server has no store, undefined while loading. */
export function useMmoProfiles(uid:string|null,version:number) {
  const [result,setResult]=useState<{uid:string;version:number;profiles:MmoProfileSummary[]|null}|null>(null);
  useEffect(()=>{
    if(!uid)return;
    const controller=new AbortController();
    fetchMmoProfiles(uid,controller.signal).then(response=>{if(!controller.signal.aborted)setResult({uid,version,profiles:response.available?response.profiles:null});})
      .catch(()=>{if(!controller.signal.aborted)setResult({uid,version,profiles:null});});
    return ()=>controller.abort();
  },[uid,version]);
  return !uid?[]:result?.uid===uid&&result.version===version?result.profiles:undefined;
}

/** One saved MMO build: the same link presentation as the Global "My builds" (saved-build-link.module.css). */
export function MmoSavedBuildLink({uid,profile,catalog,locale,current=false,onOpen,presentation='card'}:{uid:string;profile:MmoProfileSummary;
  catalog:Pick<MmoBuildCatalog,'roleResonances'>;locale:BuildLocale;current?:boolean;onOpen?:()=>void;presentation?:'card'|'compact'}) {
  const t=localeText(locale),role=localized(PLAYER_ROLE_LABELS[profile.role], locale);
  const icon=catalog.roleResonances.find(item=>item.id===profile.role)?.icon;
  const date=formatDate(profile.savedAt,locale,{dateStyle:'medium',timeStyle:'short'},'—');
  return <Hint title={`MMO · ${role}`} text={`${t('Saved')}: ${date}`}>
    <Link href={mmoProfileHref(uid,profile.role)} className={linkStyles.link} data-presentation={presentation} data-current={current||undefined}
      aria-current={current?'page':undefined} aria-label={`MMO · ${role} · UID ${uid}`} onClick={onOpen}>
      {icon&&<img src={icon} alt=""/>}
      <span className={linkStyles.label}><b>{role}</b>{presentation==='card'&&<small>{date}</small>}</span>
      <span className={linkStyles.arrow} aria-hidden="true">{current?'✓':'›'}</span>
    </Link>
  </Hint>;
}

/**
 * MMO help rail (as the Global Build rail): import, the capture app, what the card shows, the character's public MMO
 * builds and all public MMO builds.
 */
export function MmoBuildInfoRail({locale,catalog,onImport,uid,viewing,version=0,appRequest=0}:{locale:BuildLocale;catalog:MmoBuildCatalog;onImport:()=>void;appRequest?:number;
  /** The character of the own imported card (null for a demo or manual card). */
  uid:string|null;viewing?:{uid:string;role:MmoProfileRole|null};version?:number}) {
  const t=localeText(locale);
  const [open,setOpen]=useState<'app'|'about'|'profiles'|'fields'|null>(null);
  useEffect(()=>{if(appRequest)setOpen('app');},[appRequest]);
  const close=()=>setOpen(null);
  const owner=viewing?.uid??uid;
  const profiles=useMmoProfiles(open==='profiles'?owner:null,version);
  return <>
    <ToolRail placement="side" label={t('MMO build card help')} items={[
      {id:'import',label:t('Import .tofbuild','Импорт .tofbuild'),icon:<RailGlyph name="import"/>,onClick:onImport,tone:'accent'},
      {id:'app',label:t('Capture app'),icon:<RailGlyph name="download"/>,onClick:()=>setOpen('app')},
      {id:'fields',label:t('What you can edit'),icon:<RailGlyph name="edit"/>,onClick:()=>setOpen('fields'),active:open==='fields'},
      {id:'about',label:t('About the MMO card'),icon:<RailGlyph name="help"/>,onClick:()=>setOpen('about')},
      {id:'profiles',label:t('My MMO builds'),icon:<RailGlyph name="profiles"/>,onClick:()=>setOpen('profiles'),active:open==='profiles',tone:'sky'},
      {id:'all-profiles',label:t('Public MMO builds'),icon:<RailGlyph name="equipment"/>,href:MMO_PROFILES_HREF},
    ]}/>
    <CaptureAppModal isOpen={open==='app'} onClose={close} locale={locale} upload={{label:t('Import .tofbuild','Импортировать .tofbuild'),onClick:onImport}}/>
    <ToolInfoModal isOpen={open==='fields'} onClose={close} eyebrow={t('Build card · fields')} title={t('What you can edit')} closeLabel={t('Close')}
      intro={t('With the lock on, presentation choices preserve the imported values. Unlock the card to change game values, or open the advanced editor.','При включённом замке настройки оформления сохраняют данные импорта. Для изменения игровых значений разблокируйте карточку или откройте расширенный редактор.')}>
      <SectionHeading>{t('Stays Verified','Сохраняет верификацию')}</SectionHeading>
      <InfoCard><div className="grid gap-3"><RulePoint title={t('Build role')} text={t('DPS, Tank, Healer, Balance or Auto in the header. This selects the public build slot.','ДД, Танк, Хил, Баланс или «Авто» в шапке. Выбор определяет слот публичного билда.')}/>
        <RulePoint title={t('Background')} text={t('Choose a site artwork, change its scale and position, or reset its framing.','Выберите арт из каталога, измените масштаб и положение или сбросьте кадрирование.')}/></div></InfoCard>
      <InfoNote tone="sky">{t('These choices preserve verification only for a signed, unedited live Warp import. Demo, DEV and unresolved captures do not become Verified.','Эти настройки сохраняют верификацию только у подписанного неизменённого импорта с live-сервера Warp. Демо, DEV и захват с неизвестного сервера не становятся верифицированными.')}</InfoNote>
      <SectionHeading>{t('Unlock to edit · Edited')}</SectionHeading>
      <InfoCard><div className="grid gap-3">
        <RulePoint title={t('Profile')} text={t('Name, UID, level, CS, crew, title, signature, avatar, frame and season.','Ник, UID, уровень, CS, гильдия, титул, подпись, аватар, рамка и сезон.')}/>
        <RulePoint title={t('Attributes and equipment')} text={t('Both attribute panels; item, random properties and their values in each slot; expansion card and its stars.','Обе панели атрибутов; предмет, случайные свойства и их значения в каждом слоте; карта расширения и её звёзды.')}/>
        <RulePoint title={t('Weapons')} text={t('Weapon selection, advancement +N and Regular / Fixed-damage Mode.','Выбор оружия, продвижение +N и обычный режим / фиксированный урон.')}/>
        <RulePoint title={t('Smart Servant and food')} text={t('Smart Servant, its level and inherited ATK, both dishes, and every Brainfield node.','Смарт-сервант, его уровень и наследуемая АТК, оба блюда и все узлы Brainfield.')}/>
      </div></InfoCard>
      <InfoNote tone="amber">{t('Value edits stay in this browser and block public saving. Undo them or restore the imported values to save again. Generated effects and thresholds update automatically.','Правки значений остаются в этом браузере и блокируют публичное сохранение. Отмените их или восстановите импорт, чтобы снова сохранить билд. Эффекты и пороги из игровых таблиц обновляются автоматически.')}</InfoNote>
    </ToolInfoModal>
    <ToolInfoModal isOpen={open==='about'} onClose={close} eyebrow="MMO · Warp" title={t('About the MMO card')} closeLabel={t('Close')}
      intro={t('A showcase card of a Warp (MMO) character, filled from your own .tofbuild capture or by hand.')}>
      <SectionHeading>{t('What the import fills')}</SectionHeading>
      <InfoCard><div className="grid gap-2">
        <RulePoint title={t('Profile')} text={t('Name, UID, level, CS, crew, title, avatar and frame from the login.')}/>
        <RulePoint title={t('Attributes and equipment')} text={t('The attribute panel, 12 gear slots with their random stats and the expansion card of each slot.')}/>
        <RulePoint title={t('Weapons')} text={t('Three weapons with +N and the weapon mode (Regular / Fixed-damage).')}/>
        <RulePoint title={translateUiText("Brainfield", locale)} text={t('Node levels; hover a chain for its stat sums.')}/>
        <RulePoint title={t('Smart Servant and food')} text={t('The pet with its inherited ATK and the active dishes. An empty slot shows "Nothing".')}/>
      </div></InfoCard>
      <InfoNote tone="sky">{t('Parts the game did not send at this login stay empty and are listed after the import. Open those windows in the game and capture again.')}</InfoNote>
      <SectionHeading>{t('Saving and public builds')}</SectionHeading>
      <InfoCard><div className="grid gap-2">
        <RulePoint title={t('One build per role')} text={t('Choose DPS, Tank, Healer or Balance at the top right of the card and press "Save build". Each role keeps its own public card.')}/>
        <RulePoint title={t('Only the unedited import')} text={t('The site stores the signed capture, so value edits block saving. Role and background are free choices.')}/>
        <RulePoint title={t('Live Warp servers')} text={t('Test-server, DEV-client and unresolved captures are shown but never saved.')}/>
      </div></InfoCard>
      <InfoNote tone="amber">{t('MMO has no ranking, Wish Tracker or gear optimizer on the site.')}</InfoNote>
    </ToolInfoModal>
    <ToolInfoModal isOpen={open==='profiles'} onClose={close} eyebrow={owner?`UID ${owner}`:'MMO'} title={t('My MMO builds')} closeLabel={t('Close')}
      intro={t('Public MMO builds of this character, one per role. Save the card with "Save build" under it.')}>
      {!owner?<InfoCard><p className="text-xs text-slate-300 leading-relaxed">{t('Import your .tofbuild capture to see this character’s saved MMO builds.')}</p>
        <div className="mt-4"><Button variant="primary" onClick={()=>{close();onImport();}}>{t('Import .tofbuild','Импортировать .tofbuild')}</Button></div></InfoCard>
        :profiles===undefined?<LoadingState message={t('Loading MMO builds…')}/>
        :profiles===null?<InfoNote tone="amber">{t('Saved builds are unavailable: the server is not connected.')}</InfoNote>
        :!profiles.length?<InfoCard><p className="text-xs text-slate-300 leading-relaxed">{t('No saved MMO builds yet.')}</p></InfoCard>
        :<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{profiles.map(profile=><MmoSavedBuildLink key={profile.role} uid={owner} profile={profile} catalog={catalog} locale={locale}
          current={viewing?.uid===owner&&viewing.role===profile.role} onOpen={close}/>)}</div>}
    </ToolInfoModal>
  </>;
}
