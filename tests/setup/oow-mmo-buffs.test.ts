import { describe, expect, it } from 'vitest';
import {
  getMmoMonsterBuffAssetPath,
  isMmoGameplayMonsterBuff,
} from '../../scripts/game-processors/processors/build-user-stats';

describe('MMO OOW enemy buff references', () => {
  it('keeps gameplay buffs and omits empty slots and the environment display marker', () => {
    const firstPath = '/Game/Resources/Abilities_Balance/Buff/Player/Level/Origin/mon/buff_origin_balance99_4th.buff_origin_balance99_4th_C';
    const secondPath = '/Game/Resources/Abilities_Balance/Buff/Player/Level/Origin/mon/buff_origin_balance99_11.buff_origin_balance99_11_C';
    const refs = [
      { AssetPathName: firstPath },
      'None',
      { AssetPathName: secondPath },
      { AssetPathName: '/Game/Resources/Abilities/Buff/Common/EnvirSeasonDisplayForMon/Buff_EnvirDisplay_Firewall.Buff_EnvirDisplay_Firewall_C' },
    ];

    const gameplayRefs = refs.filter(isMmoGameplayMonsterBuff);

    expect(gameplayRefs).toHaveLength(2);
    expect(gameplayRefs.map(getMmoMonsterBuffAssetPath)).toEqual([
      firstPath,
      secondPath,
    ]);
  });

  it('recognizes a None object path and normalizes Windows separators', () => {
    expect(isMmoGameplayMonsterBuff({ AssetPathName: 'None.None' })).toBe(false);
    expect(isMmoGameplayMonsterBuff({ AssetPathName: '\\Game\\Resources\\Abilities\\Buff\\Common\\EnvirSeasonDisplayForMon\\Buff_EnvirDisplay_Firewall.Buff_EnvirDisplay_Firewall_C' })).toBe(false);
    expect(isMmoGameplayMonsterBuff({ AssetPathName: '\\Game\\Abilities\\Buff\\Enemy\\Buff_RealEffect.Buff_RealEffect_C' })).toBe(true);
  });
});
