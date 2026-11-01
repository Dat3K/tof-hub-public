// Cross-system CS evidence. Candidate weighted scores are not native totals.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const raw = sitePaths.rawDir;
const base = 'Hotta/Content/Resources/CoreBlueprints/DataTable/';
const overseas = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
const sources = {};
function rows(file) {
  const bytes = fs.readFileSync(path.join(raw, file));
  sources[file] = {sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes).find(o => o.Rows).Rows;
}
function merged(commonFile, overseasFile) {
  const map = new Map();
  for (const file of [commonFile, overseasFile]) {
    for (const [row, value] of Object.entries(rows(file))) map.set(row.toLowerCase(), {row, file, value});
  }
  return map;
}
const attributePath = base + 'AttributeStaticDataTable.json';
const attributes = rows(attributePath);
const rules = require('./build-cs-rules.cjs')({raw});
const fixedPercent = new Set(Object.keys(rules.bases).filter(k => rules.bases[k] === 'fixedPercent').map(k => rules.attributes[k]));
const percentBases = Object.fromEntries(Object.entries(rules.bases).filter(([,b]) => b !== 'fixedPercent').map(([type,b]) => [rules.attributes[type],b]));
const rawAttributes = Object.fromEntries(Object.entries(attributes).map(([id,r]) => [id,{weight:r.Value, percentDisplay:r.bShowPercent, descriptionFunction:r.AttributeDescFunction, nameRaw:r.AttributeText?.SourceString || null}]));
function evaluate(components) {
  let knownSubtotal = 0;
  const entries = components.map(c => {
    const attr = attributes[c.attribute];
    if (!attr || !Number.isFinite(c.value)) return {...c,status:'missing-attribute-or-value'};
    const rawWeight = attr.Value;
    if (percentBases[c.attribute]) return {...c,rawWeight,status:'requires-character-percentage-base',base:percentBases[c.attribute]};
    if (fixedPercent.has(c.attribute)) {
      const candidate = c.value * rawWeight * 100; knownSubtotal += candidate;
      return {...c,rawWeight,effectiveWeight:rawWeight*100,status:'fixed-percent-weight-model',weightedContribution:candidate};
    }
    if (rawWeight === 0) return {...c,rawWeight,status:'zero-raw-weight-native-inclusion-unverified'};
    if (attr.bShowPercent || /Mult$/.test(c.attribute)) return {...c,rawWeight,status:'percentage-unit-or-base-unverified'};
    const candidate = c.value * rawWeight; knownSubtotal += candidate;
    return {...c,rawWeight,status:'flat-weight-model',weightedContribution:candidate};
  });
  return {knownWeightedSubtotal:knownSubtotal,fullNativeCS:null,components:entries};
}
const modify = merged(base+'ModifyDataTable.json', overseas+'Weapon/ModifyDataTable_Overseas.json');
const weapons = merged(base+'StaticWeaponDataTable.json', overseas+'Weapon/StaticWeaponDataTable_Overseas.json');
const stars = merged(base+'WeaponUpgradeStarData.json', overseas+'Weapon/WeaponUpgradeStarData_Overseas.json');
const upgrade = merged(base+'EquipDataTables/DT_WeaponUpgrade.json', overseas+'Weapon/DT_WeaponUpgrade_Overseas.json');
const effects = merged(base+'EquipDataTables/EquipStrengthenEffectPackDataTable.json', overseas+'Equipment/EquipStrengthenEffectPackDataTable_Overseas.json');
const weaponProfiles = [];
for (const w of weapons.values()) {
  const mod = modify.get(w.value.ModifyData?.toLowerCase());
  if (!mod?.value.ModifyData?.length) continue;
  const starRows = [...stars.values()].filter(s => s.row.toLowerCase().startsWith(w.value.UpgradeStarPackID.toLowerCase()+'_')).map(s => ({row:s.row,source:s.file,stars:Number(s.row.split('_').at(-1)),coefficient:s.value.Coefficient,attributeCoefficients:s.value.AttributeCoefficientList,starSkillScore:s.value.StarSkillScore})).sort((a,b)=>a.stars-b.stars);
  const growth = [...upgrade.values()].filter(u => u.row.toLowerCase().startsWith(w.value.UpgradePackId.toLowerCase()+'_')).map(u => {
    const effect = effects.get(u.value.ModifyPack?.toLowerCase());
    return {level:Number(u.row.split('_').at(-1)),row:u.row,source:u.file,modifyPack:u.value.ModifyPack,effectSource:effect?.file || null,effectRow:effect?.row || null,addAttrValues:effect?.value.AddAttrValues || null};
  }).sort((a,b)=>a.level-b.level);
  weaponProfiles.push({row:w.row,source:w.file,baseScore:w.value.BaseScore,modifyRow:mod.row,modifySource:mod.file,rawBaseAttributes:mod.value.ModifyData,baseAttributeWeightModel:evaluate(mod.value.ModifyData.filter(r=>!r.IsTag&&r.ModifierOp==='MODIFY_MODOP_ADDITIVE').map(r=>({attribute:r.PropName,value:r.PropValue}))),stars:starRows,growth,fullNativeCS:null});
}
const pageFile=path.join(sitePaths.publicDir,'game-data/build-page.json');
const page=fs.existsSync(pageFile)?JSON.parse(fs.readFileSync(pageFile,'utf8')):JSON.parse(fs.readFileSync(path.join(sitePaths.publicDir,'tools/data/catalog.json'),'utf8'));
const matrices = page.matrices.map(m=>({...m}));
const matrixStats = require('./build-matrix-stats.cjs')({raw,matrices,pub:sitePaths.publicDir});
for (const file of [base+'WeaponData/WeaponMatrix/StaticMatrixData.json', overseas+'Weapon/StaticMatrixData_Overseas.json', base+'WeaponData/WeaponMatrix/MatrixStrengthenData.json', overseas+'Weapon/MatrixStrengthenData_Overseas.json', base+'WeaponData/WeaponMatrix/MatrixUpgradeStarData.json', overseas+'Weapon/MatrixUpgradeStarData_Overseas.json']) rows(file);
const matrixProfiles = Object.fromEntries(Object.entries(matrixStats.profiles).map(([id,p]) => [id,{starMultipliers:p.starMultipliers,levels:p.levels.map(l=>({level:l.level,starScores:[{stars:0,multiplier:1},...p.starMultipliers.filter(s=>s.stars>0)].map(s=>({stars:s.stars,...evaluate(l.stats.map(r=>({attribute:r.id,value:r.value*s.multiplier})))}))}))}]));
const matrixStatic = merged(base+'WeaponData/WeaponMatrix/StaticMatrixData.json', overseas+'Weapon/StaticMatrixData_Overseas.json');
const computingPath = overseas+'Equipment/EquipSlotEvolutionDataTable_Overseas.json';
const computingRows = rows(computingPath);
const curvePath = base+'EquipDataTables/EquipSlotEvolution.json';
const curves = rows(curvePath);
function curveAt(curve, level) {
  const left=curve.Keys.filter(k=>k.Time<=level).at(-1), right=curve.Keys.find(k=>k.Time>=level);
  if (!left || !right || curve.InterpMode!=='RCIM_Linear') return null;
  return left.Time===right.Time?left.Value:left.Value+(right.Value-left.Value)*(level-left.Time)/(right.Time-left.Time);
}
const computing = Object.entries(computingRows).map(([row,r])=>({row,slot:r.EquipSlotType,maxLevel:r.EquipSlotEvolutionMaxLevel,levels:Array.from({length:r.EquipSlotEvolutionMaxLevel},(_,i)=>({level:i+1,...evaluate(r.EquipSlotPropValues.map(p=>({attribute:p.PropRowValue.RowName,value:curveAt(curves[p.PropRowValue.RowName],i+1),modifierOp:p.PropModifierOp,source:curvePath,curveRow:p.PropRowValue.RowName})))}))}));
const supportPath = base+'OuterSpaceSupport/DT_OuterSpaceSupportModule.json';
const support = Object.entries(rows(supportPath)).map(([row,r])=>({row,base:r.BaseModule,levels:r.ModuleLevelData.map(l=>({level:Number(l.Key),buffClass:l.Value.BuffClass.AssetPathName,...evaluate(l.Value.AttributeID==='None'?[]:[{attribute:l.Value.AttributeID,value:l.Value.AttributeValue}]),...(l.Value.AttributeID==='None'?{status:'buff-effect-not-scored'}:{})}))}));
const suppressorPath = overseas+'Equipment/DT_Suppressor_Overseas.json';
const suppressor = Object.entries(rows(suppressorPath)).map(([row,r])=>{
  const m=modify.get(r.AttributeID?.toLowerCase());
  return {row,attributeId:r.AttributeID,modifySource:m?.file||null,modifyRow:m?.row||null,...evaluate((m?.value.ModifyData||[]).filter(a=>!a.IsTag&&a.ModifierOp==='MODIFY_MODOP_ADDITIVE').map(a=>({attribute:a.PropName,value:a.PropValue}))),status:m?'attribute-weight-model':'no-modify-row'};
});
const emptyScoring = [base+'TotalScoringStandardConfigDataTable.json',base+'EquipStrengthenScoringStandardConfigDataTable.json',base+'Artifact/ArtifactScoringStandardConfigDataTable.json'].map(file=>({file,rowCount:Object.keys(rows(file)).length}));
const result = {schemaVersion:1,auditedAt:'2026-10-03',rawClientVersion:null,sources,rawAttributes,weaponProfiles,matrix:{source:matrixStats.source,bindings:matrices.map(m=>({id:m.id,statProfiles:m.statProfiles})),baseScores:[...new Set([...matrixStatic.values()].map(r=>r.value.BaseScore))],profiles:matrixProfiles},computing,support,suppressor,scoringTables:emptyScoring,limitations:['Weighted numeric attributes do not prove total native CS.','Weapon StarSkillScore inclusion and cumulative-vs-current semantics need a paired game observation.','Percentage bases, buff eligibility and native rounding remain separate from source weights.','No contribution is automatically added to the imported character CS.']};
const target=path.join(sitePaths.publicDir,'game-data/build-cs-research.json');
const serialized=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check')) assert.equal(fs.readFileSync(target,'utf8'),serialized);
else fs.writeFileSync(target,serialized);
assert.ok(weaponProfiles.length && Object.keys(matrixProfiles).length && computing.length);
console.log(JSON.stringify({attributes:Object.keys(rawAttributes).length,weapons:weaponProfiles.length,matrixProfiles:Object.keys(matrixProfiles).length,computingNodes:computing.length,supportModules:support.length,suppressorSteps:suppressor.length,scoringTables:emptyScoring}));
