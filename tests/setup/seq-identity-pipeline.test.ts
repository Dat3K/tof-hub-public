// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSeqIdentityResolver } from '../../scripts/game-processors/processors/build-seq-data';
import { createLocalizationResolver } from '../../scripts/game-processors/processors/localization-resolver';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const parent = path.resolve('ignore/seq-identity-tests');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'raw-'));
  roots.push(root);
  const write = (file: string, data: unknown) => {
    const full = path.join(root, 'Hotta/Content', file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(data));
  };
  const classPath = '/Game/Resources/FB/BigSecret/BOSS/FutureVariant.FutureVariant_C';
  const pool = (otherClass = classPath) => write('ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/EndlessNewLandMonsterPoolDataTable_Overseas.json', [{ Rows: {
    ice_36: { PoolMonsters: [{ AttributeID: 'endless_special_boss_36', MonsterClass: { AssetPathName: classPath } }] },
    fire_36: { PoolMonsters: [{ AttributeID: 'endless_special_boss_36', MonsterClass: { AssetPathName: otherClass } }] },
  } }]);
  pool();
  const loc = createLocalizationResolver();
  loc.loadLocale('en', { ST_actorname: { ExactParent: 'Future boss', FutureVariant: undefined }, Unrelated: { FutureVariant: 'Wrong name' } });
  loc.loadLocale('ru', { ST_actorname: { ExactParent: 'Будущий босс' } });
  return { root, write, pool, loc };
}
describe('Sequential raw identity pipeline', () => {
  it('resolves a future stage through exact class inheritance, preserving source rows', () => {
    const f = fixture();
    f.write('Resources/FB/BigSecret/BOSS/FutureVariant.json', [{ Type: 'BlueprintGeneratedClass', Super: { ObjectPath: '/Game/Resources/CoreBlueprints/Character/Monster/ExactParent.ExactParent_C' } }]);
    const resolved = createSeqIdentityResolver(f.root, f.loc)('endless_special_boss_36');
    expect(resolved?.enemyNameEn).toBe('Future boss');
    expect(resolved?.enemyNameRu).toBe('Будущий босс');
    expect(resolved?.identitySource.rows).toEqual(['ice_36', 'fire_36']);
  });
  it('keeps missing identities unknown and refuses conflicting elemental pools', () => {
    const f = fixture();
    expect(createSeqIdentityResolver(f.root, f.loc)('endless_special_boss_36')?.enemyNameEn).toBeUndefined();
    f.pool('/Game/Other.Other_C');
    expect(createSeqIdentityResolver(f.root, f.loc)('endless_special_boss_36')).toBeNull();
  });
  it('terminates cyclic Blueprint inheritance and does not shorten variant suffixes', () => {
    const f = fixture();
    f.loc.loadLocale('en', { ST_actorname: { Future: 'Must not borrow this name' } });
    f.write('Resources/FB/BigSecret/BOSS/FutureVariant.json', [{ Type: 'BlueprintGeneratedClass', Super: { ObjectPath: '/Game/Resources/FB/BigSecret/BOSS/FutureVariant.FutureVariant_C' } }]);
    expect(createSeqIdentityResolver(f.root, f.loc)('endless_special_boss_36')?.enemyNameEn).toBeUndefined();
  });
});
