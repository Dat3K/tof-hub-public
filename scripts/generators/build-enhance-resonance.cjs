const fs=require('node:fs');
const path=require('node:path');
module.exports=function enhanceResonance({raw,gearMedia}) {
  const source='Hotta/Content/Resources/CoreBlueprints/DataTable/AttackIntensifyDataTable.json';
  const statsSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/ModifyDataTable_Overseas.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const modifiers=JSON.parse(fs.readFileSync(path.join(raw,statsSource),'utf8'))[0].Rows;
  const fields={CommonAtkAdded:'atk',ElementDef:'res',MaxHealthAdded:'hp',CritAdded:'crit'};
  const tiers=Object.values(rows).sort((a,b)=>a.NeedItemLevel-b.NeedItemLevel).map((row,index)=>{
    const stats={atk:0,res:0,hp:0,crit:0};
    const mods=modifiers[row.AttributModifyDataName]?.ModifyData;
    if(!mods)throw new Error('Missing enhancement resonance stats '+row.AttributModifyDataName);
    for(const mod of mods)if(fields[mod.PropName])stats[fields[mod.PropName]]=mod.PropValue;
    return {level:index+1,enhancement:row.NeedItemLevel,count:row.NeedItemCount,stats};
  });
  const slotIds=Object.entries(gearMedia).filter(([,gear])=>gear.resonanceEligible).map(([id])=>id);
  if(tiers.some(tier=>tier.count!==slotIds.length))throw new Error('Invalid basic enhancement resonance slots');
  return {source,statsSource,slotIds,tiers};
};
