/**
 * Reads OCR text of the in-game damage table. Rows satisfy Base DMG × DMG Boost Multiplier ≈ Final DMG and the five
 * categories sum to Total, which lets a misplaced decimal point be repaired and anything else be flagged for the
 * player. The column order was stated from screenshots (Base, Final, Multiplier), see docs/tools/titan-calculator.md.
 */
import {DAMAGE_CATEGORIES,NO_TITAN,TITAN_STATS,TITAN_STAT_KEYS,type DamageCategory,type TitanLevels} from './model';

const UNITS:Record<string,number>={k:1e3,m:1e6,g:1e9};
const ROW_TOLERANCE=.015;
const TOTAL_TOLERANCE=.005;

/** `490.2m` → 490200000. Null for anything that is not a damage value. */
export function parseDamageValue(raw:string):number|null {
  const match=/^(\d[\d,.]*)\s*([kmg])?$/i.exec(raw.trim().replace(/г/gi,'g'));
  if(!match)return null;
  const digits=match[1]!;
  const grouped=/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits);
  const normalized=grouped&&(!match[2]||digits.includes('.')||digits.split(',').length>2)
    ?digits.replace(/,/g,'')
    :digits.replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(normalized))return null;
  const value=Number(normalized)*(match[2]?UNITS[match[2].toLowerCase()]!:1);
  return Number.isFinite(value)?value:null;
}

/** Compact text in the table's own units, so a parsed value can be edited as seen in the game. */
export function formatDamageValue(value:number, digits=4):string {
  const trim=(number:number)=>String(Number(number.toPrecision(digits)));
  if(value>=1e9)return `${trim(value/1e9)}g`;
  if(value>=1e6)return `${trim(value/1e6)}m`;
  if(value>=1e3)return `${trim(value/1e3)}k`;
  return trim(value);
}

export type RowStatus='ok'|'corrected'|'check';
export interface ParsedRow {base:number|null;multiplier:number|null;final:number|null;expected:number|null;status:RowStatus;checkedByTotal?:true}
export interface DamageReport {
  total: number | null;
  othersShare: number | null;
  weapons: { name: string; share: number | null }[];
  selected: number | null;
}
export interface ParsedTable {rows:Partial<Record<DamageCategory,ParsedRow>>;total:number|null;totalRow:ParsedRow|null}

