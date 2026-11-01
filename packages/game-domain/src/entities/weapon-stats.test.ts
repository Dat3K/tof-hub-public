import {describe,expect,it} from 'vitest';
import {getWeaponStatsAtLevel,type WeaponGrowth} from './weapon-stats';

// Raw growth of Killknife_physic (Yan Miao, Equilibrium) and Rubilia_thunder (Lost Art) from weapon-growth.json.
const run=(value:number)=>[{from:1,to:200,value}];
const sixStar=[1,1.166667,1.333333,1.5,1.666667,1.833333,2];
const equilibrium:WeaponGrowth={maxLevel:200,stats:[
  {id:'attack',base:19.114079,increments:run(3.15534),stars:[1,1.166667,1.493333,1.66,2.146667,2.313333,2.48]},
  {id:'hp',base:1165.0486,increments:run(194.17476),stars:sixStar},
  {id:'crit',base:13.652913,increments:run(2.427185),stars:sixStar},
]};
const lostArt:WeaponGrowth={maxLevel:200,stats:[
  {id:'attack',base:18.93204,increments:run(3.15534),stars:sixStar},
  {id:'hp',base:1165.0486,increments:run(194.17476),stars:sixStar},
  {id:'crit',base:14.563107,increments:run(2.427185),stars:sixStar},
]};

describe('weapon stats from raw growth',()=>{
  it('matches in-game weapon panels',()=>{
    expect(getWeaponStatsAtLevel({growth:equilibrium},170,6)).toMatchObject({attack:1377,hp:68349,crit:852});
    expect(getWeaponStatsAtLevel({growth:equilibrium},200,6)).toMatchObject({attack:1612,hp:79999,crit:998});
    expect(getWeaponStatsAtLevel({growth:lostArt},0,0)).toMatchObject({level:0,attack:18,hp:1165,crit:14});
  });
  it('keeps the legacy endpoints when no raw growth exists',()=>{
    const legacy={base_stats:{attack:19,hp:1165,crit:15},max_stats:{level:200,attack:1612,attack_base:650,hp:79999,crit:1000}};
    expect(getWeaponStatsAtLevel(legacy,200).crit).toBe(1000);
  });
});
