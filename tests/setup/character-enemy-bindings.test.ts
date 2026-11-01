// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEnemyIdentityResolver, traceEnemyClass } from '../../scripts/game-processors/processors/enemy-identity';
import { createLocalizationResolver } from '../../scripts/game-processors/processors/localization-resolver';
import { createCharacterMediaBindings } from '../../scripts/game-processors/processors/character-media-bindings';

const roots: string[] = [];
function fixture() {
  const parent = path.resolve('ignore/all-game-locales/tests'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'bindings-')); roots.push(root);
  const write = (relative: string, value: unknown) => {
    const file = path.join(root, 'Hotta/Content', relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value));
  };
  return { root, write };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('future encounter and character identities', () => {
  it('follows exact Blueprint parents and confirmed portrait mappings without abbreviations or numeric guesses', () => {
    const f = fixture(), parent = '/Game/Resources/CoreBlueprints/Character/Monster/ExactParent.ExactParent_C';
    const child = '/Game/Resources/CoreBlueprints/Character/BigSecretMonster/Elite/FutureVariant.FutureVariant_C';
    f.write('Resources/CoreBlueprints/Character/BigSecretMonster/Elite/FutureVariant.json', [{ Type: 'BlueprintGeneratedClass', Super: { ObjectPath: parent } }]);
    f.write('Resources/CoreBlueprints/Character/Monster/ExactParent.json', [{ Name: 'Default__ExactParent_C', Properties: { MonsterName: { Namespace: 'ST_actorname', Key: 'ExactName' } } }]);
    const resolver = createLocalizationResolver();
    resolver.loadLocale('en', { ST_actorname: { ExactName: 'Verified boss', Future: 'Do not borrow' }, Unrelated: { FutureVariant: 'Wrong namespace' } });
    resolver.loadLocale('ru', { ST_actorname: { ExactName: 'Проверенный босс' } });
    const identity = createEnemyIdentityResolver(f.root, resolver, { mapping: { ExactParent: { resolutionStatus: 'confirmed', image: '/Game/Resources/UI/void/boss/exact' } } })(child);
    expect(identity).toMatchObject({ classPath: child, actorKey: 'ExactName', name: { en: 'Verified boss', ru: 'Проверенный босс' }, portrait: '/Game/Resources/UI/void/boss/exact' });
    expect(identity.classChain).toHaveLength(2);
    const missing = createEnemyIdentityResolver(f.root, resolver, { mapping: {} })('/Game/Other/Future_006.Future_006_C');
    expect(missing.name).toBeNull(); expect(missing.portrait).toBeNull();
    f.write('Resources/CoreBlueprints/Character/Monster/ExactParent.json', [{ Type: 'BlueprintGeneratedClass', Super: { ObjectPath: child } }]);
    expect(traceEnemyClass(f.root, child)).toHaveLength(2);
  });

  it('discovers an unknown character’s linked UP and gashapon art without a character-folder list', () => {
    const f = fixture(), cb = 'Resources/CoreBlueprints/DataTable/';
    const character = { id: 'future', imitation_id: 'imitation_future', avatar_id: 'future_avatar', weapon_id: 'FutureWeapon' };
    f.write(cb + 'Fashion/DT_Imitation.json', [{ Rows: { imitation_future: { WeaponId: 'FutureWeapon', CharacterType: 'RCT_FUTURE' } } }]);
    f.write('SevenForest/Blueprint/Lottery/BP_WeaponLottery_future.json', [{ Properties: { IsUPLottery: true, ssrWeaponIDArray: ['FutureWeapon'], LotteryWidget: { AssetPathName: '/Game/SevenForest/Blueprint/UI/FutureWidget.FutureWidget_C' } } }]);
    f.write('SevenForest/Blueprint/UI/FutureWidget.json', [{ Properties: { Hero: { AssetPathName: '/Game/Resources/UI/chouka/Newchouka/UP_Future/actual.actual' } } }]);
    f.write(cb + 'Gashapon/GashaponActivityConfigDataTable.json', [{ Rows: { future_activity: { PreviewActorClass: { AssetPathName: '/Game/SevenForest/Blueprint/UI/PreviewFuture.PreviewFuture_C' }, PoolIDArray: ['future_pool'] } } }]);
    f.write('SevenForest/Blueprint/UI/PreviewFuture.json', [{ Properties: { OwnerImitationId: 'imitation_future' } }]);
    f.write(cb + 'Gashapon/GashaponPoolConfigDataTable.json', [{ Rows: { future_pool: { Picture: { AssetPathName: '/Game/Resources/UI/AdvancedGashapon/future_splash.future_splash' } } } }]);
    const bindings = createCharacterMediaBindings(f.root, [character]).get('future');
    expect(bindings.map(binding => binding.ref)).toContain('/Game/Resources/UI/chouka/Newchouka/UP_Future/actual.actual');
    expect(bindings.map(binding => binding.ref)).toContain('/Game/Resources/UI/AdvancedGashapon/future_splash.future_splash');
    expect(bindings.every(binding => binding.source.file && binding.source.field)).toBe(true);
  });
});
