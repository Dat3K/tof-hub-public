import {describe,expect,it} from 'vitest';
import {hasKnownBase,hasKnownBuildBase,isVerifiedGear,isVerifiedBuild,isVerifiedPlayer} from './verification';

describe('Ranking verified seal',()=>{
  it('verifies a player by their own profile import, independently of the gear behind the score',()=>{
    expect(isVerifiedPlayer({verified:true})).toBe(true);
    expect(isVerifiedPlayer({verified:false})).toBe(false);
    expect(isVerifiedPlayer({})).toBe(false);
  });
  it('matches the known-base seal, with zero known and missing values unknown',()=>{
    for(const statsBeforeTitan of [null,[],[null,null]])expect(hasKnownBase({statsBeforeTitan})).toBe(false);
    expect(hasKnownBase({statsBeforeTitan:[0,null]})).toBe(true);
    expect(hasKnownBuildBase([])).toBe(false);
    expect(hasKnownBuildBase([{statsBeforeTitan:[0]},{statsBeforeTitan:null}])).toBe(false);
    expect(hasKnownBuildBase([{statsBeforeTitan:[0]},{statsBeforeTitan:[42]}])).toBe(true);
  });
  it('verifies gear with known originals from the owner’s .tofbuild, Titan or not',()=>{
    const ownTitan={titan:true,source:'self',statsBeforeTitan:[0,null]};
    expect(isVerifiedGear(ownTitan)).toBe(true);
    expect(isVerifiedGear({source:'self',statsBeforeTitan:[5]})).toBe(true);
    for(const gear of [{...ownTitan,source:'inspect'},
      {...ownTitan,source:undefined},{...ownTitan,statsBeforeTitan:null}])expect(isVerifiedGear(gear)).toBe(false);
    expect(isVerifiedBuild([])).toBe(false);
    expect(isVerifiedBuild([ownTitan,{...ownTitan,source:'inspect'}])).toBe(false);
    expect(isVerifiedBuild([ownTitan,{source:'self',statsBeforeTitan:[5]}])).toBe(true);
    expect(isVerifiedBuild([ownTitan,ownTitan])).toBe(true);
  });
});
