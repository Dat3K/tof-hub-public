'use client';

import { localized } from '@tof-hub/i18n';
import type {Localized} from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {ModeSwitcher} from '@tof-hub/ui';
import {ToolRail,RailGlyph} from '@/components/tool-rail/tool-rail';
import {CaptureAppModal} from '@/components/tool-rail/capture-app-modal';
import {InfoCard,InfoDisclosure,InfoNote,InfoRow,InfoRows,RulePoint,SectionHeading,ToolInfoModal} from '@/components/tool-rail/tool-info-modal';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import {STANDARD_RV_PROFILE,standardRVProfile} from './rv-profile';
import styles from './build-info.module.css';
import rvStyles from './build.module.css';
import {ElementAttackFormula,RollValueFormula,RollValueProfile,RollValueScale,RollWeightList} from './gear-roll-value';
import {FilterChip,FilterGroup} from '@tof-hub/ui';
import {gameAsset} from '@tof-hub/game-assets';
import {ELEMENT_FILTER_OPTIONS} from '../simulacra/constants';
import {alteredSource,buildRole,gearRollValue,rollValueContext} from './model';
import {getPlayerRoleLabel,type BuildRVRole} from '@tof-hub/game-domain';
import {elementLabel} from './presentation';
import {formatNumber} from '@/lib/i18n/format';
import {SavedProfilesModal} from './profile-bar';
import {BuildCalculationDetails} from './build-calculation-details';
import {useAnimatedDetails} from '../info-sections/common/use-animated-details';

type Copy=Localized<string>;
const tr=(locale:BuildLocale,copy:Copy)=>localized(copy, locale);

/** Card map: every zone of the card, where its data comes from and what can be changed by hand. */
// `direct`: what changes right on the locked card and keeps an imported card Verified (card-verification.ts allows
// the header role/element, enemy level, RV element/mode and the artwork); zones without it need unlocking.
const ZONES:{id:string;area:string;title:Copy;captured:boolean;text:Copy;direct?:Copy}[]=[
  {id:'header',area:'header',captured:true,title:{en:'Profile header',ru:'Шапка профиля'},
    text:{en:'Nickname, level, server, crew, title, signature, suppressor, current and apex CS. Role and element beside the name are chosen with a click; Auto follows the weapon resonance and the strongest element.',
      ru:'Ник, уровень, сервер, гильдия, титул, подпись, подавитель, текущий и максимальный CS. Роль и стихия рядом с ником выбираются кликом; «Авто» следует резонансу оружия и сильнейшей стихии.'},
    direct:{en:'Role and element in the top-right corner (e.g. DPS / Volt): click to choose. Auto follows the weapon resonance and the strongest element; GRV/PRV use the chosen element.',
      ru:'Роль и стихия в правом верхнем углу (например, DPS / Volt): выбираются кликом. «Авто» следует резонансу оружия и сильнейшей стихии; GRV/PRV считаются по выбранной стихии.'}},
  {id:'art',area:'art',captured:false,title:{en:'Background art',ru:'Фон'},
    text:{en:'Any Arts catalog image or your own upload; the choice survives imports.',ru:'Любой арт из каталога или своя картинка; выбор сохраняется при импорте.'},
    direct:{en:'Upload, move, scale and reset the art with the controls in the bar under the card.',ru:'Загрузить, сдвинуть, масштабировать и сбросить арт можно кнопками на панели под карточкой.'}},
  {id:'stats',area:'stats',captured:true,title:{en:'Combat stats',ru:'Боевые статы'},
    text:{en:'HP, universal ATK, Crit, Crit DMG and the five elements: ATK, ATK%, DMG% and resistance. Hover any value to light up every source on the card.',
      ru:'ОЗ, универсальная АТК, крит, крит-урон и пять стихий: АТК, АТК%, урон% и сопротивление. Наведите на значение — подсветятся все его источники.'},
    direct:{en:'Enemy level in the section header (Enemy Lv.); crit chances are calculated against it.',ru:'Уровень врага в заголовке раздела (Ур. врага); шансы крита считаются против него.'}},
  {id:'weapons',area:'weapons',captured:true,title:{en:'Weapons and matrices',ru:'Оружие и матрицы'},
    text:{en:'Three weapons with advancement, level, element form and selected skill or mode; four matrices per weapon with stars and level. Set bonuses and resonance follow automatically.',
      ru:'Три оружия с прорывом, уровнем, формой стихии и выбранным навыком или режимом; по четыре матрицы со звёздами и уровнем. Бонусы комплектов и резонанс считаются сами.'}},
  {id:'gear',area:'gear',captured:true,title:{en:'Gear',ru:'Гир'},
    text:{en:'Twelve slots: stars, enhancement, random stats now and before Titan, Titan stats and the Titan effect. Roll counts and maximums are derived.',
      ru:'Двенадцать слотов: звёзды, усиление, случайные статы сейчас и до Titan, статы Titan и эффект Titan. Число проков и максимумы вычисляются.'}},
  {id:'systems',area:'systems',captured:true,title:{en:'Systems',ru:'Системы'},
    text:{en:'Pet with modules, two relics, trait, Synesthesia, Supercomputing nodes, Space Support modules and its reset cooldown.',
      ru:'Питомец с модулями, две реликвии, черта, Синестезия, узлы суперкомпьютера, модули Space Support и откат его сброса.'}},
  {id:'buffs',area:'buffs',captured:true,title:{en:'Food and shots',ru:'Еда и шприцы'},
    text:{en:'Active food and three shot slots with their remaining time. Their ATK% and the Enhancement Shot gains are shown on the sources they raise.',
      ru:'Активная еда и три слота шприцев с остатком времени. Их АТК% и прибавки Enhancement Shot видны на тех источниках, которые они увеличивают.'}},
];

