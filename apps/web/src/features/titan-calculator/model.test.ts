import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import type {HandbookTitanData} from '@/features/datamine/contracts/handbook';
import {assignTitanLevels,buildTitanModel,damageByTypeWithTitan,damageWithTitan,draftTitanLevels,isLegalTitan,NO_TITAN,rankTitans,removeTitan,titanEffect,titanStatsByLevel,type DamageVector,type TitanLevels,type TitanOptions} from './model';
import {parseDamageReport,parseDamageTable,parseDamageValue,parseTitanLevels,readTitanLevels,readTitanLevelStrip,totalMatches,weaponSlot} from './parse-table';
import {matchWeapon,type TitanWeapon} from './weapon-match';
import {EXAMPLE_TITAN,EXAMPLE_WEAPONS} from './titan-example';
import {createTitanStatHints} from './titan-stat-hints';
import {confirmDamageRows,editWeaponRow,finalValue,fromParsedTable} from './damage-table';

const data=JSON.parse(readFileSync('apps/web/public/game-data/handbook/titan.json','utf8')) as HandbookTitanData;
const model=buildTitanModel(data)!;
const screenshot:TitanLevels={normal:15,dodge:0,skill:6,discharge:3,dmgBoost:12,weakPoint:0};
const parse:DamageVector={normal:42.42e9,dodge:.016e9,discharge:17.68e9,passive:13.94e9,skill:19.73e9};
const off:TitanOptions={weakPoint:false};
const on:TitanOptions={weakPoint:true};

describe('Titan search space',()=>{
  it('reduces item permutations to distinct generated level sets of 12 × +3',()=>{
    expect(model.slots).toHaveLength(12);
    expect(model.candidates).toHaveLength(3022);
    expect(model.candidates.filter(candidate=>candidate.levels.weakPoint===0)).toHaveLength(970);
    for(const candidate of model.candidates)expect(Object.values(candidate.levels).reduce((a,b)=>a+b,0)).toBe(36);
  });
  it('keeps a legal item assignment for each level set',()=>{
    const best=rankTitans(parse,model,on)[0]!;
    const levels={normal:0,dodge:0,skill:0,discharge:0,dmgBoost:0,weakPoint:0};
    for(const {slot,options} of model.slots) {
      const option=options.find(item=>item.stat===best.assignment[slot])!;
      expect(option).toBeDefined();
      levels[option.stat]+=option.level;
    }
    expect(levels).toEqual(best.levels);
  });
  it('accepts the observed build and rejects sets the slots cannot hold',()=>{
    expect(isLegalTitan(screenshot,model)).toBe(true);
    expect(isLegalTitan({...screenshot,normal:18,skill:3},model)).toBe(false);
  });
  it('accepts attainable partial sets and rejects total and shared-slot conflicts',()=>{
    expect(isLegalTitan(NO_TITAN,model)).toBe(true);
    expect(isLegalTitan({...screenshot,normal:14,skill:4},model)).toBe(true);
    expect(isLegalTitan({...NO_TITAN,dmgBoost:10,weakPoint:8},model)).toBe(false);
    expect(isLegalTitan({normal:8,dodge:6,skill:6,discharge:6,dmgBoost:6,weakPoint:6},model)).toBe(false);
    expect(isLegalTitan({...NO_TITAN,normal:19},model)).toBe(false);
    expect(isLegalTitan({...NO_TITAN,normal:1.5},model)).toBe(false);
  });
  it('assigns the exact edited levels to legal rolls, including a partial roll and empty slots',()=>{
    const levels={...NO_TITAN,normal:4,discharge:3,weakPoint:3};
    const assignment=assignTitanLevels(levels,model)!;
    const totals={...NO_TITAN};
    for(const {slot,options} of model.slots) {
      const roll=assignment[slot];
      if(!roll)continue;
      expect(options.find(option=>option.stat===roll.stat)?.obtainable).toContain(roll.level);
      totals[roll.stat]+=roll.level;
    }
    expect(totals).toEqual(levels);
    expect(Object.keys(assignment).length).toBeLessThan(model.slots.length);
    expect(assignTitanLevels({...NO_TITAN,dmgBoost:10,weakPoint:8},model)).toBeNull();
  });
  it('uses obtainable levels and rejects a missing roll even if it is below the slot maximum',()=>{
    const sparse=structuredClone(data);
    sparse.pools=sparse.pools.slice(0,1);
    for(const property of sparse.pools[0]!.properties)property.levels=property.levels.filter(level=>level.level===3);
    const sparseModel=buildTitanModel(sparse)!;
    expect(isLegalTitan({...NO_TITAN,normal:3},sparseModel)).toBe(true);
    expect(isLegalTitan({...NO_TITAN,normal:2},sparseModel)).toBe(false);
  });
  it('orders the ready-to-use example by level and keeps its screenshot totals',()=>{
    expect(titanStatsByLevel(EXAMPLE_TITAN)).toEqual(['weakPoint','normal','skill','discharge','dodge','dmgBoost']);
    expect(isLegalTitan(EXAMPLE_TITAN,model)).toBe(true);
    expect(EXAMPLE_WEAPONS.map(({table})=>parseDamageTable(table).total)).toEqual([59.63e9,15.94e9,18.2e9]);
  });
});

