import { readGameSourceFileSync } from '../game-processors/processors/game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createLocalizationResolver } from '../game-processors/processors/localization-resolver';
import { gameAsset } from '../../packages/game-assets/src/resolver';

type Data = Record<string, any>;
type Mode = 'standard' | 'mmo';
const base = 'Hotta/Content/Resources/CoreBlueprints';
const overseas = 'Hotta/Content/ResourcesOverSea/CoreBlueprints';
const poolFiles = {
  standard: [`${overseas}/DataTable/Dungeon/OriginWarBuffPoolDataTable_Overseas.json`, `${base}/DataTable/OriginWarBuffPoolDataTable.json`],
  mmo: [`${base}/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json`, `${overseas}/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json`],
};
const tipFiles = {
  standard: [`${overseas}/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json`, `${base}/DataTable/GameplayEffectTipsDataTable.json`],
  mmo: [`${base}/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json`, `${overseas}/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json`, `${base}/DataTable/GameplayEffectTipsDataTable.json`],
};
const assetId = (value: string) => value.split('/').at(-1)!.split('.')[0].replace(/_C$/, '');
const gameplay = (value: string) => Boolean(value && value !== 'None' && !/EnvirSeasonDisplayForMon/i.test(value));
const iconUrl = (value: string) => gameAsset({ path: value, format: 'webp', baseUrl: '/game-assets', throwOnError: true, fallback: null });

