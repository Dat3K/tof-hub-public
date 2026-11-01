// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, resources, isValidLocale, localized } from '@tof-hub/i18n';
import { LocalizedTextSchema } from '@tof-hub/contracts';
import { createLocalizationResolver } from '../../scripts/game-processors/processors/localization-resolver';
import { readGameSourceFileSync, withGameLocalizationSource } from '../../scripts/game-processors/processors/game-source-reader';
import { overlayGameLocalization, prepareLocalizationSources, publishLocaleProjection, writeLocalizationManifest, mergeLocaleProjection } from '../../tools/patch-exporter/src/localization';
import { getExportPathsForMode, loadExportRules } from '../../tools/patch-exporter/src/selective-list';
import { buildRuntimeData } from '../../scripts/generators/build-runtime-data.cjs';
import { fetchGameData, GameDataCache } from '../../apps/web/src/lib/game-data-client';
import { loadServerGameData } from '../../apps/web/src/lib/game-data-server';
import { createI18nServerInstance, resolveLocaleFromCookieGetter } from '../../apps/web/src/lib/i18n/server';

const roots: string[] = [];
function fixture() {
  const parent = path.resolve('ignore/all-game-locales/tests');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'case-'));
  roots.push(root);
  const write = (relative: string, value: unknown) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value)); return file;
  };
  return { root, write };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('all client cultures through extraction, game data and UI', () => {
  it('extracts every culture and preserves exact tags through cookies and i18next', async () => {
    const patterns = getExportPathsForMode(loadExportRules().rules, 'Text').map(pattern => new RegExp(`^${pattern}$`));
    for (const locale of SUPPORTED_LOCALES) {
      expect(patterns.some(pattern => pattern.test(`Hotta/Content/Localization/Game/${locale}/Game.locres:json`))).toBe(true);
      expect(isValidLocale(locale)).toBe(true);
      expect(resolveLocaleFromCookieGetter(name => name === 'tof_locale' ? locale : undefined).locale).toBe(locale);
      const instance = await createI18nServerInstance(locale);
      expect(instance.language).toBe(locale);
      expect(instance.t('common.close')).toBe(resources[locale].translation.common.close);
      if (locale !== 'en') expect(instance.t('common.close')).not.toBe('Close');
    }
    expect(isValidLocale('zh-hans-sg')).toBe(false);
    expect(isValidLocale('xx')).toBe(false);
  });

  it('overlays exact namespaces, retains English fallback, and isolates concurrent source reads', async () => {
    const f = fixture();
    const english = { ST_actorname: { same: 'Actor', missing: 'English fallback' }, UI: { same: 'Interface' } };
    const target = { ST_actorname: { same: 'Darsteller', missing: '' }, UI: { same: 'Oberfläche' } };
    const overlay = overlayGameLocalization(english, target);
    expect(overlay).toEqual({ table: { ST_actorname: { same: 'Darsteller', missing: 'English fallback' }, UI: { same: 'Oberfläche' } }, keys: 2, fallbackKeys: 1 });
    const original = f.write('raw/Hotta/Content/Localization/Game/en/Game.json', english);
    const de = f.write('de.json', overlay.table), ja = f.write('ja.json', { ST_actorname: { same: '登場人物' } });
    const values = await Promise.all([de, ja].map(file => withGameLocalizationSource(file, async () => {
      await Promise.resolve(); return JSON.parse(readGameSourceFileSync(original, 'utf8')).ST_actorname.same;
    })));
    expect(values).toEqual(['Darsteller', '登場人物']);
    expect(JSON.parse(fs.readFileSync(original, 'utf8'))).toEqual(english);
    withGameLocalizationSource(de, () => {
      const resolver = createLocalizationResolver();
      resolver.loadLocale('en', JSON.parse(readGameSourceFileSync(original, 'utf8')));
      resolver.loadLocale('en', [{ StringTable: { TableNamespace: 'ST_actorname', KeysToEntries: { same: 'Must not replace the translation' } } }]);
      expect(resolver.resolve({ Namespace: 'ST_actorname', Key: 'same' }, { locale: 'en' }).text).toBe('Darsteller');
    });
  });

  it('publishes cultures, localized shared fields, runtime details and source coverage', () => {
    const f = fixture();
    for (const locale of ['en', 'de', 'zh-Hans-SG']) f.write(`raw/Hotta/Content/Localization/Game/${locale}/Game.json`, { UI: { name: locale } });
    const sources = prepareLocalizationSources(path.join(f.root, 'raw'), path.join(f.root, 'work'));
    // zh-Hans-SG is a partial overlay and stays unprojected (UNPROJECTED_LOCALES).
    expect(sources.map(source => source.locale)).toEqual(['en', 'de']);
    f.write('main/build-page.json', { weapons: [{ id: 'test', name: { en: 'English', ru: 'Русский' }, hp: 123 }] });
    f.write('lane/build-page.json', { weapons: [{ id: 'test', name: { en: 'Deutsch', ru: 'Русский' }, hp: 999 }] });
    f.write('lane/en/simulacra.json', { gacha: [{ id: 'test', name: 'Deutsch', name_en: 'Deutsch', name_ru: 'Русский', skills: [{ name: 'Fähigkeit' }] }] });
    f.write('lane/en/items.json', { '1': { name: 'Gegenstand' } });
    publishLocaleProjection(path.join(f.root, 'lane'), path.join(f.root, 'main'), 'de');
    expect(JSON.parse(fs.readFileSync(path.join(f.root, 'main/de/items.json'), 'utf8'))).toEqual({ '1': { name: 'Gegenstand' } });
    const catalog = JSON.parse(fs.readFileSync(path.join(f.root, 'main/build-page.json'), 'utf8'));
    expect(catalog.weapons[0]).toMatchObject({ hp: 123, name: { en: 'English', de: 'Deutsch' } });
    buildRuntimeData(path.join(f.root, 'main'));
    const runtime = JSON.parse(fs.readFileSync(path.join(f.root, 'main/de/runtime/simulacra.json'), 'utf8'));
    expect(runtime._locale).toBe('de');
    const detail = JSON.parse(fs.readFileSync(path.join(f.root, 'main/de', runtime.gacha[0]._detail + '.json'), 'utf8'));
    expect(detail.skills[0].name).toBe('Fähigkeit');
    writeLocalizationManifest(path.join(f.root, 'main'), sources);
    const manifest = JSON.parse(fs.readFileSync(path.join(f.root, 'main/localization-manifest.json'), 'utf8'));
    expect(manifest.missingLocales).toContain('fr');
    expect(manifest.sources[1]).toMatchObject({ path: 'Hotta/Content/Localization/Game/de/Game.json', keys: 1, fallbackKeys: 0 });
    expect(manifest.sources[1]).not.toHaveProperty('projectionFile');
    expect(LocalizedTextSchema.parse({ en: 'A', ru: 'Б', de: 'C' }).de).toBe('C');
    expect(localized({ en: 'fallback', ru: 'резерв' }, 'ja')).toBe('fallback');
    // A localized pass may omit an entity; the English row is kept instead of failing the whole locale.
    expect(mergeLocaleProjection([{ id: 'one' }], [{ id: 'other' }], 'de')).toEqual([{ id: 'one' }]);
  });

  it('falls back only for absent datasets, including selected detail shards on the server', async () => {
    const requests: string[] = [];
    const fetchFn = async (url: string) => {
      requests.push(url);
      return { ok: url.includes('/en/'), status: url.includes('/en/') ? 200 : 404, json: async () => ({ language: 'en' }) } as Response;
    };
    expect(await fetchGameData('ja', 'simulacra', { fetchFn }, new GameDataCache())).toEqual({ language: 'en' });
    expect(requests).toEqual(['/game-data/ja/runtime/simulacra.json', '/game-data/en/runtime/simulacra.json']);
    let calls = 0;
    await expect(fetchGameData('ja', 'simulacra', { fetchFn: async () => { calls++; return { ok: false, status: 500 } as Response; } }, new GameDataCache())).rejects.toThrow('HTTP 500');
    expect(calls).toBe(1);
    const f = fixture();
    f.write('en/runtime/simulacra.json', { gacha: [{ id: 'test', _detail: 'runtime/details/simulacra/0123456789abcdef01234567' }] });
    f.write('en/runtime/details/simulacra/0123456789abcdef01234567.json', { id: 'test', full: true });
    expect(await loadServerGameData('ja', 'simulacra', { dataRoot: f.root, selectedId: 'test' })).toEqual({ gacha: [{ id: 'test', full: true }] });
    const corrupt = f.write('ja/runtime/simulacra.json', {}); fs.writeFileSync(corrupt, 'invalid JSON');
    await expect(loadServerGameData('ja', 'simulacra', { dataRoot: f.root })).rejects.toThrow();
  });
});
