import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectEnemyCosmeticItems,
  prettifyEnemyAssetName,
  resolveEnemyName,
} from './cosmetics';

const VOID_SUBDIR = path.join('UI', 'void', 'boss');
const WORLDBOSS_SUBDIR = path.join('UI', 'WorldBossList', 'BOSS');

let tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tmpRoots = [];
});

function makeMirror(voidFiles: string[], worldbossFiles: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmetics-enemies-'));
  tmpRoots.push(root);
  const mirror = path.join(root, 'game-assets', 'webp', 'Hotta', 'Content', 'Resources');
  fs.mkdirSync(path.join(mirror, VOID_SUBDIR), { recursive: true });
  fs.mkdirSync(path.join(mirror, WORLDBOSS_SUBDIR), { recursive: true });
  for (const file of voidFiles) {
    fs.writeFileSync(path.join(mirror, VOID_SUBDIR, file), 'webp');
  }
  for (const file of worldbossFiles) {
    fs.writeFileSync(path.join(mirror, WORLDBOSS_SUBDIR, file), 'webp');
  }
  return root;
}

describe('collectEnemyCosmeticItems', () => {
  it('keeps void bigboss portraits and drops thumbnails and other files', () => {
    const root = makeMirror(
      ['bigboss036.webp', 'bigboss036.thumb.webp', 'boss036.webp', 'notes.txt'],
      []
    );
    const items = collectEnemyCosmeticItems(root);
    expect(items.map((i) => i.id)).toEqual(['enemy_void_bigboss036']);
    expect(items[0]).toMatchObject({
      name_en: 'Culton',
      name_ru: 'Калтон',
      icon: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss036.webp',
    });
  });

  it('keeps worldboss portraits without _yuan and drops thumbnails', () => {
    const root = makeMirror(
      [],
      ['Boss_7.webp', 'World_Boss_4.webp', 'World_Boss_4.thumb.webp', 'boss_yuan_9.webp']
    );
    const items = collectEnemyCosmeticItems(root);
    expect(items.map((i) => i.id)).toEqual([
      'enemy_worldboss_boss_7',
      'enemy_worldboss_world_boss_4',
    ]);
  });

  it('keeps same-named portraits from both sources as distinct items', () => {
    const root = makeMirror(['bigboss069.webp'], ['bigboss069.webp']);
    const items = collectEnemyCosmeticItems(root);
    expect(items.map((i) => i.id).sort()).toEqual([
      'enemy_void_bigboss069',
      'enemy_worldboss_bigboss069',
    ]);
  });

  it('returns no enemies when the mirror dirs are missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmetics-enemies-empty-'));
    tmpRoots.push(root);
    expect(collectEnemyCosmeticItems(root)).toEqual([]);
  });

  it('prettifies asset base names for display', () => {
    expect(prettifyEnemyAssetName('bigboss_SY_08')).toBe('Bigboss SY 08');
    expect(prettifyEnemyAssetName('Boss_7')).toBe('Boss 7');
    expect(prettifyEnemyAssetName('World_Boss_4')).toBe('World Boss 4');
  });

  it('resolves known enemy names with Russian translations', () => {
    expect(resolveEnemyName('bigboss036')).toEqual({ en: 'Culton', ru: 'Калтон' });
    expect(resolveEnemyName('World_Boss_4')).toEqual({ en: 'Sobek', ru: 'Собек' });
    expect(resolveEnemyName('Boss_7')).toEqual({ en: 'Devourer', ru: 'Пожиратель' });
    expect(resolveEnemyName('bigboss024')).toEqual({ en: 'Taotie', ru: 'Таоте' });
  });

  it('falls back to the prettified file name for unknown assets', () => {
    expect(resolveEnemyName('bigboss026')).toEqual({ en: 'Bigboss026', ru: 'Bigboss026' });
  });

  it('leaves portraits shared by two bosses unnamed instead of guessing', () => {
    // bigboss015 = Apophis/Sobek, bigboss069 = Hive Mother/Eva,
    // bigboss_sy_02 = Valkyrie/Gaia in fce-data.ts.
    expect(resolveEnemyName('bigboss015')).toEqual({ en: 'Bigboss015', ru: 'Bigboss015' });
    expect(resolveEnemyName('bigboss069')).toEqual({ en: 'Bigboss069', ru: 'Bigboss069' });
    expect(resolveEnemyName('bigboss_SY_02')).toEqual({ en: 'Bigboss SY 02', ru: 'Bigboss SY 02' });
  });
});
