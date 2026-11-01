// Materialize the selected upstream gear contract without executing upstream code.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const revision = '52a960e66e6f1d774ec6d5ebf3595f9981e670c9';
const base = `https://raw.githubusercontent.com/apache1123/tof-tools/${revision}/src/definitions/`;
async function source(file) {
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.text();
}
(async () => {
  const [types, constants, definitions, augmentation] = await Promise.all([source('gear-types.ts'), source('gear.ts'), source('stat-types.ts'), source('augmentation-stats.ts')]);
  const statTypes = {};
  for (const match of definitions.matchAll(/\["([^"]+)"\]:\s*\{([\s\S]*?)\n\s*\},/g)) {
    const fields = {};
    for (const key of ['randomStatDefaultValue','randomStatMinRollValue','randomStatMaxRollValue','maxAugmentIncreaseMultiplier','maxAugmentIncreaseFlat']) {
      const value = match[2].match(new RegExp(`${key}:\\s*([\\d.]+)`));
      if (!value) throw new Error(`Missing ${key} for ${match[1]}`);
      fields[key] = Number(value[1]);
    }
    statTypes[match[1]] = {...fields,isPercentageBased:/isPercentageBased:\s*true/.test(match[2])};
  }
  const declaredIds = [...definitions.match(/allIds:\s*\[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  if (!declaredIds.length || declaredIds.some(id=>!statTypes[id]) || Object.keys(statTypes).length !== declaredIds.length) throw new Error('Incomplete upstream stat types');
  const pullUpFactors=[1,2,3].map(i=>{
    const match=constants.match(new RegExp('export const augmentStatsPullUpFactor'+i+' = ([0-9.]+)'));
    if(!match)throw new Error('Missing upstream Titan pull-up factor '+i);
    return Number(match[1]);
  });
  const priorities=Object.fromEntries([...augmentation.matchAll(/\["([^"]+)"\]:\s*\{([\s\S]*?)\n\s*\},/g)].map(match=>[match[1],[...match[2].match(/prioritizedStatTypes:\s*\[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1])]));
  if(declaredIds.some(id=>!priorities[id]))throw new Error('Incomplete augmentation priorities');
  const fallbacks=Object.fromEntries([...augmentation.matchAll(/\["([^"]+)"\]:\s*\{([\s\S]*?)\n\s*\},/g)].map(match=>[match[1],[...match[2].match(/fallbackStatTypes:\s*\[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1])]));
  if(declaredIds.some(id=>!fallbacks[id])||[...Object.values(priorities),...Object.values(fallbacks)].flat().some(id=>!statTypes[id]))throw new Error('Incomplete augmentation pools');
  // Captured Titan pieces disagree with the upstream pools for percent primaries (scripts/data/titan-augment-observations.json):
  // they add flat HP and elemental Resistance, never a
  // percent defence stat, and an elemental Resistance % primary adds no other element's Resistance %.
  const titanObservations=require('../data/titan-augment-observations.json');
  for(const type of Object.keys(fallbacks)) {
    const pool=fallbacks[type];
    if(statTypes[type].isPercentageBased&&pool.length&&pool.every(id=>id==='HP %'||/ Resistance %$/.test(id)))fallbacks[type]=[...titanObservations.percentFallback.types];
    if(/^(Flame|Frost|Physical|Volt) Resistance %$/.test(type))priorities[type]=[...titanObservations.resistancePercentPriority.types];
  }
  const universalAttackElements=Object.keys(priorities).filter(type=>type.endsWith(' Attack')&&priorities[type].some(p=>p.endsWith(' Attack'))).map(type=>type.split(' ')[0]);
  const maxAddedStats=Number(constants.match(/export const maxNumOfAugmentStats = (\d+);/)?.[1]);
  if(!maxAddedStats)throw new Error('Missing upstream augmentation slot count');
  const titanGrowth={pullUpFactors,priorities,fallbacks,maxAddedStats,universalAttackElements,unconfirmedPullUpRanks:[4],source:'src/models/gear/gear.ts#getMaxTitanGear/getPossibleAugmentStats; src/models/gear/augment-stat.ts',corrections:'scripts/data/titan-augment-observations.json',addedStatShare:titanObservations.addedStatShare.max,notes:'Every added stat takes addedStatShare of the primary rolls after Titan in its own range and does not grow (replaces upstream 0.95 × primary for added ATK); pullUpFactors stay for the random-stat pull-up; fourth-element pull-up remains unconfirmed'};
  const slots = {};
  for (const match of types.matchAll(/\["([^"]+)"\]:\s*\{([\s\S]*?)\n\s*\},/g)) {
    const stats = match[2].match(/possibleRandomStatTypeIds:\s*\[([\s\S]*?)\]/);
    if (!stats) continue;
    slots[match[1]] = {randomStats: [...stats[1].matchAll(/"([^"]+)"/g)].map(m => m[1])};
  }
  const limits = {};
  for (const key of ['maxNumOfRandomStatRolls','maxNumOfRandomStats','maxNumOfAugmentStats']) {
    const match = constants.match(new RegExp(`export const ${key} = (\\d+);`));
    if (!match) throw new Error(`Missing ${key}`);
    limits[key] = Number(match[1]);
  }
  if (Object.keys(slots).length !== 12) throw new Error('Expected 12 upstream gear types');
  const critSource = 'Hotta/Content/Resources/Abilities/DataTables/CritFormula.json';
  const rawRoot = sitePaths.rawDir;
  // Titan growth of the Altered stats: upstream gives them 0, the raw Titan table does not (2026-10-08). The flat
  // maximum is the raw level-120 upper bound of TupoAddABSValueMap (it equals upstream for the elemental rows); the
  // multiplier is not in raw and is taken from the Frost counterpart (inference).
  const tupoSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipRandomModifyData_Overseas.json';
  const tupoRows=JSON.parse(fs.readFileSync(path.join(rawRoot,tupoSource),'utf8'))[0].Rows;
  const tupoMax=key=>tupoRows[key].TupoAddABSValueMap.find(entry=>entry.Key==='120').Value.TupoAddABSValue.at(-1).TupoABSRange.UpperBound.Value;
  const alteredGrowth={'Altered Attack':['SuperpowerAtkAdded','Frost Attack'],'Altered Resistance':['SuperpowerDefAdded','Frost Resistance'],'Altered Resistance %':['SuperpowerDefMult','Frost Resistance %']};
  for(const [type,[rawKey,counterpart]] of Object.entries(alteredGrowth)) {
    if(!statTypes[type]||statTypes[type].maxAugmentIncreaseFlat!==0)throw new Error('Unexpected upstream Titan growth for '+type);
    statTypes[type]={...statTypes[type],maxAugmentIncreaseFlat:tupoMax(rawKey),maxAugmentIncreaseMultiplier:statTypes[counterpart].maxAugmentIncreaseMultiplier};
  }
  const curves = JSON.parse(fs.readFileSync(path.join(rawRoot,critSource),'utf8'))[0].Rows;
  const coefficient = (key,level,table=curves) => {
    const curve=table[key];
    if(curve?.InterpMode!=='RCIM_Linear') throw new Error('Unsupported crit curve '+key);
    const exact=curve.Keys.find(k=>k.Time===level);
    if(exact)return exact.Value;
    const left=curve.Keys.filter(k=>k.Time<level).at(-1),right=curve.Keys.find(k=>k.Time>level);
    if(!left||!right)throw new Error('Unsupported crit level '+level);
    return left.Value+(right.Value-left.Value)*(level-left.Time)/(right.Time-left.Time);
  };
  const maxLevel=Math.min(...['ax2','bx','c'].map(k=>Math.max(...curves[k].Keys.map(key=>key.Time))));
  const denominators=Object.fromEntries(Array.from({length:maxLevel},(_,i)=>{
    const level=i+1;
    const denominator=Math.round(coefficient('ax2',level)*level*level+coefficient('bx',level)*level+coefficient('c',level));
    if(denominator<=0)throw new Error('Invalid crit denominator at '+level);
    return [level,denominator];
  }));
  const critFormula = {source:critSource,denominators};
  const defenceSource='Hotta/Content/Resources/Abilities/DataTables/DefenceFormula.json';
  const defenceCurves=JSON.parse(fs.readFileSync(path.join(rawRoot,defenceSource),'utf8'))[0].Rows;
  const resistanceConstants=Object.fromEntries(Object.keys(denominators).map(key=>{
    const level=Number(key);
    const value=Math.floor(coefficient('ax2',level,defenceCurves)*level*level+coefficient('bx',level,defenceCurves)*level+coefficient('c',level,defenceCurves));
    if(value<=0)throw new Error('Invalid resistance constant '+level);
    return [level,value];
  }));
  if(resistanceConstants[100]!==14106)throw new Error('Unexpected level-100 resistance constant');
  const resistanceFormula={source:defenceSource,constants:resistanceConstants,expression:'RES / (RES + K)',levelBasis:'Legacy selector uses character level; attacker-level semantics not verified'};
  const titanSource='Hotta/Content/Resources/CoreBlueprints/DataTable/Gameplay/HottaAbilityDataAsset.json';
  const titanProperties=JSON.parse(fs.readFileSync(path.join(rawRoot,titanSource),'utf8'))[0].Properties;
  const rareSource='Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipUncommonModifyData.json';
  const rawRare=Object.values(JSON.parse(fs.readFileSync(path.join(rawRoot,rareSource),'utf8'))[0].Rows).flatMap(row=>row.UncommonModifyInfoList);
  // Editorial labels and migration joins; ids, order and levels are verified raw data.
  const rareLabels={
    CommonDamageRecoverHPMult:['Lifesteal','Похищение здоровья','Lifesteal'],CommonBlockMult:['Block','Блок','Block'],
    CommonWeaknessIncreaseInjury:['Weak Point','Уязвимые места','WeakPointBoost'],AutoRestoreHPMult:['HP Recovery','Восстановление ОЗ','HpRecovery'],
    SlowMult:['Delay','Замедление','Delay'],CommonAtkAggravatingInjury:['Normal Attack','Обычная атака','NormalAtkBoost'],
    EvadeAtkAggravatingInjury:['Dodge Attack','Атака уклонением','DodgeAtkBoost'],SkillAtkAggravatingInjury:['Skill','Навык','SkillBoost'],
    ChangeSkillAtkAggravatingInjury:['Discharge','Разряд','DischargeBoost'],CommonAggravatingInjury:['Damage Boost','Повышение урона','DamageBoost'],
    CommonReduceInjuries:['Damage Reduction','Снижение урона','DamageReduction'],FinalRigidity:['Healing','Лечение','IncreasedHealing'],
  };
  const effectSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/RedEquipmentAttrDataTable_Overseas.json';
  const displaySource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/RedEquipmentAttrShowDataTable_Overseas.json';
  const effectRows=JSON.parse(fs.readFileSync(path.join(rawRoot,effectSource),'utf8'))[0].Rows;
  const displayRows=JSON.parse(fs.readFileSync(path.join(rawRoot,displaySource),'utf8'))[0].Rows;
  const materializeCurve=row=>{
    if(!row||row.InterpMode!=='RCIM_Linear'||row.PreInfinityExtrap!=='RCCE_Constant'||row.PostInfinityExtrap!=='RCCE_Constant')throw new Error('Unsupported Titan effect curve');
    return row.Keys.map(({Time,Value})=>({level:Time,value:Value})).sort((a,b)=>a.level-b.level);
  };
  const rareItems=titanProperties.SpecialAttributeLevelValueList.map(({Key})=>{
    const labels=rareLabels[Key],entries=rawRare.filter(r=>r.ModifyID===Key);
    if(!labels || !entries.length)throw new Error('Missing rare Titan contract '+Key);
    return {id:Key,nameEn:labels[0],nameRu:labels[1],legacyId:labels[2],effectCurve:materializeCurve(effectRows[Key]),displayCurve:materializeCurve(displayRows[Key]).map(k=>({...k,value:k.value/100})),levels:[...new Set(entries.map(r=>r.PropLevel))].sort((a,b)=>a-b)};
  });
  const poolSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipmentDataTable_Overseas.json';
  const equipmentRows=JSON.parse(fs.readFileSync(path.join(rawRoot,poolSource),'utf8'))[0].Rows;
  const uncommonRows=JSON.parse(fs.readFileSync(path.join(rawRoot,rareSource),'utf8'))[0].Rows;
  const slotItems={helmet:'helmet_orange',spaulders:'shawl_orange',armor:'cloth_orange',bracers:'armband_orange',belt:'belt_orange',pants:'pants_orange',boots:'shoes_orange',gloves:'glove_orange',visor:'visor_OS_orange',core:'core_OS_orange',exoskeleton:'exoskeleton_OS_orange',reactor:'reactor_OS_orange'};
  const poolRows={};
  const rarePools=Object.fromEntries(Object.entries(slotItems).map(([slot,baseId])=>{
    const titanId=equipmentRows[baseId]?.TupoRedItemID;
    const packId=equipmentRows[titanId]?.UncommonPackId;
    const entries=uncommonRows[packId]?.UncommonModifyInfoList;
    if(!entries?.length)throw new Error('Missing raw Titan pool '+slot);
    const ids=[...new Set(entries.map(entry=>entry.ModifyID))];
    if(ids.some(id=>!rareItems.some(item=>item.id===id)))throw new Error('Unknown raw Titan pool property '+slot);
    poolRows[slot]={baseId,titanId,packId};
    return [slot,ids];
  }));
  const titanRare={source:rareSource,orderSource:titanSource+'#SpecialAttributeLevelValueList',effectSource,displaySource,poolSource,poolRows,items:rareItems,pools:rarePools};
  // Migrate the existing Comp icon registry into a generated preview contract.
  // Every mapping must resolve to its original game texture; no inferred filename.
  const compSource = fs.readFileSync(path.join(sitePaths.webDir,'src/features/comp/data.ts'),'utf8');
  const registry = compSource.match(/export const SIMULACRA_MATRIX_ICONS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if(!registry)throw new Error('Missing canonical Comp trait icon registry');
  const traitIcons = Object.fromEntries([...registry[1].matchAll(/['"]?([\w-]+)['"]?:\s*'([^']+\.webp)'/g)].map(m=>{
    const relative='Hotta/Content/Resources/Icon/Matrix/'+m[2];
    if(!fs.existsSync(path.join(rawRoot,relative.replace(/\.webp$/,'.png'))))throw new Error('Missing raw trait icon '+m[1]);
    return [m[1],'/game-assets/webp/'+relative];
  }));
  const output = path.join(sitePaths.publicDir,'game-data/build-reference.json');
  const synthesisPreview={maxStage:6,source:'User-provided S0–S6 preview contract; no damage formula or production roster asserted'};
  fs.writeFileSync(output, JSON.stringify({schemaVersion:7,source:'https://github.com/apache1123/tof-tools',revision,limits,slots,statTypes,critFormula,resistanceFormula,titanGrowth,traitIcons,titanRare,synthesisPreview,titanRareStats:'Overseas linear curves evaluated at the combined equipped property level; zero level has no effect'},null,2)+'\n');
  console.log(`Generated ${output}`);
})().catch(e => {console.error(e);process.exitCode=1;});