function EditableFieldsModal({isOpen,onClose,locale}:{isOpen:boolean;onClose:()=>void;locale:BuildLocale}) {
  const [mode,setMode]=useState<'verified'|'edited'>('verified');
  const [selected,setSelected]=useState(ZONES[0]!.id);
  const zone=ZONES.find(item=>item.id===selected)!;
  const verified=mode==='verified';
  const t=localeText(locale);
  return <ToolInfoModal isOpen={isOpen} onClose={onClose} eyebrow={t('Build card · fields')} title={t('What you can edit')}
    intro={t('Verified: what changes right on the card, with the lock on; the PNG of an imported card stays Verified. Edited: turn off the lock under the card and click any zone; any of these changes marks the PNG Edited.')} closeLabel={t('Close')}>
    <ModeSwitcher value={mode} onChange={setMode} ariaLabel={t('Card status')} dataAttribute="data-fields-mode"
      options={[{value:'verified',label:'Verified',tone:'sky'},{value:'edited',label:'Edited',tone:'orange'}]}/>
    <div className={styles.fieldsLayout}>
      <div className={styles.cardMap} role="group" aria-label={t('Card zones')} data-mode={mode}>
        {ZONES.flatMap(item=>[item.area,...(item.id==='systems'?['systems2']:[])].map((area,part)=><button key={area} type="button" className={styles.zone} data-zone={area}
          style={item.id==='art'?undefined:{gridArea:area}} aria-pressed={item.id===selected} tabIndex={part?-1:undefined} aria-hidden={part?true:undefined}
          data-captured={item.captured||undefined} data-direct={item.direct?'':undefined} onClick={()=>setSelected(item.id)} onMouseEnter={()=>setSelected(item.id)} onFocus={()=>setSelected(item.id)}>
          {/* The systems row continues after Food and shots (pet, Supercomputing, Space Support). */}
          <span>{tr(locale,item.title)}</span></button>))}
      </div>
      <InfoCard className={styles.zoneDetails}>
        <SectionHeading>{tr(locale,zone.title)}</SectionHeading>
        {verified
          ?<span className={styles.source} data-direct={zone.direct?'':undefined}>{zone.direct?t('On the card · stays Verified'):t('Unlock to edit · Edited')}</span>
          :<span className={styles.source} data-captured={zone.captured||undefined}>{zone.captured?t('Filled by the capture app'):t('Set by hand')}</span>}
        <p className="mt-3 text-xs leading-relaxed text-slate-400" aria-live="polite">{verified
          ?(zone.direct?tr(locale,zone.direct):t('Nothing here changes with the lock on. Editing this zone marks the exported PNG Edited.'))
          :tr(locale,zone.text)}</p>
      </InfoCard>
    </div>
    <section className="grid gap-3 md:grid-cols-2">
      <InfoCard><SectionHeading>{t('Editing tools')}</SectionHeading>
        <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-400">
          <RulePoint title={t('Undo and redo.')} text={t('Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, also for art moves and uploads.')}/>
          <RulePoint title={t('Advanced editor.')} text={t('A full form beside the card with every field, including values that have no zone.')}/>
          <RulePoint title={t('Bulk enhancement.')} text={t('Set the enhancement of all twelve gear slots at once.')}/>
          <RulePoint title={t('Autosave.')} text={t('The draft stays in this browser until you clear it.')}/>
        </ul></InfoCard>
      <InfoCard><SectionHeading>{t('Not editable')}</SectionHeading>
        <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-400">
          <RulePoint title={t('Data and forecasts.')} text={t('Set bonuses and progression tables come from the game files. Stat ranges use the generated reference; Titan ceilings are model forecasts with documented coefficients and observed calibrations.')}/>
          <RulePoint title={t('Derived values.')} text={t('GRV/PRV, roll counts, CS by system and source highlights are recalculated after every edit.')}/>
        </ul></InfoCard>
    </section>
  </ToolInfoModal>;
}

