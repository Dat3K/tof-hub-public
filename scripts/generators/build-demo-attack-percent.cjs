// Authored demonstration state; numeric effects come from generated metadata.
module.exports=function buildDemoAttackPercent(catalog,{matrixStacks={},resonance=[]}={}) {
  const draft=catalog.demoDraft;
  const sets=new Map();
  const benediction=draft.weapons.filter(w=>catalog.weapons.find(item=>item.id===w.id)?.role==='benediction').length>=2;
  for(const weapon of draft.weapons) {
    for(const id of new Set(weapon.matrices.map(m=>m.id).filter(Boolean))) {
      const pieces=weapon.matrices.filter(m=>m.id===id).sort((a,b)=>b.stars-a.stars);
      if(pieces.length<2)continue;
      const rank=pieces[1].stars;
      if(!sets.has(id)||sets.get(id).rank<rank)sets.set(id,{rank,bonuses:catalog.matrices.find(m=>m.id===id)?.effects?.find(e=>e.level===2)?.attackPercentBonuses??[]});
    }
  }
  const applies=(scope,element)=>scope==='all'||scope?.includes(element);
  const bonusValue=(b,rank)=>b.values.length===1?b.values[0]:b.values[rank]??0;
  for(const element of draft.combat.elements) {
    let value=0;
    for(const gear of draft.gear.filter(g=>g.equipped)) {
      for(const stat of [...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])]) {
        if(stat.type===`${element.id} Attack %`||stat.type==='Attack %')value+=stat.value;
      }
    }
    for(const [id,set] of sets)for(const bonus of set.bonuses) {
      if(!applies(bonus.elements,element.id)||bonus.condition&&(bonus.condition==='benediction')!==benediction)continue;
      if(bonus.conditional&&!matrixStacks[id])continue;
      const stacks=bonus.maxStacks?Math.min(bonus.maxStacks,matrixStacks[id]??1):1;
      value+=bonusValue(bonus,set.rank)*stacks;
    }
    catalog.consumables.forEach((group,index)=>{
      const item=group.items.find(item=>item.id===draft.consumables[index]);
      for(const bonus of item?.attackPercentBonuses??[])if(!bonus.conditional&&applies(bonus.elements,element.id))value+=bonusValue(bonus,0);
    });
    for(const chosen of draft.computing)for(const effect of catalog.computing.find(n=>n.id===chosen.id)?.effects??[]) {
      if(effect.attackStat==='Attack %'||effect.attackStat===`${element.id} Attack %`)value+=effect.levels.find(l=>l.level===chosen.level)?.value??0;
    }
    for(const chosen of draft.support) {
      const item=catalog.support.modules.find(m=>m.id===chosen.id);
      if(item&&!item.conditional&&(item.attackStat==='Attack %'||item.attackStat===`${element.id} Attack %`))value+=item.levels.find(l=>l.level===chosen.level)?.value??0;
    }
    for(const bonus of resonance)if(applies(bonus.elements,element.id))value+=bonus.value;
    element.attackPercent=value;
  }
};
