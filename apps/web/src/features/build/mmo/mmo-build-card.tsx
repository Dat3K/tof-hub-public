import { fillText } from '@/lib/i18n/text';
import { localized, localizedUi } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {fillMmoText,mmoCardParams} from '@tof-hub/game-domain';
import {GameRichText,ProfileAvatar} from '@tof-hub/ui';
import type {ReactElement,ReactNode,Ref} from 'react';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {MMO_PROFILE_ROLES,resolveServerFromUid,type MmoProfileRole} from '@tof-hub/contracts';
import {IconPick} from '../build-fields';
import {useBuildEditing} from '../build-editing';
import {DemoCallToAction} from '../demo-call-to-action';
import {captureOriginLabel} from '../capture-origin';
import {useMmoEditable,type MmoEditTarget} from './mmo-build-editing';
import {Inspect,InspectionHeading,BuildTooltip as Tooltip} from '../build-inspection';
import {AccountCounterRows} from '../build-card';
import {BonusEffects,BonusValue} from '../stat-bonuses';
import {StatHighlight,StatLink,statFamily} from '../stat-highlight';
import {isFillerAdvancement} from '../../simulacra/components/simulacra-advancements-section';
import {BUILD_CARD_HEIGHT,BUILD_CARD_WIDTH} from '../layout';
import {characterTitleLabel,characterTitleStyle} from '../character-title';
import {CharacterTitlePlate} from '../character-title-plate';
import {ProfileCosmeticPreview} from '../profile-cosmetic-preview';
import {AvatarFallback} from '../avatar-fallback';
import {elementLabel,formatBuildDate,formatValue} from '../presentation';
import type {BuildLocale,LocalizedName} from '../types';
import {mmoCardRole,mmoRoleResonance,mmoAttribute,mmoAttributeTotals,mmoBrainfieldChains,mmoCardSets,mmoCardStatValues,mmoGearItem,mmoPetStats,mmoRollRange,mmoStatKey,mmoStatKeys,mmoThresholds,mmoWeaponCombatStrength,mmoWeaponMaxStars,mmoCritChance,mmoCritScale,MMO_COMBAT_STRENGTH} from './model';
import type {MmoBuildCatalog,MmoBuildDraft,MmoCard} from './types';
import styles from '../build.module.css';
import mmo from './mmo-build.module.css';

const name=(value:LocalizedName|null|undefined,locale:BuildLocale)=>localized(value, locale)||value?.en||'—';
function Icon({src,className='stat-icon',element=false}:{src?:string|null;className?:string;element?:boolean}) {return src?<img className={className} data-element-icon={element||undefined} src={src} alt=""/>:null;}

/** A raw attribute value as the game shows it: percent attributes are fractions (three decimals in game). */
function attributeText(catalog:MmoBuildCatalog,prop:string,value:number|null,locale:BuildLocale,digits=3) {
  if(value===null)return '—';
  return formatValue(value,!!mmoAttribute(catalog,prop)?.percent,locale,digits);
}

/** Expansion-card text with its parameters at the given number of equipped cards of that pack. */
function cardText(card:MmoCard,count:number,locale:BuildLocale) {
  const text=localized(card.description, locale)||card.description?.en;
  return text?fillMmoText(text,mmoCardParams(card.params,Math.max(1,count))):'';
}
type CardStat={prop:string;value:number|null};
function CardDetails({card,count,stars,stats,catalog,locale}:{card:MmoCard;count:number;stars?:number;stats:CardStat[];catalog:MmoBuildCatalog;locale:BuildLocale}) {
  const t=localeText(locale);
  return <div className={styles.itemEffects}>
    <div className={styles.detailRow}><strong>{t('Active')}</strong><span>{count} / {card.maxSuit}</span></div>
    {stars!==undefined&&<div className={styles.detailRow}><strong>{t('Stars')}</strong><span>★{stars} / {card.maxStars}</span></div>}
    {stats.length>0&&<BonusEffects effects={stats.map(stat=>({id:stat.prop,icon:catalog.attributes[stat.prop]?.icon??undefined,label:name(catalog.attributes[stat.prop]?.name,locale),
      value:<BonusValue tone="neutral">+{attributeText(catalog,stat.prop,stat.value,locale,catalog.attributes[stat.prop]?.percent?2:0)}</BonusValue>}))}/>}
    <GameRichText text={cardText(card,count,locale)}/>
  </div>;
}

