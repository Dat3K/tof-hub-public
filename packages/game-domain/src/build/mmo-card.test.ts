import {describe,expect,it} from 'vitest';
import {fillMmoText,mmoCardParams,mmoCardStats,mmoThresholdLevel} from './mmo-card';

describe('MMO card rules',()=>{
  // Raw EnchantmentEffectFigure_MMO rows of Charge Expansion Pack (orange_Skill_6); the in-game text at 4 cards reads
  // 29.638% / 118.55% / 237.1% / 6s.
  const charge=[
    {value:100,curve:[[1,0.0445],[2,0.106625],[3,0.188875],[4,0.296375]] as const},
    {value:100,curve:[[1,0.178],[2,0.4265],[3,0.7555],[4,1.1855]] as const},
    {value:100,curve:[[1,0.356],[2,0.853],[3,1.511],[4,2.371]] as const},
    {value:1,curve:[[1,6],[4,6]] as const},
  ];
  it('resolves expansion-card parameters by the number of equipped cards',()=>{
    expect(mmoCardParams(charge,4)).toEqual([29.638,118.55,237.1,6]);
    expect(mmoCardParams(charge,1)[0]).toBe(4.45);
    expect(fillMmoText('{0}% … {3}s {4}',mmoCardParams(charge,4))).toBe('29.638% … 6s {4}');
  });
  it('scales expansion-card base stats by star row and level curve',()=>{
    // old8_orange_AtkHp_attribute_0/_3 × CommonLevel_MMO.CommonAtkAdded (Lv. 80 = 1593.5).
    const stats=[{prop:'CommonAtkAdded',values:[0.108088,0.129706,0.153125,0.180147]}];
    const curves={CommonAtkAdded:[[1,1],[80,1593.5],[84,1881]] as const};
    expect(mmoCardStats(stats,0,curves,80)[0]!.value).toBeCloseTo(172.238,3);
    expect(mmoCardStats(stats,3,curves,80)[0]!.value).toBeCloseTo(287.064,3);
  });
  it('counts reached threshold levels',()=>{
    const levels=[{value:1250},{value:1500},{value:1925},{value:2750}];
    expect(mmoThresholdLevel(levels,1249)).toBe(0);
    expect(mmoThresholdLevel(levels,1500)).toBe(2);
    expect(mmoThresholdLevel(levels,9999)).toBe(4);
  });
});