/** Union of raw buff pools and historical season references. Never synthesize game text or icons. */
export function buildOowEffectCatalog(rawRoot: string, historicalBuffs: Data, seasons: Record<Mode, Data>, options: { supplementalRawRoot?: string } = {}) {
  const sources: { path: string; sha256: string; supplemental?: boolean }[] = [];
  const read = (relative: string): Data | null => {
    const primary = path.join(rawRoot, relative);
    const file = fs.existsSync(primary) || !options.supplementalRawRoot ? primary : path.join(options.supplementalRawRoot, relative);
    if (!fs.existsSync(file)) return null;
    const content = readGameSourceFileSync(file, 'utf8');
    if (!sources.some(source => source.path === relative)) sources.push({ path: relative, sha256: createHash('sha256').update(content).digest('hex'), ...(file !== primary ? { supplemental: true } : {}) });
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  };
  const rows = (value: Data | null): Data => (Array.isArray(value) ? value[0] : value)?.Rows || {};
  const locales = { en: read('Hotta/Content/Localization/Game/en/Game.json'), ru: read('Hotta/Content/Localization/Game/ru/Game.json') };
  if (!locales.en || !locales.ru) throw new Error('OoW effect catalog requires EN and RU game localization.');
  const modes = {} as Record<Mode, ReturnType<typeof buildMode>>;

  function buildMode(mode: Mode) {
    const pools = poolFiles[mode].map(file => ({ file, rows: rows(read(file)) }));
    if (!pools.some(pool => Object.keys(pool.rows).length)) throw new Error(`Missing ${mode} OoW buff pool.`);
    const tips = tipFiles[mode].map(file => ({ file, rows: rows(read(file)) }));
    if (mode === 'mmo' && !tips.slice(0, 2).some(table => Object.keys(table.rows).length)) throw new Error('MMO OoW GameplayEffectTipsDataTable_Balance is required for verified catalog icons.');
    const resolver = createLocalizationResolver();
    for (const locale of ['en', 'ru'] as const) {
      // MMO localization must never inherit Gacha text with a coinciding key.
      const dictionary = mode === 'mmo'
        ? Object.fromEntries(Object.entries(locales[locale]!).filter(([namespace]) => /balance/i.test(namespace)))
        : locales[locale]!;
      resolver.loadLocale(locale, dictionary);
    }
    const entries = new Map<string, { id: string; asset: string | null; aliases: Set<string>; seasons: Set<number>; poolRows: { file: string; row: string }[] }>();
    const historicalIcons = new Map<string, { icon: string; season: number; file: string; field: string }>();
    const environmentSources = new Map<string, { file: string; row: string; field: string }>();
    const aliases = new Map<string, string>();
    const add = (id: string, asset?: string | null, season?: number) => {
      if (!gameplay(asset || id) && !environmentSources.has((asset ? assetId(asset) : id).toLowerCase())) return null;
      const canonical = asset ? assetId(asset) : aliases.get(id.toLowerCase()) || id;
      const key = canonical.toLowerCase();
      const entry = entries.get(key) || { id: canonical, asset: asset || null, aliases: new Set<string>(), seasons: new Set<number>(), poolRows: [] };
      entry.aliases.add(id);
      entry.aliases.add(canonical);
      if (season != null) entry.seasons.add(season);
      entries.set(key, entry);
      for (const alias of entry.aliases) aliases.set(alias.toLowerCase(), canonical);
      return entry;
    };
    for (const pool of pools) for (const [id, row] of Object.entries<Data>(pool.rows)) {
      const entry = add(id, row.BuffID?.AssetPathName);
      entry?.poolRows.push({ file: pool.file, row: id });
    }
    // Older pools remain part of the historical imported export. Only use their exact source identity.
    for (const [id, buff] of Object.entries<Data>(historicalBuffs)) {
      const asset = buff.source?.assetPath;
      if (asset && (/Abilities_Balance/i.test(asset) ? 'mmo' : 'standard') === mode) add(id, asset);
    }
    const visit = (value: unknown, season: number, effectList = false, field = '') => {
      if (typeof value === 'string' && effectList) {
        const asset = value.startsWith('/Game/') ? value : historicalBuffs[value]?.source?.assetPath;
        add(asset && value.startsWith('/Game/') ? assetId(asset) : value, asset, season);
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach((item, index) => visit(item, season, effectList, `${field}[${index}]`)); return; }
      const record = value as Data;
      if (typeof record.id === 'string' && (effectList || 'descEn' in record || 'buffType' in record)) {
        const entry = add(record.id, record.source?.assetPath || historicalBuffs[record.id]?.source?.assetPath, season);
        // These are the existing verified seasonal MMO exports, not the legacy resolver's icon guesses.
        if (mode === 'mmo' && entry && record.icon) {
          const previous = historicalIcons.get(entry.id.toLowerCase());
          if (!previous || previous.season < season) historicalIcons.set(entry.id.toLowerCase(), {
            icon: record.icon, season, file: `oow/seasons/mmo_s${String(season).padStart(2, '0')}.json`, field: `${field}.icon`,
          });
        }
      }
      for (const key of ['stageMutators', 'dropBuffs', 'inherentBuffs']) if (record[key]) visit(record[key], season, true, `${field}.${key}`);
      for (const key of ['floors', 'enemies']) if (record[key]) visit(record[key], season, false, `${field}.${key}`);
    };
    for (const season of Object.values<Data>(seasons[mode])) visit(season, Number(season.season));
    if (mode === 'standard') {
      // Season files keep only ids; the monster pools carry the exact GameplayEffect class paths.
      for (const file of [`${overseas}/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json`, `${base}/DataTable/OriginWarMonsterPoolDataTable.json`]) {
        const visitBuffs = (value: unknown): void => {
          if (Array.isArray(value)) { value.forEach(visitBuffs); return; }
          if (!value || typeof value !== 'object') return;
          for (const buff of (value as Data).MonsterBuffID || []) {
            const asset = typeof buff === 'string' ? buff : buff?.AssetPathName;
            const entry = typeof asset === 'string' ? entries.get(assetId(asset).toLowerCase()) : undefined;
            if (entry && !entry.asset) entry.asset = asset;
          }
          Object.values(value).forEach(visitBuffs);
        };
        visitBuffs(rows(read(file)));
      }
    }
    // An effect without its own tip may apply exactly one other effect that has one (e.g. Buff_Curse_001 -> _Start).
    const referencedEffects = (asset: string | null) => {
      if (!asset) return [];
      const document = read(`${asset.replace(/^\/Game\//, 'Hotta/Content/').split('.')[0]}.json`);
      const self = assetId(asset).toLowerCase();
      // Applied effects are exported as GEObjs: {ObjectName: "BlueprintGeneratedClass'X_C'", ObjectPath: "Hotta/Content/Resources/Abilities/..."}.
      const applied = [...JSON.stringify(document ?? '').matchAll(/"GEObjs":\[([^\]]*)\]/g)]
        .flatMap(match => [...match[1].matchAll(/BlueprintGeneratedClass'(\w+)_C'","ObjectPath":"Hotta\/Content\/Resources\/Abilities\//g)].map(item => item[1]));
      return [...new Set(applied)].filter(id => id.toLowerCase() !== self);
    };
    if (mode === 'mmo') {
      const files = [base, overseas].map(root => `${root}/DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO.json`);
      for (const file of files) {
        for (const [row, pool] of Object.entries<Data>(rows(read(file)))) {
          for (const [monsterIndex, monster] of (pool.PoolMonsters || []).entries()) {
            for (const [buffIndex, buff] of (monster.MonsterBuffID || []).entries()) {
              const asset = typeof buff === 'string' ? buff : buff.AssetPathName;
              if (typeof asset !== 'string' || !/EnvirSeasonDisplayForMon/i.test(asset)) continue;
              const id = assetId(asset), key = id.toLowerCase();
              if (!environmentSources.has(key)) environmentSources.set(key, { file, row, field: `PoolMonsters[${monsterIndex}].MonsterBuffID[${buffIndex}]` });
              add(id, asset);
            }
          }
        }
      }
    }
    return [...entries.values()].map(entry => {
      let tip: Data | undefined;
      let tipSource: { file: string; row: string } | null = null;
      const findTip = (ids: string[]) => {
        for (const table of tips) {
          const match = Object.keys(table.rows).find(key => ids.some(alias => alias.toLowerCase() === key.toLowerCase()));
          if (match) return { tip: table.rows[match], source: { file: table.file, row: match } };
        }
        return null;
      };
      let found = findTip([...entry.aliases]);
      let tipVia: string | null = null;
      if (!found) {
        const applied = referencedEffects(entry.asset).map(id => ({ id, found: findTip([id]) })).filter(item => item.found);
        if (applied.length === 1) { found = applied[0].found; tipVia = applied[0].id; }
      }
      if (found) { tip = found.tip; tipSource = found.source; }
      const namespaces = mode === 'mmo' ? ['BuffDes_Balance', 'Voidbuffdes_balance'] : ['BuffDes', 'Voidbuffdes', 'ST_VoidClone'];
      const environment = environmentSources.get(entry.id.toLowerCase());
      const resolve = (field: 'Name' | 'Desc', locale: 'en' | 'ru') => {
        const candidates = [tip?.[field], ...(environment ? [{ TableId: field === 'Name' ? 'ST_Item_Balance' : 'BuffDes_Balance', Key: entry.id }] : []), ...namespaces.flatMap(namespace => [...entry.aliases].flatMap(id =>
          (field === 'Name' ? ['_name'] : ['_des', '_desc']).map(suffix => ({ TableId: namespace, Key: `${id}${suffix}` }))))].filter(Boolean);
        for (const candidate of candidates) {
          const result = resolver.resolve(candidate, { locale, clean: false });
          if (result.text && result.provenance.resolvedLocale && result.provenance.matchedKey) return { text: result.text, namespace: result.provenance.matchedNamespace, key: result.provenance.matchedKey, locale: result.provenance.resolvedLocale };
        }
        return null;
      };
      const name = { en: resolve('Name', 'en'), ru: resolve('Name', 'ru') };
      const description = { en: resolve('Desc', 'en'), ru: resolve('Desc', 'ru') };
      const icon = tip?.Icon?.AssetPathName;
      const historicalIcon = !tip ? historicalIcons.get(entry.id.toLowerCase()) : null;
      return {
        id: entry.id,
        name: { en: name.en?.text || entry.id, ru: name.ru?.text || name.en?.text || entry.id },
        description: { en: description.en?.text || '', ru: description.ru?.text || description.en?.text || '' },
        icon: gameplay(icon) ? iconUrl(icon) : historicalIcon?.icon ? iconUrl(historicalIcon.icon) : null,
        environment: Boolean(environment),
        seasons: [...entry.seasons].sort((a, b) => a - b),
        source: { asset: entry.asset, poolRows: entry.poolRows, tip: tipSource, ...(tipVia ? { tipVia } : {}), icon: gameplay(icon) ? { kind: 'effect-tips', ...tipSource, field: 'Icon.AssetPathName', assetPath: icon } : historicalIcon ? { kind: 'verified-season-export', ...historicalIcon } : null, environment: environment || null, name, description },
      };
    }).sort((a, b) => Number(b.environment) - Number(a.environment) || a.name.en.localeCompare(b.name.en, 'en', { numeric: true }));
  }
  modes.standard = buildMode('standard');
  modes.mmo = buildMode('mmo');
  return { schemaVersion: 1, sources, seasonCoverage: { standard: Object.keys(seasons.standard).length, mmo: Object.keys(seasons.mmo).length }, modes };
}
