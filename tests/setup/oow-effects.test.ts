import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { buildOowEffectCatalog } from '../../scripts/normalize-game-data/oow-effects';

it('unions historical and unused pool effects, merges exact asset aliases, and isolates MMO localization', () => {
  const scratch = path.resolve('ignore/oow-effects-tests');
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'case-'));
  const write = (relative: string, data: unknown) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  try {
    const pool = [{ Rows: { alias: { BuffID: { AssetPathName: '/Game/buff_fixture.buff_fixture_C' } } } }];
    write('Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarBuffPoolDataTable_Overseas.json', pool);
    write('Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json', pool);
    const tips = 'supplemental/Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json';
    write(tips, [{ Rows: { buff_fixture: { Icon: { AssetPathName: 'None' } } } }]);
    write('Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO.json', [{ Rows: {
      fixture: { PoolMonsters: [{ MonsterBuffID: [{ AssetPathName: '/Game/EnvirSeasonDisplayForMon/fixture_environment.fixture_environment_C' }] }] },
    } }]);
    for (const locale of ['en', 'ru']) write(`Hotta/Content/Localization/Game/${locale}/Game.json`, {
      BuffDes: { buff_fixture_name: 'Gacha fixture', buff_fixture_des: 'Gacha description', buff_old_name: 'Archived fixture' },
      BuffDes_Balance: { buff_fixture_name: 'MMO fixture', buff_fixture_des: 'MMO description' },
      ST_Item_Balance: { fixture_environment: 'Environment fixture' },
    });
    const historical = { alternate: { source: { assetPath: '/Game/buff_fixture.buff_fixture_C' } } };
    const result = buildOowEffectCatalog(root, historical, {
      standard: { old: { season: 1, floors: [{ stageMutators: [{ id: 'buff_old', buffType: 'fixture' }, { id: 'alternate', buffType: 'fixture' }], dropBuffs: ['buff_untranslated'] }] } },
      mmo: { old: { season: 7, floors: [{ stageMutators: [{ id: 'buff_oldIcon', buffType: 'fixture', icon: '/game-assets/webp/Hotta/Content/Resources/Icon/verified-fixture.webp' }] }] } },
    }, { supplementalRawRoot: path.join(root, 'supplemental') });
    expect(result.modes.standard).toHaveLength(3);
    expect(result.modes.mmo).toHaveLength(3);
    expect(result.modes.standard.find(effect => effect.id === 'buff_fixture')?.seasons).toEqual([1]);
    expect(result.modes.mmo[0]).toMatchObject({ name: { en: 'Environment fixture' }, environment: true });
    expect(result.modes.mmo.find(effect => effect.id === 'buff_fixture')).toMatchObject({ name: { en: 'MMO fixture' }, description: { en: 'MMO description' }, seasons: [], icon: null });
    expect(result.modes.mmo.find(effect => effect.id === 'buff_oldIcon')).toMatchObject({ icon: '/game-assets/webp/Hotta/Content/Resources/Icon/verified-fixture.webp', source: { icon: { kind: 'verified-season-export', season: 7 } } });
    expect(result.modes.standard.find(effect => effect.id === 'buff_old')).toMatchObject({ description: { en: '' }, icon: null });
    expect(result.modes.standard.find(effect => effect.id === 'buff_untranslated')).toMatchObject({ name: { en: 'buff_untranslated' }, seasons: [1] });
    expect(result.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
    write(tips, [{ Rows: { buff_oldIcon: { Icon: { AssetPathName: '/Game/Resources/Icon/fixture.fixture' } } } }]);
    const refreshed = buildOowEffectCatalog(root, historical, { standard: {}, mmo: { old: { season: 7, floors: [{ stageMutators: [{ id: 'buff_oldIcon', buffType: 'fixture', icon: '/game-assets/older.webp' }] }] } } }, { supplementalRawRoot: path.join(root, 'supplemental') });
    expect(refreshed.modes.mmo.find(effect => effect.id === 'buff_oldIcon')?.icon).toBe('/game-assets/webp/Hotta/Content/Resources/Icon/fixture.webp');
    expect(refreshed.sources.find(source => source.path.endsWith('GameplayEffectTipsDataTable_Balance.json'))?.supplemental).toBe(true);
  } finally {
    if (!path.resolve(root).startsWith(scratch + path.sep)) throw new Error('Fixture outside scratch');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('published catalogs cover every historical floor, drop and enemy effect without duplicate identities', () => {
  const directory = path.resolve('apps/web/public/game-data/en/oow');
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'effects.json'), 'utf8'));
  for (const mode of ['standard', 'mmo']) {
    const effects = catalog.modes[mode];
    expect(new Set(effects.map((effect: any) => effect.id.toLowerCase())).size).toBe(effects.length);
    const identity = (asset: string) => asset.split('/').at(-1)!.split('.')[0].replace(/_C$/, '').toLowerCase();
    const available = new Set(effects.map((effect: any) => effect.id.toLowerCase()));
    const verify = (value: any, season: number) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(item => verify(item, season)); return; }
      if (value.id && ('descEn' in value || 'buffType' in value)) {
        const asset = value.source?.assetPath;
        if (!/EnvirSeasonDisplayForMon/i.test(asset || value.id) && value.id !== 'None') {
          const id = asset ? identity(asset) : value.id.toLowerCase();
          expect(available.has(id), `${mode} S${season}: ${id}`).toBe(true);
        }
      }
      for (const field of ['floors', 'enemies', 'stageMutators', 'dropBuffs', 'inherentBuffs']) verify(value[field], season);
    };
    for (const file of fs.readdirSync(path.join(directory, 'seasons')).filter(name => mode === 'mmo' ? /^mmo_s\d+\.json$/.test(name) : /^s\d+\.json$/.test(name))) {
      const season = JSON.parse(fs.readFileSync(path.join(directory, 'seasons', file), 'utf8'));
      verify(season, season.season);
    }
  }
});