function Gear({slotId,draft,catalog,locale,counts}:{slotId:string;draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;counts:Map<string,number>}) {
  const t=localeText(locale),edit=useMmoEditable();
  const slot=catalog.slots.find(entry=>entry.id===slotId)!;
  const gear=draft.gear[slotId];
  const item=gear&&mmoGearItem(catalog,gear.itemId);
  const card=gear?.card&&catalog.cards.find(entry=>entry.id===gear.card!.id);
  const base=item?.base??[];
  const role=item?.role&&catalog.roleResonances.find(entry=>entry.id===item.role);
  const fmt=(value:number|null,prop:string,digits?:number)=>attributeText(catalog,prop,value,locale,digits);
  const cardStats=card?mmoCardStatValues(catalog,card,gear!.card!.stars,draft.profile.level):[];
  const cardDetails=card&&<CardDetails card={card} count={counts.get(card.id)??1} stars={gear!.card!.stars} stats={cardStats} catalog={catalog} locale={locale}/>;
  const key=(prop:string)=>mmoStatKey(catalog,prop);
  const cardRow=card?<Inspect editTarget={`card:${slotId}`} title={name(card.name,locale)} meta={localized(catalog.labels.expansionStats, locale)} tooltipDetails={cardDetails} details={cardDetails}>
    <StatLink types={cardStats.flatMap(stat=>mmoStatKeys(catalog,stat.prop))} inspectTypes={[]} sourceBonuses={sourceBonuses(catalog,locale,cardStats)}><span className={mmo.cardRow}><Icon src={card.icon} className={mmo.cardIcon}/><span data-hint-overflow>{name(card.name,locale)}</span><small>★{gear!.card!.stars}</small></span></StatLink></Inspect>
    :<span {...edit(`card:${slotId}`)} className={`${mmo.cardRow} ${mmo.cardEmpty}`}><span className={mmo.cardIcon}/>{localized(catalog.labels.expansionStats, locale)} · —</span>;
  if(!item)return <article className="gear" data-empty="" {...edit(`gear:${slotId}`,'area')}><div className="gear-head"><span className="media-placeholder system-placeholder" {...edit(`gear:${slotId}`)}>—</span><div className="gear-name"><div className="gear-title"><b>{localizedUi(slot.name,locale)||'—'}</b></div><small>{t('Not equipped')}</small></div></div>
    <div className={mmo.gearBody}/>{cardRow}</article>;
  const details=<div className={styles.gearDetails}>
    <section><h3>{localized(catalog.labels.baseStats, locale)}</h3><BonusEffects effects={base.map(stat=>({id:stat.prop,icon:catalog.attributes[stat.prop]?.icon??undefined,label:name(catalog.attributes[stat.prop]?.name,locale),
      value:<BonusValue tone="neutral">{fmt(stat.value,stat.prop,0)}</BonusValue>}))}/></section>
    <section><h3>{localized(catalog.labels.randomStats, locale)}</h3>{gear!.rolls.length?<BonusEffects effects={gear!.rolls.map((roll,index)=>{const range=mmoRollRange(catalog,roll.prop,item.quality);return {id:`${index}`,icon:mmoAttribute(catalog,roll.prop)?.icon??undefined,label:name(mmoAttribute(catalog,roll.prop)?.name,locale),
      value:<><BonusValue tone="neutral">{fmt(roll.value,roll.prop,2)}</BonusValue>{range&&<> [{range.min===range.max?t('Max'):`${fmt(range.min,roll.prop,2)}–${fmt(range.max,roll.prop,2)}`}]</>}</>};})}/>:<span>—</span>}</section>
  </div>;
  return <article className="gear" {...edit(`gear:${slotId}`,'area')}>
    <div className="gear-head"><Inspect editTarget={`gear:${slotId}`} dialogSize="sm" title={name(item.name,locale)} meta={<span>{t('Lv.')} <b>{item.tier}</b></span>} tooltipDetails={details} details={details}><img src={item.icon??''} alt=""/></Inspect>
      <div className="gear-name"><div className="gear-title">{role&&<img className={mmo.gearRole} src={role.icon} alt={localized(role.name, locale)} data-hint={localized(role.name, locale)}/>}<b data-hint-overflow>{name(item.baseName??item.name,locale)}</b></div><small className={mmo.gearMeta}>T{item.grade} {t('Lv.')} {item.tier}</small></div></div>
    <div className="base">{base.map(stat=><StatLink key={stat.prop} contribution="base" types={key(stat.prop)}><span>{name(catalog.attributes[stat.prop]?.name,locale)} {fmt(stat.value,stat.prop,0)}</span></StatLink>)}</div>
    <div className={mmo.gearBody}>{gear!.rolls.map((roll,index)=>{
      const range=mmoRollRange(catalog,roll.prop,item.quality);
      const atMax=range!==null&&roll.value!==null&&roll.value>=range.max-1e-9;
      // Roll quality: where the value sits between the roll's minimum and maximum (model); a fixed roll (min = max) is Max.
      const quality=range!==null&&roll.value!==null&&range.max>range.min?Math.min(1,Math.max(0,(roll.value-range.min)/(range.max-range.min))):null;
      return <StatLink key={index} types={mmoStatKeys(catalog,roll.prop)}><div className="roll"><span><Icon src={mmoAttribute(catalog,roll.prop)?.icon}/>{name(mmoAttribute(catalog,roll.prop)?.name,locale)}</span><b>{fmt(roll.value,roll.prop,2)}</b>
        <span className="roll-detail"><em data-hint={range?`${t('Roll range')}: ${fmt(range.min,roll.prop,2)}–${fmt(range.max,roll.prop,2)}`:undefined} data-quality={quality===null?undefined:quality>=.9?'high':quality>=.5?'mid':'low'}>{range?atMax?t('Max'):quality===null?'—':`${Math.round(quality*100)}%`:'—'}</em></span></div></StatLink>;
    })}</div>
    {cardRow}
  </article>;
}

