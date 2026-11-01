import { localeText } from '@/lib/i18n/text';
import { translateUiText } from '@tof-hub/i18n';

import {getElementShortLabel} from '@tof-hub/game-domain';
import type {BuildCatalog,BuildLocale,SystemBonus,PetModule} from './types';
import {formatNumber} from '@/lib/i18n/format';
/** Shared hint for the editable enemy level on Build and Optimizer. */
export function enemyLevelEditHint(locale:BuildLocale) {
  return localeText(locale)('Edit enemy level to change the crit chance formula.', 'Измените уровень врага, чтобы изменить формулу шанса крита.');
}
export function petModuleLevel(module:PetModule|undefined,level:number|undefined) {
  return module?.levels.find(item=>item.level===level)??module?.levels[0];
}
/** Titan clicks of an item (the game's "Augmentation Count"); null when the capture did not read it. */
/** Titan clicks (Augmentation Count) split into label and number, for layouts that style them apart. */
export function augmentCountParts(count:number|null|undefined,locale:BuildLocale) {
  if(count===null||count===undefined||count<0)return null;
  return {label:'Aug',value:formatNumber(count,locale)};
}
export function augmentCountText(count:number|null|undefined,locale:BuildLocale) {
  const parts=augmentCountParts(count,locale);
  return parts?`${parts.label}: ${parts.value}`:null;
}
/** Element name (ELEMENT_SHORT_LABELS of @tof-hub/game-domain, the Info terms); other ids stay as given. */
export function elementLabel(id:string,locale:BuildLocale) {
  return getElementShortLabel(id,locale);
}
export function statLabel(type:string,locale:BuildLocale) {
  const label=type.replace('Attack','ATK').replace('Damage','DMG').replace('Resistance','RES').replace('Crit Rate','CR');
  if(locale==='en')return label;
  if(locale==='ru'){
    let ru=label;
    for(const [en,word] of Object.entries({Elemental:'Элем.',Frost:'Лед',Volt:'Электро',Flame:'Огонь',Physical:'Физ.',Altered:'Аберр.',ATK:'АТК',DMG:'Урон',RES:'Сопр.',HP:'ОЗ',Crit:'Крит',CR:'ШК'}))ru=ru.replace(en,word);
    return ru;
  }
  // Every other culture composes the label from its phrase-table words ("Frost ATK %" → 冰攻击%).
  const joined=label.split(' ').map(word=>translateUiText(word,locale)).join(locale==='zh-CN'||locale==='zh-Hans'||locale==='zh-Hans-SG'||locale==='ja'?'':' ');
  return joined.replace(/(\S)%/,'$1 %');
}
/**
 * Colour of a rated stat in GRV/PRV bars and legends (build card and ranking). Element stats take the site's element
 * colour (--elem-*): flat ATK the pure colour, ATK % a lighter and DMG % a darker shade; universal ATK is
 * gold, Crit red (Crit Rate % pink). Tank stats follow the same scheme (2026-10-08): element RES the pure element colour,
 * RES % lighter, universal RES silver; HP green, HP % lighter.
 */
