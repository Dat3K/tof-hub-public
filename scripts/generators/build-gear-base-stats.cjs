const fs=require('node:fs');
const path=require('node:path');
module.exports=function gearBaseStats({raw,gearMedia}) {
  const root='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
  const read=file=>JSON.parse(fs.readFileSync(path.join(raw,root+file),'utf8'))[0].Rows;
  const items=read('Equipment/EquipmentDataTable_Overseas.json');
  const modifiers=read('Weapon/ModifyDataTable_Overseas.json');
  const growth=read('Equipment/EquipStrengthenEffectPackDataTable_Overseas.json');
  const unlocks=read('Equipment/EquipStrengthenAdvanceDataTable_Overseas.json');
  const labels={CommonAtkAdded:'Attack',MaxHealthAdded:'HP',CritAdded:'Crit',ElementDef:'Resistance'};
  return Object.fromEntries(Object.entries(gearMedia).map(([id,gear])=>[id,Object.fromEntries(Object.entries(gear.itemIds).map(([stage,itemId])=>{
    const item=items[itemId],base=modifiers[item.ModifyData]?.ModifyData?.map(stat=>({...stat}));
    if(!base?.length||base.some(stat=>!labels[stat.PropName]))throw new Error('Unknown gear base stats '+itemId);
    const maxLevel=Math.min(item.MaxStrengthenLevel,Math.max(...Object.keys(growth).filter(key=>key.startsWith(item.StrengthenEffectPackID+'_')).map(key=>Number(key.slice(item.StrengthenEffectPackID.length+1)))));
    const nativeCount=base.length;
    for(let threshold=1;threshold<=Math.floor(maxLevel/5);threshold++) {
      const unlock=unlocks[item.StrengthenEffectPackID+'_'+threshold];
      const bonuses=modifiers[unlock?.ModifyId]?.ModifyData;
      if(!bonuses)throw new Error('Missing enhancement unlock '+itemId);
      for(const bonus of bonuses) {
        if(!labels[bonus.PropName])throw new Error('Unknown enhancement unlock stat '+itemId);
        if(!base.some(stat=>stat.PropName===bonus.PropName))base.push({...bonus,PropValue:0});
      }
    }
    const enhanced=base.map(()=>0),unlocked=base.map(()=>0),levels=[];
    for(let level=0;level<=maxLevel;level++) {
      if(level) {
        const row=growth[item.StrengthenEffectPackID+'_'+level];
        if(!row||row.AddAttrValues.length>nativeCount)throw new Error('Missing enhancement growth '+itemId+' '+level);
        row.AddAttrValues.forEach((value,index)=>{enhanced[index]+=value;});
        if(level%5===0) {
          const unlock=unlocks[item.StrengthenEffectPackID+'_'+level/5];
          const bonuses=modifiers[unlock?.ModifyId]?.ModifyData;
          if(!bonuses)throw new Error('Missing enhancement unlock '+itemId+' '+level);
          for(const bonus of bonuses) {
            const index=base.findIndex(stat=>stat.PropName===bonus.PropName);
            if(index<0)throw new Error('Unknown enhancement unlock stat '+itemId);
            unlocked[index]+=bonus.PropValue;
          }
        }
      }
      // Match the game's separately truncated base/green/unlocked components.
      levels.push({level,stats:base.map((stat,index)=>{
        const original=Math.trunc(stat.PropValue),enhancement=Math.trunc(enhanced[index]),unlock=Math.trunc(unlocked[index]);
        return {label:labels[stat.PropName],base:original,enhancement,unlocked:unlock,value:original+enhancement+unlock};
      }).filter(stat=>stat.value>0)});
    }
    return [stage,levels];
  }))]));
};
