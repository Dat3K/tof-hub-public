// Raw weapon level/star growth shared by Build and Info Simulacra (docs/pipeline.md).
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const base='Hotta/Content/Resources/CoreBlueprints/DataTable/';
const overseas='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
const ids={CommonAtkAdded:'attack',MaxHealthAdded:'hp',CritAdded:'crit',ElementDef:'resistance'};

function build({raw}) {
  const rows=file=>JSON.parse(fs.readFileSync(path.join(raw,file),'utf8')).find(o=>o.Rows).Rows;
  const merged=(...files)=>{
    const map=new Map();
    for(const file of files)for(const [row,value] of Object.entries(rows(file)))map.set(row.toLowerCase(),{row,value});
    return map;
  };
  const modify=merged(base+'ModifyDataTable.json',overseas+'Weapon/ModifyDataTable_Overseas.json');
  const weapons=merged(base+'StaticWeaponDataTable.json',overseas+'Weapon/StaticWeaponDataTable_Overseas.json');
  const stars=merged(base+'WeaponUpgradeStarData.json',overseas+'Weapon/WeaponUpgradeStarData_Overseas.json');
  const upgrade=merged(base+'EquipDataTables/DT_WeaponUpgrade.json',overseas+'Weapon/DT_WeaponUpgrade_Overseas.json');
  const effects=merged(base+'EquipDataTables/EquipStrengthenEffectPackDataTable.json',overseas+'Equipment/EquipStrengthenEffectPackDataTable_Overseas.json');
  const result={};
  for(const weapon of weapons.values()) {
    const attributes=(modify.get(weapon.value.ModifyData?.toLowerCase())?.value.ModifyData??[])
      .filter(entry=>!entry.IsTag&&entry.ModifierOp==='MODIFY_MODOP_ADDITIVE'&&ids[entry.PropName]);
    if(!attributes.length||!weapon.value.UpgradePackId||!weapon.value.UpgradeStarPackID)continue;
    const prefix=key=>key.toLowerCase()+'_';
    // AddAttrValues are positional against the ModifyData additive rows (verified on Killknife_physic and Rubilia_thunder).
    const levels=[...upgrade.values()].filter(u=>u.row.toLowerCase().startsWith(prefix(weapon.value.UpgradePackId)))
      .map(u=>({level:Number(u.row.split('_').at(-1)),values:effects.get(u.value.ModifyPack?.toLowerCase())?.value.AddAttrValues??null}))
      .filter(u=>Number.isInteger(u.level)&&u.values?.length===attributes.length).sort((a,b)=>a.level-b.level);
    if(!levels.length||levels.some((u,i)=>u.level!==i+1))continue;
    const starRows=[...stars.values()].filter(s=>s.row.toLowerCase().startsWith(prefix(weapon.value.UpgradeStarPackID)))
      .map(s=>({stars:Number(s.row.split('_').at(-1)),list:s.value.AttributeCoefficientList??[]})).sort((a,b)=>a.stars-b.stars);
    result[weapon.row.toLowerCase()]={maxLevel:levels.length,stats:attributes.map((entry,index)=>{
      // Run-length per-level increments: most packs repeat the same values for every level.
      const increments=[];
      for(const {level,values} of levels) {
        const last=increments.at(-1);
        if(last&&last.value===values[index])last.to=level;else increments.push({from:level,to:level,value:values[index]});
      }
      return {id:ids[entry.PropName],base:entry.PropValue,increments,
        stars:starRows.map(row=>row.list.find(item=>item.PropName===entry.PropName)?.PropCoefficient??1)};
    })};
  }
  return result;
}
function write(file,weapons) {
  fs.writeFileSync(file,JSON.stringify({schemaVersion:1,source:'StaticWeaponDataTable/ModifyDataTable/DT_WeaponUpgrade/EquipStrengthenEffectPackDataTable/WeaponUpgradeStarData (+_Overseas)',weapons})+'\n');
}
module.exports=build;
module.exports.write=write;

if(require.main===module) {
  const raw=sitePaths.rawDir;
  const out=path.join(sitePaths.publicDir,'game-data/weapon-growth.json');
  const weapons=build({raw});
  write(out,weapons);
  // Keep the checked-in unit-test catalog on the same growth as build-page.json (build-weapon-stats.cjs).
  const fixture=path.join(sitePaths.webDir,'src/features/build/__fixtures__/catalog.json');
  if(sitePaths.writesRepoFixtures){
    const catalog=JSON.parse(fs.readFileSync(fixture,'utf8'));
    for(const weapon of catalog.weapons)if(weapon.stats)weapon.stats.growth=weapons[String(weapon.weaponId).toLowerCase()]??null;
    catalog.weaponStats={source:'game-data/weapon-growth.json (raw); en/simulacra.json fallback'};
    fs.writeFileSync(fixture,JSON.stringify(catalog,null,2)+'\n');
  }
  console.log(`weapon-growth.json: ${Object.keys(weapons).length} weapons`);
}
