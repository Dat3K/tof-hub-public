const fs = require('node:fs');
const path = require('node:path');
const attackPercentBonuses=require('./build-attack-percent.cjs');

// Selection groups requested for the build card; facts and media come from Food.
module.exports = function buildConsumables({pub,media}) {
  const data=JSON.parse(fs.readFileSync(path.join(pub,'en','food.json'),'utf8'));
  const translated=JSON.parse(fs.readFileSync(path.join(pub,'ru','food.json'),'utf8'));
  const supplementFile=path.join(pub,'game-data/capture-food.json');
  const supplement=fs.existsSync(supplementFile)?JSON.parse(fs.readFileSync(supplementFile,'utf8')).items:[];
  const groups=[
    {id:'food',name:{en:'Food',ru:'Еда'},items:[...data.items,...data.potions.filter(item=>item.subcategory==='nutripastes')],translations:[...translated.items,...translated.potions]},
    {id:'attack',name:{en:'Attack shot',ru:'Шприц атаки'},names:['Blade Shot','Enhanced Blade Shot']},
    {id:'enhancement',name:{en:'Enhancement Shot',ru:'Усиливающий заряд'},names:['Enhancement Shot']},
    {id:'piercing',name:{en:'Piercing Shot',ru:'Пробивающий заряд'},names:['Piercing Shot']},
  ];
  return groups.map(group=>({id:group.id,name:group.name,items:[...(group.items||data.potions.filter(item=>group.names.includes(item.name_en||item.name))).map(item=>{
    const ru=(group.translations||translated.potions).find(value=>value.id===item.id)||item;
    const effects=(value,locale)=> (value[`formatted_effects_${locale}`]||value.formatted_effects||[]).join('<br>')||value[`effect_text_${locale}`]||value.effect_text||'';
    const percentBonuses=attackPercentBonuses(effects(item,'en'));
    const elements=Object.entries({PhyAtk:'Physical',FireAtk:'Flame',IceAtk:'Frost',ThunderAtk:'Volt',AlteredAtk:'Altered'}).filter(([category])=>item.categories?.some(value=>value===category||value===category.replace(/Atk$/,'Def'))).map(([,element])=>element);
    const clauses=[...effects(item,'en').replace(/<[^>]+>/g,'').matchAll(/(?:Attack|Resistance|Defense)\s*\+?\s*([\d.]+)%\s*\+\s*([\d,]+)/gi)];
    const foodBuff={percentage:Math.max(item.atk_percent||0,...clauses.map(match=>Number(match[1])))/100,flat:Math.max(item.atk_flat||0,...clauses.map(match=>Number(match[2].replace(/,/g,''))))};
    const flatScope=elements.length?elements:percentBonuses[0]?.elements;
    const flatAttackValue=Number.isFinite(item.atk_flat)?item.atk_flat:percentBonuses.length?foodBuff.flat:0;
    const flatAttackBonuses=flatAttackValue>0&&flatScope?[{elements:flatScope,value:flatAttackValue}]:[];
    return {id:item.id,name:{en:item.name_en||item.name,ru:ru.name_ru||ru.name||item.name_ru||item.name_en||item.name},icon:media(item.icon),quality:item.rarity,
      elements,foodBuff,attackPercentBonuses:percentBonuses,flatAttackBonuses,description:{en:effects(item,'en'),ru:effects(ru,'ru')}};
  }),...(group.id==='food'?supplement.map(item=>({...item,icon:media(item.icon)})):[])]}));
};
