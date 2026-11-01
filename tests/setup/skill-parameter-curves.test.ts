import {describe,it,expect} from 'vitest';
import {restoreSkillCurveTimes,type SkillTipCurves} from '../../scripts/normalize-game-data/skill-parameter-curves';

describe('skill parameter curve normalization',()=>{
  it('retains original Time coordinates and interpolation instead of enumerating compressed points',()=>{
    const curves:SkillTipCurves=new Map([['skill_1',{source:'fixture/SkillUpdateTips.json',curve:{InterpMode:'RCIM_Linear',Keys:[{Time:1,Value:10},{Time:7,Value:70},{Time:21,Value:210},{Time:100,Value:210}]}}]]);
    const weapon={skills:[{parameters:[{key:'skill_1',levels:{1:10,2:70,3:210,4:210}}]}]};
    expect(restoreSkillCurveTimes(weapon,curves)).toBe(1);
    expect(weapon.skills[0]!.parameters[0]!.levels).toEqual({1:10,7:70,21:210,100:210});
  });
});

