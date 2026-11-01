// Matrix attribute growth from original game tables, shared by all sets using a pack.
const fs=require('node:fs');
const path=require('node:path');
module.exports=function({raw,matrices,pub}) {
  const root='Hotta/Content/Resources/CoreBlueprints/DataTable/';
  const read=file=>JSON.parse(fs.readFileSync(path.join(raw,root,file),'utf8')).find(item=>item.Rows)?.Rows||{};
  const overseasRoot='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
  const overseas=file=>JSON.parse(fs.readFileSync(path.join(raw,overseasRoot,file),'utf8')).find(item=>item.Rows)?.Rows||{};
  const staticRows={...read('WeaponData/WeaponMatrix/StaticMatrixData.json'),...overseas('Weapon/StaticMatrixData_Overseas.json')};
  const strengthen={...read('WeaponData/WeaponMatrix/MatrixStrengthenData.json'),...overseas('Weapon/MatrixStrengthenData_Overseas.json')};
  const stars={...read('WeaponData/WeaponMatrix/MatrixUpgradeStarData.json'),...overseas('Weapon/MatrixUpgradeStarData_Overseas.json')};
  const modify={...read('ModifyDataTable.json'),...overseas('Weapon/ModifyDataTable_Overseas.json')};
  const effects={...read('EquipDataTables/EquipStrengthenEffectPackDataTable.json'),...overseas('Equipment/EquipStrengthenEffectPackDataTable_Overseas.json')};
  const slots=['WEAPON_MATRIX_SLOT_FIRST','WEAPON_MATRIX_SLOT_SECOND','WEAPON_MATRIX_SLOT_THIRD','WEAPON_MATRIX_SLOT_FOURTH'];
  const profiles={};
  for(const matrix of matrices) {
    matrix.statProfiles=slots.map(slot=>{
      const row=Object.values(staticRows).find(r=>String(r.SuitID).toLowerCase()===matrix.id.toLowerCase()&&r.SlotIndex===slot);
      if(!row)return '';
      const id=[row.ModifyData,row.StrengthenPackID,row.UpgradeStarPackID].join(':');
      if(!profiles[id]) {
        const base=modify[row.ModifyData]?.ModifyData;
        if(!base?.length)return '';
        const values=base.map(b=>b.PropValue);
        const levels=[{level:0,stats:base.map((b,i)=>({id:b.PropName,value:values[i]}))}];
        for(let level=1;level<=row.BaseMaxStrengthenLevel;level++) {
          const pack=strengthen[row.StrengthenPackID+'_'+level]?.ModifyPack;
          const increments=effects[pack]?.AddAttrValues;
          if(!increments||increments.length!==values.length)throw new Error('Missing matrix growth '+id+' level '+level);
          increments.forEach((n,i)=>{values[i]+=n;});
          levels.push({level,stats:base.map((b,i)=>({id:b.PropName,value:values[i]}))});
        }
        const starMultipliers=Object.entries(stars).filter(([key])=>key.startsWith(row.UpgradeStarPackID+'_')).map(([key,r])=>({stars:Number(key.split('_').at(-1)),multiplier:1+r.Coefficient}));
        profiles[id]={levels,starMultipliers};
      }
      return id;
    });
  }
  const slotPresentation=[['Mind','Разум','mind'],['Memory','Память','memory'],['Belief','Вера','believe'],['Emotion','Эмоция','emotion']].map(([en,ru,asset])=>{
    const icon='/game-assets/webp/Hotta/Content/Resources/UI/yizhi/yizhick_'+asset+'_big.webp';
    return {name:{en,ru},icon:fs.existsSync(path.join(pub,icon))?icon:''};
  });
  return {profiles,slots:slotPresentation,source:overseasRoot+'Weapon/{StaticMatrixData,MatrixStrengthenData,MatrixUpgradeStarData,ModifyDataTable}_Overseas.json; Equipment/EquipStrengthenEffectPackDataTable_Overseas.json; shared tables used for entries without an Overseas override'};
};
