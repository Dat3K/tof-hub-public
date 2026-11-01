// Shared pipeline policy for the site and the standalone capture source archive.
// Inputs are named raw food rows, generated food/potion definitions and generated ATK modifiers.
function buildCapturePolicy(foodRows,foodCatalog,attack,itemRows={}) {
  const allowed={};
  for(const [id,row] of [...Object.entries(foodRows),...Object.entries(itemRows).filter(([,row])=>row.ItemType==='ITEM_TYPE_FOOD'&&row.AvailableServerMode!=='EHottaServerModeLimit::MMOServerOnly')])for(const buff of row.Buffs??[]) {
    const className=buff.BuffClass?.AssetPathName?.split('.').at(-1);
    if(!className||className==='None')continue;
    const entry=allowed['Default__'+className]??={kind:'food',rows:[]};
    if(!entry.rows.includes(id))entry.rows.push(id);
  }
  for(const item of foodCatalog.potions??[])if(item.subcategory==='shots')for(const buff of item.buffs??[]) {
    const definition='Default__'+buff.buff_id+'_C',modifiers=attack.effects[definition]?.modifiers;
    if(modifiers?.length&&modifiers.every(modifier=>modifier.kind==='percent'&&[2.5/100,3.5/100].includes(modifier.magnitude)))
      allowed[definition]={kind:'injection',rows:[item.id]};
  }
  return {schemaVersion:1,allowed,provenance:{
    food:{relativePath:'Hotta/Content/Resources/CoreBlueprints/DataTable/cooking/CookingFoodDataTable.json',table:'CookingFoodDataTable',fields:['row key','Buffs[].BuffClass.AssetPathName']},
    itemFoods:{relativePath:'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json',table:'ItemConfigs',fields:['row key','ItemType=ITEM_TYPE_FOOD','Buffs[].BuffClass.AssetPathName']},
    injections:{source:'pipeline en/food.json potions: subcategory=shots; buffs[].buff_id',
      modifiers:'temporary-attack-effects.json effects[].modifiers; raw Properties.Modifiers / ModuleExtraModifierInfos',
      conversion:'User policy permits ATK fractions 2.5/100 and 3.5/100; every modifier must match; no display-text matching'},
    version:'Raw export version unknown; generated 2026-10-11'}};
}
module.exports={buildCapturePolicy};
