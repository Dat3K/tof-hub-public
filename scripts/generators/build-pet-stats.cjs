const fs=require('node:fs');
const path=require('node:path');

// Global coefficients override the CN values in the migration catalog.
module.exports=function buildPetStats({raw,items}) {
  const source='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/PetAdvanceDataTable_Overseas.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const elementNames={'火焰':'Flame','寒冰':'Frost','雷电':'Volt','物理':'Physical'};
  return new Map(items.map(p=>{
    const levels=Object.values(p.stats_progression?.levels||{}).map(s=>({level:s.level,attack:s.atk,crit:s.crit,critDamage:s.crit_dmg}));
    if(levels.some(s=>Object.values(s).some(value=>!Number.isFinite(value))))throw new Error('Incomplete pet stats '+p.id);
    const first=rows[`${p.id}_adv_0`]?.AdvanceDetail?.SourceString||'';
    const elements=Object.entries(elementNames).filter(([name])=>first.includes(name)).map(([,element])=>element);
    const inheritance=(p.stars||[]).flatMap(s=>{
      const row=rows[`${p.id}_adv_${s.star}`];
      if(!row||!elements.length)return [];
      // Some rows use a placeholder coefficient; their description carries the rate.
      const text=row.AdvanceDetail?.SourceString?.match(/<shuzhi>([\d.]+)%/);
      const rate=row.PlayerModifyCoefficient===1&&text?Number(text[1])/100:row.PlayerModifyCoefficient;
      if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('Invalid pet inheritance '+p.id);
      return [{stars:Number(s.star),rate,elements}];
    });
    return [p.id,{levels,inheritance}];
  }));
};