function Weapon({index,draft,catalog,locale}:{index:number;draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale}) {
  const t=localeText(locale);
  const edit=useMmoEditable();
  const entry=draft.weapons[index]!;
  const weapon=catalog.weapons.find(item=>item.id===entry.id);
  if(!weapon)return <article className="weapon" data-empty="" {...edit(`weapon:${index}`)}><div className="weapon-head"><span className="media-placeholder weapon-icon">—</span><div><div className="weapon-title">—</div><div className="weapon-meta">+0</div></div></div></article>;
  const element=weapon.elements[0]!;
  // Stat-only steps (Combat Strength, base growth) are hidden as on Info Simulacra; their count stays visible.
  const reached=weapon.advancements.filter(advancement=>advancement.star<=entry.stars);
  const filler=(advancement:typeof reached[number])=>!!advancement.description&&isFillerAdvancement({desc_en:advancement.description.en,desc_ru:advancement.description.ru});
  const effects=reached.filter(advancement=>!filler(advancement));
  const hidden=reached.length-effects.length;
  const advancements=<div className={styles.itemEffects}>{effects.map(advancement=>
    <div key={advancement.star} className={mmo.advancement} data-active><strong>+{advancement.star}</strong>{advancement.description?<GameRichText text={localized(advancement.description, locale)}/>:<span>{t('Effect text unavailable')}</span>}</div>)}
    {!reached.length&&<span>{t('No advancement')}</span>}
    {hidden>0&&<span className={mmo.muted}>{fillText(t('Hidden: {0} Combat Strength steps', 'Скрыто обычных шагов (боевая мощь): {0}'), [hidden])}</span>}</div>;
  return <article className="weapon" {...edit(`weapon:${index}`,'area')}>
    <div className="weapon-head"><div className="weapon-art"><span className="weapon-element" data-hint={elementLabel(element,locale)}><img src={catalog.elementIcons[element]?.icon} alt={elementLabel(element,locale)}/></span>
      <Inspect editTarget={`weapon:${index}`} title={localized(weapon.weapon, locale)} meta={<span>{localized(weapon.name, locale)} · +{entry.stars}</span>} tooltipDetails={advancements} details={advancements}><img className="weapon-icon" src={weapon.icon??''} alt=""/></Inspect></div>
      <div className={mmo.weaponIdentity}><div className="weapon-title" data-hint-overflow>{localized(weapon.weapon, locale)}</div><div className="weapon-meta">{localized(weapon.name, locale)}</div></div>
      <div className={mmo.weaponSide}><b className={mmo.weaponLevel} {...edit(`weapon-stars:${index}`)}>+{entry.stars}</b></div></div>
    <div className={mmo.weaponProgressSlot} {...edit(`weapon-stars:${index}`)}><WeaponProgress stars={entry.stars} max={mmoWeaponMaxStars(catalog,weapon.id)} locale={locale} tip={star=>{
      // What the +N step gives: the game's advancement text; a stat-only step reads "Increases Combat Strength by N".
      const step=weapon.advancements.find(advancement=>advancement.star===star);
      return <div className={mmo.advancementTip}><strong>+{star}{star>entry.stars&&<small> · {t('not reached')}</small>}</strong>{step?.description?<GameRichText text={localized(step.description, locale)}/>:step&&step.combatStrength>0?<span>{fillText(t('Increases Combat Strength by {0}.', 'Увеличивает боевую мощь на {0}.'), [step.combatStrength])}</span>:<span>{t('Effect text unavailable')}</span>}</div>;
    }}/></div>
    <StatLink types={MMO_COMBAT_STRENGTH} inspectTypes={[]}><div className={mmo.weaponScore}><span>{t('Combat Strength')}</span><b>{formatValue(mmoWeaponCombatStrength(catalog,entry),false,locale,0)}</b></div></StatLink>
  </article>;
}

/** Advancement track +0…+max: one cell per star, filled in sequence; the last filled cell glows, milestones every five. */
function WeaponProgress({stars,max,locale,tip}:{stars:number;max:number;locale:BuildLocale;tip:(star:number)=>ReactNode}) {
  const t=localeText(locale);
  return <div className={mmo.weaponProgress} role="progressbar" aria-label={t('Weapon advancement','Продвижение оружия')} aria-valuemin={0} aria-valuemax={max} aria-valuenow={stars} data-full={stars>=max||undefined}>
    <div className={mmo.weaponTrack}>{Array.from({length:max},(_,index)=><Tooltip key={index} portal placement="top" content={tip(index+1)}><i style={{'--i':index} as React.CSSProperties} data-on={index<stars||undefined} data-tip={index===stars-1||undefined} data-milestone={(index+1)%5===0||undefined}/></Tooltip>)}</div>
    <div className={mmo.weaponScale}><span>+0</span><span>+{Math.round(max/3)}</span><span>+{Math.round(max*2/3)}</span><span>+{max}</span></div>
  </div>;
}

/** Header "role / season", as the Global card's "DPS / element": the role resonance icon and short name, then the MMO season. */
function CardFocus({draft,catalog,locale,onChange,onSeasonChange}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;onChange?:(role:MmoProfileRole|null)=>void;onSeasonChange?:(season:number|null)=>void}) {
  const t=localeText(locale);
  const id=mmoCardRole(draft,catalog),icon=catalog.roleResonances.find(item=>item.id===id)?.icon;
  const season=catalog.seasons.find(item=>item.index===draft.profile.season);
  const display=<span className="build-role">{icon&&<img src={icon} alt=""/>}{localized(PLAYER_ROLE_LABELS[id], locale)}</span>;
  const seasonLabel=<span className="build-element" data-hint={onSeasonChange?undefined:t('MMO season')}>{season?name(season.name,locale):'—'}</span>;
  // The season is the player's pick (the capture does not carry it): the same inline picker as the role.
  const seasonText=onSeasonChange?<IconPick hint={false} inline label={t('MMO season')} value={draft.profile.season===null?'':String(draft.profile.season)}
    items={catalog.seasons.map(item=>({id:String(item.index),icon:'',name:item.name??{en:`Season ${item.index}`,ru:`Сезон ${item.index}`}}))} locale={locale}
    emptyLabel={{en:'No season',ru:'Без сезона'}} display={seasonLabel} onChange={id=>onSeasonChange(id===''?null:Number(id))}/>:seasonLabel;
  const separator=<span className="build-focus-separator">/</span>;
  if(!onChange)return <div className={`build-title ${styles.buildTitle}`}>{display}{separator}{seasonText}</div>;
  const items=MMO_PROFILE_ROLES.map(role=>({id:role,icon:catalog.roleResonances.find(item=>item.id===role)?.icon??'',name:PLAYER_ROLE_LABELS[role]}));
  // The Global header picker classes (build.module.css .buildTitle): inline trigger and a right-aligned popover.
  return <div className={`build-title build-focus ${styles.buildTitle}`} data-build-edit-skip data-role-source={draft.role?'manual':'auto'}><IconPick hint={false} inline label={t('Build role')} value={draft.role??''} items={items} locale={locale}
    emptyLabel={{en:'Auto · weapon resonance',ru:'Авто · резонанс оружия'}} display={display} onChange={role=>onChange(role?role as MmoProfileRole:null)}/>{separator}{seasonText}</div>;
}

