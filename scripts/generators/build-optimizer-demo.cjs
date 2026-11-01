const sitePaths=require('../lib/site-paths.cjs');
/* eslint-disable @typescript-eslint/no-require-imports -- Node pipeline follows the existing CommonJS generators. */
// Authored inventory scenarios; every stat value and pool is derived from generated build data.
const fs=require('node:fs');
const path=require('node:path');
const {getBuildIdealItem,getBuildTitanPrimaries,getBuildTitanProjection,getBuildAugmentPools}=require('../../packages/game-domain/src/build/stats.ts');

function buildOptimizerDemo(catalog,pub) {
  const reference=catalog.reference,draft=catalog.demoDraft;
  const element=draft.rv?.element||draft.combat.elements.reduce((best,next)=>next.attack>best.attack?next:best).id;
  const combat=draft.combat.elements.find(stat=>stat.id===element);
  const profile={flatAttack:combat.attack/(1+(combat.attackPercent??0)),attackPercent:combat.attackPercent??0,damagePercent:combat.damage,
    critChance:Math.min(1,draft.combat.crit/reference.critFormula.denominators[draft.enemyLevel]+draft.combat.additionalCritRate),
    critDamageBonus:draft.combat.critDamage,critDenominator:reference.critFormula.denominators[draft.enemyLevel]};
  const pieces=[];
  for(const meta of catalog.gear) {
    const donor=draft.gear.find(item=>item.id===meta.id);
    const ideal=getBuildIdealItem({types:reference.statTypes,growth:reference.titanGrowth,element,percentElements:[element],includeCrit:true,
      allowedTypes:meta.allowedStats,maxStats:reference.limits.maxNumOfRandomStats,maxRolls:reference.limits.maxNumOfRandomStatRolls,profile});
    const initial=ideal.stats.map(stat=>({type:stat.type,beforeTitan:stat.before,value:stat.before}));
    // Fill free rows with non-attack types first, so an unused element can legally be added below.
    const fillers=[...meta.allowedStats].sort((a,b)=>Number(/Attack|Damage/.test(a))-Number(/Attack|Damage/.test(b)));
    for(const type of fillers)if(initial.length<reference.limits.maxNumOfRandomStats&&!initial.some(row=>row.type===type))
      initial.push({type,beforeTitan:reference.statTypes[type].randomStatDefaultValue,value:reference.statTypes[type].randomStatDefaultValue});
    for(const [index,scenario] of ['plain','partial','mature'].entries()) {
      // Deliberately different bases make current-vs-transfer ordering visible. These qualities/counts are demo inputs.
      const quality=[.92,.7,.86][index];
      let rows=initial.map(row=>{const bounds=reference.statTypes[row.type];const value=bounds.randomStatDefaultValue+(row.value-bounds.randomStatDefaultValue)*quality;
        return {...row,beforeTitan:Number(value.toFixed(8)),value:Number(value.toFixed(8))};});
      const primary=getBuildTitanPrimaries(rows,reference.statTypes)[0];
      const projection=getBuildTitanProjection(rows,reference.statTypes,reference.titanGrowth,primary);
      const pools=getBuildAugmentPools(rows,reference.titanGrowth,primary);
      // Mature examples intentionally have other elemental lower stats, making a useful reroll possible.
      const pool=[...pools.priority].sort((a,b)=>scenario==='mature'?Number(a.startsWith('Physical'))-Number(b.startsWith('Physical')):0);
      const types=[...pool,...pools.fallback].slice(0,reference.limits.maxNumOfAugmentStats);
      const augmented=scenario!=='plain';
      if(augmented)rows=rows.map((row,i)=>({...row,value:Number((row.value+(projection.random[i]-row.value)*(scenario==='mature'?.91:.2)).toFixed(8))}));
      const gear={id:meta.id,equipped:false,enhancement:donor.enhancement,stars:reference.limits.maxNumOfRandomStatRolls,
        titan:scenario==='mature',augmented,rows,augments:augmented?types.map(type=>({type,value:Number((projection.added(type)*(scenario==='mature'?.9:.3)).toFixed(8))})):[],
        base:[],rareId:scenario==='mature'?donor.rareId:'',rareLevel:scenario==='mature'?donor.rareLevel:0,augmentCount:[0,8,480][index]};
      pieces.push({key:`demo-${meta.id}-${scenario}`,scenario,gear});
    }
  }
  // No copy of an equipped piece: the backpack never contains what is worn (user, 2026-10-09). Every demo piece has
  // known pre-Titan values, so developed pieces also show their state before Titan.
  const output={schemaVersion:1,source:'demo',pieces};
  fs.mkdirSync(path.join(pub,'game-data'),{recursive:true});
  const target=path.join(pub,'game-data/optimizer-demo.json');
  fs.writeFileSync(target+'.tmp',JSON.stringify(output)+'\n');fs.renameSync(target+'.tmp',target);
  return output;
}
module.exports=buildOptimizerDemo;
if(require.main===module) {
  const pub=sitePaths.publicDir;
  const catalog=JSON.parse(fs.readFileSync(path.join(pub,'game-data/build-page.json'),'utf8'));
  const output=buildOptimizerDemo(catalog,pub);
  console.log(`Generated optimizer-demo.json: ${output.pieces.length} synthetic inventory pieces`);
}
