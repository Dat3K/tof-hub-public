// Derive the authored example from generated source metadata, never preset totals.
module.exports=function buildDemoDamage(catalog) {
  const draft=catalog.demoDraft;
  for(const element of draft.combat.elements) {
    let damage=0;
    const applies=scope=>scope==='all'||scope?.includes(element.id);
    for(const gear of draft.gear.filter(g=>g.equipped)) {
      for(const stat of [...gear.rows,...(gear.augmented||gear.titan?gear.augments:[])]) {
        if(stat.type===`${element.id} Damage %`||stat.type==='Damage %')damage+=stat.value;
      }
    }
    for(const chosen of draft.synthesis) {
      for(const effect of catalog.synthesis.effects[chosen.id]??[]) {
        if(effect.stage<=chosen.stage&&applies(effect.damageScope))damage+=effect.damageValue??0;
      }
    }
    for(const chosen of draft.computing) {
      for(const effect of catalog.computing.find(n=>n.id===chosen.id)?.effects??[]) {
        if(applies(effect.damageScope))damage+=effect.levels.find(l=>l.level===chosen.level)?.value??0;
      }
    }
    for(const chosen of draft.support) {
      const item=catalog.support.modules.find(m=>m.id===chosen.id);
      // Mode-specific bonuses require an active content mode; the example has none.
      if(item&&!item.conditional&&applies(item.damageScope))damage+=item.levels.find(l=>l.level===chosen.level)?.value??0;
    }
    element.damage=damage;
  }
};
