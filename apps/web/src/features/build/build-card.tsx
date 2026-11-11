import { fillText } from '@/lib/i18n/text';
import { localized, localizedUi, translateUiText} from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {resolveServerFromUid,type EquippedBuildRanking} from '@tof-hub/contracts';
import {BuildGearRanking} from './build-gear-ranking';
import {WeaponSkillChoices} from '../info-sections/common/weapon-skill-choices';
import {getDualElementIconPath} from '../info-sections/common/element-icons';
import {gameAsset} from '@tof-hub/game-assets';
import {activeRoleResonance,activeWeaponResonances,buildWeaponElements} from './weapon-resonances';
import {gearCombatScore,gearRollDetails,gearTitanCombatScore} from './model';
import {GearRollQuality} from './gear-roll-quality';
import {TitanEffectDetails} from './titan-effect-details';
import {BonusEffects,BonusValue,enhancementBonusText,attackPercentBonusText} from './stat-bonuses';
import {GameRichText,ProfileAvatar} from '@tof-hub/ui';
import {useBuildEditable,useBuildEditing} from './build-editing';
import {InlineNumber} from './build-fields';
import {Inspect,InspectionHeading,InspectionStars,BuildTooltip as Tooltip} from './build-inspection';
import {buildInfoHref} from './info-link';
import {buildRankedModuleDescription,getModuleRank} from '../info-sections/common/pet-module-text';
import {MatrixStrip} from './matrix-strip';
import {WeaponIdentity} from './weapon-identity';
import {GearBaseStats,GearStatSection} from './gear-base-stats';
import {RelicSystem,ConsumableSystem} from './compact-loadout';
import {Stars} from './stars';
import {captureOriginLabel,restrictedCaptureOrigin} from './capture-origin';
import {GearRollValue,TotalRollValue} from './gear-roll-value';
import {BUILD_CARD_WIDTH,buildSummaryColumns,buildCardHeight} from './layout';
import {StatHighlight,StatLink,statInspectTypes,DAMAGE_SOURCES,ATTACK_SOURCES,ATTACK_PERCENT_SOURCES,CRIT_SOURCES,HP_SOURCES,RESISTANCE_SOURCES,resistanceSourceKey,resistanceSourceKeys,ENHANCEMENT_SOURCES,CS_SOURCES,CS_TOTAL,AUGMENT_COUNT} from './stat-highlight';
import {getBuildResistanceReduction} from '@tof-hub/game-domain';
import type {Ref,ReactNode} from 'react';
import type {BuildCatalog,BuildDraft,BuildLocale,GearDraft} from './types';
import {buildRole,rollValueContext,elementResistanceBase,elementTotalAttack,universalAttack,weaponStatBonuses,matrixAttackPercentSources,petStatBonuses,enhancementShotBonuses,analyzeGear,combatRates,summaryStats,supportSystem,titanMaximums,enhancementResonance,gearBaseStats,gearStatContributions,equippedGearStats,combatStatWinners,buildCombatDraft,gearElementStat,duoInheritedValue,duoPartner,type ElementStatKind,weaponMarkBonus,additionalDamageSources,buildRollValue,cardGear,gearCurrentRollValue,augmentationTotalValue} from './model';
import {computingCombatScore,supportCombatScore,suppressorCombatScore,weaponCombatScore,type SystemCombatScore} from './system-cs';
import {SupportResetDetails} from './support-reset';
import {BuildFocus} from './build-focus';
import {DemoCallToAction} from './demo-call-to-action';
import {augmentCountParts,elementLabel,enemyLevelEditHint,formatBuildDate,formatValue,formatStatMaximum,statIcon,statLabel,systemBonusText,petModuleLevel,rollValueQuality} from './presentation';
import styles from './build.module.css';
import {formatNumber} from '@/lib/i18n/format';
import {characterTitleLabel,characterTitleStyle} from './character-title';
import {CharacterTitlePlate} from './character-title-plate';
import {formatTopUp} from './top-up';
import {ProfileCosmeticPreview} from './profile-cosmetic-preview';
import {AvatarFallback} from './avatar-fallback';

function Icon({src,element=false,resistanceElement}:{src?:string;element?:boolean;resistanceElement?:string}) {return src?<img className="stat-icon" data-element-icon={element||undefined} data-resistance-element={resistanceElement} src={src} alt=""/>:null;}
function SummaryStatIcon({type,catalog}:{type:string;catalog:BuildCatalog}) {
  const element=Object.keys(catalog.elementIcons).find(e=>type.startsWith(e+' '));
  const resistance=type.includes('Resistance');
  const src=element?(resistance?catalog.resistanceIcons[element]?.icon:catalog.elementIcons[element]?.icon):statIcon(type,catalog);
  const badge=type.includes('Damage')?'D%':type.includes('Attack %')?'A%':type.includes('%')?'%':'';
  return <span className="summary-stat-icon" data-crit={type.startsWith('Crit')||undefined}><Icon src={src} element={!!element} resistanceElement={resistance?element:undefined}/>{badge&&<small>{badge}</small>}</span>;
}
function tBase(locale:BuildLocale) {return localeText(locale)('Base + enhancement + unlocked bonuses', 'Основа + усиление + открытые бонусы');}
function ComputingEffects({node,level,locale}:{node:BuildCatalog['computing'][number];level:number;locale:BuildLocale}) {
  return <BonusEffects effects={node.effects.map(effect=>{
    const bonus=effect.levels.find(item=>item.level===level);
    return {id:effect.id,icon:effect.icon,label:localizedUi(effect.name, locale),value:bonus?<BonusValue tone="neutral">+{formatValue(bonus.value,bonus.percentage,locale,1)}</BonusValue>:systemBonusText(undefined,undefined,locale)};
  })}/>;
}
function SynthesisEffects({effects,stage,locale}:{effects:BuildCatalog['synthesis']['effects'][string]|undefined;stage:number;locale:BuildLocale}) {
  return <div className={styles.synthesisEffects}>{effects?.map(effect=>{
    const unlocked=stage>=effect.stage;
    return <div className={styles.synthesisEffect} data-unlocked={unlocked} key={effect.stage}><strong>S{effect.stage}</strong><GameRichText text={localized(effect.description, locale)}/><small>{unlocked?(localeText(locale)('Active')):(localeText(locale)('Not unlocked', 'Не открыто'))}</small></div>;
  })}</div>;
}
function StatBonuses({stats,catalog,locale}:{stats:BuildCatalog['suppressors'][number]['stats'];catalog:BuildCatalog;locale:BuildLocale}) {
  if(!stats)return <span>{localeText(locale)('No stat bonus', 'Нет бонуса к статам')}</span>;
  return <div className={styles.alignedBonusRows}><BonusEffects effects={([['atk','ATK','АТК','attack'],['res','Resistance','Сопротивление','resistance'],['hp','HP','HP','hp'],['crit','Crit','Крит','crit']] as const).map(([key,en,ru,icon])=>({id:key,icon:catalog.displayIcons[icon]?.icon,label:localizedUi({en,ru},locale),value:<BonusValue tone="neutral">+{formatValue(stats[key],false,locale)}</BonusValue>}))}/></div>;
}
// Both progression systems expose the same four flat stat contributions.
function progressionSourceProps(stats:BuildCatalog['suppressors'][number]['stats'],locale:BuildLocale,resistanceChannels:string[],combatScore?:string) {
  const entries=([
    ['atk','attack',ATTACK_SOURCES],['hp','hp',HP_SOURCES],
    ['crit','crit',CRIT_SOURCES],['res','resistance',RESISTANCE_SOURCES],
  ] as const).filter(([key])=>(stats?.[key]??0)>0)
    .flatMap(([key,id,channel])=>(key==='res'?[channel,...resistanceChannels]:[channel]).map(channel=>({key,id,channel})));
  const channels=entries.map(({channel})=>channel);
  const cs=combatScore?[CS_SOURCES]:[];
  return {
    types:[...cs,...channels],
    inspectTypes:[],
    highlightOnHover:false,
    sourceChannel:[...cs,...channels],
    sourceBonuses:{...(combatScore?{[CS_SOURCES]:combatScore}:{}),...Object.fromEntries(entries.map(({key,id,channel})=>[channel,enhancementBonusText([{id,value:stats![key]}],locale)]))},
  };
}
/**
 * Own account counters; Top-up uses the user-confirmed TotalRechargeValue / 100 dollar presentation.
 */
/** Account counter rows of a capture (shared with the MMO card header). */
export function AccountCounterRows({account,locale}:{account?:import('@tof-hub/contracts').AccountCounters;locale:BuildLocale}) {
  const rows:[{en:string;ru:string},keyof import('@tof-hub/contracts').AccountCounters][]=[
    [{en:'Days logged in',ru:'Дней входа'},'totalLoginDays'],[{en:'Login streak',ru:'Дней подряд'},'continueLoginDays'],
    [{en:'Outfits purchased',ru:'Куплено костюмов'},'buyFashionCount'],[{en:'Packs purchased',ru:'Куплено паков'},'buyGemCount'],
    [{en:'Top-up',ru:'Пополнение'},'totalRechargeValue'],
  ];
  return <>{account&&rows.map(([label,key])=><div key={key} className={`${styles.detailRow} ${styles.accountCounterRow}`} data-separated={key==='buyFashionCount'||key==='totalRechargeValue'||undefined}><strong>{localizedUi(label,locale)}</strong><span>{typeof account[key]==='number'?(key==='totalRechargeValue'?formatTopUp(account[key]!,locale):formatNumber(account[key]!,locale)):'—'}</span></div>)}</>;
}

function AccountCounters({account,draft,backpack,locale}:{account?:import('@tof-hub/contracts').AccountCounters;draft:BuildDraft;backpack?:Pick<GearDraft,'augmentCount'>[];locale:BuildLocale}) {
  const ru=locale==='ru';
  const augmentationSpent=augmentationTotalValue(draft,backpack);
  return <div className={styles.accountCounters}>
    <AccountCounterRows account={account} locale={locale}/>
    {draft.captureSource?.kind==='file'&&<div className={`${styles.detailRow} ${styles.accountCounterRow}`} data-separated><strong>{localizedUi({en:'Augmentations used',ru:'Аугментаций использовано'},locale)}</strong><span>{augmentationSpent===null?'—':formatNumber(augmentationSpent,locale)}</span></div>}
  </div>;
}