const FORMULAS:{id:string;title:Copy;formula:string;text:Copy}[]=[
  {id:'grv',title:{en:'GRV · Global Roll Value',ru:'GRV · глобальный Roll Value'},formula:'RV = 100 × Σ(Tᵢ × wᵢ) / Q',
    text:{en:'Current useful random and Titan-added stats are weighted for a fixed editorial reference profile. Its DPS baseline is {atk} ATK, {atkp} ATK%, {dmg} DMG% and {crit} crit; the selected role’s actual reference is shown below. Initial random-stat values count; fixed equipment base/enhancement stats and rare Titan properties are not RV points. 100 points is one strongest weighted maximum roll after the Titan multiplier, not a perfect item or 100% damage.',
      ru:'Текущие полезные случайные и добавленные Titan-статы взвешиваются по фиксированному эталону сайта. Его база для ДД: {atk} АТК, {atkp} АТК%, {dmg} урона% и {crit} крита; фактический эталон выбранной роли показан ниже. Стартовые значения случайных статов учитываются; фиксированные базовые статы и усиление гира, редкие свойства Titan не дают очки RV. 100 очков — один сильнейший взвешенный максимальный прок после множителя Titan, а не идеальная вещь или 100% урона.'}},
  {id:'prv',title:{en:'PRV · Personal Roll Value',ru:'PRV · персональный Roll Value'},formula:'local weights from the profile without this equipped item',
    text:{en:'Uses effective personal stats, including selected recognized consumables. For an equipped item, remove its fixed, random and Titan-added contributions and any lost enhancement-resonance stats before computing weights. Crit and Crit Rate share the remaining chance below 100%. Each slot has its own item-free profile, Q and ceiling, so the sum is not the effect of removing the complete set. Missing required inputs leave PRV unavailable.',
      ru:'Использует эффективные персональные статы, включая выбранные распознанные расходники. Перед расчётом весов надетой вещи вычитаются её фиксированные, случайные и добавленные Titan-статы, а также потерянные статы резонанса усиления. Крит и КШ вместе занимают оставшийся шанс до 100%. У каждого слота своя база без вещи, Q и потолок, поэтому сумма не описывает снятие всего комплекта. Без необходимых входных данных PRV недоступен.'}},
  {id:'pair',title:{en:'Element pairs',ru:'Пары стихий'},formula:'GRV flat ATK: universal + max(pair); build %: one whole-gear winner',
    text:{en:'GRV counts the higher elemental flat ATK of each item once, plus applicable universal ATK. A standalone item chooses its higher ATK% and DMG% independently. A whole Build selects one percentage source from the higher total across all equipped gear for ATK%, and independently for DMG%; the losing percentage rows add zero in every slot. Pair values are not summed. PRV uses the selected personal element and removes the marginal percentage lost with the item.',
      ru:'GRV считает большую плоскую стихийную АТК каждой вещи один раз плюс применимую общую АТК. Отдельная вещь независимо выбирает свои больший АТК% и больший урон%. Весь Build выбирает один источник АТК% по большей сумме надетого гира и независимо один источник урона%; проигравшие процентные строки дают ноль во всех слотах. Статы пары не складываются. PRV использует выбранную персональную стихию и вычитает предельную потерю процента при снятии вещи.'}},
  {id:'auto',title:{en:'Auto element',ru:'Авто-стихия'},formula:'role + released weapon order + eligible resonance',
    text:{en:'DPS follows the main resonance of the newest eligible equipped weapon; without a matching resonance it falls back to native final ATK. Healer and tank use the main element of their newest released equipped weapon of that role. Auto chooses the rating context; it does not infer a full combat rotation.',
      ru:'ДД следует основной резонансной стихии новейшего подходящего надетого оружия; без подходящего резонанса выбирает по исходной итоговой АТК. Хилер и танк используют основную стихию самого нового вышедшего надетого оружия своей роли. Авто выбирает контекст оценки, а не восстанавливает полную боевую ротацию.'}},
];