describe('Titan damage',()=>{
  it('uses the generated curve value quoted in game',()=>{
    expect(titanEffect(model,'normal',15)).toBeCloseTo(.2441,4);
    expect(titanEffect(model,'normal',0)).toBe(0);
  });
  it('round-trips the parse through removing and restoring the worn Titan',()=>{
    for(const options of [off,on]) {
      const clean=removeTitan(parse,EXAMPLE_TITAN,model,options);
      const projected=damageByTypeWithTitan(clean,EXAMPLE_TITAN,model,options);
      for(const category of Object.keys(parse) as (keyof DamageVector)[])expect(projected[category]).toBeCloseTo(parse[category],0);
      expect(damageWithTitan(clean,EXAMPLE_TITAN,model,options)).toBeCloseTo(Object.values(parse).reduce((a,b)=>a+b,0),0);
    }
  });
  it('lets only Damage Boost and Weak Point raise Passive',()=>{
    const passive:DamageVector={normal:0,dodge:0,discharge:0,passive:1e9,skill:0};
    const best=rankTitans(passive,model,on)[0]!;
    expect(best.levels.dmgBoost+best.levels.weakPoint).toBe(18);
    expect(best.levels.weakPoint).toBe(18);
  });
  it('weights the Titan stat by the build damage and respects the Weak Point scenario',()=>{
    const clean:DamageVector={normal:100,skill:100,dodge:0,discharge:0,passive:0};
    const levels={...NO_TITAN,skill:6,weakPoint:18};
    const inactive=createTitanStatHints(levels,model,'en',false,clean);
    expect(inactive('skill')).toBe('Skill +12% · +6% to total build damage');
    expect(inactive('weakPoint')).toBe('All damage types 0% · 0% to total build damage · Without Weak Point');
    const active=createTitanStatHints(levels,model,'en',true,clean);
    expect(active('weakPoint')).toBe('All damage types +17.4% · +17.4% to total build damage · With Weak Point');
    expect(active('skill',3)).not.toBe(active('skill'));
  });
  it('never finds worse than the worn Titan and ignores Weak Point sets when it is off',()=>{
    const clean=removeTitan(parse,screenshot,model,off);
    const ranked=rankTitans(clean,model,off);
    expect(ranked[0]!.damage).toBeGreaterThanOrEqual(damageWithTitan(clean,screenshot,model,off));
    expect(ranked.every(item=>item.levels.weakPoint===0)).toBe(true);
    expect(ranked[0]!.damage).toBeGreaterThanOrEqual(ranked[1]!.damage);
  });
  it('sums a saved draft and rejects foreign values',()=>{
    expect(draftTitanLevels({gear:[{titan:true,rareId:'CommonAggravatingInjury',rareLevel:3},{titan:true,rareId:'CommonAggravatingInjury',rareLevel:2},{titan:false,rareId:'CommonAggravatingInjury',rareLevel:3},{titan:true,rareId:'FinalRigidity',rareLevel:3}]})?.dmgBoost).toBe(5);
    expect(draftTitanLevels(null)).toBeNull();
  });
});