function Gear({gear,draft,catalog,locale,showTitanQuality,showQuality}:{gear:GearDraft;draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;showTitanQuality:boolean;showQuality:boolean}) {
  // Titan clicks (Augmentation Count) from an own capture, shown with the item's stars and level on hover.
  const clicks=gear.equipped&&gear.titan?augmentCountParts(gear.augmentCount,locale):null;
  const augmentationFooter=clicks&&<div className={styles.augmentationFooter}><span className={styles.augmentationLabel}>{localeText(locale)('Augmentation', 'Аугментация')}</span><b>{clicks.value}</b></div>;
  const edit=useBuildEditable();
  const gearIndex=draft.gear.findIndex(g=>g.id===gear.id);
  const meta=catalog.gear.find(g=>g.id===gear.id)!;
  const {rolls,combinations}=analyzeGear(gear,catalog);
  const rollDetails=gearRollDetails(gear,catalog),rollText=(i:number)=>rollDetails[i]!.count;
  const maxima=titanMaximums(gear,catalog);
  // Scored as the build uses it: on a duo pair only the ATK % / DMG % element the whole gear wins (cardGear).
  const rvScore=gearCurrentRollValue(cardGear(gear,draft,catalog),draft,catalog);
  const cs=gearCombatScore(gear,draft,catalog);
  const csText=cs.value===null?'—':`= ${formatValue(cs.value,false,locale)}`;
  const baseDetails=<GearBaseStats stats={gearBaseStats(gear,catalog)} catalog={catalog} locale={locale} combatScore={gear.equipped?cs.value:null} emptyLabel={gear.equipped?'—':localeText(locale)('Not equipped')}/>;
  const gearPreviewDetails=<GearBaseStats stats={gearBaseStats(gear,catalog)} catalog={catalog} locale={locale} combatScore={gear.equipped?cs.value:null} emptyLabel={gear.equipped?'—':localeText(locale)('Not equipped')} footer={augmentationFooter}/>;

  const fmt=(n:number,p=false,digits=2)=>formatValue(n,p,locale,digits);
  const rare=catalog.reference.titanRare.items.find(r=>r.id===gear.rareId);
  // Titan clicks: an invisible anchor at the top of a Titan item. Any row of "Titan · total levels" shows them above
  // every Titan item in the card's source bubble (as CS does), "—" when unknown; the item itself is not lit.
  const clicksText=gear.equipped&&gear.titan?`Aug: ${gear.augmentCount??'—'}`:null;
  return <article className="gear" data-empty={gear.equipped?undefined:''} {...edit(`gear:${gearIndex}`,'area')}>
    {clicksText&&<StatLink types={AUGMENT_COUNT} inspectTypes={[AUGMENT_COUNT]} sourceBonus={clicksText}><span className="titan-clicks-anchor" aria-hidden="true" tabIndex={-1}/></StatLink>}
    <StatLink types={gear.equipped&&cs.value!==null?CS_SOURCES:[]} inspectTypes={[]} sourceChannel={CS_SOURCES} sourceBonus={gear.equipped&&cs.value!==null?`CS: ${formatValue(cs.value,false,locale)}`:undefined}><div className="gear-head"><Inspect dialogSize="sm" title={localizedUi(meta.name, locale)} meta={<span data-gear-enhancement><InspectionStars value={gear.stars}/> · <span data-meta-value>+{gear.enhancement}</span></span>} heading={<InspectionHeading title={localizedUi(meta.name, locale)} meta={<span data-gear-enhancement><InspectionStars value={gear.stars}/> · <span data-meta-value>+{gear.enhancement}</span></span>}/>} tooltipDetails={gearPreviewDetails} details={<div className={styles.gearDetails}>{baseDetails}<GearStatSection title={localeText(locale)('Random stats', 'Случайные статы')}>{(()=>{const titanStage=gear.titan||gear.augmented;const pct=(type:string)=>!!catalog.reference.statTypes[type]?.isPercentageBased;
        return <div className={styles.randomStats} data-titan={titanStage||undefined} role="table" aria-label={localeText(locale)('Random stats', 'Случайные статы')}>
          <div role="row" className={styles.randomStatsHead}><span role="columnheader">{localeText(locale)('Stat')}</span><span role="columnheader">{localeText(locale)('Now')}</span>{titanStage&&<span role="columnheader">{localeText(locale)('Before', 'До Titan')}</span>}<span role="columnheader">{localeText(locale)('Rolls')}</span>{titanStage&&<span role="columnheader">{localeText(locale)('Titan max', 'Макс. Titan')}</span>}</div>
          {gear.rows.map((r,i)=><div role="row" key={i}><span role="cell" className={styles.randomStatName}><img className={styles.computingEffectIcon} src={statIcon(r.type,catalog)} alt=""/>{statLabel(r.type,locale)}</span><b role="cell">{fmt(r.value,pct(r.type))}</b>{titanStage&&<span role="cell">{r.beforeTitan===null?'—':fmt(r.beforeTitan,pct(r.type))}</span>}<span role="cell">×{rollText(i)}</span>{titanStage&&<span role="cell" className={styles.randomStatMax} data-percentage={pct(r.type)||undefined}>{maxima.random[i]===null?'—':fmt(maxima.random[i]!,pct(r.type))}</span>}</div>)}
        </div>;})()}</GearStatSection>{gear.titan&&<GearStatSection title={translateUiText('Titan',locale)}><div className={styles.randomStats} role="table" aria-label={translateUiText('Titan',locale)}>
          <div role="row" className={styles.randomStatsHead}><span role="columnheader">{localeText(locale)('Stat')}</span><span role="columnheader">{localeText(locale)('Now')}</span><span role="columnheader">{localeText(locale)('Titan max', 'Макс. Titan')}</span></div>
          {gear.augments.map((a,i)=>a.type&&<div role="row" key={i}><span role="cell" className={styles.randomStatName}><img className={styles.computingEffectIcon} src={statIcon(a.type,catalog)} alt=""/>{statLabel(a.type,locale)}</span><b role="cell">{fmt(a.value,!!catalog.reference.statTypes[a.type]?.isPercentageBased)}</b><span role="cell" className={styles.randomStatMax}>{maxima.added[i]===null||maxima.added[i]===undefined?'—':fmt(maxima.added[i]!,!!catalog.reference.statTypes[a.type]?.isPercentageBased)}</span></div>)}
        </div><p className={styles.titanRareLevel}>{rare&&<img className={styles.titanRareIcon} src={statIcon(rare.nameEn,catalog)} alt=""/>}{rare?(locale === 'ru' ? rare.nameRu : translateUiText(rare.nameEn, locale)):'—'} +{gear.rareLevel}</p>{augmentationFooter}</GearStatSection>}</div>}><img src={meta.icons[gear.equipped&&gear.titan?'titan':gear.equipped&&gear.augmented?'augmented':'normal']} alt=""/></Inspect><div className="gear-name"><div className="gear-title"><b data-hint-overflow>{localizedUi(meta.name, locale)}</b><span className="level" {...edit(`gear-level:${gearIndex}`)}>+{gear.enhancement}</span></div><small>{gear.equipped?<>{gear.titan?`${translateUiText('Titan',locale).toLocaleUpperCase()} · `:gear.augmented?`${translateUiText('Augmented',locale).toLocaleUpperCase()} · `:''}<span {...edit(`gear-stars:${gearIndex}`)}><Stars value={gear.stars}/></span></>:<>— · <span {...edit(`gear-stars:${gearIndex}`)}><Stars value={0}/></span></>}</small></div>{showQuality&&(gear.equipped?<GearRollValue gear={gear} draft={draft} catalog={catalog} locale={locale} score={rvScore}/>:<span className="gear-rv empty-rv">0 {(draft.rv?.mode??'grv').toUpperCase()}</span>)}</div></StatLink>
    <><div className="base">{gearBaseStats({...gear,equipped:true},catalog).map(b=>!gear.equipped?<span key={b.label}>{statLabel(b.label,locale)} 0</span>:<Tooltip key={b.label} portal content={gear.equipped?`${tBase(locale)}: ${fmt(b.base)} + ${fmt(b.enhancement)} + ${fmt(b.unlocked)} = ${fmt(b.value)}`:"—"}><StatLink contribution="base" types={b.label} inspectTypes={statInspectTypes(b.label)}><span tabIndex={0}>{statLabel(b.label,locale)} {fmt(gear.equipped?b.value:0)}</span></StatLink></Tooltip>)}</div>
    {gear.rows.map((row,i)=>{
      const bounds=catalog.reference.statTypes[row.type];
      if(!bounds)return <div key={i} className="roll" {...edit(`gear-stat:${gearIndex}:random:${i}`)}><span>—</span><b>0</b><span className="roll-detail">×0</span></div>;
      const before=row.beforeTitan;
      const quality=rollDetails[i]!.quality;
      const tooltip=before===null?(localeText(locale)('Enter the pre-Titan value to analyze rolls.', 'Введите значение до Titan для анализа проков.')):<>
        <span>{localeText(locale)('Before Titan', 'До Titan')}: <BonusValue tone="accent">{fmt(before,bounds.isPercentageBased)}</BonusValue>.{quality!==null&&<> {localeText(locale)('Roll quality')}: <BonusValue tone="roll">{fmt(quality,true,0)}</BonusValue>.</>}</span>
        <br/>
        <span>{maxima.random[i]!==null?<>{localeText(locale)('Maximum after Titan', 'Максимум после Titan')}: <BonusValue tone="accent">{formatStatMaximum(maxima.random[i]!,bounds.isPercentageBased,locale,2)}</BonusValue> (<BonusValue tone="roll">{fmt(row.value/maxima.random[i]!,true)}</BonusValue>).</>:gear.stars!==catalog.reference.limits.maxNumOfRandomStatRolls?(localeText(locale)('Titan maximum requires 5 stars.', 'Для максимума Titan нужны 5 звёзд.')):combinations.length?(localeText(locale)('Maximum unknown: multiple pull-up outcomes.', 'Максимум неизвестен: несколько вариантов подтягивания.')):(localeText(locale)('Values do not match SSR roll bounds.', 'Значения не соответствуют SSR-прокам.'))}</span></>;
      return <div className="roll-tooltip" key={i}><Tooltip portal content={tooltip}><StatLink contribution={rolls[i]===0?'base':undefined} types={row.type} inspectTypes={statInspectTypes(row.type)}><div className="roll" {...edit(`gear-stat:${gearIndex}:random:${i}`)}><span><Icon src={statIcon(row.type,catalog)}/>{statLabel(row.type,locale)}</span><b data-percentage={bounds.isPercentageBased||undefined}>{fmt(row.value,bounds.isPercentageBased)}</b><span className="roll-detail"><em tabIndex={0}>×{rollText(i)}<GearRollQuality value={quality} locale={locale} className="roll-quality"/></em></span></div></StatLink></Tooltip></div>;
    })}
    {(gear.titan||gear.augmented||!gear.equipped)&&<><div className="augment">{gear.augments.map((a,i)=>{const percentage=!!catalog.reference.statTypes[a.type]?.isPercentageBased;return <Tooltip key={i} portal content={maxima.added[i]===null?(localeText(locale)('Maximum unknown: check the SSR values and augmentation pool.', 'Максимум неизвестен: проверьте исходные значения и пул переноса.')):<>{localeText(locale)('Maximum after Titan', 'Максимум после Titan')}: <BonusValue tone={percentage?'roll':'accent'}>{formatStatMaximum(maxima.added[i]!,percentage,locale,2)}</BonusValue> (<BonusValue tone="roll">{fmt(a.value/maxima.added[i]!,true)}</BonusValue>)</>}><StatLink types={a.type} inspectTypes={statInspectTypes(a.type)}><div tabIndex={0} className={showTitanQuality?"augment-value with-quality":"augment-value"} {...edit(`gear-stat:${gearIndex}:augment:${i}`)} aria-label={statLabel(a.type,locale)}><span>{a.type&&<Icon src={statIcon(a.type,catalog)}/> }{!showTitanQuality&&<span className="augment-label" data-hint-overflow>{a.type?statLabel(a.type,locale):'—'}</span>}</span><b data-percentage={percentage||undefined}>{a.type?fmt(a.value,percentage):'0'}</b>{showTitanQuality&&<small className="titan-roll-size">{maxima.added[i]!==null&&maxima.added[i]!>0?fmt(a.value/maxima.added[i]!,true):'—'}</small>}</div></StatLink></Tooltip>})}</div>{(gear.titan||!gear.equipped)&&(()=>{
      const row=<StatLink types={gear.rareId}><div className="rare" {...edit(`gear-stat:${gearIndex}:rare:0`)}><span><Icon src={catalog.statIcons[gear.rareId]?.icon}/>{rare?(locale === 'ru' ? rare.nameRu : translateUiText(rare.nameEn, locale)):'—'}</span><b>{rare?`+${gear.rareLevel}`:'0'}</b></div></StatLink>;
      // No effect tooltip on the item: the combined level and effect live in "Titan · total levels".
      return row;
    })()}</>}
    </>
  </article>;
}

