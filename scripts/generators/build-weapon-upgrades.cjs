// Breakthrough row indices are zero-based; displayed/captured Up. is one-based.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const common='Hotta/Content/Resources/CoreBlueprints/DataTable/';
const overseas='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/';
module.exports=function buildWeaponUpgrades({raw}){
  const merge=(...files)=>{
    const map=new Map();
    for(const file of files){
      const rows=JSON.parse(fs.readFileSync(path.join(raw,file),'utf8')).find(object=>object.Rows).Rows;
      for(const [key,value] of Object.entries(rows))map.set(key.toLowerCase(),{key,value});
    }
    return map;
  };
  const weapons=merge(common+'StaticWeaponDataTable.json',overseas+'StaticWeaponDataTable_Overseas.json');
  const stages=merge(common+'EquipDataTables/DT_WeaponTupo.json',overseas+'DT_WeaponTupo_Overseas.json');
  const result={};
  for(const [id,{value:weapon}] of weapons){
    const prefix=String(weapon.TupoPackId||'').toLowerCase()+'_';
    const ranges=[...stages.values()].filter(row=>row.key.toLowerCase().startsWith(prefix)).map(({key,value})=>({
      upgrade:Number(key.split('_').at(-1))+1,minLevel:value.NeedWeaponLevel,maxLevel:value.MaxWeaponLevel,
    })).filter(row=>Number.isInteger(row.upgrade)&&Number.isFinite(row.minLevel)&&Number.isFinite(row.maxLevel)).sort((a,b)=>a.upgrade-b.upgrade);
    if(ranges.length)result[id]=ranges;
  }
  return result;
};
if(require.main===module){
  const raw=sitePaths.rawDir;
  const upgrades=module.exports({raw});
  const targets=[path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(sitePaths.webDir,'src/features/build/__fixtures__/catalog.json')]:[])];
  for(const file of targets){
    const target=file,catalog=JSON.parse(fs.readFileSync(target,'utf8'));
    for(const weapon of catalog.weapons)weapon.upgradeStages=upgrades[String(weapon.weaponId).toLowerCase()]||[];
    fs.writeFileSync(target,JSON.stringify(catalog,file.includes('__fixtures__')?null:undefined,file.includes('__fixtures__')?2:undefined)+'\n');
  }
}
