// Complete Build's food selection from raw identities, including foods without modeled ATK effects.
const fs=require('node:fs'),path=require('node:path');
module.exports=function buildCaptureFood({raw,pub,effects}) {
  const relativePath='Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,relativePath),'utf8')).find(object=>object.Name==='ItemConfigs'&&object.Rows)?.Rows;
  if(!rows)throw new Error('Missing raw ItemConfigs');
  const foods=JSON.parse(fs.readFileSync(path.join(pub,'en/food.json'),'utf8'));
  const known=new Set([...foods.items,...foods.potions.filter(item=>['nutripastes','shots'].includes(item.subcategory))].map(item=>item.id));
  const names=Object.fromEntries(['en','ru'].map(locale=>[locale,Object.fromEntries(Object.values(JSON.parse(fs.readFileSync(path.join(pub,`game-data/${locale}/datamine/items.json`),'utf8'))).map(item=>[item.id,item]))]));
  const bindings={},items=[];
  for(const [id,row] of Object.entries(rows)) {
    if(row.ItemType!=='ITEM_TYPE_FOOD'||row.AvailableServerMode==='EHottaServerModeLimit::MMOServerOnly')continue;
    const definitions=(row.Buffs??[]).flatMap(buff=>{
      const name=buff.BuffClass?.AssetPathName?.split('.').at(-1);
      return name&&name!=='None'?['Default__'+name]:[];
    });
    for(const definition of definitions)(bindings[definition]??=[]).push(id);
    if(known.has(id))continue;
    const modifiers=definitions.flatMap(definition=>effects[definition]?.modifiers??[]);
    const verified=modifiers.filter(modifier=>modifier.magnitude!==null);
    const attackPercentBonuses=verified.filter(modifier=>modifier.kind==='percent').map(modifier=>({elements:modifier.elements,values:[modifier.magnitude]}));
    const flatAttackBonuses=verified.filter(modifier=>modifier.kind==='flat').map(modifier=>({elements:modifier.elements,value:modifier.magnitude}));
    const name=Object.fromEntries(['en','ru'].map(locale=>[locale,names[locale][id]?.name||id]));
    const description=Object.fromEntries(['en','ru'].map(locale=>[locale,[names[locale][id]?.[`description_${locale}`],...verified.map(modifier=>`${modifier.elements.join(' / ')} ATK${modifier.kind==='percent'?'%':''}: +${modifier.kind==='percent'?modifier.magnitude*100+'%':modifier.magnitude}`),...(modifiers.some(modifier=>modifier.magnitude===null)?[locale==='ru'?'Часть бонусов не участвует в расчёте: нет подтверждённого значения.':'Some bonuses are not modeled: their values are unavailable.']:[])].filter(Boolean).join('<br>')]));
    const icon=names.en[id]?.icon??'';
    items.push({id,name,icon,description,attackPercentBonuses,flatAttackBonuses,elements:[...new Set(modifiers.flatMap(modifier=>modifier.elements))]});
  }
  return {items,bindings,provenance:{relativePath,table:'ItemConfigs',fields:['row key','ItemType','Buffs[].BuffClass.AssetPathName'],modifiers:'temporary-attack-effects.json effects[].modifiers; only constant GE modifiers, no inference from unused ModifyData fields'}};
};
