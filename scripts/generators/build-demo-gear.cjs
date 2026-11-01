// Editorial scenarios; values and legal pools come from the generated contract.
const {enumerateBuildRolls,getBuildTitanPrimaries,getBuildTitanProjection,getBuildAugmentPools}=require('../../packages/game-domain/src/build/stats.ts');
const scenarios=[
  {id:'helmet',types:['Frost Attack','Attack','HP','Flame Resistance'],rolls:[3,1,1,0],quality:[.95,.88,.83,0]},
  {id:'spaulders',types:['Frost Attack','Attack','HP','Flame Resistance'],rolls:[0,0,4,1],quality:[0,0,.15,0]},
  {id:'armor',types:['HP','Resistance','Flame Resistance','Frost Resistance'],rolls:[1,0,4,0],quality:[.3,0,.9,0]},
  {id:'bracers',types:['Frost Attack','Attack','HP','Flame Resistance'],rolls:[3,1,1,0],quality:[0,0,0,0]},
  {id:'belt',types:['Physical Attack','Attack','Flame Attack','Volt Attack'],rolls:[5,0,0,0],quality:[.72,0,0,0]},
  {id:'pants',types:['Attack','Frost Attack','HP','Flame Resistance'],rolls:[4,0,0,1],quality:[.7,0,0,.2]},
  {id:'boots',types:['Frost Attack','Attack','Crit','HP'],rolls:[0,0,5,0],quality:[0,0,1,0]},
  {id:'gloves',types:['Frost Attack','Attack','Crit','Flame Resistance'],rolls:[0,0,1,4],quality:[0,0,0,.75]},
  {id:'visor',types:['Frost Attack %','Crit Rate %','Frost Attack','HP'],rolls:[1,3,1,0],quality:[1,1,.2,0]},
  {id:'core',types:['Frost Damage %','Volt Attack %','Frost Attack','HP'],rolls:[1,3,1,0],quality:[1,1,.4,0]},
  {id:'exoskeleton',types:['Frost Damage %','Frost Attack %','HP %','Flame Resistance %'],rolls:[0,0,4,1],quality:[0,0,1,1]},
  {id:'reactor',types:['Physical Damage %','Volt Attack %','Frost Attack','Attack'],rolls:[5,0,0,0],quality:[1,0,0,0]},
];
// User's original Titan sample. Exoskeleton's Normal Attack is outside its raw
// pool, so retain the +2 level with the legal Skill property instead.
const rareScenarios={
  helmet:['SlowMult',1],spaulders:['FinalRigidity',2],armor:['CommonAggravatingInjury',3],
  bracers:['CommonWeaknessIncreaseInjury',1],belt:['EvadeAtkAggravatingInjury',2],pants:['EvadeAtkAggravatingInjury',3],
  boots:['CommonDamageRecoverHPMult',1],gloves:['FinalRigidity',2],visor:['CommonBlockMult',3],
  core:['CommonWeaknessIncreaseInjury',1],exoskeleton:['SkillAtkAggravatingInjury',2],reactor:['ChangeSkillAtkAggravatingInjury',3],
};
module.exports=function demoGear(gear,reference) {
  const snapshot=require('../data/build-stat-ranges-reference.json');
  for(const [name,expected] of Object.entries(snapshot.stats)) {
    const actual=reference.statTypes[name];
    for(const [field,key] of [['randomStatDefaultValue','base'],['randomStatMinRollValue','minRoll'],['randomStatMaxRollValue','maxRoll']]) {
      if(!actual||Math.abs(actual[field]-expected[key])>1e-8)throw new Error('Stat range differs from approved screenshot: '+name+' '+field);
    }
  }
  return gear.map((item,index)=>{
    const scenario=scenarios.find(s=>s.id===item.id);
    if(!scenario||scenario.rolls.reduce((a,b)=>a+b,0)!==reference.limits.maxNumOfRandomStatRolls)throw new Error('Invalid demo scenario '+item.id);
    const round=(value,type)=>type.isPercentageBased?Number(value.toFixed(8)):Math.floor(value);
    let rows=scenario.types.map((type,i)=>{
      const bounds=reference.statTypes[type];
      if(!bounds)throw new Error('Missing demo stat bounds '+type);
      const increment=round(bounds.randomStatMinRollValue+(bounds.randomStatMaxRollValue-bounds.randomStatMinRollValue)*scenario.quality[i],bounds);
      const beforeTitan=Number((bounds.randomStatDefaultValue+scenario.rolls[i]*increment).toFixed(8));
      return {type,beforeTitan,value:beforeTitan};
    });
    const history=enumerateBuildRolls(rows,reference.statTypes,item.stars,reference.limits.maxNumOfRandomStatRolls);
    if(!history.some(path=>path.every((n,i)=>n===scenario.rolls[i])))throw new Error('Invalid demo roll history '+item.id);
    const primaries=getBuildTitanPrimaries(rows,reference.statTypes);
    const primary=primaries[0];
    if(primaries.length!==1)throw new Error('Ambiguous demo augmentation pool '+item.id);
    const projection=getBuildTitanProjection(rows,reference.statTypes,reference.titanGrowth,primary);
    rows=rows.map((row,i)=>{
      const maximum=projection.random[i];
      if(maximum===null||maximum<row.beforeTitan)throw new Error('Unsupported demo growth '+item.id);
      const progress=index===6?1:.35+((index*17+i*11)%60)/100;
      return {...row,value:round(row.beforeTitan+(maximum-row.beforeTitan)*progress,reference.statTypes[row.type])};
    });
    const pools=getBuildAugmentPools(rows,reference.titanGrowth,primary);
    const preferred=['Frost','Volt'];
    const priority=[...pools.priority].sort((a,b)=>{
      const rank=type=>preferred.includes(type.split(' ')[0])?preferred.indexOf(type.split(' ')[0]):-1;
      return (rank(a)<0?99:rank(a))-(rank(b)<0?99:rank(b));
    });
    const augmentTypes=priority.concat(pools.fallback).slice(0,reference.limits.maxNumOfAugmentStats);
    if(augmentTypes.length!==reference.limits.maxNumOfAugmentStats)throw new Error('Incomplete demo augmentation '+item.id);
    const augments=augmentTypes.map((type,i)=>{
      const bounds=reference.statTypes[type],maximum=projection.added(type);
      if(maximum===null)throw new Error('Illegal demo augmentation '+type);
      const progress=index===6?1:.4+((index*13+i*17)%55)/100;
      return {type,value:round(bounds.randomStatDefaultValue+(maximum-bounds.randomStatDefaultValue)*progress,bounds)};
    });
    const [rareId,rareLevel]=rareScenarios[item.id];
    if(!reference.titanRare.pools[item.id]?.includes(rareId))throw new Error('Illegal demo Titan property '+item.id+' '+rareId);
    return {...item,rows,augments,rareId,rareLevel};
  });
};
