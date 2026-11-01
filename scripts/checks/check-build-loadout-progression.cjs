// Independent boundary/benchmark audit. Deterministic byte freshness is checked
// separately by build-loadout-progression.cjs --check.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const d=JSON.parse(fs.readFileSync(path.join(root,'apps/web/public/game-data/build-loadout-progression.json'),'utf8'));
for(const p of Object.values(d.weapon.profiles)){
  assert.equal(p.progression.length,200);
  assert.equal(p.progression[0].requiredExp,40);
  assert.equal(p.progression.at(-1).requiredExp,1180);
  assert.equal(p.rawExpTotal,113800);
  assert.equal(p.level1ToMaxCandidates.lookupTargetLevel,113760);
  assert.equal(p.level1ToMaxCandidates.lookupCurrentLevel,112620);
  assert.equal(p.excludedRows[0].index,201);
}
const breakthrough=d.weapon.breakthroughProfiles.physic_ssr_tupo_AC;
assert.equal(breakthrough.progression.length,19);
assert.deepEqual(breakthrough.progression[0].items,{Item_Mine_physic:2});
assert.equal(breakthrough.progression[0].gold,400);
assert.equal(breakthrough.total.Gold,76000);
assert.equal(breakthrough.total.Item_Mine_physic_03,26);
assert.ok(breakthrough.excludedRows.some(r=>r.index===20&&r.MaxWeaponLevel===r.NeedWeaponLevel));
for(const b of d.weapon.bindings){assert.ok(d.weapon.profiles[b.upgradePack]);assert.ok(d.weapon.breakthroughProfiles[b.tupoPack]);}
const expected={n:[20,600],r:[50,6500],sr:[70,24800],ssr:[100,95300]};
for(const [id,p]of Object.entries(d.matrix.profiles)){
  const quality=id.split('_')[1];
  assert.equal(p.progression.length,expected[quality][0]);
  assert.equal(p.totalExp,expected[quality][1]);
}
assert.equal(d.matrix.profiles.matrix_ssr_1_strengthen.progression[0].requiredExp,100);
assert.equal(d.matrix.starProfiles.ssr_star.at(-1).cumulativeGold,71000);
assert.equal(d.matrix.starProfiles.ssr_star.at(-1).cumulativeCopies,3);
const p=d.pet.profiles.FightPet1_Upgrade;
assert.equal(p.progression.length,100);assert.equal(p.progression[0].requiredExp,0);
assert.equal(p.totalExp,61260);assert.equal(p.excludedRows[0].row,'FightPet1_Upgrade_101');
assert.equal(d.pet.pets.length,12);
const leia=d.pet.pets.find(p=>p.id==='FightPet_8');
assert.deepEqual(leia.gifts.filter(g=>g.preferred).map(g=>[g.id,g.exp]),[['Item_Jiuyu_Harvest_009',20],['Item_Jiuyu_Mine_01',20],['Item_Jiuyu_Mine_02',20]]);
assert.deepEqual(d.pet.pets.find(p=>p.id==='FightPet_11').gifts.map(g=>[g.id,g.exp,g.preferred]),[['PENPEN_Harvest',60,true]]);
for(const pet of d.pet.mmoCoverage){assert.equal(pet.missingLevels.length,14);assert.equal(pet.gifts[0].exp,900);}
for(const material of Object.values(d.materials))assert.ok(material.name.raw);
console.log('Verified weapon level/cap boundaries, 19 SSR breakthroughs, matrix quality totals/stars, pet XP and standard/MMO gift distinctions.');
