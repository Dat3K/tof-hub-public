// Build and Info Simulacra consume identical generated weapon stat endpoints.
const fs=require('node:fs');
const path=require('node:path');
module.exports=function({pub,weapons,raw}) {
  const characters=JSON.parse(fs.readFileSync(path.join(pub,'en/simulacra.json'),'utf8')).items;
  // Raw growth is regenerated with the catalog; Info Simulacra reads the same file (loadServerSimulacra).
  const growth=require('./build-weapon-growth.cjs')({raw});
  require('./build-weapon-growth.cjs').write(path.join(pub,'game-data/weapon-growth.json'),growth);
  for(const weapon of weapons) {
    const character=characters.find(c=>c.id===weapon.id);
    if(!character?.base_stats||!character?.max_stats)continue;
    weapon.quality=character.rarity;
    weapon.stats={base_stats:character.base_stats,max_stats:character.max_stats,growth:growth[String(weapon.weaponId).toLowerCase()]??null};
  }
  return {source:'game-data/weapon-growth.json (raw); en/simulacra.json fallback'};
};