export function BuildCard({draft,catalog,locale,cardRef,customArt,showQuality=true,showSummary=true,showResistancePercent=true,showTitanQuality=false,backpack,onImportRequest,ranking,rankingEdited=false}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;cardRef?:Ref<HTMLElement>;customArt?:string;showQuality?:boolean;showSummary?:boolean;showResistancePercent?:boolean;showTitanQuality?:boolean;ranking?:EquippedBuildRanking;rankingEdited?:boolean;
  /** Backpack pieces of the same .tofbuild (the Optimizer inventory): counted into the profile's augmentation total. */
  backpack?:Pick<GearDraft,'augmentCount'>[];
  /** Demo card only: the banner's import button opens the .tofbuild picker. */
  onImportRequest?:()=>void}) {
  draft=buildCombatDraft(draft,catalog);
  const edit=useBuildEditable();
  const editing=useBuildEditing(),{locked}=editing;
  const weaponElements=buildWeaponElements(draft,catalog);
  const t=localeText(locale);
  const achievedAt=draft.profile.apexGsAchievedAt;
  // Stored as "Server (REGION)"; shown as "REGION · Server". Free text without a region stays as typed.
  const serverParts=/^(.*?)\s*\(([A-Za-z]{2,4})\)$/.exec(draft.profile.server.trim());
  const serverLine=serverParts?`${serverParts[2].toUpperCase()}${serverParts[1]?` / ${serverParts[1]}`:''}`:draft.profile.server||'—';
  const serverInfo=resolveServerFromUid(draft.profile.uid);
  const serverLabel=<span className="inspect-trigger" tabIndex={serverInfo?0:undefined} {...edit('profile:server')}>{serverLine}</span>;
  const serverLabelWithId=serverInfo?<Tooltip portal placement="bottom" content={`${t('Server ID')}: ${serverInfo.id}`}>{serverLabel}</Tooltip>:serverLabel;
  // Character identifiers, including the optional PWG account bound to this captured character.
  const roleId=draft.profile.roleId||draft.captureSource?.capture.capture.subject.roleId||'';
  const pwg=draft.captureSource?.capture.pwg;
  const pwgUid=pwg?.roleId===roleId&&draft.captureSource?.capture.capture.subject.uid===draft.profile.uid?pwg.uid:null;
  const characterIds=<>{[['UID',draft.profile.uid||'—'],['PWG UID',pwgUid||'—'],['RoleId',roleId||'—'],[t('Server ID'),serverInfo?.id||'—'],[t('Server'),serverLine||'—']].map(([label,value])=><div key={label} className={styles.detailRow}><strong>{label}</strong><span>{value}</span></div>)}</>;
  const captured=draft.captureSource?.kind==='file'?draft.captureSource.capture:null;
  const civilTime=captured?.profile.maxCsCivilTime;
  const received=(id:string)=>!captured||captured.availability[id]?.state==='received';
  const equippedStats=draft.gear.filter(item=>item.equipped).flatMap(item=>equippedGearStats(item,catalog));
  const gearStatTotal=(type:string)=>equippedStats.filter(stat=>stat.type===type).reduce((sum,stat)=>sum+stat.value,0);
  const hpPercent=draft.combat.hpPercent??gearStatTotal('HP %');
  const hpBase=received('hp')&&draft.combat.hp>0?draft.combat.hp/(1+hpPercent):null;
  const hpGear=gearStatTotal('HP');
  const critGear=gearStatTotal('Crit');
  const whiteAttack=universalAttack(draft);
  const whiteAttackGear=gearStatTotal('Attack');
  const enhancementSlot=catalog.consumables.findIndex(group=>group.id==='enhancement');
  const enhancementItem=catalog.consumables[enhancementSlot]?.items.find(item=>item.id===draft.consumables?.[enhancementSlot]);
  const shotStats=enhancementItem?draft.combat.consumableStatsApplied:undefined;
  const shotHP=shotStats?.hp??0,shotCrit=shotStats?.crit??0,shotResistance=shotStats?.resistance??0;

  // Game timestamps carry fractional seconds; show date and time to the minute only.
  const maximumCSDetails=<div className={styles.itemEffects}><div className={styles.detailRow}><strong>{t('CS')}</strong><b>{formatValue(draft.profile.apexCs??0,false,locale)}</b></div><div className={styles.detailRow}><strong>{t('Reached')}</strong>{achievedAt?<time dateTime={achievedAt}>{formatBuildDate(achievedAt,'instant')}</time>:civilTime?<time dateTime={civilTime}>{formatBuildDate(civilTime,'civil')} UTC</time>:<span>{t('Date and time unavailable')}</span>}</div></div>;
  const fmt=(n:number,p=false,digits=2)=>formatValue(n,p,locale,digits);
  const gearRows=(progression:number|null,rolls:number,percent=false,digits=0,element?:string,comparedTo?:{progression:number;rolls:number},enhancementShot=0,colorElement?:string)=><>
    {progression!==null&&progression+enhancementShot!==comparedTo?.progression&&<div className={styles.detailRow} data-gear-contribution="progression" data-hint={t('Fixed base stats, enhancement and unlocked base bonuses.')}><strong>{t('Gear · base + enhancement')}{element&&` · ${elementLabel(element,locale)}`}</strong><b className={element?'inherited-value':undefined} data-element={element}>{fmt(progression+enhancementShot,percent,digits)}</b></div>}
    {rolls!==comparedTo?.rolls&&<div className={styles.detailRow} data-gear-contribution="rolls" data-hint={t('Initial random values, upgrade rolls and Titan additions.')}><strong>{t('Gear · random stats')}{element&&` · ${elementLabel(element,locale)}`}</strong><b className={element||colorElement?'inherited-value':undefined} data-element={element||colorElement}>{fmt(rolls,percent,digits)}</b></div>}
  </>;
  const gearTypeRows=(types:readonly string[],percent=false,digits=0,enhancementShot=0)=>{
    const parts=gearStatContributions(draft,catalog,types);
    return gearRows(parts.progression,parts.rolls,percent,digits,undefined,undefined,enhancementShot);
  };
  // Weapon CS only; each matrix shows its own.
  const combatScoreText=(weapon:number|null)=>weapon===null?undefined:`CS: ${fmt(Math.round(weapon))}`;
  // Supercomputing, Space Support and suppressor: weighted raw attributes of the current level.
  const systemScoreText=(score:SystemCombatScore|null)=>score?.parts.length?`CS: ${fmt(Math.round(score.value))}`:undefined;
  const art=catalog.artworks.find(w=>w.id===draft.art.id);
  const suppressor=catalog.suppressors.find(item=>item.id===draft.profile.suppressorId);
  const resonance=enhancementResonance(draft,catalog);
  const suppressorStats=<StatBonuses stats={suppressor?.stats??null} catalog={catalog} locale={locale}/>;
  const resonanceStats=<StatBonuses stats={resonance?.stats??null} catalog={catalog} locale={locale}/>;
  const avatar=catalog.avatars.find(w=>w.id===draft.profile.avatarId);
  const avatarFrame=catalog.avatarFrames.find(w=>w.id===draft.profile.avatarFrameId);
  const portrait=<ProfileAvatar className="avatar-portrait" {...edit('profile:avatarId')} data-info-href={avatar?buildInfoHref('cosmetic',avatar.id):avatarFrame?buildInfoHref('cosmetic',avatarFrame.id):undefined} data-info-label={avatar?t('Avatar'):t('Frame')} data-info-frame-href={avatar&&avatarFrame?buildInfoHref('cosmetic',avatarFrame.id):undefined} avatar={avatar} frame={avatarFrame} formatLabel={avatar?.animation ? avatar.animation.status === 'ready' ? 'GIF' : t('Effect', 'Эффект') : undefined} avatarLabel={localized(avatar?.name, locale)}><AvatarFallback locale={locale}/></ProfileAvatar>;
  const accountDetails=<AccountCounters account={draft.account} draft={draft} backpack={backpack} locale={locale}/>;
  const trait=catalog.weapons.find(w=>w.id===draft.traitId);
  const pet=catalog.pets.find(p=>p.id===draft.pet.id);
  const petName=draft.pet.customName?.trim()||localized(pet?.name, locale)||'—';
  const petInspectionHeading=pet&&<div className={styles.petInspectionHeading} data-inspection-heading><strong>{localized(pet.name, locale)}</strong><div><InspectionStars value={draft.pet.stars}/><span>·</span><span className={styles.petInspectionLevel}>{t('Lv.')} <b>{draft.pet.level}</b></span></div></div>;
  const petStats=petStatBonuses(draft,catalog);
  const petBonuses=petStats?<div className={styles.alignedBonusRows}><BonusEffects effects={[
    {id:"attack",icon:catalog.displayIcons.attack?.icon,label:t("ATK"),value:<><BonusValue tone="neutral">{fmt(petStats.attack)}</BonusValue> {petStats.inheritedAttack===null?"—":<BonusValue tone="positive">+{fmt(petStats.inheritedAttack)}</BonusValue>}</>},
    {id:"totalAttack",icon:catalog.displayIcons.attack?.icon,label:t("Total ATK"),value:<BonusValue tone="neutral">{petStats.totalAttack===null?"—":fmt(petStats.totalAttack)}</BonusValue>},
    {id:"playerAttack",icon:catalog.displayIcons.attack?.icon,label:t("Player ATK")+(petStats.inheritanceRate===null?"":` (${fmt(petStats.inheritanceRate,true,0)} ${t("inherited")})`),value:<BonusValue tone="neutral">{petStats.averageAttack===null?"—":fmt(petStats.averageAttack)}</BonusValue>},
    {id:"crit",icon:catalog.displayIcons.crit?.icon,label:t("Crit"),value:<BonusValue tone="neutral">{fmt(petStats.crit)} = {petStats.critChance===null?"—":fmt(petStats.critChance,true)} <span className={styles.petEnemyLevel}>({t("Enemy Lv.","Враг ур.")} {draft.enemyLevel})</span></BonusValue>},
    {id:"critDamage",icon:catalog.displayIcons.critDamage?.icon,label:t("Crit DMG"),value:<BonusValue tone="neutral">{fmt(petStats.critDamage,true,0)}</BonusValue>},
  ]}/></div>:<span>{t("Stat data unavailable")}</span>;
  const enhancement=enhancementShotBonuses(draft,catalog);
  const crit=combatRates(draft,catalog);
  // Captured files carry no DMG%: derive it from the loadout for every imported card, also after a manual edit.
  const damageDraft=buildCombatDraft(draft,catalog);
  // A tank is rated by resistance: the selected element's resistance is lit instead of its ATK / ATK% / DMG% cells.
  const tankElement=buildRole(draft)==='tank'?rollValueContext(draft,catalog).element:'';
  const statWinners=tankElement?{element:null,attack:null,attackPercent:null,damage:null}:combatStatWinners(damageDraft,catalog);
  // Captured EXP toward the next level against the raw requirement of that level.
  const computingProgress=(node:BuildDraft['computing'][number])=>{
    const next=catalog.computingExp?.find(step=>step.level===node.level+1);
    // Keep the entire EXP segment muted like the surrounding level metadata.
    return node.progress===undefined||!next?null:<span data-meta-exp> · <span className={styles.computingMetaValue}>{fmt(node.progress)}</span> / <span className={styles.computingMetaValue}>{fmt(next.exp)}</span> {t('EXP')}</span>;
  };
  // Per-column totals feed the in-game "value (inherited)" display of the duo pair.
  const columnTotals=(key:'attack'|'attackPercent'|'damage')=>Object.fromEntries(damageDraft.combat.elements.map(e=>[e.id,e[key]??0])) as Record<string,number>;
  const totals={Attack:columnTotals('attack'),'Attack %':columnTotals('attackPercent'),'Damage %':columnTotals('damage')};
  const elementCell=(element:string,kind:ElementStatKind,shown:boolean)=>{
    const total=totals[kind][element]??0,percent=kind!=='Attack';
    const value=(n:number)=>fmt(n,percent,percent?1:0);
    if(!shown)return {text:'—',tooltip:'—'};
    if(element==='Altered'&&kind==='Attack') {
      const attack=elementTotalAttack(draft,catalog,element),copied=attack.attack-(attack.ownAdded??0);
      // Altered receives the native shot after that source's ATK%, without a second flat gain.
      return {text:value(attack.attack),tooltip:<div className={styles.itemEffects} data-altered-inheritance>
        <div className={styles.detailRow}><strong>{t('Inherited final ATK')} · {elementLabel(attack.source,locale)}</strong><b data-altered-source={attack.source}>{fmt(copied,false,0)}</b></div>
        <div className={styles.detailRow}><strong>{t('Own ATK')} · {elementLabel('Altered',locale)}</strong><b>+{fmt(attack.ownAdded??0,false,0)}</b></div>
        <div className={styles.attackTotal} data-total-attack>
          <div className={styles.detailRow}><strong>{t('Base ATK','Базовая АТК')} · {elementLabel('Altered',locale)}</strong><b>{fmt(attack.attack,false,0)}</b></div>
          <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Total before ATK%')}</strong><b>{fmt(attack.attack,false,0)}</b></div>
          <div className={styles.detailRow}><strong>{t('ATK%')} · {elementLabel('Altered',locale)} <span className={styles.sourcePercentage} data-element="Altered">{fmt(attack.percent,true,1)}</span></strong><b>+{fmt(attack.attack*attack.percent,false,0)}</b></div>
          {attack.support>0&&<div className={styles.detailRow}><strong>{t('Space Support')} · {t('Altered')}</strong><b>+{fmt(attack.support,false,0)}</b></div>}
          {attack.foodAttack>0&&<div className={styles.detailRow}><strong>{t('Food ATK · after ATK%')}</strong><b>+{fmt(attack.foodAttack,false,0)}</b></div>}
          </div>
          <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Total ATK')}</strong><b className="inherited-value" data-element={attack.source} data-stat-total="Attack">{fmt(attack.total,false,0)}</b></div>
          </div>
        </div>
      </div>};
    }
    const gear=gearElementStat(draft,catalog,element,kind),inherited=duoInheritedValue(draft,catalog,element,kind,totals[kind]);
    // The table keeps this element's own value; the duo partner's gear and the inherited value live in the tooltip.
    const partner=duoPartner(draft,catalog,element);
    const gearParts={progression:gearElementStat(draft,catalog,element,kind,'progression'),rolls:gearElementStat(draft,catalog,element,kind,'rolls')};
    const ownAttack=kind==='Attack'?elementTotalAttack(draft,catalog,element):null;
    const universalBase=ownAttack?(ownAttack.inherited?ownAttack.own:ownAttack.base)-gearParts.rolls:0;
    const text=value(total);
    const relicDamage=kind==='Damage %'?(draft.relicDamage?.[element]??0):0;
    const tooltip=<div className={styles.itemEffects}>
      <div className={styles.detailRow}><strong>{kind==='Attack'?t('Universal base'):t('Other sources')}</strong><b>{value(kind==='Attack'?universalBase:total-gear-relicDamage)}</b></div>
      {relicDamage!==0&&<div className={styles.detailRow}><strong>{t('Relic A4 DMG%')}</strong><b>{value(relicDamage)}</b></div>}
      {kind==='Attack'?<div className={styles.attackTotal}>{gearRows(null,gearParts.rolls,percent,percent?1:0,undefined,undefined,0,element)}{partner&&gearRows(null,gearElementStat(draft,catalog,partner,kind,'rolls'),percent,percent?1:0,partner,gearParts)}</div>:<>{gearRows(gearParts.progression,gearParts.rolls,percent,percent?1:0,undefined,undefined,0,element)}{partner&&gearRows(gearElementStat(draft,catalog,partner,kind,'progression'),gearElementStat(draft,catalog,partner,kind,'rolls'),percent,percent?1:0,partner,gearParts)}</>}
      {kind!=='Attack'&&<div className={styles.attackTotal}><div className={styles.detailRow}><strong>{kind==='Attack %'?t('Total ATK%'):t('Total DMG%')}</strong><b className="inherited-value" data-element={inherited?.from??element} data-stat-total={kind}>{value(inherited?.value??total)}</b></div></div>}
      {kind==='Attack'&&(()=>{const attack=ownAttack!;
        // As in the game: this element's own ATK% applies to the ATK it uses (the duo partner's when inherited).
        const inheritedProps=attack.inherited?{className:'inherited-value','data-element':attack.source}:{};
        const totalElement=attack.inherited?attack.source:duoInheritedValue(draft,catalog,element,'Attack %',totals['Attack %'])?.from??element;
        return <div className={styles.attackTotal} data-total-attack>
          <div className={styles.detailRow}><strong>{t('Base ATK','Базовая АТК')} · {elementLabel(element,locale)}</strong><b>{fmt(attack.inherited?attack.own:attack.base,false,0)}</b></div>
          {attack.inherited&&<div className={styles.detailRow}><strong>{t('Used ATK')} · {elementLabel(attack.source,locale)}</strong><b {...inheritedProps}>{fmt(attack.base,false,0)}</b></div>}
          <div className={styles.attackTotal}>
          {attack.supportBase>0&&<div className={styles.detailRow}><strong>{t('Space Support')} · {elementLabel(element,locale)}</strong><b>+{fmt(attack.supportBase,false,0)}</b></div>}
          <div className={styles.detailRow}><strong>{t('Total before ATK%')}</strong><b>{fmt(attack.attack,false,0)}</b></div>
          <div className={styles.detailRow}><strong>{t('ATK%')} · {elementLabel(element,locale)} <span className={styles.sourcePercentage} data-element={element}>{fmt(attack.percent,true,1)}</span></strong><b>+{fmt(attack.attack*attack.percent,false,0)}</b></div>
          {attack.support>0&&<div className={styles.detailRow}><strong>{t('Space Support')} · {elementLabel(element,locale)}</strong><b>+{fmt(attack.support,false,0)}</b></div>}
          {attack.foodAttack>0&&<div className={styles.detailRow}><strong>{t('Food ATK · after ATK%')}</strong><b>+{fmt(attack.foodAttack,false,0)}</b></div>}
          </div>
          <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Total ATK')}</strong><b className="inherited-value" data-element={totalElement} data-stat-total="Attack">{fmt(attack.total,false,0)}</b></div>
          </div>
        </div>;})()}
    </div>;
    return {text,tooltip};
  };
  const hpDetails=<div className={styles.itemEffects} data-hp-breakdown>
        <div className={styles.detailRow}><strong>{t('Other sources')}</strong><b>{hpBase===null?'—':fmt(hpBase-hpGear-shotHP)}</b></div>
        {gearTypeRows(['HP'],false,2,hpBase!==null?shotHP:0)}
        <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Base before HP%')}</strong><b>{hpBase===null?'—':fmt(hpBase)}</b></div>
          <div className={styles.detailRow}><strong>HP% {fmt(hpPercent,true,1)}</strong><b>{hpBase===null?'—':`+${fmt(hpBase*hpPercent)}`}</b></div>
        </div>
        <div className={styles.attackTotal}><div className={styles.detailRow}><strong>{t('Total HP')}</strong><b>{received('hp')?fmt(draft.combat.hp):'—'}</b></div></div>
      </div>;
  const universalAttackDetails=<div className={styles.itemEffects} data-universal-attack-breakdown>
        <div className={styles.detailRow}><strong>{t('Other sources')}</strong><b>{whiteAttack===null?'—':fmt(Math.round(whiteAttack)-Math.round(whiteAttackGear))}</b></div>
        {gearTypeRows(['Attack'],false,2)}
        <div className={styles.attackTotal}><div className={styles.detailRow}><strong>{t('Total Universal ATK')}</strong><b>{whiteAttack===null?'—':fmt(Math.round(whiteAttack))}</b></div></div>
      </div>;
  const critDetails=<div className={styles.itemEffects} data-crit-breakdown>
          <div className={styles.detailRow}><strong>{t('Other sources')}</strong><b>{received('crit')?fmt(draft.combat.crit-critGear-shotCrit,false,0):'—'}</b></div>
          {gearTypeRows(['Crit'],false,0,received('crit')?shotCrit:0)}
          <div className={styles.attackTotal}><div className={styles.detailRow}><strong>{t('Total Crit')}</strong><b>{received('crit')?fmt(draft.combat.crit,false,0):'—'}</b></div></div>
          <div className={styles.attackTotal}>
            <div className={styles.detailRow}><strong>{t('Chance from Crit')}</strong><b>{received('crit')&&crit.base!==null?fmt(crit.base,true,3):'—'}</b></div>
            <div className={styles.detailRow}><strong>{t('Additional Crit Rate')}</strong><b>{received('critRates')?fmt(draft.combat.additionalCritRate,true,3):'—'}</b></div>
          </div>
          <div className={styles.attackTotal}><div className={styles.detailRow}><strong>{t('Total Crit chance')}</strong><b>{received('crit')&&received('critRates')&&crit.total!==null?fmt(crit.total,true,3):'—'}</b></div></div>
        </div>;
  const critDamageDetails=<div className={styles.itemEffects} data-crit-damage-breakdown>
    <div className={styles.detailRow}><strong>{t('Total Crit DMG')}</strong><b>{received('critDamage')?fmt(draft.combat.critDamage,true):'—'}</b></div>
  </div>;
  const totalRv=buildRollValue(draft,catalog);
  const rvGrade=rollValueQuality(totalRv.value,totalRv.maximum).grade;
  const summary=summaryStats(draft,catalog);
  const matrixPercent=matrixAttackPercentSources(draft,catalog);
  const damageSources=additionalDamageSources(draft,catalog);
  const damageBonus=(kind:string,id:string)=>{
    const source=damageSources.find(s=>s.kind===kind&&s.id===id);
    return source?`DMG: +${fmt(source.value,true,1)}`:undefined;
  };
  const damageKeys=(kind:string,id:string)=>{
    const keys=[...new Set(damageSources.filter(source=>source.kind===kind&&source.id===id).flatMap(source=>source.elements.map(element=>`${element} Damage %`)))];
    return keys.length?keys:[`Damage source: ${kind}:${id}`];
  };
      const computingAttacks=new Map(draft.computing.map(n=>[n.id,catalog.computing.find(item=>item.id===n.id)?.effects.filter(effect=>effect.attackStat).reduce((sum,effect)=>sum+(effect.levels.find(level=>level.level===n.level)?.value??0),0)??0]));
  const computingResistances=new Map(draft.computing.map(n=>[n.id,catalog.computing.find(item=>item.id===n.id)?.effects.filter(effect=>effect.resistanceStat).reduce((sum,effect)=>sum+(effect.levels.find(level=>level.level===n.level)?.value??0),0)??0]));
  const allResistanceSourceKeys=resistanceSourceKeys(Object.keys(catalog.elementIcons));
  const computingAttackBonus=(id:string)=>computingAttacks.get(id)?`${t("ATK%")}: +${fmt(computingAttacks.get(id)!,true,1)}`:undefined;
  const support=supportSystem(draft,catalog);
  // Module chips are too small for one label each: the central core carries the modules' summed CS (content modules included).
  const supportScores=draft.support.map(module=>supportCombatScore(module,catalog)).filter(score=>!!score?.parts.length);
  const supportCS=supportScores.length?systemScoreText({value:supportScores.reduce((sum,score)=>sum+score!.value,0),parts:supportScores.flatMap(score=>score!.parts),unscored:[]}):undefined;
  const rareTotals=catalog.reference.titanRare.items.map(r=>{
    const gear=draft.gear.filter(g=>g.equipped&&g.titan&&g.rareId===r.id);
    const scores=gear.map(g=>gearTitanCombatScore(g,catalog));
    return {...r,level:gear.reduce((n,g)=>n+g.rareLevel,0),cs:scores.some(score=>score===null)?null:scores.reduce<number>((sum,score)=>sum+(score??0),0)};
  }).sort((a,b)=>b.level-a.level);
  return <StatHighlight><article data-editing={!locked||undefined} className={`card ${showQuality?'':'hide-quality'} ${showSummary?'':'hide-summary'} ${showResistancePercent?'show-resistance-percent':''}`} style={{width:BUILD_CARD_WIDTH,height:buildCardHeight(summary.length)}} ref={cardRef} aria-label={t('Tower of Fantasy build card')}>
    {(customArt||art?.url)&&<img className="hero-art" src={customArt||art?.url} alt="" style={{objectPosition:`${draft.art.x}% ${draft.art.y}%`,transform:`translate(${draft.art.offsetX??0}%, ${draft.art.offsetY??0}%) scale(${draft.art.zoom})`}}/>}<div className="art-shade"/>
    <header className="header" {...edit('art','area')}><div className={`identity ${styles.profileIdentity}`}>{draft.account||draft.captureSource?.kind==='file'||avatar?.animation?<Inspect dialogSize="sm" title={draft.profile.name||'—'} meta={t('Account')} tooltipDetails={accountDetails} details={<>{accountDetails}<ProfileCosmeticPreview animation={avatar?.animation} name={localized(avatar?.name,locale)} locale={locale}/></>}>{portrait}</Inspect>:portrait}<div><div className="player-row">{draft.account||draft.captureSource?.kind==='file'?<Inspect dialogSize="sm" title={draft.profile.name||'—'} meta={t('Account')} editTarget="profile:name" tooltipDetails={accountDetails} details={accountDetails}><div className={`player ${styles.profileName}`}>{draft.profile.name||'—'}</div></Inspect>:<div className={`player ${styles.profileName}`} {...edit('profile:name')}>{draft.profile.name||'—'}</div>}{suppressor?<Inspect title={`${t('Suppressor','Сапрессор')} ${suppressor.version}`} editTarget="profile:suppressorId" heading={<InspectionHeading title={t('Suppressor','Сапрессор')} meta={<span className={styles.suppressorVersion}>{suppressor.version}</span>}/>} tooltipDetails={suppressorStats} details={suppressorStats}><StatLink {...progressionSourceProps(suppressor.stats,locale,allResistanceSourceKeys,systemScoreText(suppressorCombatScore(draft,catalog)))}><span className="suppressor-source"><img className="suppressor-icon" src={suppressor.icon} alt={suppressor.version}/></span></StatLink></Inspect>:<span className="suppressor-placeholder" {...edit('profile:suppressorId')}>V0</span>}<div className="profile-affiliations"><span className="profile-crew" {...edit('profile:crew')}><small>{t('Crew','Гильдия')}:</small><b data-hint-overflow>{draft.profile.crew||'—'}</b></span><span className="profile-character-title" {...edit('profile:characterTitle')}><small>{t('Title')}:</small><CharacterTitlePlate label={characterTitleLabel(draft.profile.characterTitle,catalog,locale,draft.captureSource?.capture.profile.titleId)||'—'} style={characterTitleStyle(draft.profile.characterTitle,catalog,draft.captureSource?.capture.profile.titleId)}/></span></div></div><div className="profile-meta"><div className={`sub ${styles.profileSub}`}>{serverLabelWithId} · <Inspect dialogSize="sm" title={t('Account ID')} heading={<InspectionHeading title={t('Account ID')}/>} editTarget="profile:uid" tooltipDetails={characterIds} details={characterIds}><span>UID {draft.profile.uid||'0'}</span></Inspect> · <span {...edit('profile:level')}>{t('Lv.')} {draft.profile.level}</span></div><div className="profile-cs"><StatLink types={[CS_SOURCES,CS_TOTAL]}><span className="current-cs" {...edit('profile:cs')}>{t('CS')} <b>{draft.profile.cs===null?'—':fmt(draft.profile.cs??0)}</b></span></StatLink><Inspect title={t('Maximum Combat Score')} editTarget="profile:apexCs" tooltipDetails={maximumCSDetails} details={maximumCSDetails}><span>{t('Apex CS')} <b>{draft.profile.apexCs===null?'—':fmt(draft.profile.apexCs??0)}</b></span></Inspect></div></div></div></div>{draft.demo?<DemoCallToAction label={t('Demo profile preview')} importLabel={t('Import your build')} onImport={onImportRequest}/>
      :<p className="profile-signature" {...edit('profile:signature')}>{draft.profile.signature||'—'}</p>}<div className="art-edit-slot">{!locked&&<span className="art-edit-control" {...edit('art')}>{t('Background')}</span>}</div><div className={`header-right ${ranking||rankingEdited?styles.rankedHeader:''}`} >{(ranking||rankingEdited)&&<BuildGearRanking ranking={ranking} edited={rankingEdited} locale={locale}/>}<BuildFocus draft={draft} catalog={catalog} locale={locale}/></div></header>
    <div className="main"><section className="loadout"><h2 className={`section-title ${styles.sectionTitle}`}><span className="section-label">{t('Weapons & matrices')}</span>{!locked&&<span className="mark-edit-control" {...edit('mark')}><img src={catalog.weaponMark.icon} alt=""/></span>}<div className="weapon-resonances">{(()=>{const role=activeRoleResonance(draft,catalog);return role&&<Inspect title={`${localized(role.name, locale)} ${t('Resonance')}`} heading={<InspectionHeading title={`${localized(role.name, locale)} ${t('Resonance')}`} trailing={<span className={styles.inspectionMeta}>{t('Weapon roles')}</span>}/>} description={`${localized(role.description, locale)}

${t('Team modes')}: ${localized(role.teamDescription, locale)}`}><span className="weapon-resonance role-resonance" aria-label={localized(role.name, locale)}><img src={role.icon} alt=""/></span></Inspect>;})()}{activeWeaponResonances(draft,catalog).map(resonance=><StatLink key={resonance.element} types={[...(resonance.attackPercent?[`${resonance.element} Attack %`]:[]),...(resonance.resistancePercent?[`${resonance.element} Resistance %`]:[])]} inspectTypes={[]} sourceChannel={[ATTACK_PERCENT_SOURCES,`${resonance.element} Resistance %`]} sourceBonuses={{[ATTACK_PERCENT_SOURCES]:resonance.attackPercent?`${t('ATK%')}: +${fmt(resonance.attackPercent,true,1)}`:undefined,[`${resonance.element} Resistance %`]:resonance.resistancePercent?`${t('RES%')}: +${fmt(resonance.resistancePercent,true,1)}`:undefined}}><span className="weapon-resonance-source"><Inspect title={localized(resonance.name, locale)} meta={localized(resonance.weaponName, locale)} description={localized(resonance.description, locale)}><span className="weapon-resonance" aria-label={localized(resonance.name, locale)}>{resonance.icon?<img src={resonance.icon} alt=""/>:resonance.element}</span></Inspect></span></StatLink>)}</div></h2>{draft.weapons.map((w,i)=>{
      const sim=catalog.weapons.find(s=>s.id===w.id);
      const sets=new Map<string,number>();for(const m of w.matrices)if(m.id)sets.set(m.id,(sets.get(m.id)||0)+1);for(const [id,count] of sets)if(count<2)sets.delete(id);
      const mark=weaponMarkBonus(draft,catalog,w);
      const weaponStats=weaponStatBonuses(w,catalog);
      const attackSources=matrixPercent.filter(source=>source.weaponIndex===i);
      const weaponEnhanced=enhancement.weapons[i].weapon.some(s=>s.value>0);
      const weaponCrit=enhancementBonusText(weaponStats.filter(s=>s.id==='crit'),locale);
      const weaponHP=enhancementBonusText(weaponStats.filter(s=>s.id==='hp'&&s.value>0),locale);
      const weaponResistance=enhancementBonusText(weaponStats.filter(s=>s.id==='resistance'&&s.value>0),locale);
      const weaponAttack=enhancementBonusText(weaponStats.filter(s=>s.id==='attack'),locale);
      const weaponBonuses=<BonusEffects effects={weaponStats.map(s=>({id:s.id,icon:catalog.displayIcons[s.id as 'attack'|'hp'|'crit'|'resistance']?.icon,label:s.id==='attack'?'ATK':s.id==='hp'?'HP':s.id==='crit'?t('Crit'):t('Resistance','Сопротивление'),value:<BonusValue tone="neutral">+{fmt(s.value)}</BonusValue>}))}/>;
      const markDetails=<><GameRichText text={`DMG: ${fmt(mark.base,true,0)} + ${mark.advancements} × ${fmt(catalog.weaponMark.rules.perAdvancement,true,0)} = ${fmt(mark.total,true,0)}`}/><div>{mark.inBuild?t('Uses Nan Yin’s advancements.'):t('Uses this weapon’s advancements.')}</div><div>{t('Nan Yin')} A{catalog.weaponMark.rules.allMarksMinAdvancement}: {mark.inBuild?t('in build — marks all weapons.'):t('marks the selected weapon.')}</div></>;
      return <article className="weapon" key={i} {...edit(`weapon:${i}`,'area')}>
        <div className="weapon-head" data-info-href={sim?buildInfoHref('weapon',sim.id):undefined}><StatLink types={[CS_SOURCES,...(weaponEnhanced?[ENHANCEMENT_SOURCES]:[]),...(weaponAttack?[ATTACK_SOURCES]:[]),...(weaponCrit?[CRIT_SOURCES]:[]),...(weaponResistance?allResistanceSourceKeys:[]),...(weaponHP?[HP_SOURCES]:[])]} sourceBonuses={{[CS_SOURCES]:combatScoreText(weaponCombatScore(w,catalog)),[ATTACK_SOURCES]:weaponAttack,[CRIT_SOURCES]:weaponCrit||undefined,...Object.fromEntries(allResistanceSourceKeys.map(key=>[key,weaponResistance||undefined])),[HP_SOURCES]:weaponHP||undefined}} inspectTypes={[]} sourceChannel={ENHANCEMENT_SOURCES} sourceBonus={enhancementBonusText(enhancement.weapons[i].weapon,locale)}><div className="weapon-art">{sim&&<span className="weapon-element" {...(sim.selectableElements?.length?edit(`weapon-config:${i}`):{})} data-hint={sim.selectableElements?.length&&!w.element?t('Choose weapon element'):weaponElements[i].map(element=>elementLabel(element,locale)).join(' / ')}>{sim.selectableElements?.length&&!w.element?<span className="unknown-element">?</span>:<img src={getDualElementIconPath(...weaponElements[i].slice(0,2))?gameAsset(getDualElementIconPath(...weaponElements[i].slice(0,2))!):catalog.elementIcons[weaponElements[i][0]]?.icon} alt={weaponElements[i].map(element=>elementLabel(element,locale)).join(' / ')}/>}</span>}{sim?<Inspect title={localized(sim.weapon, locale)} heading={<div className={styles.weaponInspectionHeading} data-inspection-heading><div className={styles.weaponInspectionTitle}><strong data-hint-overflow>{localized(sim.weapon, locale)}</strong><span className={styles.weaponInspectionLevel}>{t('Lv.')} {w.level}</span></div><div className={styles.weaponInspectionMeta}><span className={styles.weaponInspectionCharacter}>{localized(sim.name, locale)}</span><InspectionStars value={w.stars}/><span className={styles.weaponInspectionLevel}>Up. {w.upgradeLevel??"—"}</span></div></div>} tooltipDetails={weaponBonuses} details={weaponBonuses}><img className="weapon-icon" src={sim.icon} alt=""/></Inspect>:<span className="media-placeholder weapon-icon">—</span>}{mark.enabled&&<span className="weapon-mark-trigger" {...edit('mark','area')}><Inspect infoHref={buildInfoHref('weapon',catalog.weaponMark.simulacrumId)} title={localized(catalog.weaponMark.name, locale)} tooltipDetails={markDetails} details={markDetails}><img className="weapon-mark" src={catalog.weaponMark.icon} alt=""/></Inspect></span>}</div></StatLink><WeaponIdentity weapon={w} item={sim} index={i} locale={locale} enhanced={weaponEnhanced}/>{(!!sim?.selectableSkills?.length||!!sim?.selectableModes?.length)&&<div className="weapon-options" {...edit(`weapon-config:${i}`)}><div>{!!sim?.selectableSkills?.length&&<WeaponSkillChoices presentation="icons" options={sim.selectableSkills} value={w.skills} locale={locale}/ >}{!!sim?.selectableModes?.length&&<WeaponSkillChoices kind="mode" presentation="icons" options={sim.selectableModes} value={[w.mode??'']} locale={locale}/>}</div></div>}</div>
        <div className="matrix-row"><MatrixStrip attackSources={attackSources} enhancementBonuses={enhancement.weapons[i].matrices} weaponIndex={i} matrices={w.matrices} catalog={catalog} locale={locale}/><div className="matrix-caption">{sets.size?[...sets].map(([id,count])=><StatLink key={id} types={[w.matrices.some((m,index)=>m.id===id&&enhancement.weapons[i].matrices[index].some(s=>s.value>0))?ENHANCEMENT_SOURCES:"Unchanged matrix progression",...(attackSources.find(source=>source.id===id)?.bonuses.flatMap(b=>b.elements.map(element=>`${element} Attack %`))??[])]} sourceBonuses={{[ATTACK_PERCENT_SOURCES]:attackSources.some(source=>source.id===id)?attackPercentBonusText(attackSources.find(source=>source.id===id)!.bonuses,locale):undefined}} inspectTypes={[]} sourceChannel={[ENHANCEMENT_SOURCES,ATTACK_PERCENT_SOURCES]}><div className="matrix-set-row"><b {...edit(`matrix-set:${i}:${w.matrices.findIndex(m=>m.id===id)}`)} data-info-href={buildInfoHref('matrix',id)} data-hint-overflow>{localized(catalog.matrices.find(m=>m.id===id)?.name, locale)}</b><small {...edit(`matrix-level-all:${i}`)}>{count} {t('pcs')}</small></div></StatLink>):<div className="matrix-set-row"><b {...edit(`matrix-set:${i}:0`)}>{w.matrices.some(m=>m.id)?t('No set bonus'):'—'}</b>{!w.matrices.some(m=>m.id)&&<small {...edit(`matrix-level-all:${i}`)}>0 {t('pcs')}</small>}</div>}</div></div>
      </article>;
    })}</section>
    <section className="combat"><h2 className={`section-title ${styles.sectionTitle}`}><span className="section-label">{t('Combat stats')}</span><StatLink types={CRIT_SOURCES} inspectTypes={[]}><Tooltip portal content={enemyLevelEditHint(locale)}><small className="enemy-level" tabIndex={editing.change?undefined:0}>{t('Enemy Lv.','Ур. врага')} {editing.change?<InlineNumber className="level-value" label={t('Enemy level','Уровень врага')} hint={null} value={draft.enemyLevel} min={1} max={100} onChange={n=>editing.change!(d=>{d.enemyLevel=n;})}/>:<b className="level-value">{draft.enemyLevel}</b>}</small></Tooltip></StatLink></h2><div className="stats">
      <div className="health-row"><Inspect dialogSize="sm" title={t('HP')} tooltipDetails={hpDetails} details={hpDetails}><StatLink types="HP" inspectTypes={["HP","HP %",HP_SOURCES]}><div className="vital-stat hp-stat" tabIndex={-1} {...edit('combat:hp')}><span><Icon src={catalog.displayIcons.hp?.icon}/>{t('HP')}</span><b>{received("hp")?fmt(draft.combat.hp):"—"}</b></div></StatLink></Inspect><Inspect dialogSize="sm" title={t('Universal ATK')} tooltipDetails={universalAttackDetails} details={universalAttackDetails} placement="bottom"><StatLink types="Attack" inspectTypes={["Attack",ATTACK_SOURCES]}><div className="vital-stat universal-attack-stat" tabIndex={-1}><span><Icon src={catalog.statIcons.CommonAtkAdded?.icon}/>{t('Universal ATK')}</span><b>{whiteAttack===null?'—':fmt(Math.round(whiteAttack))}</b></div></StatLink></Inspect></div>
      <div className="crit-summary" {...edit('combat:crit')}><div className="crit-hero">
        <Inspect dialogSize="sm" title={t('Crit')} tooltipDetails={critDetails} details={critDetails}><StatLink types="Crit" inspectTypes={statInspectTypes("Crit")}><div className="crit-rating top-stat" tabIndex={-1}><span><Icon src={catalog.displayIcons.crit?.icon}/>{t('Crit')}</span><strong>{received("crit")?fmt(draft.combat.crit):"—"}</strong></div></StatLink></Inspect>
        <div className="crit-result"><StatLink types="Crit" inspectTypes={statInspectTypes("Crit")}><div className="crit-calculation"><Tooltip portal content={`${t('Crit rating ÷ enemy-level coefficient')}: ${fmt(draft.combat.crit)} ÷ ${fmt(catalog.reference.critFormula.denominators[draft.enemyLevel]||0)} · Lv. ${draft.enemyLevel}`}><strong tabIndex={0}>→ {!received("crit")?"—":crit.base===null?(draft.enemyLevel===0?fmt(0,true,3):'—'):fmt(crit.base,true,3)}</strong></Tooltip><small {...edit('combat:additionalCritRate')}>+ {received("critRates")?fmt(draft.combat.additionalCritRate,true,3):"—"}</small></div></StatLink><Inspect dialogSize="sm" title={t('Crit chance')} tooltipDetails={critDetails} details={critDetails}><StatLink types="Crit" inspectTypes={statInspectTypes("Crit")}><div className="crit-breakdown total" tabIndex={-1}><b>{!received("crit")?"—":crit.total===null?(draft.enemyLevel===0?fmt(0,true,3):'—'):fmt(crit.total,true,3)}</b></div></StatLink></Inspect></div>
      </div><div className="crit-breakdown crit-damage">{[<span key="label" tabIndex={-1}><Icon src={catalog.displayIcons.critDamage?.icon}/>{t('Crit DMG')}</span>,<b key="value" tabIndex={-1}>{received("critDamage")?fmt(draft.combat.critDamage,true):"—"}</b>].map(content=><Inspect key={content.key} dialogSize="sm" title={t('Crit DMG')} editTarget="combat:critDamage" tooltipDetails={critDamageDetails} details={critDamageDetails}><StatLink types="Crit Damage">{content}</StatLink></Inspect>)}</div></div>
    <table className={`stat-table ${styles.elementStatPalette}`} data-element={statWinners.element||undefined}><colgroup><col className="element-column"/><col className="attack-column"/><col className="attack-percent-column"/><col className="damage-column"/></colgroup><thead><tr><th>{t('Element','Элемент')}</th><th><Icon src={catalog.displayIcons.attack?.icon}/>{t('ATK')}</th><th><Icon src={catalog.displayIcons.attack?.icon}/>{t('ATK%')}</th><th><Icon src={catalog.displayIcons.damage?.icon}/>{t('DMG%')}</th></tr></thead><tbody>{draft.combat.elements.map((e,i)=><tr key={e.id}><th className={statWinners.element===e.id?'active':undefined}><StatLink types={[...(e.id===statWinners.attack&&e.id!==statWinners.element?[]:[`${e.id===statWinners.element&&statWinners.attack?statWinners.attack:e.id} Attack`]),`${e.id} Attack %`,`${e.id} Damage %`,`Own element source: ${e.id} Attack`]} inspectTypes={[`${e.id===statWinners.element&&statWinners.attack?statWinners.attack:e.id} Attack`,"Attack",`${e.id} Attack %`,"Attack %",`${e.id} Damage %`,ATTACK_SOURCES,ATTACK_PERCENT_SOURCES,DAMAGE_SOURCES]}><span className="element-stat-label"><Icon element src={catalog.elementIcons[e.id]?.icon}/>{elementLabel(e.id,locale)}</span></StatLink></th><StatLink types={[`${e.id} Attack`,`Own element source: ${e.id} Attack`]} inspectTypes={["Attack","Attack %",`${e.id} Attack %`,...statInspectTypes(`${e.id} Attack`),ATTACK_SOURCES,ATTACK_PERCENT_SOURCES]}><td className={statWinners.attack===e.id?'active':undefined}>{(()=>{const cell=elementCell(e.id,'Attack',received("attack"));return <Inspect title={`${elementLabel(e.id,locale)} ${t('ATK')}`} tooltipDetails={cell.tooltip} details={cell.tooltip}><span tabIndex={0} className="element-stat-value" {...edit(`element:${i}:attack`)}>{cell.text}</span></Inspect>;})()}</td></StatLink><StatLink types={`${e.id} Attack %`} inspectTypes={[`${e.id} Attack %`,"Attack %",ATTACK_PERCENT_SOURCES]}><td className={statWinners.attackPercent===e.id?'active':undefined}>{(()=>{const cell=elementCell(e.id,'Attack %',received("attackBase"));return <Inspect placement="bottom" title={`${elementLabel(e.id,locale)} ${t('ATK%')}`} tooltipDetails={cell.tooltip} details={cell.tooltip}><span tabIndex={0} className="element-stat-value" {...edit(`element:${i}:attackPercent`)}>{cell.text}</span></Inspect>;})()}</td></StatLink><StatLink types={`${e.id} Damage %`} inspectTypes={statInspectTypes(`${e.id} Damage %`)}><td className={statWinners.damage===e.id?'active':undefined}>{(()=>{const cell=elementCell(e.id,'Damage %',true);return <Inspect placement="bottom" title={`${elementLabel(e.id,locale)} ${t('DMG%')}`} tooltipDetails={cell.tooltip} details={cell.tooltip}><span className="element-stat-value" {...edit(`element:${i}:damage`)}><span tabIndex={0}>{cell.text}</span></span></Inspect>;})()}</td></StatLink></tr>)}</tbody></table>
    <div className="resistance-summary"><h3>{t('Resistance','Сопротивления')}</h3><div className="resistance-totals">{draft.combat.elements.map((e,i)=>{
      const constant=catalog.reference.resistanceFormula.constants[draft.profile.level];
      const pool=elementResistanceBase(draft,e.id,catalog);
      const resistancePercent=pool?.percent??null;
      const totalResistance=pool&&resistancePercent!==null?pool.base*(1+resistancePercent):e.resistance;
      const reduction=totalResistance===null||totalResistance===0?0:constant?getBuildResistanceReduction(totalResistance,constant):null;
      const gear=draft.gear.filter(item=>item.equipped).reduce((sum,item)=>sum+equippedGearStats(item,catalog)
        .filter(stat=>stat.type==='Resistance'||stat.type===`${e.id} Resistance`).reduce((total,stat)=>total+stat.value,0),0);
       const resistanceValue=totalResistance===null?'—':fmt(totalResistance,false,0);
       const resistanceSource=resistanceSourceKey(e.id);
      const resistanceDetails=<div className={styles.itemEffects} data-resistance-breakdown>
        <div className={styles.detailRow}><strong>{t('Other sources')}</strong><b>{pool?fmt(pool.base-gear-shotResistance,false,0):'—'}</b></div>
        {gearTypeRows(['Resistance',`${e.id} Resistance`],false,0,pool?shotResistance:0)}
       <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Base before RES%')} · {elementLabel(e.id,locale)}</strong><b>{pool?fmt(pool.base,false,0):'—'}</b></div>
          <div className={styles.detailRow}><strong>{t('RES%')} · {elementLabel(e.id,locale)} <span className={styles.sourcePercentage} data-element={e.id}>{resistancePercent===null?'—':fmt(resistancePercent,true,1)}</span></strong><b>{pool&&resistancePercent!==null?`+${fmt(pool.base*resistancePercent,false,0)}`:'—'}</b></div>
        </div>
        <div className={styles.attackTotal}>
          <div className={styles.detailRow}><strong>{t('Total Resistance')}</strong><b className="inherited-value" data-element={e.id} data-stat-total="Resistance">{resistanceValue}</b></div>
          <div className={styles.detailRow}><strong>{t('Damage reduction','Снижение урона')} · Lv. {draft.profile.level}</strong><b>{reduction===null?'—':fmt(reduction,true,1)}</b></div>
        </div>
       </div>;
      return <Inspect key={e.id} dialogSize="sm" title={`${elementLabel(e.id,locale)} ${t('Resistance','Сопротивление')}`} tooltipDetails={resistanceDetails} details={resistanceDetails}><StatLink types={[`${e.id} Resistance`,...(buildRole(draft)==='tank'?[`Relic A4 resistance: ${e.id}`]:[])]} inspectTypes={[`${e.id} Resistance`,`${e.id} Resistance %`,resistanceSource]}><div tabIndex={-1} className={`resistance-total${tankElement===e.id?' active':''}`} data-element={tankElement===e.id?e.id:undefined} {...edit(`element:${i}:resistance`)} aria-label={`${elementLabel(e.id,locale)} ${t('resistance')}`}><Icon resistanceElement={e.id} src={catalog.resistanceIcons[e.id]?.icon}/><b>{fmt(totalResistance??0)}</b>{showResistancePercent&&<small className="resistance-percent">{reduction===null?'—':fmt(reduction,true,1)}</small>}</div></StatLink></Inspect>;
    })}</div></div>{rareTotals.length>0&&<div className="titan-summary"><h3>{t('Titan · total levels')}</h3><div className="titan-totals" style={{gridTemplateRows:`repeat(${Math.ceil(rareTotals.length/2)},auto)`}}>{rareTotals.map(r=><Tooltip key={r.id} className={styles.itemTooltip} portal content={<TitanEffectDetails id={r.id} level={r.level} catalog={catalog} locale={locale}/>}><StatLink types={[r.id,...(r.level>0&&r.cs!==null?[CS_SOURCES]:[])]} inspectTypes={[r.id,AUGMENT_COUNT]} sourceBonuses={{[CS_SOURCES]:r.level>0&&r.cs!==null?`CS: ${fmt(r.cs)}`:undefined}}><div className="titan-total" data-titan-stat={r.id} data-level={r.level}><span><Icon src={catalog.statIcons[r.id]?.icon}/>{locale === 'ru' ? r.nameRu : translateUiText(r.nameEn, locale)}</span><b>{r.level?`+${r.level}`:0}</b></div></StatLink></Tooltip>)}</div><aside className="titan-cs-overlay" aria-label={t("Titan Combat Score")}><strong>{t('Titan · CS')}</strong>{rareTotals.map((r,index)=>r.level>0&&r.cs!==null?<div key={r.id} style={{gridColumn:Math.floor(index/Math.ceil(rareTotals.length/2))+1,gridRow:index%Math.ceil(rareTotals.length/2)+2}}><span>{locale === 'ru' ? r.nameRu : translateUiText(r.nameEn, locale)}</span><b>{fmt(r.cs!)}</b></div>:null)}</aside></div>}</div></section>
    <section><h2 className={`section-title ${styles.sectionTitle}`}><span className="equipment-heading" {...edit('equipment')}><span className="section-label">{t('Equipment')}</span><StatLink {...progressionSourceProps(resonance?.stats??null,locale,allResistanceSourceKeys)}><small className="equipment-level"><Inspect title={t('Enhance Resonance')} meta={<>{`${catalog.enhancementResonance.slotIds.length} ${t('pieces')} · `}<span data-meta-value>+{resonance?.enhancement??0}</span></>} tooltipDetails={resonanceStats} details={resonanceStats}>{t('Lv.')} <b className="level-value">{resonance?.level??0}</b></Inspect></small></StatLink></span>{showQuality&&<small className={`${styles.rollValueTheme} equipment-rv`} {...edit('rv','area')} data-grade={rvGrade} data-build-rv={totalRv.value??undefined}><TotalRollValue value={totalRv.value} maximum={totalRv.maximum} empty={totalRv.equipped===0} locale={locale} mode={draft.rv?.mode??'grv'}/></small>}</h2><div className="gear-grid">{draft.gear.map(g=><Gear key={g.id} gear={g} draft={draft} catalog={catalog} locale={locale} showTitanQuality={showTitanQuality} showQuality={showQuality}/>)}</div></section></div>
    <section className="systems" aria-label={t('Additional build systems')}><div className="system trait-system"><h3 {...edit('trait-points')}>{t('Trait')} · {fmt(draft.traitPoints)}</h3>{trait?<div {...edit('trait','area')} className="trait-display" data-info-href={buildInfoHref('weapon',trait.id)}><div className="trait-avatar">{trait.traitIcon&&<Inspect title={localized(trait.name, locale)} meta={`Trait · ${fmt(draft.traitPoints)}`} description={localized(trait.trait, locale)}><img src={trait.traitIcon} alt=""/></Inspect>}</div><b lang={locale} data-hint-overflow>{localized(trait.name, locale)}</b></div>:<div {...edit('trait','area')} className="trait-display"><div className="trait-avatar"><span className="media-placeholder trait-placeholder" {...edit('trait')}>—</span></div><b>—</b></div>}</div>
    <RelicSystem draft={draft} catalog={catalog} locale={locale}/><div className="system synthesis-system"><h3>{t('Synthesis')}</h3><div className="synthesis-items">{draft.synthesis.map((s,i)=>{const w=catalog.weapons.find(w=>w.id===s.id);return w&&<StatLink types={damageKeys('synthesis',s.id)} inspectTypes={[]} sourceBonus={damageBonus('synthesis',s.id)} key={s.id}><div className="synthesis-item" {...edit(`synthesis:${i}`,'area')} data-info-href={buildInfoHref('weapon',w.id)} data-damage-source={`synthesis:${s.id}`}> <Inspect title={localized(w.weapon, locale)} meta={<>{t('Synthesis')} · <span className={styles.synthesisStageMeta}>S{s.stage}</span></>} tooltipDetails={<SynthesisEffects effects={catalog.synthesis.effects?.[s.id]} stage={s.stage} locale={locale}/>} details={<SynthesisEffects effects={catalog.synthesis.effects?.[s.id]} stage={s.stage} locale={locale}/>}><img src={w.icon} alt=""/></Inspect><span className="synthesis-stage">{captured&&!captured.synthesis.some(entry=>entry.itemId.toLowerCase()===w.weaponId.toLowerCase())?"—":"S"+s.stage}</span><small>{localized(w.name, locale)}</small></div></StatLink>;})}</div></div>
    <ConsumableSystem draft={draft} catalog={catalog} locale={locale}/>
    <div className="system"><h3>{t('Smart Servant')}</h3>{pet?<><div className="system-media" {...edit('pet','area')} data-info-href={buildInfoHref('pet',pet.id)}><Inspect title={localized(pet.name, locale)} heading={petInspectionHeading} tooltipDetails={petBonuses} details={<>{petBonuses}{draft.pet.modules.filter(Boolean).map((id,i)=><p key={i}>{localized(pet.modules.find(m=>m.id===id)?.name, locale)}</p>)}</>}><img src={pet.icon} alt=""/></Inspect><div className="pet-identity"><Inspect title={localized(pet.name, locale)} heading={petInspectionHeading} editTarget="pet-name" tooltipDetails={petBonuses} details={petBonuses}><b className="pet-name">{petName}</b></Inspect><small><span {...edit('pet-stars')}><Stars value={draft.pet.stars}/></span> · <span {...edit('pet-level')}>{t('Lv.')} {draft.pet.level}</span></small>{!pet.modules.length&&<small>{t('No modules')}</small>}</div></div>{pet.modules.length>0&&<div className="pet-modules">{[...draft.pet.modules.keys()].sort((a,b)=>Number(!draft.pet.modules[a])-Number(!draft.pet.modules[b])||a-b).filter(i=>draft.pet.modules[i]||!locked).map(i=>{const id=draft.pet.modules[i];const module=pet.modules.find(m=>m.id===id);const level=petModuleLevel(module,draft.pet.moduleLevels?.[i]);const levels=module?.levels.map(l=>({level:l.level,desc_en:l.description.en,desc_ru:l.description.ru}))??[];const description=buildRankedModuleDescription(levels,locale==='ru',level?.level);const rank=level?getModuleRank(levels,level.level):undefined;return module?<span key={i} {...edit(`module:${i}`,'area')}><Inspect infoHref={buildInfoHref('module',module.id)} key={i} title={localized(module.name, locale)} meta={level?<span className={styles.inspectionLevelMeta}>{t('Lv.')} {level.level}</span>:undefined} description={description} tooltipDetails={description?<GameRichText text={description} rank={rank}/>:undefined} details={description?<GameRichText text={description} rank={rank}/>:undefined}><img src={level?.icon||module.icon} alt={localized(module.name, locale)}/></Inspect>{!locked&&<small className="module-edit-level" {...edit(`module-level:${i}`)}>{t('Lv.')} {level?.level??0}</small>}</span>:!locked?<span key={i} {...edit(`module:${i}`)} className="media-placeholder module-placeholder">—</span>:null;})}</div>}</>:<><Tooltip portal content={captured?t('Smart Servant was not equipped or not captured at game login.'):t('No Smart Servant equipped.')}><div className="system-media" {...edit('pet','area')}><span className="media-placeholder system-placeholder">—</span><div><b {...edit('pet')}>—</b><small><span {...edit('pet-stars')}><Stars value={0}/></span> · <span {...edit('pet-level')}>{t('Lv.')} 0</span></small></div></div></Tooltip><div className="pet-modules">{!locked&&draft.pet.modules.map((_,i)=><span key={i} {...edit(`module:${i}`)} className="media-placeholder module-placeholder">—</span>)}</div></>}</div>
        <div className="system"><h3>{t('Supercomputing')}</h3><div className="computing-nodes">{draft.computing.map((n,i)=>{const node=catalog.computing.find(x=>x.id===n.id);const csText=systemScoreText(computingCombatScore(n,catalog));return node&&<StatLink types={[...(csText?[CS_SOURCES]:[]),...damageKeys('computing',n.id),...(computingAttacks.get(n.id)?["Attack %"]:[]),...(computingResistances.get(n.id)?["Resistance %",...allResistanceSourceKeys]:[])]} inspectTypes={[]} sourceBonuses={{...Object.fromEntries(allResistanceSourceKeys.map(key=>[key,computingResistances.get(n.id)?`${t("RES%")}: +${fmt(computingResistances.get(n.id)!,true,1)}`:undefined])),[ATTACK_SOURCES]:computingAttackBonus(n.id),[ATTACK_PERCENT_SOURCES]:computingAttacks.get(n.id)?`${t("ATK%")}: +${fmt(computingAttacks.get(n.id)!,true,1)}`:undefined,[CS_SOURCES]:csText}} sourceBonus={damageBonus('computing',n.id)} key={n.id}><div className="computing-node" {...edit(`computing:${i}`,'area')} data-damage-source={`computing:${n.id}`}> <Inspect title={localizedUi({en:node.label_en,ru:node.label_ru},locale)} meta={<span className={styles.inspectionLevelMeta}><span className={styles.computingLevelMeta}>{t('Lv.')} {n.level} / {node.maxLevel}</span>{computingProgress(n)}</span>} tooltipDetails={<ComputingEffects node={node} level={n.level} locale={locale}/>} details={<ComputingEffects node={node} level={n.level} locale={locale}/>}><img src={node.icon} alt={localizedUi({en:node.label_en,ru:node.label_ru},locale)}/></Inspect><div className="computing-level"><small>{t('Lv.')}</small>{received("computingNodes")?n.level:"—"}</div></div></StatLink>;})}</div></div>
    <div className="system space-support"><h3>{t('Space Support')} <small>{localizedUi({en:support.name_en,ru:support.name_ru},locale)} · {captured&&!captured.support?"—":support.maxModuleLevel}</small></h3><div className="support-chips">{[true,false].map((base,i)=><div key={i} style={{display:'contents'}}>{i===1&&<Inspect title={t('Space Support reset')} editTarget="support-all" tooltipDetails={<SupportResetDetails draft={draft} cooldownDays={catalog.support.reset?.cooldownDays} locale={locale}/>} details={<SupportResetDetails draft={draft} cooldownDays={catalog.support.reset?.cooldownDays} locale={locale}/>}><StatLink types={supportCS?[CS_SOURCES]:[]} inspectTypes={[]} sourceChannel={CS_SOURCES} sourceBonus={supportCS}><span className="support-core-source"><img className="support-core" src={support.icon} alt=""/></span></StatLink></Inspect>}<div className="support-group">{catalog.support.modules.filter(m=>m.base===base).map(m=>{const moduleName=localizedUi({en:m.name_en,ru:m.name_ru},locale);const level=draft.support.find(s=>s.id===m.id)?.level||0;const bonus=m.levels.find(l=>l.level===level);const attack=m.attackStat&&bonus&&bonus.value>0?{stat:m.attackStat,label:`${t('ATK')}: +${fmt(bonus.value,bonus.percentage)}`} :null;// Space Support ATK belongs to its own element: the element row lights it even when that element inherits the pair's gear ATK.
    // Scored modules light up on CS hover without their own label: the core shows the modules' sum.
    const scored=!!supportCombatScore({id:m.id,level},catalog)?.parts.length;
    return <StatLink types={[...(scored?[CS_SOURCES]:[]),...(m.attackStat?(attack?[attack.stat,`Own element source: ${attack.stat}`]:[`Inactive attack source: ${m.id}`]):damageKeys('support',m.id))]} inspectTypes={[]} sourceChannel={m.attackStat?ATTACK_SOURCES:undefined} sourceBonuses={scored?{[CS_SOURCES]:''}:undefined} sourceBonus={m.attackStat?attack?.label:damageBonus('support',m.id)} key={m.id}><div className={`support-chip ${level?'':'inactive'}`} {...edit(`support:${catalog.support.modules.indexOf(m)}`,'area')} data-damage-source={`support:${m.id}`}> <Inspect title={moduleName} meta={<span className={`${styles.inspectionLevelMeta} ${styles.supportLevelMeta}`}>{t('Lv.')} {level} / {support.maxModuleLevel}</span>} tooltipDetails={bonus&&bonus.value!==0?<div><span className={styles.systemBonusLabel}>{t('Bonus')}:</span> <BonusValue tone="neutral">+{formatValue(bonus.value,bonus.percentage,locale,1)}</BonusValue> {moduleName}</div>:undefined} description={systemBonusText(bonus,undefined,locale,moduleName)}><img src={m.icon} alt={moduleName}/></Inspect><small>{captured&&!captured.support?"—":level}</small></div></StatLink>;})}</div></div>)}</div></div></section>
    <footer className="footer"><span className="foot-brand">@kritik</span><div className="gear-stat-totals" style={{gridTemplateColumns:`repeat(${buildSummaryColumns(summary.length)},max-content)`}}>{summary.map(s=><StatLink key={s.type} types={s.type}><div className="gear-stat-total" tabIndex={0} data-hint={`${statLabel(s.type,locale)} · ${s.rolls===null?t('roll count unknown'):`${t('rolls')}: ${s.rolls}`}${s.quality!==null?` · ${fmt(s.quality,true,0)} ${t('of the maximum for these rolls')}`:''}`}><span className="gear-stat-value"><SummaryStatIcon type={s.type} catalog={catalog}/>{fmt(s.value,catalog.reference.statTypes[s.type].isPercentageBased)}</span><span className="gear-stat-rolls">×{s.rolls??'?'}{s.quality!==null&&<> · <b>{fmt(s.quality!,true,0)}</b></>}</span></div></StatLink>)}</div><div className="card-metadata"><Tooltip portal align="end" className={styles.itemTooltip} content={<div className={styles.itemEffects}>{draft.captureSource?.kind==='file'?<>
      <b>{t('Imported capture')}</b>
      <span>{restrictedCaptureOrigin(draft)?t('This source is available for viewing and calculations. Its environment flag stays on the PNG after edits.'):t('Game values come from a sealed capture of this account. The PNG marks the card verified only if it still matches that capture.')}</span>
      {draft.captureSource.unresolved?.length?<><div className={styles.detailRow}><strong>{t('Not captured at login')}</strong><span>{draft.captureSource.unresolved.length}</span></div>
        <span>{t('Part of the profile was not captured at game login or is not yet in this catalog; these slots stay empty on the card.')}</span>
        {/* Raw capture names the catalog does not know yet (a newer game patch); they stay empty on the card. */}
        <ul className={styles.unresolvedList}>{draft.captureSource.unresolved.slice(0,12).map((item,index)=><li key={index}>{item}</li>)}
          {draft.captureSource.unresolved.length>12&&<li>{fillText(t('and {0} more', 'и ещё {0}'), [draft.captureSource.unresolved.length-12])}</li>}</ul></>:null}
    </>:<><b>{t('Manual card')}</b><span>{t('Values were entered or edited by hand.')}</span></>}</div>}><time data-build-provenance tabIndex={0} dateTime={draft.updatedAt}>{draft.updatedAt?formatBuildDate(draft.updatedAt,'instant'):'—'}</time></Tooltip>
    {/* Only the PNG shows one of these; demo is explicit, while other statuses follow card verification. */}
    <span className="data-origin" data-export-provenance="test-server">{captureOriginLabel('test-server',locale,'export',draft.captureSource?.capture.capture.scan?.distribution)}</span>
    <span className="data-origin" data-export-provenance="pioneer-server">{captureOriginLabel('pioneer-server',locale)}</span>
    <span className="data-origin" data-export-provenance="unknown-server">{captureOriginLabel('unknown-server',locale)}</span>
    <span className="data-origin" data-export-provenance="incomplete-capture">{captureOriginLabel('incomplete-capture',locale)}</span>
    <span className="data-origin" data-status="demo" data-export-provenance="demo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM8.5 12l2.5 2.5 4.5-5"/></svg>{t('Demo')}</span>
    <span className="data-origin" data-status="verified" data-export-provenance="verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM8.5 12l2.5 2.5 4.5-5"/></svg>{t('Verified')}</span>
    <span className="data-origin" data-export-provenance="edited"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 16 12-12 4 4-12 12-5 1zM14 6l4 4"/></svg>{t('Edited')}</span></div></footer>
  </article></StatHighlight>;
}

export {CardPreview} from './card-preview';
