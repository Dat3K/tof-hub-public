// Materialize legacy mechanics and raw module-level effects for build tooltips.
const path=require('node:path');
const fs=require('node:fs');
module.exports=function systemBonuses({computing,supportData,legacy}) {
  const source='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipSlotEvolutionDataTable_Overseas.json';
  const raw=process.env.TOF_RAW_GAME_DIR||path.join(legacy,'tof-fast-datamine/raw_exports/raw_exports');
  const rows=Object.values(JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows);
  // Editorial translations; node identities and bonuses are sourced from the raw table.
  const labels={UI_Evolution_1:{en:'Combat Engine',ru:'Боевой двигатель'},UI_Evolution_2:{en:'Microreactor',ru:'Микрореактор'},UI_Evolution_3:{en:'Exoskeleton',ru:'Экзоскелет'},UI_Evolution_4:{en:'Eyepiece',ru:'Окуляр'}};
  const statLabels={icon_acceptUp_all:{en:'Elemental DMG',ru:'Урон всех стихий'},icon_resistUp_all:{en:'All resistances',ru:'Все сопротивления'},icon_zhiliaoUP:{en:'Healing',ru:'Лечение'},icon_atk:{en:'All ATK',ru:'Атака всех стихий'},icon_breach_pdxl:{en:'Shatter',ru:'Разрушение щита'}};
  const nodes=computing.nodes.map(n=>{
    const family=n.icon.match(/Icon_NewEqui(\d)/)?.[1];
    const row=rows.find(r=>r.EquipSlotIcon.AssetPathName.includes(`Icon_NewEqui${family}a.`));
    if(!row)throw new Error('Unknown supercomputing texture family '+n.id);
    const maxLevel=row.EquipSlotEvolutionMaxLevel;
    const effects=row.EquipSlotSimulatedProps.map(prop=>{
      const id=prop.PropIcon.AssetPathName.split('.').at(-1);
      const name=statLabels[id];if(!name)throw new Error('Unknown supercomputing bonus '+id);
      const levels=[{level:0,value:0,percentage:true},...prop.PropValueDescs.slice(0,maxLevel).map((description,index)=>{
        const match=description.SourceString.match(/^\+([\d.]+)%$/);
        if(!match)throw new Error('Unparseable supercomputing bonus '+id);
        return {level:index+1,value:Number(match[1])/100,percentage:true};
      })];
      if(levels.length!==maxLevel+1)throw new Error('Incomplete supercomputing levels '+id);
      const relative='Hotta/Content/'+prop.PropIcon.AssetPathName.slice(6).split('.')[0];
      return {id,name,levels,icon:'/game-assets/webp/'+relative+'.webp',...(id==='icon_acceptUp_all'?{damageScope:'all'}:{}),...(id==='icon_atk'?{attackStat:'Attack %'}:{}),...(id==='icon_resistUp_all'?{resistanceStat:'Resistance %'}:{})};
    });
    const label=labels[row.EquipSlotName.Key];if(!label)throw new Error('Unknown supercomputing label');
    return {...n,label_en:label.en,label_ru:label.ru,maxLevel,effects,levels:effects[0].levels,mechanicsSource:source,slot:row.EquipSlotType};
  });
  const modules=supportData.modules.map(m=>{
    const percentage=m.levels.some(l=>/%/.test(l.Description?.SourceString||''));
    const levels=m.levels.map(l=>{
      const raw=l.Description?.SourceString||'';
      const text=raw.match(/<shuzhi>([\d.]+)(%)?<\//);
      let value=l.AttributeValue;
      if(l.AttributeID==='None') {
        if(l.level>0&&!text)throw new Error('Missing support buff amount '+m.id+' level '+l.level);
        value=text?Number(text[1])/(text[2]?100:1):0;
      }
      if(!Number.isFinite(value)||value<0)throw new Error('Invalid support bonus '+m.id);
      return {level:l.level,value,percentage};
    });
    const attribute=m.levels.find(l=>l.level>0)?.AttributeID;
    const damageAttributes={PhyAtkExtraUpMult:'Physical',FireAtkExtraUpMult:'Flame',IceAtkExtraUpMult:'Frost',ThunderAtkExtraUpMult:'Volt'};
    const attackAttributes={PhyAtkAdded:'Physical Attack',FireAtkAdded:'Flame Attack',IceAtkAdded:'Frost Attack',ThunderAtkAdded:'Volt Attack'};
    let damageScope;
    if(damageAttributes[attribute])damageScope=[damageAttributes[attribute]];
    else if(!m.base&&attribute==='None'&&percentage) {
      const description=m.levels.find(l=>l.level>0)?.Description?.SourceString||'';
      const element=Object.entries({'物理序列':'Physical','火焰序列':'Flame','寒冰序列':'Frost','雷电序列':'Volt'}).find(([text])=>description.includes(text))?.[1];
      if(description.includes('伤害'))damageScope=element?[element]:'all';
    }
    return {...m,levels,...(attackAttributes[attribute]?{attackStat:attackAttributes[attribute]}:{}),...(damageScope?{damageScope,conditional:!m.base}:{})};
  });
  return {computing:{...computing,nodes},supportData:{...supportData,modules}};
};