/** Header "WS / WS-Korea · UID · Lv.": the server resolved from the UID, and the character ids on hover as on the Global card. */
function CardIds({draft,locale}:{draft:MmoBuildDraft;locale:BuildLocale}) {
  const t=localeText(locale),edit=useMmoEditable();
  const serverInfo=resolveServerFromUid(draft.profile.uid);
  const serverLine=serverInfo?`${serverInfo.regionCode} / ${serverInfo.name}`:'—';
  const capture=draft.source?.capture.capture;
  const roleId=capture?.subject.roleId||'';
  const pwg=draft.source?.capture.pwg;
  const pwgUid=pwg&&pwg.roleId===roleId&&capture?.subject.uid===draft.profile.uid?pwg.uid:null;
  const ids=<>{[['UID',draft.profile.uid||'—'],['PWG UID',pwgUid||'—'],['RoleId',roleId||'—'],[t('Server ID'),serverInfo?.id||'—'],[t('Server'),serverLine]].map(([label,value])=><div key={label} className={styles.detailRow}><strong>{label}</strong><span>{value}</span></div>)}</>;
  const server=<span className="inspect-trigger" tabIndex={serverInfo?0:undefined}>{serverLine}</span>;
  return <div className={`sub ${styles.profileSub}`}>{serverInfo?<Tooltip portal placement="bottom" content={`${t('Server ID')}: ${serverInfo.id}`}>{server}</Tooltip>:server} · <Inspect editTarget="profile:uid" dialogSize="sm" title={t('Account ID')} heading={<InspectionHeading title={t('Account ID')}/>} tooltipDetails={ids} details={ids}><span>UID {draft.profile.uid||'0'}</span></Inspect> · <span {...edit('profile:level')}>{t('Lv.')} {draft.profile.level}</span></div>;
}

/** Hover badges of a source ("ATK: +750"), keyed by the stat keys its StatLink answers to, as the Global card's sourceBonuses. */
function sourceBonuses(catalog:MmoBuildCatalog,locale:BuildLocale,stats:{prop:string;value:number|null}[]) {
  // Keyed as the shared highlight sees the active stat (statFamily: "ATK" is "Attack"), for every key the source answers to.
  return Object.fromEntries(stats.filter(stat=>stat.value!==null).flatMap(stat=>{
    const attribute=mmoAttribute(catalog,stat.prop);
    const text=`${name(attribute?.name,locale)}: +${attributeText(catalog,stat.prop,stat.value as number,locale,attribute?.percent?2:0)}`;
    return mmoStatKeys(catalog,stat.prop).map(key=>[statFamily(key),text]);
  }));
}

/** The panel rows whose game hover text has a single {0} equal to the shown value (Defense 7.400% reads "reduces damage received by 7.400%", screenshot 2026-10-23); other templates need the client's description function and are not shown. */
const SHOWN_VALUE_TEXT=new Set(['ApproachingSpeedMMO','DefenseIntensityMMO','AttackPowerMMO','EquipAttrHealAtk','EquipAttrSuperArmor']);
/** `bare`: the Global combat-stat classes (vital-stat, crit-rating, crit-breakdown…) instead of the MMO row; `valueTag` is the value element. */
function StatRow({prop,draft,catalog,locale,className,bare,valueTag='b'}:{prop:string;draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;className?:string;bare?:boolean;valueTag?:'b'|'strong'}) {
  const edit=useMmoEditable();
  const attribute=catalog.attributes[prop];
  const shown=attributeText(catalog,prop,draft.stats[prop]??null,locale);
  const template=localized(attribute?.description, locale)??'';
  const text=!template?'':template.includes('{')?(SHOWN_VALUE_TEXT.has(prop)&&!template.includes('{1}')?template.replace(/\{0\}(%?)/,(_,percent)=>`<shuzhi>${shown.replace(/%$/,'')}${percent}</>`):''):template;
  const Value=valueTag;
  const label=<span><Icon src={attribute?.icon}/>{name(attribute?.name,locale)}</span>,value=<Value>{shown}</Value>;
  // A description that only repeats the attribute's name adds nothing.
  const hover=text&&text!==name(attribute?.name,locale)?(child:ReactElement)=><Inspect editTarget={`stat:${prop}`} title={name(attribute?.name,locale)} tooltipDetails={<GameRichText text={text}/>} details={<GameRichText text={text}/>}>{child}</Inspect>:null;
  // Global combat rows: label and value are children of the flex row; one hover covers the whole row (the trigger is stretched in the CSS).
  if(bare){const row=<StatLink types={mmoStatKey(catalog,prop)}><div {...(!hover?edit(`stat:${prop}`):{})} className={className}>{label}{value}</div></StatLink>;return hover?hover(row):row;}
  const row=<StatLink types={mmoStatKey(catalog,prop)}><div {...(!hover?edit(`stat:${prop}`):{})} className={`${mmo.statRow} ${className??''}`}>{label}{value}</div></StatLink>;
  return hover?hover(row):row;
}

/** `onRoleChange`: the header role becomes a picker (the saved build's slot); without it the role is shown only.
 * `onArtChange`: the Global card's header "Background" control (class `art-edit-control`, left out of the PNG export). */
