/**
 * Stat reading from OCR text of a gear screenshot (2026-10-10). The line logic follows the open-source tof-tools importer
 * (apache1123/tof-tools, MIT: get-stats-from-gear-card-ocr / get-stats-from-augment-screen-ocr), adapted to this
 * catalog: candidate stat types and their names come from the generated stat types, nothing is hardcoded here.
 * Pure functions: the recognised text never leaves the browser.
 */
export interface OcrStatCandidate {type:string;percent:boolean}
export interface OcrStat {type:string;value:number|undefined}

const ABBREVIATIONS:[RegExp,string][]=[[/Attack/g,'ATK'],[/Damage/g,'DMG'],[/Resistance/g,'RES'],[/Crit Rate/g,'CR']];

/** Names a stat may have on screen: catalog name and the in-game abbreviations (ATK, DMG, RES, CR), without a trailing %. */
export function statAliases(type:string):string[] {
  const base=type.replace(/\s*%$/,'');
  const abbreviated=ABBREVIATIONS.reduce((name,[pattern,short])=>name.replace(pattern,short),base);
  const partial=ABBREVIATIONS.map(([pattern,short])=>base.replace(pattern,short));
  return [...new Set([base,abbreviated,...partial])].filter(Boolean).sort((a,b)=>b.length-a.length);
}

const normalize=(line:string)=>line.replace(/\s+/g,' ').trim();
const lines=(text:string)=>text.split(/\r?\n/).map(normalize).filter(Boolean);
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** `+4,125` and `+7.8%` (comma thousands, point decimals) → number; percentages become fractions. */
export function parseOcrNumber(word:string):number|undefined {
  const percent=word.includes('%');
  const cleaned=word.replace(/[^0-9.+-]/g,'').replace(/^\+/,'');
  if(!/\d/.test(cleaned))return undefined;
  const value=Number(cleaned);
  if(!Number.isFinite(value))return undefined;
  // Rounded so 5.937% is exactly 0.05937, not a binary-float neighbour.
  return percent?Number((value/100).toFixed(8)):value;
}

/** Longest alias of a candidate that occurs in the line (case-insensitive, on word edges) with its end position. */
function findAlias(line:string,candidate:OcrStatCandidate) {
  for(const alias of statAliases(candidate.type)) {
    const match=new RegExp(`(?:^|[^A-Za-z])(${escapeRegExp(alias)})(?![A-Za-z])`,'i').exec(line);
    if(match)return {alias,end:match.index+match[0].length};
  }
  return null;
}

/** Gear card: "Stat name +value" on one line. Percentage and flat variants of one name are told apart by the % sign. */
export function parseGearCardText(text:string,candidates:readonly OcrStatCandidate[],maxStats:number):OcrStat[] {
  const results:OcrStat[]=[];
  for(const line of lines(text)) {
    if(results.length>=maxStats)break;
    let best:{candidate:OcrStatCandidate;aliasLength:number;value:number}|null=null;
    for(const candidate of candidates) {
      if(results.some(result=>result.type===candidate.type))continue;
      const found=findAlias(line,candidate);
      if(!found)continue;
      const after=line.slice(found.end);
      const word=/[+-]?\s*\d[\d,]*(?:\.\d+)?\s*%?/.exec(after)?.[0];
      if(!word)continue;
      if(word.includes('%')!==candidate.percent)continue;
      const value=parseOcrNumber(word);
      if(value===undefined)continue;
      // The longest name wins: "Physical ATK" over "ATK" on the same line.
      if(!best||found.alias.length>best.aliasLength)best={candidate,aliasLength:found.alias.length,value};
    }
    if(best)results.push({type:best.candidate.type,value:best.value});
  }
  return results;
}