const LABELS:[DamageCategory|'total',RegExp][]=[
  ['normal',/norm\w*|обыч\w*/i],['dodge',/dodg\w*|уклон\w*/i],['discharge',/disch\w*|разряд\w*/i],
  ['passive',/passi\w*|пассив\w*/i],['skill',/skil\w*|навык\w*/i],['total',/\btotal\b|итог\w*|всего/i],
];
const ROW_ORDER=[...DAMAGE_CATEGORIES,'total'] as const;
const TOKEN=/\d[\d,]*(?:\.\d+)?(?:['’](?=[kmg]))?\s*[kmg]?(?![a-z\d])/gi;
/** The screen's summary line (Basic, Final, Multiplier) above the table is not a table row. */
const SUMMARY_LINE=/total\s*dmg/i;

function lineTokens(text:string) {
  const cleaned=text.replace(/\d[\d.,]*\s*%/g,' ').replace(/\d+:\d+/g,' ').replace(/\b[Oo]\b/g,'0').replace(/(\d)\.\s+(\d)/g,'$1.$2').replace(/(\d)г/gi,'$1g');
  return (cleaned.match(TOKEN)??[]).map(token=>token.replace(/\s+/g,''));
}

const hasUnit=(token:string|undefined)=>Boolean(token&&/[kmg]$/i.test(token));
interface Tokens {base:string|undefined;final:string|undefined;multiplier:string|undefined}
function columns(tokens:string[]):Tokens {
  // A point read as a space splits Final in two: `18 29`.
  if(tokens.length===4&&!hasUnit(tokens[1])&&!tokens[1]!.includes('.')&&!tokens[2]!.includes('.'))return {base:tokens[0],final:`${tokens[1]}.${tokens[2]}`,multiplier:tokens[3]};
  // The multiplier is the unitless column; a different on-screen order is still read correctly.
  if(tokens.length>=3&&hasUnit(tokens[2])&&!hasUnit(tokens[1]))return {base:tokens[0],multiplier:tokens[1],final:tokens[2]};
  return {base:tokens[0],final:tokens[1],multiplier:tokens[2]};
}

const DECIMAL_SHIFTS=[1,10,100,1000,.1,.01,.001];
const UNIT_SCALES=[1,1e3,1e6,1e9];

/** Values a misread Final cell may have meant: a moved point, a lost unit, or `g` read as a trailing 9. */
function finalCandidates(token:string|undefined,final:number|null) {
  if(token===undefined||final===null)return [];
  // A complete value such as 685.1m is never moved to fit the row: a misread Base or Multiplier is as likely.
  if(hasUnit(token)&&token.includes('.'))return [];
  const shifted=DECIMAL_SHIFTS.map(scale=>final*scale);
  if(hasUnit(token))return shifted;
  const withoutNine=/\d9$|\.9$/.test(token)?parseDamageValue(token.slice(0,-1).replace(/\.$/,'')):null;
  return [...(withoutNine===null?[]:[withoutNine*UNITS.g!]),...UNIT_SCALES.map(scale=>final*scale),...shifted];
}

function readRow(tokens:string[]):ParsedRow {
  if(tokens.every(token=>Number(token)===0))return {base:0,multiplier:0,final:0,expected:0,status:'ok'};
  const cells=columns(tokens);
  const value=(token:string|undefined)=>token===undefined?null:parseDamageValue(token);
  const base=value(cells.base);
  // The column always shows two decimals, so four digits without a point mean the point was lost: 7788 is 77.88.
  const readMultiplier=value(cells.multiplier);
  const multiplier=readMultiplier!==null&&readMultiplier>=1000&&!cells.multiplier!.includes('.')?readMultiplier/100:readMultiplier;
  const glyphRepair=cells.final?.replace(/['’](?=[kmg]$)/i,'1');
  const final=tokens.length===1?base:value(glyphRepair);
  const expected=base!==null&&multiplier!==null?base*multiplier:null;
  if(expected===null||expected===0)return {base,multiplier,final,expected,status:expected===0&&final===0?'ok':'check'};
  const fits=(candidate:number,target:number)=>Math.abs(candidate/target-1)<=ROW_TOLERANCE;
  if(final!==null&&fits(final,expected))return {base,multiplier,final,expected,status:glyphRepair===cells.final?'ok':'corrected'};
  // Each cell can be misread on its own, so the row's product decides which reading is consistent.
  const finals=finalCandidates(cells.final,final);
  for(const baseScale of hasUnit(cells.base)?[1]:UNIT_SCALES) {
    const repairedBase=base!*baseScale,target=repairedBase*multiplier!;
    const match=finals.filter(candidate=>fits(candidate,target)).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
    if(match!==undefined)return {base:repairedBase,multiplier,final:match,expected:target,status:'corrected'};
  }
  if(final===null)return {base,multiplier,final:expected,expected,status:'corrected'};
  return {base,multiplier,final,expected,status:'check'};
}

/** Total checks the Final column as a whole, which can settle rows their own product could not. */
function reconcileWithTotal(table:ParsedTable) {
  const present=Object.values(table.rows);
  if(table.total===null||present.length<DAMAGE_CATEGORIES.length)return;
  const finals=present.map(row=>row.final??0);
  if(totalMatches(finals,table.total)) {
    for(const row of present)if(row.status==='check'&&row.final!==null){row.status='ok';row.checkedByTotal=true;}
    return;
  }
  const unsure=present.filter(row=>row.status==='check');
  if(unsure.length!==1)return;
  const row=unsure[0]!,implied=table.total-present.reduce((sum,other)=>other===row?sum:sum+(other.final??0),0);
  if(row.expected&&Math.abs(implied/row.expected-1)<=ROW_TOLERANCE){row.final=row.expected;row.status='corrected';}
}

export function parseDamageTable(text:string):ParsedTable {
  const table:ParsedTable={rows:{},total:null,totalRow:null};
  const seen=new Set<string>();
  const assign=(label:DamageCategory|'total',tokens:string[])=>{
    const row=readRow(tokens);
    if(label==='total'){table.total=row.final;table.totalRow=row;}
    else table.rows[label]=row;
    seen.add(label);
  };
  const numeric:{tokens:string[];labelled:boolean}[]=[];
  for(const line of text.split(/\r?\n/)) {
    if(SUMMARY_LINE.test(line))continue;
    const found=LABELS.map(([label,pattern])=>({label,match:pattern.exec(line)})).find(item=>item.match);
    // Numbers left of a label belong to the screen's weapon list.
    const tokens=lineTokens(found?line.slice(found.match!.index+found.match![0].length):line);
    if(found&&tokens.length&&!seen.has(found.label))assign(found.label,tokens);
    if(tokens.length>=2||found&&tokens.length)numeric.push({tokens,labelled:Boolean(found)});
  }
  // A garbled label, such as Cyrillic text under the English model, is placed by its position in the table.
  if(numeric.length>=ROW_ORDER.length) {
    const positioned=numeric.slice(-ROW_ORDER.length);
    ROW_ORDER.forEach((label,index)=>{
      const line=positioned[index]!;
      if(!seen.has(label)&&!line.labelled)assign(label,line.tokens);
    });
  }
  reconcileWithTotal(table);
  return table;
}

const OTHERS=/\bothers?\b|прочее|другие/i;
const SHARE=/(\d{1,3}(?:[.,]\d+)?)\s*%/;

/** Reads the battle-wide header and the sidebar independently of the selected weapon's table. */
export function parseDamageReport(text:string, sidebar='', selected:number|null=null):DamageReport {
  const headline=text.split(/\r?\n/).find(line=>SUMMARY_LINE.test(line));
  const final=headline ? lineTokens(headline.slice(headline.search(SUMMARY_LINE)))[1] : undefined;
  const total=final ? parseDamageValue(/\d9$/.test(final) ? final.slice(0,-1)+'g' : final) : null;
  const report:DamageReport={total:total!==null&&total>=1000?Math.round(total):null,othersShare:null,weapons:[],selected};
  let label='';
  for(const line of (sidebar||text).split(/\r?\n/)) {
    const share=SHARE.exec(line);
    const name=(share?line.slice(0,share.index):line).trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu,'');
    if(name && /\p{L}/u.test(name)) label=LABELS.some(([, pattern])=>pattern.test(name))||SUMMARY_LINE.test(name)?'':name;
    if(!share||!label)continue;
    const fraction=Number(share[1]!.replace(',','.'))/100;
    if(fraction>=0&&fraction<=1) {
      if(OTHERS.test(label))report.othersShare=fraction;
      else if(report.weapons.length<3 && !report.weapons.some(weapon=>weapon.name===label))report.weapons.push({name:label,share:fraction});
    }
    label='';
  }
  if(selected!==null) {
    if(report.weapons.length!==3) {
      const names=sidebar.split(/\r?\n/).map(line=>line.replace(SHARE,'').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu,''))
        .filter(line=>/^\p{L}{2}[\p{L}\p{N} .’'()\-]*$/u.test(line)&&!OTHERS.test(line)&&!SUMMARY_LINE.test(line));
      report.weapons=names.length===3?names.map(name=>({name,share:null})):[];
      report.othersShare=null;
    }
    return report;
  }
  // A complete sidebar accounts for the battle total (allow rounding in the game display).
  if(report.weapons.length!==3 || Math.abs(report.weapons.reduce((sum,weapon)=>sum+(weapon.share??0),0)+(report.othersShare??0)-1)>.015)report.weapons=[];
  return report;
}

export function weaponSlot(report:DamageReport, tableTotal:number|null):number|null {
  if(report.selected!==null)return report.selected<3?report.selected:null;
  if(!tableTotal||!report.total)return null;
  const share=tableTotal/report.total;
  const matches=report.weapons.flatMap((weapon,index)=>weapon.share!==null&&Math.abs(weapon.share-share)<=.006?[index]:[]);
  return matches.length===1?matches[0]!:null;
}

/** Null when there is no Total to compare; otherwise whether the five rows add up to it. */
export function totalMatches(finals:readonly number[],total:number|null) {
  if(total===null||total<=0)return null;
  return Math.abs(finals.reduce((sum,value)=>sum+value,0)/total-1)<=TOTAL_TOLERANCE;
}

const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

type TitanNames=readonly {id:string;name:{en?:string|null;ru?:string|null}}[];
const PANEL_NAMES:Record<keyof TitanLevels,string>={normal:'Normal Attack Damage Boost',dodge:'Dodge Attack Damage Boost',
  skill:'Skill Damage Boost',discharge:'Discharge Damage Boost',dmgBoost:'Damage Boost',weakPoint:'Weak Point Damage Boost'};

/** The game's stat panel shows the level on a new line beneath the label. */
export function readTitanLevels(text:string,names:TitanNames):Partial<TitanLevels> {
  const levels:Partial<TitanLevels>={};
  for(const stat of TITAN_STAT_KEYS) {
    const item=names.find(entry=>entry.id===TITAN_STATS[stat]);
    for(const name of new Set([PANEL_NAMES[stat],item?.name.en,item?.name.ru])) {
      if(!name)continue;
      const pattern=escapeRegExp(name);
      const prefix=stat==='dmgBoost'?'(?:^|\\n)[ \\t|’\'"]*':'';
      const match=new RegExp(`${prefix}${pattern}[ \\t:]*\\+?[ \\t]*(\\d{1,2})(?![\\d.,%])`,'i').exec(text)
        ?? new RegExp(`${prefix}${pattern}[ \\t:|’\'".-]*(?:\\r?\\n[ \\t|]*)+\\+?(\\d{1,2})(?![\\d.,%])`,'i').exec(text);
      if(match){levels[stat]=Number(match[1]);break;}
    }
  }
  return levels;
}

/** Website captures can OCR as a strip of labels followed by their input values. */
export function readTitanLevelStrip(text:string,names:TitanNames):Partial<TitanLevels> {
  const labels=TITAN_STAT_KEYS.map(stat=>{
    const name=names.find(item=>item.id===TITAN_STATS[stat])?.name;
    return [stat,[name?.en,name?.ru].filter(Boolean)] as const;
  });
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  for(const [index,line] of lines.entries()) {
    const starts=labels.map(([stat,aliases])=>({stat,position:Math.min(...aliases.map(alias=>line.toLocaleLowerCase().indexOf(alias!.toLocaleLowerCase())).filter(position=>position>=0))}));
    if(starts.some(({position})=>!Number.isFinite(position)))continue;
    const values=(lines[index+1]??'').replace(/\+?\d+(?:[.,]\d+)?\s*%/g,'').match(/\b\d{1,2}\b/g);
    if(values?.length!==TITAN_STAT_KEYS.length)continue;
    return Object.fromEntries(starts.sort((a,b)=>a.position-b.position).map(({stat},position)=>[stat,Number(values[position])]));
  }
  return {};
}

/** A compact list can omit zeroes. The two-column game panel requires all six numbers. */
export function parseTitanLevels(text:string,names:TitanNames):TitanLevels|null {
  const levels={...readTitanLevels(text,names),...readTitanLevelStrip(text,names)};
  return Object.keys(levels).length?{...NO_TITAN,...levels}:null;
}

/** Bright table text on a busy translucent backdrop becomes dark text on white before reading. */
export async function prepareTableImage(file:File, threshold:number|null=150):Promise<File> {
  try {
    const bitmap=await createImageBitmap(file);
    // Game screenshots are often small; about 1600 px across reads best.
    const scale=Math.max(1,Math.min(3,1600/Math.max(bitmap.width,bitmap.height)));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context){bitmap.close();return file;}
    context.imageSmoothingQuality='high';
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    if(threshold!==null) {
      const image=context.getImageData(0,0,canvas.width,canvas.height),pixels=image.data;
      for(let index=0;index<pixels.length;index+=4) {
        const light=.299*pixels[index]!+.587*pixels[index+1]!+.114*pixels[index+2]!;
        pixels[index]=pixels[index+1]=pixels[index+2]=light>=threshold?0:255;
      }
      context.putImageData(image,0,0);
    }
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
    return blob?new File([blob],'parse.png',{type:'image/png'}):file;
  } catch {
    return file;
  }
}

/** The stat screen has two dark-text columns over translucent blue artwork. */
export async function prepareTitanPanel(file:File):Promise<File|null> {
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(3,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    const width=Math.round(bitmap.width*.45*scale),height=Math.round(bitmap.height*scale),gap=32;
    canvas.width=width+2*gap;canvas.height=height*2+3*gap;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return null;
    context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
    context.imageSmoothingQuality='high';
    for(const [column,left,right,bottom] of [[0,.11,.55,1],[1,.619,1,.57]] as const) {
      const top=gap+column*(height+gap),widthPx=Math.round((right-left)*bitmap.width*scale);
      const columnHeight=Math.round(height*bottom);
      context.drawImage(bitmap,bitmap.width*left,0,bitmap.width*(right-left),bitmap.height*bottom,gap,top,widthPx,columnHeight);
      const image=context.getImageData(gap,top,widthPx,columnHeight),pixels=image.data;
      // Compare to a local mean of the blue channel so shaded areas keep readable numbers.
      const stride=widthPx+1,sums=new Float64Array(stride*(columnHeight+1));
      for(let y=1;y<=columnHeight;y++) {
        let row=0;
        for(let x=1;x<=widthPx;x++) {
          row+=pixels[((y-1)*widthPx+x-1)*4+2]!;
          sums[y*stride+x]=sums[(y-1)*stride+x]!+row;
        }
      }
      const radius=Math.max(12,Math.round(height*.025));
      for(let y=0;y<columnHeight;y++)for(let x=0;x<widthPx;x++) {
        const left=Math.max(0,x-radius),right=Math.min(widthPx,x+radius+1);
        const top=Math.max(0,y-radius),bottom=Math.min(columnHeight,y+radius+1);
        const mean=(sums[bottom*stride+right]!-sums[top*stride+right]!-sums[bottom*stride+left]!+sums[top*stride+left]!)/((right-left)*(bottom-top));
        const index=(y*widthPx+x)*4;
        pixels[index]=pixels[index+1]=pixels[index+2]=pixels[index+2]!<mean-21?0:255;
      }
      context.putImageData(image,gap,top);
    }
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
    return blob?new File([blob],'titan-panel.png',{type:'image/png'}):null;
  } finally {
    bitmap.close();
  }
}

export async function prepareDamageSidebar(file:File):Promise<{image:File;selected:number|null}|null> {
  const bitmap=await createImageBitmap(file);
  try {
    const width=Math.floor(bitmap.width*.26);
    const scale=Math.min(4,1400/bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return null;
    context.imageSmoothingQuality='high';
    context.drawImage(bitmap,0,0,width,bitmap.height,0,0,canvas.width,canvas.height);
    const {data}=context.getImageData(0,0,canvas.width,canvas.height);
    const brightness=(height:number)=>{
      const y=Math.round(height*(canvas.height-1));
      let sum=0;
      for(const fraction of [.15,.25,.35,.45,.55]) {
        const index=(y*canvas.width+Math.round(fraction*canvas.width))*4;
        sum+=(data[index]!+data[index+1]!+data[index+2]!)/3;
      }
      return sum/5;
    };
    const centers=[.23,.45,.675,.9];
    const panels=centers.map(center=>[-.024,0,.024].reduce((sum,offset)=>sum+brightness(center+offset),0)/3);
    const darkest=panels.indexOf(Math.min(...panels));
    const active=panels[darkest]!;
    const selected=active<105&&panels.every((light,index)=>index===darkest||light>active+40)?darkest:null;
    if(selected!==null) {
      canvas.width=Math.round(bitmap.width*.25*scale);
      canvas.height=Math.round(bitmap.height*.855*scale);
      context.imageSmoothingQuality='high';
      context.drawImage(bitmap,bitmap.width*.015,bitmap.height*.145,bitmap.width*.25,bitmap.height*.855,0,0,canvas.width,canvas.height);
    }
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
    return blob?{image:new File([blob],'damage-sidebar.png',{type:'image/png'}),selected}:null;
  } finally {
    bitmap.close();
  }
}