export function MmoBuildCard({draft,catalog,locale,cardRef,customArt,height=BUILD_CARD_HEIGHT,onRoleChange,onSeasonChange,onArtChange,onImportRequest}:{draft:MmoBuildDraft;catalog:MmoBuildCatalog;locale:BuildLocale;cardRef?:Ref<HTMLElement>;customArt?:string;height?:number;onRoleChange?:(role:MmoProfileRole|null)=>void;onSeasonChange?:(season:number|null)=>void;onArtChange?:(id:string)=>void;onImportRequest?:()=>void}) {
  const t=localeText(locale);
  const edit=useMmoEditable(),{locked}=useBuildEditing();
  const art=catalog.artworks.find(item=>item.id===draft.art.id);
  const avatar=catalog.avatars.find(item=>item.id===draft.profile.avatarId);
  const frame=catalog.avatarFrames.find(item=>item.id===draft.profile.avatarFrameId);
  // Hover details of the account, as on the Global card: the signed capture's counters (an imported card only).
  const accountDetails=<div className={styles.accountCounters}>{draft.source?.capture.account?<AccountCounterRows account={draft.source.capture.account} locale={locale}/>:<div className={styles.detailRow}><span>{t('No account counters in this capture.')}</span></div>}
    {/* An avatar the catalog lacks is named here: a second hint on the portrait would overlap this popup. */}
    {draft.profile.avatarId&&!avatar&&<div className={`${styles.detailRow} ${styles.accountCounterRow}`} data-separated><strong>{t('Avatar')}</strong><span>{draft.profile.avatarId} · {t('not in the catalog yet')}</span></div>}</div>;
  const account=(child:ReactElement,target:MmoEditTarget)=>draft.source||(target==='profile:avatarId'&&avatar?.animation)?<Inspect editTarget={target} key={target} dialogSize="sm" title={draft.profile.name||'—'} meta={t('Account')} tooltipDetails={accountDetails} details={<>{accountDetails}{target==='profile:avatarId'&&<ProfileCosmeticPreview animation={avatar?.animation} name={localized(avatar?.name,locale)} locale={locale}/>}</>}>{child}</Inspect>:<span {...edit(target)}>{child}</span>;
  // Panel lists run from the largest to the smallest shown value; equal values keep the Global order (Frost, Volt, Flame, Physical, Altered).
  const elementOrder=['Frost','Volt','Flame','Physical','Altered'];
  const elementRows=[...catalog.panels.elements].sort((a,b)=>(draft.stats[b.attack]??-1)-(draft.stats[a.attack]??-1)||elementOrder.indexOf(a.element)-elementOrder.indexOf(b.element));
  const shown=(prop:string)=>(draft.stats[prop]??0)*(catalog.attributes[prop]?.percent?100:1);
  // Percent attributes first, then flat numbers; each group from the largest down.
  const basicProps=[...catalog.panels.basic].sort((a,b)=>Number(!!catalog.attributes[b]?.percent)-Number(!!catalog.attributes[a]?.percent)||shown(b)-shown(a));
  // RES hover: the game's text of the element's resistance with the reduction filled in (model: RES / (RES + K), K calibrated on one in-game reading).
  const resistanceHover=(row:{element:string;resistance:string})=>{
    const value=draft.stats[row.resistance]??null;
    const shownValue=<span className="element-stat-value">{attributeText(catalog,row.resistance,value,locale)}</span>;
    const k=catalog.resistanceFormula?.k;
    const template=localized(catalog.attributes[row.resistance]?.description, locale);
    if(value===null||!k||!template?.includes('{0}'))return shownValue;
    const text=template.replace(/\{0\}(%?)/,`<shuzhi>${formatValue(value/(value+k),true,locale,3)}</>`);
    const details=<><GameRichText text={text}/><p className={mmo.muted}>{t('RES ÷ (RES + K), K calibrated on one in-game reading (model).')}</p></>;
    return <Inspect title={`${elementLabel(row.element,locale)} ${t('Resistance','Сопротивление')}`} tooltipDetails={details} details={details}>{shownValue}</Inspect>;
  };
  const critChance=mmoCritChance(draft,catalog);
  const petScale=mmoCritScale(draft,catalog);
  const sets=mmoCardSets(draft,catalog);
  const counts=new Map(sets.map(set=>[set.card.id,set.count]));
  const thresholds=mmoThresholds(draft,catalog);
  const chains=mmoBrainfieldChains(draft,catalog);
  const pet=mmoPetStats(draft,catalog);
  const totals=mmoAttributeTotals(draft,catalog);
  const role=mmoRoleResonance(draft,catalog);
  const modeLabel=draft.weaponMode?localized(catalog.labels[draft.weaponMode==='fixed'?'fixedMode':'regularMode'], locale):null;
  const modeDescription=draft.weaponMode?localized(catalog.labels[draft.weaponMode==='fixed'?'fixedModeDescription':'regularModeDescription'], locale):'';
  const fmt=(value:number,digits=0)=>formatValue(value,false,locale,digits);
  // Smart Servant hover, as the Global card's pet details: own ATK + the inherited part, their sum, Crit.
  const petDetails=pet&&<div className={styles.alignedBonusRows}><BonusEffects effects={[
    {id:'attack',icon:catalog.attributes.CommonAtkAdded?.icon??undefined,label:t('ATK'),value:<><BonusValue tone="neutral">{pet.attack===null?'—':fmt(pet.attack)}</BonusValue> {pet.inheritedAttack===null?'—':<BonusValue tone="positive">+{fmt(pet.inheritedAttack)}</BonusValue>}</>},
    {id:'totalAttack',icon:catalog.attributes.CommonAtkAdded?.icon??undefined,label:t('Total ATK'),value:<BonusValue tone="neutral">{pet.attack===null||pet.inheritedAttack===null?'—':fmt(pet.attack+pet.inheritedAttack)}</BonusValue>},
    {id:'crit',icon:catalog.attributes.Crit?.icon??undefined,label:t('Crit'),value:<BonusValue tone="neutral">{pet.crit===null?'—':fmt(pet.crit)}{pet.crit!==null&&petScale&&<> = {formatValue(pet.crit/petScale.denominator,true,locale,3)} <span className={styles.petEnemyLevel}>({t('Lv.','Ур.')} {petScale.level})</span></>}</BonusValue>},
  ]}/></div>;
  const weaponCombatStrength=draft.weapons.reduce((sum,entry)=>sum+mmoWeaponCombatStrength(catalog,entry),0);
  return <StatHighlight><article data-mmo-card data-editing={!locked||undefined} className={`card ${mmo.card}`} style={{width:BUILD_CARD_WIDTH,height}} ref={cardRef} aria-label={t('Tower of Fantasy MMO build card')}>
    {(customArt||art?.url)&&<img className="hero-art" src={customArt||art?.url} alt="" style={{objectPosition:`${draft.art.x}% ${draft.art.y}%`,transform:`translate(${draft.art.offsetX??0}%, ${draft.art.offsetY??0}%) scale(${draft.art.zoom})`}}/>}<div className="art-shade"/>
    <header className="header" {...edit('art','area')}><div className={`identity ${styles.profileIdentity}`}>{account(<ProfileAvatar className="avatar-portrait" avatar={avatar} frame={frame} formatLabel={avatar?.animation ? avatar.animation.status === 'ready' ? 'GIF' : t('Effect', 'Эффект') : undefined} avatarLabel={localized(avatar?.name, locale)}><AvatarFallback avatarId={draft.source?undefined:draft.profile.avatarId} locale={locale}/></ProfileAvatar>,'profile:avatarId')}
      <div><div className="player-row">{account(<div className={`player ${styles.profileName}`}>{draft.profile.name||'—'}</div>,'profile:name')}<div className="profile-affiliations"><span className="profile-crew" {...edit('profile:crew')}><small>{t('Crew','Гильдия')}:</small><b data-hint-overflow>{draft.profile.crew||'—'}</b></span><span className="profile-character-title" {...edit('profile:characterTitle')}><small>{t('Title')}:</small><CharacterTitlePlate label={characterTitleLabel(draft.profile.characterTitle,catalog,locale)||'—'} style={characterTitleStyle(draft.profile.characterTitle,catalog)}/></span></div></div>
        <div className="profile-meta"><CardIds draft={draft} locale={locale}/><div className="profile-cs"><span className="current-cs" {...edit('profile:cs')}>{t('CS')} <b>{draft.profile.cs===null?'—':fmt(draft.profile.cs)}</b></span><StatLink types={MMO_COMBAT_STRENGTH}><span>{t('Combat Strength')} <b>{fmt(weaponCombatStrength)}</b></span></StatLink></div></div></div></div>
      {draft.demo?<DemoCallToAction label={t('Demo profile preview')} importLabel={t('Import your build')} onImport={onImportRequest}/>:<p className="profile-signature" {...edit('profile:signature')}>{draft.profile.signature||'—'}</p>}
      {onArtChange&&<div className="art-edit-slot"><span className={`build-title build-focus ${styles.buildTitle}`} data-build-edit-skip><IconPick hint={false} inline searchable label={t('Background')} value={draft.art.id} items={catalog.artworks} locale={locale}
        display={<span className="art-edit-control">{t('Background')}</span>} onChange={onArtChange}/></span></div>}
      <div className="header-right"><CardFocus draft={draft} catalog={catalog} locale={locale} onChange={onRoleChange} onSeasonChange={onSeasonChange}/></div></header>
    <div className="main">
      <section className="loadout"><h2 className={`section-title ${styles.sectionTitle}`}><span className="section-label" {...edit('weapon-mode')}>{t('Weapons')}</span><span className={mmo.weaponHeading}>{role&&<Inspect title={`${localized(role.name, locale)} ${t('Resonance')}`} description={`${localized(role.description, locale)}

${t('Team modes')}: ${localized(role.teamDescription, locale)}`}><span className="weapon-resonance role-resonance" aria-label={localized(role.name, locale)}><img src={role.icon} alt=""/></span></Inspect>}{modeLabel&&<Inspect editTarget="weapon-mode" title={modeLabel} description={modeDescription} hoverPreview><small className={mmo.weaponMode}>{modeLabel}</small></Inspect>}</span></h2>
        {draft.weapons.map((_,index)=><Weapon key={index} index={index} draft={draft} catalog={catalog} locale={locale}/>)}</section>
      <section className="combat"><h2 className={`section-title ${styles.sectionTitle}`}><span className="section-label" {...edit('stats')}>{t('Attributes')}</span></h2><div className={`stats ${mmo.stats}`}>
        <div className="health-row"><StatRow bare prop="MaxHP" className="vital-stat hp-stat" draft={draft} catalog={catalog} locale={locale}/><StatRow bare prop="MaxEnergy" className="vital-stat universal-attack-stat" draft={draft} catalog={catalog} locale={locale}/></div>
        <div className="crit-summary"><div className="crit-hero"><StatRow bare prop="Crit" className="crit-rating top-stat" valueTag="strong" draft={draft} catalog={catalog} locale={locale}/>
          <div className="crit-result">{critChance?<><StatLink types={mmoStatKey(catalog,'Crit')}><div className="crit-calculation"><Tooltip portal content={`${t('Crit rating ÷ same-level coefficient (model)')}: ${fmt(critChance.rating)} ÷ ${fmt(critChance.denominator)} · Lv. ${critChance.level}`}><strong tabIndex={0}>→ {formatValue(critChance.base,true,locale,3)}</strong></Tooltip>
            <small {...edit('stat:FinalCrit')} data-hint={name(catalog.attributes.FinalCrit?.name,locale)}>+ {attributeText(catalog,'FinalCrit',draft.stats.FinalCrit??null,locale)}</small></div></StatLink>
            <StatLink types={mmoStatKey(catalog,'Crit')}><div className="crit-breakdown total" tabIndex={-1}><b>{formatValue(critChance.total,true,locale,3)}</b></div></StatLink></>:<small>—</small>}</div></div>
          <StatRow bare prop="CritDam" className="crit-breakdown crit-damage" draft={draft} catalog={catalog} locale={locale}/></div>
        <table className={`stat-table ${styles.elementStatPalette}`}><colgroup><col className="element-column"/><col className="attack-column"/><col className="attack-column"/></colgroup><thead><tr><th>{t('Element','Элемент')}</th><th><Icon src={catalog.attributes.CommonAtkAdded?.icon}/>{t('ATK')}</th><th><Icon src={catalog.attributes.ElementDef?.icon}/>{t('RES','Сопр.')}</th></tr></thead><tbody>{elementRows.map(row=><tr key={row.element}>
          <th><StatLink types={mmoStatKey(catalog,row.attack)} inspectTypes={[mmoStatKey(catalog,row.attack),mmoStatKey(catalog,'CommonAtkAdded')]}><span className="element-stat-label"><Icon element src={catalog.elementIcons[row.element]?.icon}/>{elementLabel(row.element,locale)}</span></StatLink></th>
          {/* An ATK cell lights only itself; its sources are the shared ATK modifier and its own element's ATK. The element name answers as its ATK cell. */}
          <StatLink types={mmoStatKey(catalog,row.attack)} inspectTypes={[mmoStatKey(catalog,row.attack),mmoStatKey(catalog,'CommonAtkAdded')]}><td {...edit(`stat:${row.attack}`)}><span className="element-stat-value">{attributeText(catalog,row.attack,draft.stats[row.attack]??null,locale)}</span></td></StatLink>
          <StatLink types={[mmoStatKey(catalog,'ElementDef'),`${row.element} ${mmoStatKey(catalog,'ElementDef')}`]}><td {...edit(`stat:${row.resistance}`)}>{resistanceHover(row)}</td></StatLink></tr>)}</tbody></table>
        <div className={mmo.basic}><h3>{t('Basic')}</h3><div className={mmo.basicGrid}>{basicProps.map(prop=><StatRow key={prop} prop={prop} draft={draft} catalog={catalog} locale={locale}/>)}</div></div>
      </div></section>
      <section><h2 className={`section-title ${styles.sectionTitle}`}><span className="section-label" {...edit('equipment')}>{t('Equipment')}</span></h2><div className="gear-grid">{catalog.slots.map(slot=><Gear key={slot.id} slotId={slot.id} draft={draft} catalog={catalog} locale={locale} counts={counts}/>)}</div></section>
    </div>
    <section className={`systems ${mmo.systems}`} aria-label={t('Additional build systems')}>
      <div className="system"><h3>{t('Random stat bonuses')}</h3><div className={mmo.thresholds}>{[...thresholds].sort((a,b)=>b.level-a.level).map(track=>{
        const attribute=catalog.attributes[track.attribute];
        const active=track.levels[Math.max(0,track.level-1)];
        const description=localized(active?.description, locale)?.replace(/<shuzhi2?>([^<]*)<\/>(?=\/)/g,'$1');
        const content=<div className={styles.itemEffects}><div className={styles.detailRow}><strong>{t('Total','Сумма')}</strong><span>{attributeText(catalog,track.prop,track.total,locale,2)}</span></div>
          <div className={styles.detailRow}><strong>{t('Thresholds')}</strong><span>{track.levels.map(level=>attributeText(catalog,track.prop,level.value,locale,2)).join(' / ')}</span></div>
          {description&&<GameRichText text={description} rank={Math.max(0,track.level-1)}/>}</div>;
        return <Inspect key={track.prop} title={name(attribute?.name,locale)} meta={`Lv. ${track.level} / ${track.levels.length}`} tooltipDetails={content} details={content}>
          <StatLink types={mmoStatKey(catalog,track.attribute)}><span className={mmo.threshold} data-level={track.level}><Icon src={attribute?.icon}/><span>{name(attribute?.name,locale)}</span><b>{track.level}</b></span></StatLink></Inspect>;
      })}</div></div>
      <div className="system" {...edit('pet','area')}><h3 {...edit('pet')}>{t('Smart Servant')}</h3>{pet?<Inspect editTarget="pet-details" title={name(pet.pet.name,locale)} meta={`Lv. ${draft.pet!.level}`} tooltipDetails={petDetails} details={petDetails}><div className={mmo.pet}><img className={mmo.petPortrait} src={pet.pet.portrait??pet.pet.icon??''} alt=""/><div className={mmo.petInfo}><b>{name(pet.pet.name,locale)} <small>{t('Lv.')} {draft.pet!.level}{!!draft.pet!.stars&&` · ★${draft.pet!.stars}`}</small></b>
        {/* The pet's own stats: not a source of the player's panel (no source is verified), so no stat link. As the in-game Abilities list: own ATK + the inherited part, then Crit. */}
        <span className={mmo.petStat}><Icon src={catalog.attributes.CommonAtkAdded?.icon}/>{t('Attack')}<b>{pet.attack===null?'—':fmt(pet.attack)}{pet.inheritedAttack!==null&&<span className={mmo.inherited}>+{fmt(pet.inheritedAttack)}</span>}</b></span>
        <span className={mmo.petStat}><Icon src={catalog.attributes.Crit?.icon}/>{t('Crit')}<b>{pet.crit===null?'—':fmt(pet.crit)}{pet.crit!==null&&petScale&&<span className={mmo.petChance} data-hint={`${t('Crit rating ÷ same-level coefficient (model)')} · Lv. ${petScale.level}`}> = {formatValue(pet.crit/petScale.denominator,true,locale,3)}</span>}</b></span></div></div></Inspect>
        :<p className="consumable-empty" {...edit('pet')}>{t('Nothing')}</p>}
        {!!draft.pet?.modules?.length&&<div className={mmo.petModules}>{draft.pet.modules.map(row=>{
          const module=catalog.petModules?.find(entry=>entry.id===row.id);
          return <Inspect key={row.slot} editTarget={`pet-module:${row.slot}`} title={module?name(module.name,locale):row.id} description={localized(module?.description,locale)}><span {...edit(`pet-module:${row.slot}`)}><Icon src={module?.icon} className={mmo.cardIcon}/><small>{module?.level??'?'}</small></span></Inspect>;
        })}</div>}</div>
      {/* As the Global card's consumables: "Nothing" when neither dish is active. */}
      <div className="system"><h3 {...edit('consumable:food')}>{t('Food')}</h3>{locked&&!draft.consumables.food&&!draft.consumables.potion?<p className="consumable-empty">{t('Nothing')}</p>:<div className={mmo.foods}>{([[catalog.foods.find(item=>item.id===draft.consumables.food),t('Dish')],[catalog.potions.find(item=>item.id===draft.consumables.potion),t('ATK% dish')]] as const).map(([item,label],index)=>
        item?<Tooltip key={index} portal content={`${label}: ${localized(item.name, locale)}${'atkPercent' in item&&item.atkPercent!==null?` · ${t('ATK')} +${item.atkPercent}%`:''}`}><img {...edit(index===0?'consumable:food':'consumable:potion')} tabIndex={0} src={item.icon??''} alt={localized(item.name, locale)}/></Tooltip>:<span key={index} {...edit(index===0?'consumable:food':'consumable:potion')} className="compact-empty" data-hint={label}>—</span>)}</div>}</div>
      <div className="system"><h3 {...edit('equipment')}>{localized(catalog.labels.expansionStats, locale)}</h3><div className={mmo.sets} style={{gridTemplateColumns:`repeat(${sets.length>8?3:2},minmax(0,1fr))`}}>{sets.length?sets.slice(0,12).map(set=><Inspect key={set.card.id} title={name(set.card.name,locale)} tooltipDetails={<CardDetails card={set.card} count={set.count} stats={set.stats} catalog={catalog} locale={locale}/>} details={<CardDetails card={set.card} count={set.count} stats={set.stats} catalog={catalog} locale={locale}/>}>
        <StatLink types={set.stats.flatMap(stat=>mmoStatKeys(catalog,stat.prop))} inspectTypes={[]} sourceBonuses={sourceBonuses(catalog,locale,set.stats)}><span className={mmo.set}><Icon src={set.card.icon} className={mmo.cardIcon}/><span data-hint-overflow>{name(set.card.name,locale)}</span><b>{set.count}/{set.card.maxSuit}</b></span></StatLink></Inspect>):<span className={mmo.muted}>—</span>}</div></div>
      <div className="system"><h3>{t('Brainfield','Brainfield')}</h3><div className={mmo.chains}>{chains.map((chain,index)=>{
        const learned=chain.nodes.filter(node=>(draft.brainfield[node.id]??0)>0);
        // Reached levels' attribute rows summed by attribute, then each learned node's level.
        const content=<div className={styles.itemEffects}>{chain.stats.length>0&&<BonusEffects effects={chain.stats.map(stat=>({id:stat.prop,icon:mmoAttribute(catalog,stat.prop)?.icon??undefined,
          label:name(mmoAttribute(catalog,stat.prop)?.name,locale),value:<BonusValue tone="neutral">+{attributeText(catalog,stat.prop,stat.value,locale,mmoAttribute(catalog,stat.prop)?.percent?2:0)}</BonusValue>}))}/>}
          {learned.length?learned.map(node=><div key={node.id} className={styles.detailRow}><strong>{name(node.name,locale)}</strong><span>{draft.brainfield[node.id]} / {node.maxLevel}</span></div>):<span>{t('No levels')}</span>}</div>;
        return <Inspect editTarget={`brainfield:${index}`} key={chain.name.en} title={name(chain.name,locale)} meta={`${chain.level} / ${chain.maximum}`} tooltipDetails={content} details={content}>
          <StatLink types={chain.stats.flatMap(stat=>mmoStatKeys(catalog,stat.prop))} inspectTypes={[]} sourceBonuses={sourceBonuses(catalog,locale,chain.stats)}><span className={mmo.chain}><span>{name(chain.name,locale)}</span><span className={mmo.chainSkills}>{chain.nodes.filter(node=>node.kind==='skill').map(node=><img key={node.id} src={node.icon??''} alt="" data-active={(draft.brainfield[node.id]??0)>0||undefined}/>)}</span><b>{chain.level}</b><small>/ {chain.maximum}</small></span></StatLink></Inspect>;
      })}</div></div>
    </section>
    <footer className="footer"><span className="foot-brand">@kritik</span><div className={`gear-stat-totals ${mmo.totals}`}>{totals.map(total=><StatLink key={total.attribute} types={mmoStatKey(catalog,total.attribute)}><div className="gear-stat-total" tabIndex={0} data-attribute={total.attribute} data-hint={`${name(catalog.attributes[total.attribute]?.name,locale)} · ${fillText(t('{0} gear pieces', 'предметов гира: {0}'), [total.pieces])}`}>
      <span className="gear-stat-value"><span className="summary-stat-icon"><Icon src={catalog.attributes[total.attribute]?.icon}/></span>{attributeText(catalog,total.attribute,total.value,locale,2)}</span><span className="gear-stat-rolls">×{total.pieces}{total.quality!==null&&<> · <b data-roll-quality>{formatValue(total.quality,true,locale,0)}</b></>}</span></div></StatLink>)}</div>
      <div className="card-metadata"><time dateTime={draft.updatedAt}>{draft.updatedAt?formatBuildDate(draft.updatedAt,'instant'):'—'}</time>
        {(['demo','verified','edited','test-server','unknown-server','incomplete-capture'] as const).map(status=><span key={status} className="data-origin" data-status={status} data-export-provenance={status}>{status==='demo'?t('Demo'):status==='verified'?t('Verified'):status==='edited'?t('Edited'):captureOriginLabel(status,locale,'export',draft.source?.capture.capture.scan?.distribution)}</span>)}
      </div></footer>
  </article></StatHighlight>;
}

