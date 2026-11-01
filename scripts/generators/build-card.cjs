// Review-only design fixture. Game identities/media come from generated catalogs;
// every loadout value is synthetic and is not a game calculation.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const pub = sitePaths.publicDir;
const pageMode = process.argv.includes('--page') || process.env.BUILD_PAGE_DATA === '1';
const catalog = JSON.parse(fs.readFileSync(path.join(pub, 'tools/data/catalog.json')));
const reference = JSON.parse(fs.readFileSync(path.join(pub, 'game-data/build-reference.json')));
const {getBuildTitanProjection}=require('../../packages/game-domain/src/build/stats.ts');
const {combinations,percentOfMaximum} = require('../lib/roll-analysis.cjs');
const legacy = sitePaths.legacyDir;
const sandbox = {};
require('node:vm').runInNewContext(fs.readFileSync(path.join(legacy, 'tools/build/js/build-runtime.js'), 'utf8'), sandbox);
const runtime = sandbox.TofBuild;
const gearPage = fs.readFileSync(path.join(legacy, 'info/tools/gear-compare/index.html'), 'utf8');
const gearIcons = new Map([...gearPage.matchAll(/data-slot="([^"]+)"[\s\S]*?<img src="([^"]+)"/g)].map(m => [m[1], m[2]]));
const enhancement = JSON.parse(fs.readFileSync(path.join(legacy,'datamine2/gear/data/enhancement.json')));
function asset(url) {
  if (!url) return '';
  const candidates = [path.join(pub, url), path.join(pub, url.replace('/datamine/shared/media/', '/game-assets/webp/'))];
  const source = candidates.find(p => fs.existsSync(p));
  if (!source) throw new Error(`Missing generated media: ${url}`);
  if (pageMode) return '/'+path.relative(pub,source).replaceAll('\\','/');
  const ext = path.extname(source).slice(1);
  return `data:image/${ext};base64,${fs.readFileSync(source).toString('base64')}`;
}
const statMedia = JSON.parse(fs.readFileSync(path.join(pub,'game-data/build-stat-icons.json')));
const statIcons=Object.fromEntries(Object.entries(statMedia.attributes).map(([id,r])=>[id,asset(r.icon)]));
const elementIcons=Object.fromEntries(Object.entries(statMedia.elements).map(([id,r])=>[id,asset(r.icon)]));
function statIcon(type){
  const id=/Crit/.test(type)?'CritAdded':/HP/.test(type)?'MaxHealth':/Flame Resistance/.test(type)?'FireDefAdded':/Resistance/.test(type)?'ElementDef':/Frost/.test(type)?'IceAtkAdded':/Volt/.test(type)?'ThunderAtkAdded':/Flame/.test(type)?'FireAtkAdded':'CommonAtkAdded';
  return statIcons[id];
}
const ids = ['gefion', 'salidy', 'nemesis-voidpiercer'];
const weapons = ids.map(id => {
  const s = catalog.simulacra.find(s => s.id === id);
  const m = catalog.matrices.find(m => m.id.toLowerCase() === s.matrix_suit_id.toLowerCase());
  return {id:s.id,weaponId:s.weapon_id,name:s.name_en, weapon:s.weapon_name_en, art:asset(s.card), icon:asset(s.weapon_icon), avatar:asset(s.avatar), matrix:m.name_en, matrixIcon:asset(m.icon)};
});
const gear = runtime.GEAR_SLOTS.map((id, i) => {
  const meta = runtime.GEAR_SLOT_META[id];
  const rarePool=reference.titanRare.pools[id] || [];
  const rare=reference.titanRare.items.find(r=>r.id===rarePool[i%rarePool.length]);
  const legacySlot = {visor:'eyepiece', core:'combat_engine', reactor:'microreactor'}[id] || id;
  const icon = gearIcons.get(legacySlot);
  if (!icon) throw new Error(`Gear Compare has no icon for ${id}`);
  const upstreamType = {pants:'Legguards',core:'Combat Engine',visor:'Eyepiece',reactor:'Microreactor'}[id] || meta.nameEn;
  const stats = reference.slots[upstreamType];
  if (!stats) throw new Error(`Unknown upstream gear type ${upstreamType}`);
  // Synthetic layout fixtures: stat kinds are checked against the materialized contract.
  const rows = id === 'visor'
    ? [['Frost Attack %','Атака холодом','4,82%',3],['Crit Rate %','Шанс крита','2,16%',1],['Frost Attack','Атака холодом','1 284',1],['HP','ОЗ','18 420',0]]
    : meta.isVera
      ? [['Frost Damage %','Урон холодом','4,82%',3],['Frost Attack','Атака холодом','1 284',1],['Volt Damage %','Урон электро','2,16%',1],['HP','ОЗ','18 420',0]]
      : [['Frost Attack','Атака холодом',String(1084+i*37),3],['Attack','Атака',String(426+i*13),1],['gloves','boots'].includes(id)?['Crit','Крит','3 284',1]:['HP','ОЗ','14 820',1],['Flame Resistance','Сопр. огню','842',0]];
  if (rows.length !== reference.limits.maxNumOfRandomStats || rows.some(row => !stats.randomStats.includes(row[0]))) throw new Error(`Invalid fixture stat kinds for ${id}`);
  const formatStat = (value,type) => type.isPercentageBased
    ? (value*100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'
    : Math.round(value).toLocaleString('ru-RU');
  // Coherent synthetic SSR histories; percentages and bounds are generated upstream data.
  const analyzedRows = rows.map((row,j)=>{
    const type = reference.statTypes[row[0]];
    const maximum = type.randomStatDefaultValue + row[3]*type.randomStatMaxRollValue;
    const strength = [0.94-i*0.008,0.88,0.83,1][j];
    const beforeTitan = type.isPercentageBased || !row[3] ? maximum : Math.round(maximum*strength);
    const augmentIncrease = (beforeTitan*type.maxAugmentIncreaseMultiplier+type.maxAugmentIncreaseFlat)*0.85;
    return {type:row[0],icon:statIcon(row[0]),label:row[1],value:formatStat(beforeTitan+augmentIncrease,type),beforeTitan,
      quality:percentOfMaximum(beforeTitan,row[3],type),rolls:row[3],
      detail:row[3] ? `До Titan: ${formatStat(beforeTitan,type)} / ${formatStat(maximum,type)} · ${row[3]} прок(а). Начальный стат включён; усиление Titan исключено.` : 'Начальный стат: проков нет. Процент не применяется.'};
  });
  const projection=getBuildTitanProjection(analyzedRows,reference.statTypes,reference.titanGrowth,0);
  analyzedRows.forEach((row,i)=>{row.titanMaximum=projection.random[i];});
  const possibilities = combinations(analyzedRows,reference.statTypes,5,reference.limits.maxNumOfRandomStatRolls);
  if (possibilities.length !== 1 || possibilities[0].some((n,j)=>n!==rows[j][3])) throw new Error(`Ambiguous or invalid synthetic SSR history: ${id}`);
  const augments = id === 'visor' ? [['Атака электро','4,58%'],['Атака огнём','4,58%']]
    : meta.isVera ? [['Урон электро','4,58%'],['Урон огнём','4,58%']]
      : [['Атака электро',String(1010+i*35)],['Атака огнём',String(1010+i*35)]];
  // These fixtures have a known, unique three-roll primary elemental stat.
  const primary=analyzedRows[0];
  if(primary.rolls!==3 || analyzedRows.slice(1).some(r=>r.rolls>=primary.rolls))throw new Error('Preview highest stat is not uniquely known');
  // Same rule as game-domain getBuildTitanProjection: a share of the primary's rolls after Titan in the added stat's range.
  const augmentType=reference.statTypes[primary.type];
  const augmentMaximum=augmentType.randomStatDefaultValue+(reference.titanGrowth.addedStatShare??1)*(primary.titanMaximum-augmentType.randomStatDefaultValue);
  augments.forEach((r,i)=>{
    const percentage=r[1].includes('%');
    const sample=augmentMaximum*[0.89,0.92][i];
    r[1]=percentage ? (sample*100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : Math.floor(sample).toLocaleString('ru-RU');
    r.push(statIcons[i===0?'ThunderAtkAdded':'FireAtkAdded']);
    r.push(augmentMaximum);
  });
  if (augments.length !== reference.limits.maxNumOfAugmentStats) throw new Error('Invalid augmentation fixture count');
  const enhancementSlot = enhancement.slots.find(s => s.name_en === (id === 'pants' ? 'Leggings' : meta.nameEn));
  if (!enhancementSlot) throw new Error(`Missing base stat metadata for ${id}`);
  const baseStats = enhancementSlot.main_stats.map(stat=>({label:({ATK:'АТК',HP:'ОЗ',Crit:'Крит',Resistance:'Сопр.'})[stat],value:({ATK:'312',HP:'18 600',Crit:'258',Resistance:'842'})[stat]}));
  return {id, name:meta.nameRu, icon:asset(icon), rareIcon:rare ? statIcons[rare.id] : null,rareId:rare?.id || null,rare:rare?.nameRu || 'Редкий стат: не задан', rareLevel:rare ? 1+i%3 : null, vera:meta.isVera, rows:analyzedRows,augments,baseStats};
});
const relics = catalog.relics.slice(0,2).map(r => ({name:r.name_en,icon:asset(r.icon),quality:r.quality,rank:5}));
const petsData = JSON.parse(fs.readFileSync(path.join(pub,'game-data/en/pets.json')));
const pet = petsData.items.find(p=>p.id === 'FightPet_12');
if (!pet) throw new Error('Missing preview pet FightPet_12');
const petKeys = [pet.id,pet.name,pet.name_en,pet.name_ru].filter(Boolean).map(s=>s.toLowerCase().trim());
const compatibleModules = petsData.module_families.filter(m=>{
  const owners=[m.owner_id,m.owner,m.owner_en,m.owner_ru].filter(Boolean).map(s=>s.toLowerCase().trim());
  return owners.length === 0 || owners.some(o=>petKeys.includes(o));
});
// Preview loadout only: show the four-module layout, not an imported build.
const petModules = compatibleModules.slice(0,4).map(m=>({name:m.name_en || m.name,icon:asset(m.icon)}));
const petStars = Math.max(0,...pet.stars.map(s=>Number(s.star)));
const computing = JSON.parse(fs.readFileSync(path.join(pub,'game-data/supercomputing.json')));
// Synthetic levels for presentation, taken from the user's screenshot example.
const computingLevels = [6,7,12,10];
const supercomputing = computing.nodes.map((n,i)=>({label:n.label_ru,icon:asset(n.icon),level:computingLevels[i]}));
// Preview composition: keep each icon paired with its level when reordering.
[supercomputing[2],supercomputing[3]] = [supercomputing[3],supercomputing[2]];
const supportData = JSON.parse(fs.readFileSync(path.join(pub,'game-data/space-support.json')));
const {selectSupportSystem}=require('../lib/build-support-level.cjs');
// Synthetic preview levels, including unlevelled chips. Never infer a player's levels.
const supportModules=supportData.modules.map((m,i)=>({id:m.id,name:m.name_ru,base:m.base,icon:asset(m.icon),level:Math.min([1,0,3,0,5,4,2,0][i%8],m.maxLevel)}));
const supportSystem = selectSupportSystem(supportData.systemLevels,supportModules);
const finalSupportSystem=[...supportData.systemLevels].sort((a,b)=>a.maxModuleLevel-b.maxModuleLevel).at(-1);
const spaceSupport = {name:supportSystem.name_ru,cap:supportSystem.maxModuleLevel,maxCap:finalSupportSystem.maxModuleLevel,icon:asset(supportSystem.icon),modules:supportModules,
  unlockHint:{en:`All modules at Lv. ${finalSupportSystem.needAllModuleLevel} unlock Lv. ${finalSupportSystem.maxModuleLevel} for every module.`,ru:`Все модули уровня ${finalSupportSystem.needAllModuleLevel} открывают прокачку каждого до уровня ${finalSupportSystem.maxModuleLevel}.`}};
const combat = {level:100,enemyLevel:90,hp:1248600,crit:19840,additionalCritRate:0.124,critDamage:.5,resistanceConstants:reference.resistanceFormula.constants,denominators:reference.critFormula.denominators};
combat.denominator=reference.critFormula.denominators[combat.enemyLevel];
if(!combat.denominator)throw new Error('Missing raw crit formula for preview level');
combat.baseCritRate=combat.crit/combat.denominator;
combat.totalCritRate=combat.baseCritRate+combat.additionalCritRate;
const traitSim = catalog.simulacra.find(s=>s.id===ids[0]);
const trait = {name:traitSim.name_en,icon:asset(reference.traitIcons[traitSim.id]),description:traitSim.trait_desc_en};
if(!trait.icon)throw new Error('Missing canonical Comp trait icon');
// User-authored preview composition; sample synthesis stages are not imported.
const synthesis=['lin','fiona'].map((id,i)=>{
  const sim=catalog.simulacra.find(s=>s.id===id);
  if(!sim)throw new Error('Missing synthesis preview catalog entry '+id);
  const stage=[3,6][i];
  if(stage<0 || stage>reference.synthesisPreview.maxStage)throw new Error('Invalid synthesis preview stage');
  return {id,name:sim.name_en,icon:asset(sim.weapon_icon),stage};
});
const titanTotals=reference.titanRare.items.map(r=>({id:r.id,name:r.nameRu,level:gear.filter(g=>g.rareId===r.id).reduce((sum,g)=>sum+(g.rareLevel||0),0)})).filter(r=>r.level>0).sort((a,b)=>b.level-a.level);
const markMedia=JSON.parse(fs.readFileSync(path.join(pub,'game-data/build-weapon-marks.json')));
// User-authored preview: mark the first weapon. Presence in the loadout is derived.
const nanYinMark={...markMedia.nanYin,icon:asset(markMedia.nanYin.icon),selectedWeaponId:weapons[0].weaponId};
// Roll summary: random stats only, before Titan; main and added stats are excluded.
const parseStat=value=>Number(value.replace(/[\s\u00a0]/g,'').replace('%','').replace(',','.'))/(value.includes('%')?100:1);
const gearStatTotals=[];
function addStat(type,label,value,row){
  let total=gearStatTotals.find(s=>s.type===type);
  if(!total){total={type,label,icon:statIcon(type),value:0,rolls:0,beforeTitan:0,maximum:0,percentage:type.includes('%')};gearStatTotals.push(total);}
  total.value+=parseStat(value);
  if(row){total.rolls+=row.rolls;total.beforeTitan+=row.beforeTitan;const bounds=reference.statTypes[type];total.maximum+=bounds.randomStatDefaultValue+row.rolls*bounds.randomStatMaxRollValue;}
}
for(const g of gear){
  g.rows.forEach(r=>{
    const type=reference.statTypes[r.type];
    const value=type.isPercentageBased ? String(r.beforeTitan*100)+'%' : String(r.beforeTitan);
    addStat(r.type,r.label,value,r);
  });
}
for(const s of gearStatTotals){s.quality=s.rolls ? s.beforeTitan/s.maximum*100 : null;}
// Presentation order: crit, attack pairs, damage pairs, HP, resistance.
const summaryGroup=type=>/Crit/.test(type)?0:/Attack/.test(type)?1:/Damage/.test(type)?2:/HP/.test(type)?3:4;
const summaryElement=type=>['Frost','Volt','Flame','Physical','Altered'].findIndex(e=>type.startsWith(e));
gearStatTotals.sort((a,b)=>summaryGroup(a.type)-summaryGroup(b.type)
  || summaryElement(a.type)-summaryElement(b.type)
  || Number(a.percentage)-Number(b.percentage)
  || a.type.localeCompare(b.type));
const longestSim=[...catalog.simulacra].filter(s=>s.weapon_name_en&&s.weapon_icon).sort((a,b)=>b.weapon_name_en.length-a.weapon_name_en.length)[0];
const longestMatrix=[...catalog.matrices].filter(m=>m.name_en&&m.icon).sort((a,b)=>b.name_en.length-a.name_en.length)[0];
const longNames={name:longestSim.name_en,weapon:longestSim.weapon_name_en,id:longestSim.id,weaponId:longestSim.weapon_id,icon:asset(longestSim.weapon_icon),matrix:longestMatrix.name_en,matrixIcon:asset(longestMatrix.icon)};
const data = {longNames,gearStatTotals,nanYinMark,statIcons,elementIcons,weapons, gear, relics, supercomputing, spaceSupport, combat,trait,synthesis,synthesisMaxStage:reference.synthesisPreview.maxStage,titanTotals, pet:{name:pet.name_en,icon:asset(pet.icon),stars:petStars,modules:petModules}};
const englishLabels = {
  'Атака холодом':'Frost ATK','Атака электро':'Volt ATK','Атака огнём':'Flame ATK',
  'Урон холодом':'Frost DMG','Урон электро':'Volt DMG','Урон огнём':'Flame DMG',
  'Шанс крита':'Crit rate','Атака':'ATK','Крит':'Crit','ОЗ':'HP','АТК':'ATK','Сопр.':'RES','Сопр. огню':'Flame RES',
  'Редкий стат: не задан':'Rare stat unavailable',
};
for (const meta of Object.values(runtime.GEAR_SLOT_META)) englishLabels[meta.nameRu]=meta.nameEn;
for (const rare of Object.values(runtime.TITAN_RARE_STAT_REGISTRY)) englishLabels[rare.nameRu]=rare.nameEn;
for (const rare of reference.titanRare.items) englishLabels[rare.nameRu]=rare.nameEn;
for (const m of supportData.modules) englishLabels[m.name_ru]=m.name_en;
englishLabels[supportSystem.name_ru]=supportSystem.name_en;
for (const n of computing.nodes) englishLabels[n.label_ru]=n.label_en;
for (const m of compatibleModules) if(m.name_ru) englishLabels[m.name_ru]=m.name_en || m.name;
function english(value) {
  if (Array.isArray(value)) return value.map(english);
  if (value && typeof value==='object') {
    const result=Object.fromEntries(Object.entries(value).map(([key,v])=>[key,english(v)]));
    if (value===data.trait) result.description=traitSim.trait_desc_en;
    if ('beforeTitan' in value) {
      const type=reference.statTypes[value.type];
      const format=n=>type.isPercentageBased ? (n*100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : Math.round(n).toLocaleString('en-US');
      result.detail=value.rolls ? `Before Titan: ${format(value.beforeTitan)} / ${format(type.randomStatDefaultValue+value.rolls*type.randomStatMaxRollValue)} · ${value.rolls} rolls. Initial stat included; Titan increase excluded.` : 'Initial stat: no rolls. Percentage does not apply.';
    }
    return result;
  }
  if(typeof value!=='string' || value.startsWith('data:')) return value;
  return englishLabels[value] || (/^[\d\s\u00a0]+(?:,\d+)?%?$/.test(value) ? value.replaceAll('\u00a0',',').replace(/(\d),(\d+)%$/,'$1.$2%') : value);
}
const englishData=english(data);
data.trait.description=traitSim.trait_desc_ru;
if (pageMode) {
  require('./build-page-catalog.cjs')({pub,catalog,reference,runtime,gearIcons,petsData,computing,supportData,statMedia,markMedia,fixtures:{en:englishData,ru:data}}).catch(error=>{console.error(error);process.exitCode=1;});
} else {
// The review mockup is repository-only; the page catalog above is what the pipeline needs.
const template = fs.readFileSync(path.join(root, 'docs/tools/build/mockup/template.html'), 'utf8');
const html = template.replace('/* FIXTURE */', JSON.stringify({en:englishData,ru:data}))
  .replace('/* LABELS */',JSON.stringify(require('../lib/build-labels.cjs')));
fs.writeFileSync(path.join(root, 'docs/tools/build/mockup/index.html'), html);
const publicMockup = path.join(pub, 'tools/build/mockup');
fs.mkdirSync(publicMockup, {recursive:true});
fs.writeFileSync(path.join(publicMockup, 'index.html'), html);
console.log('Created self-contained mockup: '+path.join(root, 'docs/tools/build/mockup/index.html'));

}