export type RollValueStatGroup='crit'|'crit-rate'|'attack'|'element-attack'|'attack-percent'|'damage-percent'|'resistance'|'element-resistance'|'resistance-percent'|'hp'|'hp-percent'|'other';
/** Display priority shared by gear summaries and rated-stat breakdowns. */
const GEAR_STAT_GROUP_ORDER:readonly RollValueStatGroup[]=['crit','crit-rate','attack','element-attack','attack-percent','damage-percent','resistance','element-resistance','resistance-percent','hp','hp-percent','other'];
export function gearStatOrder(type:string) {
  return GEAR_STAT_GROUP_ORDER.indexOf(rollValueStatGroup(type));
}
export function rollValueStatGroup(type:string):RollValueStatGroup {
  if(type==='Crit')return 'crit';
  if(type==='Crit Rate %')return 'crit-rate';
  if(type==='Attack')return 'attack';
  if(type.endsWith(' Attack %')||type==='Attack %')return 'attack-percent';
  if(type.endsWith(' Damage %')||type==='Damage %')return 'damage-percent';
  if(type.endsWith(' Attack'))return 'element-attack';
  if(type==='Resistance')return 'resistance';
  if(type.endsWith(' Resistance %')||type==='Resistance %')return 'resistance-percent';
  if(type.endsWith(' Resistance'))return 'element-resistance';
  if(type==='HP')return 'hp';
  if(type==='HP %')return 'hp-percent';
  return 'other';
}
/** Element of an element stat ("Frost Attack %" → "Frost"), or undefined for universal stats. */
export function rollValueStatElement(type:string):string|undefined {
  const element=type.split(' ')[0];
  return type.includes(' ')&&rollValueStatGroup(type)!=='other'&&!type.startsWith('Crit')&&!type.startsWith('HP')&&element!=='Attack'&&element!=='Damage'?element:undefined;
}
export function statIcon(type:string,catalog:Pick<BuildCatalog,'statTypeIcons'|'displayIcons'>) {
  return catalog.statTypeIcons[type]?.icon || catalog.displayIcons.attack?.icon || '';
}
export function formatValue(value:number,percentage:boolean,locale:BuildLocale,digits=2) {
  return formatNumber(value,locale,{maximumFractionDigits:percentage?digits:0,minimumFractionDigits:percentage?digits:0,style:percentage?'percent':'decimal'});
}
/** Titan ceilings retain fractional growth, unlike rounded in-card flat stats. */
export function formatStatMaximum(value:number,percentage:boolean,locale:BuildLocale,digits=4) {
  return percentage?formatValue(value,true,locale,digits):formatNumber(value,locale,{maximumFractionDigits:digits});
}
export function systemBonusText(current:SystemBonus|undefined,next:SystemBonus|undefined,locale:BuildLocale,effectName?:string) {
  if(!current)return localeText(locale)('No bonus data for this level.', 'Нет данных о бонусе этого уровня.');
  const bonus=current.value===0?(localeText(locale)('No effect')):`${localeText(locale)('Bonus', 'Бонус')}: +${formatValue(current.value,current.percentage,locale,1)}${effectName?` ${effectName}`:''}`;
  return next?`${bonus} · ${localeText(locale)('Next level')}: +${formatValue(next.value-current.value,current.percentage,locale,1)}`:bonus;
}

/** Quality bands by share of the max GRV (slot ceiling or a stat's five-roll maximum): each grade starts at `from`. */
export const ROLL_VALUE_GRADES=[
  {grade:'neutral',from:0},{grade:'green',from:.6},{grade:'blue',from:.7},
  {grade:'purple',from:.8},{grade:'gold',from:.85},{grade:'titan',from:.9},
] as const;
export type RollValueGrade=typeof ROLL_VALUE_GRADES[number]['grade'];
export function rollValueQuality(value:number|null,maximum:number) {
  const ratio=value===null||maximum<=0?null:Math.max(0,Math.min(1,value/maximum));
  // Graded at the shown precision (0.1%), so a value displayed as 90.0% never takes the colour below 90%.
  const shown=ratio===null?null:Math.round(ratio*1000)/1000;
  const grade:RollValueGrade=shown===null?'neutral':ROLL_VALUE_GRADES.reduce<RollValueGrade>((found,band)=>shown>=band.from?band.grade:found,'neutral');
  return {ratio,grade};
}
/** Legend labels of ROLL_VALUE_GRADES: `<60%`, `60–<70%`, …, `90–100%`. */
export function rollValueGradeLabels() {
  return ROLL_VALUE_GRADES.map(({grade,from},index)=>{
    const next=ROLL_VALUE_GRADES[index+1],pct=(v:number)=>Math.round(v*100);
    return {grade,label:index===0?`<${pct(next!.from)}%`:next?`${pct(from)}–<${pct(next.from)}%`:`${pct(from)}–100%`};
  });
}

/**
 * One date style for the card: DD.MM.YYYY HH:mm in both locales.
 * `instant` values (ISO with a zone) are shown in UTC, matching the editor inputs, and marked "UTC";
 * `civil` game-clock values are shown exactly as stored, without a zone.
 */
export function formatBuildDate(value:string|number,kind:'instant'|'civil',withTime=true):string {
  const date=typeof value==='number'?new Date(value):new Date(kind==='civil'?value.replace(/(\.\d+)?Z?$/,'Z'):value);
  if(!Number.isFinite(date.getTime()))return String(value);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).formatToParts(date).map(part=>[part.type,part.value]));
  const day=`${parts.day}.${parts.month}.${parts.year}`;
  return withTime?`${day} ${parts.hour}:${parts.minute}${kind==='instant'?' UTC':''}`:day;
}