/** The GRV reference player is quoted from the scoring constants, never retyped. */
function profileText(text:string,locale:BuildLocale) {
  const percent=(value:number)=>`${formatNumber(Math.round(value*100),locale)}%`;
  return text.replace('{atk}',formatNumber(STANDARD_RV_PROFILE.flatAttack,locale)).replace('{atkp}',percent(STANDARD_RV_PROFILE.attackPercent))
    .replace('{dmg}',percent(STANDARD_RV_PROFILE.damagePercent)).replace('{crit}',percent(STANDARD_RV_PROFILE.critChance));
}

/** How GRV and PRV are calculated, expanded: the same blocks as the item RV dialog and the Tools · Ranking "?" help. */
/** "How GRV and PRV are calculated"; also opened from the Tools · Ranking rail. */
export function CalculationsModal({isOpen,onClose,locale,catalog,element,alteredFrom,role,audience='build',contextDetails,children}:{isOpen:boolean;onClose:()=>void;locale:BuildLocale;catalog:BuildCatalog;element:string;alteredFrom:string;role:BuildRVRole;audience?:'build'|'ranking';contextDetails?:ReactNode;children?:ReactNode}) {
  const t=localeText(locale);
  const ranking=audience==='ranking';
  // GRV weights depend on the element (flat ATK and ATK%/DMG% of that element), so the table has its own element choice,
  // starting from the card's element; same rows as the item RV dialog and the Tools · Ranking "?" help.
  const rank=(id:string)=>ELEMENT_FILTER_OPTIONS.findIndex(option=>option.id===id.toLowerCase());
  const elements=Object.keys(catalog.elementIcons).sort((a,b)=>rank(a)-rank(b));
  const [picked,setPicked]=useState<string|null>(null);
  const [pickedRole,setPickedRole]=useState<BuildRVRole|null>(null);
  const weightsRole=pickedRole??role;
  const tankComparison=weightsRole==='tank';
  const weightsElement=picked??(elements.includes(element)?element:elements[0]??'');
  const weights=useMemo(()=>gearRollValue({id:'',equipped:true,enhancement:0,stars:0,titan:false,augmented:false,rows:[],augments:[],base:[],rareId:'',rareLevel:0},
    {rv:{element:'',includeCrit:true,mode:'grv'}} as BuildDraft,catalog,weightsElement==='Altered'&&weightsRole!=='tank'?{element:'Altered',selected:'Altered',percentElements:[alteredFrom],inheritFrom:alteredFrom,role:weightsRole}:{element:weightsElement,selected:weightsElement,percentElements:[weightsElement],role:weightsRole}).rollWeights,[catalog,weightsElement,alteredFrom,weightsRole]);
  // Cards and the "other calculations" block fold with the Simulacra motion; the modal mounts only while open.
  useAnimatedDetails({containerSelector:'[data-build-calculations]',dependencyKey:`${locale}-${isOpen}`});
  const roleLabels:Record<BuildRVRole,string>={dps:getPlayerRoleLabel('dps',locale),healer:getPlayerRoleLabel('healer',locale),tank:getPlayerRoleLabel('tank',locale)};
  return <ToolInfoModal isOpen={isOpen} onClose={onClose} eyebrow={ranking?t('Ranking · Calculations'):t('Build card · Calculations')} title={ranking?t('Ranking: GRV, CS and comparison'):t('Build stats, CS, GRV and PRV')}
    intro={ranking?t('Ranking compares current gear using the same fixed GRV reference for every player. GRV points, ceiling percentages, CS and the comparison result measure different things; the explanations below follow the selected role and element.'):t('GRV rates current gear with a fixed reference; PRV uses your effective personal profile. Combat stats and CS have separate formulas. Below are the inputs, equations and limits of each calculation; item tooltips show the current breakdown.')} closeLabel={t('Close')}>
    <div data-build-calculations className="space-y-6">
    {contextDetails}
    {/* Groups in reading order, one column: scores, weights and reference, element ATK and rules, colours and comparison. */}
    <div className={styles.calcGroups}>
      <section className={styles.calcGroup}><h3 className={styles.groupTitle}>{t('Scores')}</h3>{FORMULAS.filter(item=>item.id==='grv'||!ranking&&item.id==='prv').map(item=><InfoDisclosure key={item.id} title={tr(locale,item.title)}>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{profileText(tr(locale,item.text),locale)}</p>
      </InfoDisclosure>)}</section>
      <section className={styles.calcGroup}><h3 className={styles.groupTitle}>{t('Weights and reference')}</h3>
      <InfoDisclosure title={t('Maximum roll weights (GRV)')}>
        <div className={`${rvStyles.rollValueMethod} ${styles.rvCardBody}`}>
          <FilterGroup label={t('Role')}>{(['dps','healer','tank'] as const).map(id=><FilterChip key={id} value={id} active={id===weightsRole} onClick={()=>setPickedRole(id)}>{roleLabels[id]}</FilterChip>)}</FilterGroup>
          <FilterGroup label={t('Element','Стихия')}>{elements.map(id=>{const option=ELEMENT_FILTER_OPTIONS.find(item=>item.id===id.toLowerCase());
            return <FilterChip key={id} value={id} variant={option?.variant} icon={option?.iconPath?gameAsset(option.iconPath):undefined} iconAlt="" active={id===weightsElement} onClick={()=>setPicked(id)}>{elementLabel(id,locale)}</FilterChip>;})}</FilterGroup>
          <RollWeightList weights={weights} catalog={catalog} locale={locale} mode="GRV"/>
        </div>
      </InfoDisclosure>
      <InfoDisclosure title={t('GRV reference player')}><div className={`${rvStyles.rollValueMethod} ${styles.rvCardBody}`}><RollValueProfile profile={standardRVProfile(catalog,weightsElement)} role={weightsRole} enemyLevel={STANDARD_RV_PROFILE.enemyLevel} locale={locale}/></div></InfoDisclosure>
      <InfoDisclosure title={t('Formula')}><div className={`${rvStyles.rollValueMethod} ${styles.rvCardBody}`}><RollValueFormula mode={ranking?'GRV':'GRV / PRV'} locale={locale} role={weightsRole}/></div></InfoDisclosure>
      </section>
      <section className={styles.calcGroup}><h3 className={styles.groupTitle}>{ranking?t('Scoring rules'):t('Element ATK and rules')}</h3>
      {!ranking&&<InfoDisclosure title={t('Element ATK and Space Support')}><ElementAttackFormula locale={locale}/></InfoDisclosure>}
      {/* Shared rules as one list: name and formula on one line, the explanation under it. */}
      <InfoDisclosure title={t('Rules')}><InfoRows>
        {FORMULAS.filter(item=>item.id==='pair'||!ranking&&item.id==='auto').map(item=><InfoRow key={item.id} title={tr(locale,item.title)} formula={item.formula}>{ranking?t('A standalone item independently chooses its higher elemental ATK, ATK% and DMG% within the selected pair, counting applicable universal ATK once. A player set chooses one whole-gear ATK% winner and one DMG% winner independently; losing percentage rows contribute zero. Pair stats are not summed.'):tr(locale,item.text)}</InfoRow>)}
        <InfoRow title={t('Percentage')} formula="100 × clamp(score / ceiling, 0, 1)">{t('The rating percentage shows a share of the model’s slot ceiling, limited to 0–100%; rating points themselves stay unrounded for calculations. The ceiling searches legal rated stat combinations and roll allocations for the slot. DPS/healer use the rated random-stat ceiling; tank also models allowed Titan-added defensive stats. It is not an extra damage percentage or a player rank. A build sums equipped scores and uses the sum of all slot ceilings, including empty slots.')}</InfoRow>
        <InfoRow title={t('Ranking updates')} formula={t('one GRV rule for points, percentages and places')}>{t('Build and Ranking use the same GRV reference and scoring rules. A build percentage is its total GRV divided by the sum of slot ceilings × 100. When scoring rules or reference data change, stored gear and player rankings are automatically recalculated before the updated ranking becomes available. Combat ATK and Space Support affect personal calculations, not the fixed GRV reference.')}</InfoRow>
        <InfoRow title={t('Role')} formula="DPS: output · healer: ATK · tank: EHP">{t('DPS and Balance rate ATK, ATK%, DMG%, Crit and Crit Rate with an expected-output model. Healer rates flat ATK and ATK% only; the score does not simulate healing skills. Tank rates HP, HP%, universal and own-element RES, and own-element RES% with EHP = HP × (1 + final RES / K). Resistance has diminishing damage-reduction and relative EHP gains; absolute EHP is linear in RES at fixed HP. The shown GRV reference is an editorial comparison baseline, not captured game stats, and differs for Altered tank.')}</InfoRow>
        <InfoRow title={t('Altered','Altered')} formula={t('strongest final ATK + Altered ATK')}>{ranking?t('Altered chooses one native gear source for the complete player set, without duo inheritance. Standalone items choose their own source. DPS rates native ATK/ATK%, applicable universal ATK, own Altered ATK and crit; gear DMG% adds zero. Healer excludes crit. Tank rates HP and universal / Altered resistance only. Under All, matching native elements win at equal gear points; a smaller ceiling alone cannot select Altered.'):t('Altered uses one native element for the complete set, without pair inheritance, and adds own Altered ATK after percentages. GRV selects the strongest gear-only source; PRV uses personal ATK, and replacement comparisons can switch the source. DPS retains crit but rates gear DMG% at zero; healer excludes both. Tank rates only HP and universal / Altered resistance, with no native RES inheritance. Under All, matching native elements take priority when gear points equal Altered; a smaller ceiling alone cannot make Altered the winner.')}</InfoRow>
      </InfoRows></InfoDisclosure>
      </section>
      <section className={styles.calcGroup}><h3 className={styles.groupTitle}>{t('Colours and comparison')}</h3>
      <InfoDisclosure title={t('Colors')}><div className={`${rvStyles.rollValueMethod} ${styles.rvCardBody}`}>
        <p>{t('The color shows how much of the max GRV is reached: an item against its slot ceiling, a stat against its own five-roll maximum, a build against the sum of its slot ceilings. The same bands are used on the build card and in the ranking.')}</p>
        <RollValueScale/>
      </div></InfoDisclosure>
      {/* Ranking Compare: last block, after the colours. */}
      <InfoDisclosure title={t('Damage comparison (ranking)')}><InfoRows>
        <InfoRow title={t('Gear')} formula={tankComparison?'gain = EHP(reference + item B) / EHP(reference + item A) − 1':'gain = O(reference + item A) / O(reference + item B) − 1'}>{t('The reference output is recalculated for the counted stats of A and B. Within this model: DPS O = [(B + F)(1 + a + p) + P] × (1 + d + q) × [1 + min(1, c + Crit / D + CR) × k]; healer uses only the ATK factor. Tank O = (H + ΔH)(1 + h + Δh) × [1 + (R + ΔR)(1 + r + Δr) / K]. F is counted flat ATK, p/q are ATK%/DMG%, CR is added Crit Rate; P includes own Altered ATK after native percentages when applicable. Factor ratios multiply to the result. This is exact for that reference model, not measured combat DPS or healing.')}</InfoRow>
        <InfoRow title={t('Players')} formula={tankComparison?'≈ exp((GRV_B × Q_B − GRV_A × Q_A) / 100) − 1':'≈ exp((GRV_A × Q_A − GRV_B × Q_B) / 100) − 1'}>{t('A first-order estimate from the difference in weighted gear totals. Q is the local normalization of one strongest weighted maximum roll after Titan; it is not the exact logarithm of a finite damage gain. Each track uses its own Q, and only equal Q reduces this to (GRV_A − GRV_B) × Q. The exponential converts that estimated log-output difference into a ratio; it does not turn local GRV weights into an exact whole-build simulation.')}</InfoRow>
        <InfoRow title={t('Sign')} formula={tankComparison?'negative: less damage taken than reference':'positive: row output > reference output'}>{tankComparison?t('For tanks the comparison displays the inverse EHP ratio as a change in damage taken. A negative value means less damage taken and favors the row; a positive value means more. The reference is the pinned row or the ideal model. Player comparisons remain a first-order estimate from GRV totals.'):t('The reference is the row selected with the square button, or the model’s ideal item/player. A positive result means the row has a higher modeled output than that reference; a negative result means lower. This comparison does not simulate personal buffs, rotations or the enemy’s complete mechanics.')}</InfoRow>
      </InfoRows></InfoDisclosure>
      </section>
    </div>
    <InfoNote label={t('Interpreting rating points')}>{ranking?t('GRV points and ceiling percentages measure weighted gear potential, not damage, healing or survival gain. Item comparison recalculates the reference output; player comparison estimates it from weighted totals.'):t('GRV and PRV use local derivatives of the reference output. Their points and ceiling percentages do not directly equal damage, healing or survival gains; compare the recalculated output when choosing a replacement.')}</InfoNote>
    {ranking?<InfoDisclosure title={t('CS in the ranking')}><p>{t('The player row shows the captured maximum CS (Apex CS), falling back to current captured CS when that maximum is unavailable. Its tooltip shows the recorded maximum date when supplied. CS is a character snapshot value, separate from gear GRV and the comparison model. Sorting by CS changes display order; the numbered places remain GRV places.')}</p></InfoDisclosure>:<details className={styles.otherFormulas}><summary>{t('Other calculations and game rules that are not obvious')}</summary>
      <BuildCalculationDetails catalog={catalog} locale={locale}/>
    </details>}
    {children}
    </div>
  </ToolInfoModal>;
}

