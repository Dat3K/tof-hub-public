// Weapon and matrix-set CS tables for the build card.
// Verified against server fWeaponScore / fMatrixScore in devscan7.
// Weapon: Σ((base + level growth) × star coefficient × attribute weight) + StarSkillScore[stars].
// Matrix sets: MatrixSuitData_Overseas Buffs[].AddScore per piece count; row suffix _N is the set's star rank.
// Supercomputing / Space Support / suppressor: raw attribute pairs per level (index = level); no paired native score yet.
// Standalone: `node scripts/generators/build-system-cs.cjs` patches generated build-page.json and the test fixture.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT_RAW=require('node:path').resolve('pipeline/raw');
const SUIT_SOURCE='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/MatrixSuitData_Overseas.json';
const round=value=>Number(value.toFixed(6));
function generate({raw=sitePaths.rawDir,research,weaponIds}) {
  const weapons={};
  for(const id of weaponIds) {
    const profile=research.weaponProfiles.find(item=>item.row.toLowerCase()===id.toLowerCase());
    if(!profile)continue;
    const attrs=profile.rawBaseAttributes.map(item=>item.PropName);
    const weights=Object.fromEntries(profile.baseAttributeWeightModel.components.map(item=>[item.attribute,item.rawWeight]));
    // Consecutive levels sharing one growth pack collapse into [from, to, add[]] segments.
    const segments=[];
    for(const step of profile.growth.filter(item=>Array.isArray(item.addAttrValues)).sort((a,b)=>a.level-b.level)) {
      const add=step.addAttrValues.map(round),last=segments.at(-1);
      if(last&&last[1]===step.level-1&&last[2].every((value,i)=>value===add[i]))last[1]=step.level;
      else segments.push([step.level,step.level,add]);
    }
    weapons[id.toLowerCase()]={attrs,weights:attrs.map(name=>weights[name]??0),base:profile.rawBaseAttributes.map(item=>round(item.PropValue)),segments,
      stars:profile.stars.sort((a,b)=>a.stars-b.stars).map(star=>({coefficients:attrs.map(name=>star.attributeCoefficients.find(item=>item.PropName===name)?.PropCoefficient??1),skillScore:star.starSkillScore}))};
  }
  const suitTable=JSON.parse(fs.readFileSync(path.join(raw,SUIT_SOURCE),'utf8'));
  const rows=(Array.isArray(suitTable)?suitTable[0]:suitTable).Rows;
  const matrixSets={};
  for(const [row,value] of Object.entries(rows)) {
    const match=/^(.+)_(\d+)$/.exec(row);if(!match)continue;
    const suit=match[1].toLowerCase(),stars=Number(match[2]);
    for(const buff of value.Buffs??[]) {
      if(!Number.isFinite(buff.AddScore))continue;
      ((matrixSets[suit]??={})[buff.SuitCount]??=[])[stars]=buff.AddScore;
    }
  }
  // Raw numeric attributes per level of the other systems; the client weights them with csRules like gear stats.
  const pairs=components=>components.filter(item=>Number.isFinite(item.value)&&item.value!==0).map(item=>[item.attribute,round(item.value)]);
  const computing=Object.fromEntries(research.computing.map(node=>[node.slot,[[],...node.levels.sort((a,b)=>a.level-b.level).map(level=>pairs(level.components))]]));
  // Content modules (AttributeID=None) apply BuffClass Buff_FinDamageUp_WH<Lv>: Properties.ModuleExtraModifierInfos[]
  // .GameplayModifierInfo (Attribute.AttributeName, ScalableFloatMagnitude.Value, ModifierOp Additive).
  const buffPairs=buffClass=>{
    if(!buffClass||buffClass==='None')return [];
    const file=path.join(raw,buffClass.replace(/^\/Game\//,'Hotta/Content/').replace(/\.[^/]+$/,'')+'.json');
    if(!fs.existsSync(file))return [];
    const object=JSON.parse(fs.readFileSync(file,'utf8')).find(item=>item.Properties?.ModuleExtraModifierInfos);
    return (object?.Properties.ModuleExtraModifierInfos??[]).map(item=>item.GameplayModifierInfo)
      .filter(info=>info?.ModifierOp==='EGameplayModOp::Additive'&&info.ModifierMagnitude?.MagnitudeCalculationType==='EGameplayEffectMagnitudeCalculation::ScalableFloat')
      .map(info=>({attribute:info.Attribute.AttributeName,value:info.ModifierMagnitude.ScalableFloatMagnitude.Value}));
  };
  const support=Object.fromEntries(research.support.map(module=>{
    const levels=[];
    for(const level of module.levels)levels[level.level]=pairs(level.status==='buff-effect-not-scored'?buffPairs(level.buffClass):level.components);
    return [module.row,Array.from(levels,level=>level??[])];
  }));
  const suppressor=Object.fromEntries(research.suppressor.map(step=>[step.row,pairs(step.components)]));
  return {weaponSource:'build-cs-research.json weaponProfiles (StaticWeaponDataTable/ModifyDataTable/DT_WeaponUpgrade/EquipStrengthenEffectPack/WeaponUpgradeStarData _Overseas)',
    matrixSetSource:`${SUIT_SOURCE} Rows[<suit>_<stars>].Buffs[].SuitCount/AddScore`,weapons,matrixSets,
    systemsSource:'build-cs-research.json computing (EquipSlotEvolutionDataTable_Overseas + EquipSlotEvolution curves), support (DT_OuterSpaceSupportModule ModuleLevelData), suppressor (DT_Suppressor_Overseas AttributeID → ModifyDataTable_Overseas)',
    computing,support,suppressor,
    // FinalDamageExtraUpMult has raw weight 0; content-module DMG is scored like elemental DMG% (hypothesis).
    derivedWeights:{FinalDamageExtraUpMult:'Physical Damage %'}};
}
module.exports=generate;
if(require.main===module) {
  const web=sitePaths.webDir;
  const research=JSON.parse(fs.readFileSync(path.join(web,'public/game-data/build-cs-research.json'),'utf8'));
  for(const file of [path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(web,'src/features/build/__fixtures__/catalog.json')]:[])]) {
    if(!fs.existsSync(file))continue;
    const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
    catalog.systemCs=generate({research,weaponIds:catalog.weapons.map(item=>item.weaponId).filter(Boolean)});
    fs.writeFileSync(file,JSON.stringify(catalog,null,file.includes('__fixtures__')?2:0)+'\n');
    console.log('Patched',path.relative(process.cwd(),file),Object.keys(catalog.systemCs.weapons).length,'weapons',Object.keys(catalog.systemCs.matrixSets).length,'sets');
  }
}