/** Augmentation screen: the stat name on one line, its value on a following line (possibly noisy). */
export function parseAugmentScreenText(text:string,candidates:readonly OcrStatCandidate[],maxStats:number):OcrStat[] {
  const results:OcrStat[]=[];
  let pending:OcrStatCandidate|undefined;
  const sameName=(a:string,b:string)=>a.replace(/\s*%$/,'')===b.replace(/\s*%$/,'');
  const match=(line:string)=>{
    let best:{candidate:OcrStatCandidate;length:number}|undefined;
    for(const candidate of candidates) {
      if(results.some(result=>result.type===candidate.type))continue;
      const found=findAlias(line,candidate);
      if(found&&(!best||found.alias.length>best.length))best={candidate,length:found.alias.length};
    }
    return best?.candidate;
  };
  for(const line of lines(text)) {
    if(results.length>=maxStats)break;
    const matched=match(line);
    if(matched) {
      if(pending)results.push({type:pending.type,value:undefined});
      pending=matched;
      continue;
    }
    if(!pending)continue;
    const word=line.replace(/ /g,'').replace(/[^0-9.%+-]/g,'');
    let target=pending;
    if(word.includes('%')!==target.percent) {
      // The name is shared by the flat and % variants: switch to the counterpart that fits the sign.
      const counterpart=candidates.find(candidate=>candidate.percent===word.includes('%')&&sameName(candidate.type,target.type)&&!results.some(result=>result.type===candidate.type));
      if(!counterpart)continue;
      target=counterpart;
    }
    const value=parseOcrNumber(word);
    if(value===undefined)continue;
    results.push({type:target.type,value});
    pending=undefined;
  }
  if(pending&&results.length<maxStats)results.push({type:pending.type,value:undefined});
  return results;
}

export interface OcrRareCandidate {id:string;names:string[]}
export interface OcrGearCard {
  /** Header line without the trailing enhancement level, e.g. "Titan Handguards". */
  name?:string;enhancement?:number;
  random:OcrStat[];augments:OcrStat[];
  rare?:{id:string;level:number};
}

/**
 * A whole in-game gear card (the screenshot of "Random Stats" + "Augmentation Stats" + the Titan rare line). The text
 * is split at the section headings; without headings the whole text is read as random stats (a cropped screenshot).
 */
export function parseGearCard(text:string,options:{random:readonly OcrStatCandidate[];augment:readonly OcrStatCandidate[];rare:readonly OcrRareCandidate[];maxRandom:number;maxAugment:number}):OcrGearCard {
  const all=lines(text);
  const randomAt=all.findIndex(line=>/random\s*stats/i.test(line));
  const augmentAt=all.findIndex(line=>/augment(?:ation)?\s*stats/i.test(line));
  const header=randomAt>0?all.slice(0,randomAt):[];
  const randomLines=all.slice(randomAt>=0?randomAt+1:0,augmentAt>=0?augmentAt:undefined);
  const augmentLines=augmentAt>=0?all.slice(augmentAt+1):[];
  const result:OcrGearCard={random:parseGearCardText(randomLines.join('\n'),options.random,options.maxRandom),augments:[]};
  const title=header.find(line=>/[A-Za-z]{3}/.test(line));
  if(title) {
    const level=/(\d{1,3})\s*$/.exec(title);
    result.name=title.replace(/\s*\d{1,3}\s*$/,'').trim();
    if(level)result.enhancement=Number(level[1]);
  }
  // The Titan rare line sits between the headings of the augmentation block: "<effect> Damage Boost +3".
  for(const line of augmentLines) {
    const rare=options.rare.find(item=>item.names.some(name=>name&&new RegExp(`(?:^|[^A-Za-z])${escapeRegExp(name)}(?![A-Za-z])`,'i').test(line)));
    if(!rare)continue;
    const level=/\+\s*(\d+)\s*$/.exec(line);
    result.rare={id:rare.id,level:level?Number(level[1]):0};
    break;
  }
  const statLines=augmentLines.filter(line=>!result.rare||!options.rare.find(item=>item.id===result.rare!.id)?.names.some(name=>name&&line.toLowerCase().includes(name.toLowerCase())));
  result.augments=parseGearCardText(statLines.join('\n'),options.augment,options.maxAugment);
  return result;
}