describe('Damage table reading',()=>{
  it('corrects an unambiguous OCR typo against the weapon catalog',()=>{
    const weapon={id:'fixture',weaponId:'fixture',role:'dps',weapon:{en:'Crystal Blade',ru:'Хрустальный клинок'},elements:['Frost'],icon:''} satisfies TitanWeapon;
    expect(matchWeapon('CrystaI Blade',[weapon])).toBe(weapon);
    expect(matchWeapon('Хрустальный клинок',[weapon])).toBe(weapon);
    expect(matchWeapon('Crystal Blade',[weapon,{...weapon,id:'another'}])).toBeUndefined();
    expect(matchWeapon('Unrelated',[weapon])).toBeUndefined();
  });
  it('accepts exact short weapon names without guessing near matches',()=>{
    const weapon={id:'fixture',weaponId:'fixture',role:'dps',weapon:{en:'V2',ru:'Форма V2'},elements:['Frost'],icon:''} satisfies TitanWeapon;
    expect(matchWeapon('V2',[weapon])).toBe(weapon);
    expect(matchWeapon('V3',[weapon])).toBeUndefined();
  });
  const table=`Type Base DMG Final DMG DMG Boost Multiplier
Normal Attack 10.57m 490.2m 46.39
Dodge 0 0 0
Discharge 37.3m 3.09g 82.83
Passive 200m 13.94g 69.7
Skill 8271k 685.1m 82.83
Total 256.1m 18.2g 71.1`;
  it('reads units and every row',()=>{
    expect(parseDamageValue('13.94g')).toBeCloseTo(13.94e9);
    expect(parseDamageValue('8271k')).toBe(8271000);
    expect(parseDamageValue('n/a')).toBeNull();
    const parsed=parseDamageTable(table);
    expect(parsed.rows.normal).toMatchObject({final:490.2e6,status:'ok'});
    expect(parsed.rows.dodge).toMatchObject({final:0,status:'ok'});
    expect(parsed.rows.skill).toMatchObject({final:685.1e6,status:'ok'});
    expect(parsed.total).toBeCloseTo(18.2e9);
  });
  it('repairs a lost decimal point from the row product and flags what it cannot explain',()=>{
    const parsed=parseDamageTable('Normal Attack 10.57m 4902m 46.39\nSkill 8271k 123.4m 82.83');
    expect(parsed.rows.normal).toMatchObject({final:490.2e6,status:'corrected'});
    expect(parsed.rows.skill).toMatchObject({final:123.4e6,status:'check'});
  });
  it('keeps an OCR warning when editing other columns until Final DMG is corrected or confirmed',()=>{
    const weapon=fromParsedTable(parseDamageTable('Skill 8271k 123.4m 82.83'));
    const baseEdited=editWeaponRow(weapon,'skill','base','9m');
    expect(baseEdited.skill?.source?.status).toBe('check');
    expect(editWeaponRow(baseEdited,'skill','final','685.1m').skill?.source).toBeUndefined();
    const confirmed=confirmDamageRows(baseEdited);
    expect(confirmed.skill?.source).toBeUndefined();
    expect(finalValue(confirmed.skill)).toBe(123.4e6);
  });
  it('repairs a lost unit, g read as 9 and a lost multiplier point',()=>{
    const parsed=parseDamageTable('Normal Attack 350m 28.19 80.54\nDischarge 37.3m 3.099 8283');
    expect(parsed.rows.normal).toMatchObject({final:28.19e9,status:'corrected'});
    expect(parsed.rows.discharge).toMatchObject({final:3.09e9,multiplier:82.83,status:'corrected'});
  });
  it('reads the screenshot Total of 64g when the integer suffix is read as 9',()=>{
    const parsed=parseDamageTable('Normal 334.6m 30.749 91.85\nDodge 0 0 0\nDischarge 177.5m 19.159 107.84\nPassive 0 0\nSkill 127.8m 14.129 110.39\nTotal 640.0m 649 99.99');
    expect(parsed.totalRow).toMatchObject({final:64e9,status:'corrected'});
    expect(parsed.rows.normal?.final).toBe(30.74e9);
    expect(parseDamageValue('64G')).toBe(64e9);
    expect(parseDamageValue('64г')).toBe(64e9);
  });
  it('routes by a unique weapon share and preserves the independently reported Others share',()=>{
    const report=parseDamageReport('Total DMG 152\'m 133.39 12451.31','Skybreaker\n40.8%\nEvolution Cube\n10.9%\nNeverrest\n48%\nOthers\n0.3%');
    expect(report.total).toBe(133.3e9);
    expect(report.weapons.map(weapon=>weapon.name)).toEqual(['Skybreaker','Evolution Cube','Neverrest']);
    expect(weaponSlot(report,64e9)).toBe(2);
    expect(weaponSlot(report,47.85e9)).toBeNull();
    expect(report.othersShare).toBe(.003);
  });
  it('keeps a known selection and its weapon names when a sidebar percentage is misread',()=>{
    const sidebar='Skybreaker\n40.8%\nEvolution Cube\n10.9%\nNeverrest\n46%\nOthers\n0.3%';
    const report=parseDamageReport('',sidebar,2);
    expect(weaponSlot(report,null)).toBe(2);
    expect(report.weapons[2]?.name).toBe('Neverrest');
    expect(parseDamageReport('',sidebar).weapons).toEqual([]);
  });
  it('reads the OCR text of real in-game screens',()=>{
    const finals=(text:string)=>{
      const parsed=parseDamageTable(text);
      return {...Object.fromEntries(Object.entries(parsed.rows).map(([key,row])=>[key,row.final])),total:parsed.total};
    };
    const close=(actual:Record<string,number|null|undefined>,expected:Record<string,number>)=>{
      for(const [key,value] of Object.entries(expected))expect(actual[key]! / (value||1)).toBeCloseTo(value?1:0,2);
    };
    close(finals(`Basic Final Multiplier Duration
|} Total DMG 1328m 94.079 8611.97 .
Rosebud
Normal 10.57m 490.2m 46.39 .
Attack:
Evolution Cube Dodge: 0 0 °
Discharge: 33.29m 3086m 92.72
. Ce —————————8- Passive: 149.3m 13.949 93.28 «
Star of Oblivion -
Skill: 8271k 685. 1m 82.83 h
_ Total: 201.5m 18 29 90.30
oT Battle Duration: 0:11 |`),{normal:490.2e6,dodge:0,discharge:3086e6,passive:13.94e9,skill:685.1e6,total:18.2e9});
    close(finals(`Total DMG 1336m 94.569 8563.20
, Rosebud
Normal 374.6m 28.199 75.25 b
Attack: p
Evolution Cube Dodge: 0 0 0 p
Discharge: 183.9m 14.599 79.29 ’
Passive: 0 0 0 /
Star of Oblivion
skill: 216.4m 16.869 7788 *
Total: 775.0m 59.639 76.94 /
al Battle Duration: 2:05`),{normal:28.19e9,dodge:0,discharge:14.59e9,passive:0,skill:16.86e9,total:59.63e9});
    close(finals(`Total DMG 1322m 93.719 8701.65
Normal 181.8m 13.749 75.58
Attack:
Evolution Cube Dodge: 252.8k 16.41m 64.90
] Discharge: 0 0 0
8-- hind Passive: 0 0 0
Star of Oblivion
Skill: 154.4m 218'm 14.13
Total: 336.5m 15 949 47.37
a Battie Duration: 0:07`),{normal:13.74e9,dodge:16.41e6,discharge:0,passive:0,skill:2181e6,total:15.94e9});
  });
  it('keeps a complete Final when Base was misread and Total confirms it',()=>{
    const parsed=parseDamageTable('Normal 10.57m 490.2m 46.39\nDodge 0 0 0\nDischarge 33.29m 3086m 92.72\nPassive 149.3m 13.94g 93.28\nSkill 827k 685.1m 82.83\nTotal 201.5m 18.2g 90.30');
    expect(parsed.rows.skill).toMatchObject({final:685.1e6,status:'ok'});
  });
  it('ignores the summary line and weapon shares when labels are missing',()=>{
    const parsed=parseDamageTable('1328m 94.07g 8611.97\n63.4% aaa 10m 500m 50\nbbb 0 0 0\nccc 0 0 0\nddd 0 0 0\neee 1m 80m 80\nfff 11m 580m 52');
    expect(parsed.rows.normal?.final).toBe(500e6);
    expect(parsed.total).toBe(580e6);
  });
  it('does not assign arbitrary numbers to damage rows without labels or a complete table',()=>{
    expect(parseDamageTable('xxxx 10.57m 490.2m 46.39\nyyyy 1m 2m 2').rows).toEqual({});
  });
  it('recovers the exact value when a 1 is read as an apostrophe',()=>{
    const parsed=parseDamageTable("Skill: 154.4m 218'm 14.13");
    expect(parsed.rows.skill).toMatchObject({final:2181e6,status:'corrected'});
  });
  it('accepts decimal commas and rejects malformed separators',()=>{
    expect(parseDamageValue('490,2m')).toBe(490.2e6);
    expect(parseDamageValue('1,234')).toBe(1234);
    expect(parseDamageValue('1,,2m')).toBeNull();
  });
  it('compares rows with Total within display rounding',()=>{
    expect(totalMatches([28.19e9,0,14.59e9,0,16.86e9],59.63e9)).toBe(true);
    expect(totalMatches([20e9,0,14.59e9,0,16.86e9],59.63e9)).toBe(false);
    expect(totalMatches([1],null)).toBeNull();
  });
  it('reads Titan levels by generated names',()=>{
    const names=data.rareValues.map(item=>({id:item.id,name:item.name as unknown as Record<string,string|undefined>}));
    expect(parseTitanLevels('Normal Attack +15   Weak Point [1]\nDamage Boost +12\nSkill +6\nDischarge +3',names)).toEqual(screenshot);
    expect(parseTitanLevels('Lifesteal +3',names)).toBeNull();
    const panel='Weak Point Damage Boost\n18\nNormal Attack Damage Boost\n9\nDodge Attack Damage Boost\n0\nSkill Damage Boost\n6\nDischarge Damage Boost\n3\nDamage Boost\n0';
    expect(readTitanLevels(panel,names)).toEqual({normal:9,dodge:0,skill:6,discharge:3,dmgBoost:0,weakPoint:18});
    expect(readTitanLevels('Discharge Damage Boost\n3',names)).toEqual({discharge:3});
    expect(readTitanLevelStrip('Normal Attack Dodge Attack Skill Discharge Damage Boost Weak Point\n9 0 6 3 0 18',names))
      .toEqual({normal:9,dodge:0,skill:6,discharge:3,dmgBoost:0,weakPoint:18});
  });
});