/** Help rail; `onImport` opens the .tofbuild picker (primary action, as Import pulls on the Wish Tracker rail). */
export function BuildInfoRail({
  locale,
  onImport,
  catalog,
  draft,
  appRequest = 0,
  viewing,
  profilesVersion = 0,
}: {
  locale: BuildLocale;
  onImport: () => void;
  catalog: BuildCatalog;
  draft: BuildDraft;
  appRequest?: number;
  viewing?: { uid: string; slot: string | null };
  profilesVersion?: number;
}) {
  const [open, setOpen] = useState<'app' | 'profiles' | 'fields' | 'formulas' | null>(null);
  useEffect(() => {
    if (appRequest) setOpen('app');
  }, [appRequest]);
  const t = localeText(locale);
  const close = () => setOpen(null);

  return (
    <>
      <ToolRail
        placement="side"
        label={t('Build card help')}
        items={[
          { id: 'import', label: t('Import .tofbuild', 'Импорт .tofbuild'), icon: <RailGlyph name="import" />, onClick: onImport, tone: 'accent' },
          { id: 'app', label: t('Capture app'), icon: <RailGlyph name="download" />, onClick: () => setOpen('app') },
          { id: 'fields', label: t('Editable fields'), icon: <RailGlyph name="edit" />, onClick: () => setOpen('fields') },
          { id: 'formulas', label: t('How GRV and PRV work'), icon: <RailGlyph name="formula" />, onClick: () => setOpen('formulas') },
          { id: 'profiles', label: t('My builds'), icon: <RailGlyph name="profiles" />, onClick: () => setOpen('profiles'), active: open === 'profiles', tone: 'sky' },
          { id: 'all-profiles', label: t('All profiles'), icon: <RailGlyph name="equipment" />, href: '/tools/build/profiles/' },
        ]}
      />
      <CaptureAppModal isOpen={open === 'app'} onClose={close} locale={locale} upload={{ label: t('Import .tofbuild', 'Импортировать .tofbuild'), onClick: onImport }} />
      <SavedProfilesModal
        isOpen={open === 'profiles'}
        onClose={close}
        draft={draft}
        catalog={catalog}
        locale={locale}
        viewing={viewing}
        version={profilesVersion}
        onImport={onImport}
      />
      <EditableFieldsModal isOpen={open === 'fields'} onClose={close} locale={locale} />
      {open === 'formulas' && (
        <CalculationsModal
          isOpen
          onClose={close}
          locale={locale}
          catalog={catalog}
          element={rollValueContext(draft, catalog).element}
          alteredFrom={alteredSource(draft, catalog)}
          role={buildRole(draft)}
        />
      )}
    </>
  );
}
