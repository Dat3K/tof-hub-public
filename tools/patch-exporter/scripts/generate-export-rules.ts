import fs from 'node:fs';
import path from 'node:path';

/**
 * Rebuilds config/export-rules.json `rules` from what the pipeline actually reads
 * (trace-report.ts over a traced run of processors + normalize + media + generators).
 *
 *   tsx scripts/generate-export-rules.ts --report <trace-report.json> [--write]
 *
 * JSON: every directory holding a read table is exported (its direct children), and the
 * ability trees are exported whole because the temporary-effect scan walks them.
 * PNG: directories holding a used texture are exported (direct children) so new files in
 * known folders arrive automatically; the roots below are exported recursively because
 * new content lands in new sub-folders there (character icons, banners, seasons, bosses).
 * Requirements whose files the pipeline no longer reads are dropped.
 */

/** Exported with all sub-folders (new characters/banners/seasons add folders here). */
export const RECURSIVE_ROOTS: ReadonlyArray<{ root: string; type: 'json' | 'png'; why: string; smallMode?: boolean }> = [
  { root: 'Hotta/Content/Resources/UI/shuxingpiaozi', type: 'png', why: 'stat icons referenced by generated game-data' },
  { root: 'Hotta/Content/Resources/UI/liaotian', type: 'png', why: 'chat sticker posters and animation atlases, including future subfolders' },
  { root: 'Hotta/Content/Resources/UI/liaotian', type: 'json', why: 'chat sticker material, texture and animation source metadata' },
  { root: 'Hotta/Content/Resources/Icon/Avatar', type: 'json', why: 'avatar material instances, parents and particle animation metadata' },
  { root: 'Hotta/Content/Resources/UI/mingpian/Memory', type: 'png', why: 'badge full illustrations and inventory icons' },
  { root: 'Hotta/Content/SevenForest/Blueprint/UI', type: 'json', why: 'character-specific lottery widgets, gashapon previews and dorm UI asset references' },
  { root: 'Hotta/Content/Resources/UI/LeisureRoom', type: 'png', why: 'dorm artwork bound through exported character and room references' },
  { root: 'Hotta/Content/Resources/UI/MMOGashapon', type: 'png', why: 'MMO gashapon artwork referenced by the exported preview graph' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipmentSlot', type: 'json', why: 'MMO expansion tables and future season subfolders' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure', type: 'json', why: 'MMO expansion effect curves, including future season folders' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/DataTable/EffectFigure_MMO', type: 'json', why: 'MMO level and equipment effect curves' },
  { root: 'Hotta/Content/Resources/UI/qianghua/TuoZhan_MMO', type: 'png', why: 'MMO expansion slot art and future season folders' },
  { root: 'Hotta/Content/Resources/FB/BigSecret/BOSS', type: 'json', why: 'Sequential boss Blueprint identities and parent class references' },
  { root: 'Hotta/Content/Resources/Abilities', type: 'json', why: 'temporary ATK effect scan walks every gameplay effect' },
  { root: 'Hotta/Content/Resources/Abilities_MMO', type: 'json', why: 'MMO food and effect buffs' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/Character/BigSecretMonster', type: 'json', why: 'MMO Bygone variants and Blueprint identity inheritance' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/Character/Monster', type: 'json', why: 'Enemy Blueprint ancestors and localized actor identities' },
  { root: 'Hotta/Content/Resources/CoreBlueprints/Character/OriginWarMonster', type: 'json', why: 'Shared OOW enemy identities and exact inherited portrait mappings' },
  { root: 'Hotta/Content/Resources/FB/SHTT/Monster', type: 'json', why: 'MMO encounter enemy Blueprint inheritance' },
  { root: 'Hotta/Content/Resources/Icon', type: 'png', why: 'item/skill/buff/weapon icons; new characters add folders' },
  { root: 'Hotta/Content/ResourcesOverSea/Icon', type: 'png', why: 'Global-only item icons' },
  { root: 'Hotta/Content/Resources/UI/AdvancedGashapon', type: 'png', why: 'banner art and gashapon splash discovery' },
  { root: 'Hotta/Content/Resources/UI/chouka', type: 'png', why: 'Special Order and Balance banner art, including future banner folders (Newchouka, UP*, Balance)' },
  { root: 'Hotta/Content/Resources/UI/buff', type: 'png', why: 'buff icons referenced by OOW season buffs, MMO OOW and effect catalogs; new buffs add files' },
  { root: 'Hotta/Content/Resources/UI/Talent', type: 'png', why: 'MMO Brainfield (naoyu) attribute and buff icons, including disabled variants' },
  { root: 'Hotta/Content/Resources/UI/Activity/huodong/NewGgy', type: 'png', why: 'event and season wallpapers' },
  { root: 'Hotta/Content/Resources/UI/shizhuang', type: 'png', why: 'imitation/outfit art per character' },
  { root: 'Hotta/Content/Resources/UI/huanxing', type: 'png', why: 'character splash (lihui)' },
  { root: 'Hotta/Content/Resources/UI/void/boss', type: 'png', why: 'FCE / Void boss portraits', smallMode: true },
  { root: 'Hotta/Content/Resources/UI/fuben/taofazuozhan', type: 'png', why: 'Original and MMO raid art, including new raid portraits and subfolders', smallMode: true },
  { root: 'Hotta/Content/Resources/UI/WorldBossList', type: 'png', why: 'world boss portraits', smallMode: true },
  { root: 'Hotta/Content/Resources/UI/SHTT/guaiwu', type: 'png', why: 'OOW enemy portraits', smallMode: true },
  { root: 'Hotta/Content/Resources/UI/plugin/FB/bigmon', type: 'png', why: 'large boss art' },
  { root: 'Hotta/Content/Resources/UI/PetFight/skill', type: 'png', why: 'MMO OoW Firewall and pet combat effect icons' },
  { root: 'Hotta/Content/Resources/UI/login/loading', type: 'png', why: 'loading screen wallpapers' },
  { root: 'Hotta/Content/L10N/zh-Hans/Resources/UI/login/loading', type: 'png', why: 'original loading screens' },
];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Literal raw table paths (`Hotta/Content/...json`, or `Content/...json` joined to the Hotta root) written in the
 * processors, normalizers and generators under `scripts/`. Template paths and localization are left to the trace.
 */
export function declaredTablePaths(scriptsDir: string): string[] {
  const found = new Set<string>();
  const literal = /(?:Hotta\/Content|(?<![A-Za-z])Content)\/[A-Za-z0-9_/.-]+?\.json/g;
  const walk = (dir: string, recursive: boolean): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !/^(node_modules|__tests__|curated|data|deployment)$/.test(entry.name)) walk(file, true);
      } else if (/\.(c?js|ts|mjs)$/.test(entry.name) && !/\.(test|d)\./.test(entry.name)) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(literal)) {
          const raw = match[0].startsWith('Hotta/') ? match[0] : `Hotta/${match[0]}`;
          if (!/\/Localization\/Game\//.test(raw) && !/\/X\/T\.json$/.test(raw)) found.add(raw);
        }
      }
    }
  };
  walk(scriptsDir, false);
  for (const sub of ['generators', 'checks', 'game-processors', 'normalize-game-data', 'lib', '_shared']) {
    if (fs.existsSync(path.join(scriptsDir, sub))) walk(path.join(scriptsDir, sub), true);
  }
  return [...found].sort();
}

/**
 * Raw texture paths (`Hotta/...png`, `Engine/Content/...png`) of every image URL in the generated
 * datasets under `<public>/game-data`. Media URLs drop `Content/` for engine textures.
 */
export function referencedSiteTextures(publicDir: string): string[] {
  const root = path.join(publicDir, 'game-data');
  const found = new Set<string>();
  if (!fs.existsSync(root)) return [];
  const media = /(?:^|\/)((?:Hotta|Engine)\/[^"'?#]+?)\.(?:webp|png)$/i;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') return Object.values(value).forEach(visit);
    if (typeof value !== 'string') return;
    const match = value.split(/[?#]/)[0].match(media);
    if (!match) return;
    const raw = match[1].startsWith('Engine/') && !match[1].startsWith('Engine/Content/') ? `Engine/Content/${match[1].slice(7)}` : match[1];
    found.add(`${raw}.png`);
  };
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.json')) {
        try { visit(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { /* not a dataset */ }
      }
    }
  };
  walk(root);
  return [...found].sort();
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  const reportFile = option('report');
  const refreshDeclared = process.argv.includes('--refresh-declared');
  if (!reportFile && !refreshDeclared) throw new Error('--report <trace-report.json> or --refresh-declared is required');
  const report = reportFile ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { requiredRaw: {} };
  const required: string[] = Object.keys(report.requiredRaw);
  // Archived WebP can satisfy an old run without touching the game PNG. Keep
  // every declared enemy portrait package in extraction rules regardless of trace.
  const enemyMapping = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../../scripts/game-processors/processors/monster-image-mapping.json'), 'utf8'));
  for (const entry of Object.values(enemyMapping) as Array<{ normalizedPackagePath?: string }>) {
    if (entry.normalizedPackagePath) required.push(`${entry.normalizedPackagePath}.png`);
  }
  // A trace only sees what that run read: a run from an older dump or with archived media skips
  // textures the site still serves, and the next game run would then drop them from the archive.
  // Keep every texture the current generated site data references.
  const publicDir = path.resolve(option('public') ?? path.join(__dirname, '../../../apps/web/public'));
  const siteTextures = referencedSiteTextures(publicDir);
  required.push(...siteTextures);
  console.log(`Site-referenced textures kept: ${siteTextures.length} (${publicDir})`);
  // Alternative table locations the code already handles (Resources vs ResourcesOverSea, renamed folders)
  // are not read when the traced client lacks them; keep them so a client that moves a table still exports it.
  const declared = declaredTablePaths(path.resolve(__dirname, '../../../scripts'));
  required.push(...declared);
  console.log(`Table paths named in pipeline code kept: ${declared.length}`);
  const rulesFile = path.resolve(__dirname, '../config/export-rules.json');
  const config = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));

  const underRecursive = (file: string, type: 'json' | 'png') =>
    RECURSIVE_ROOTS.some((r) => r.type === type && file.toLowerCase().startsWith(r.root.toLowerCase() + '/'));
  const dirs = { json: new Set<string>(), png: new Set<string>() };
  let localization = false;
  for (const file of required) {
    if (!/^(Hotta|Engine)\//.test(file)) continue; // Config-folder mapping files are copied, not unpacked.
    if (/\/Localization\/Game\/[^/]+\/Game\.json$/.test(file)) {
      localization = true;
      continue;
    }
    const type = file.endsWith('.png') ? 'png' : file.endsWith('.json') ? 'json' : null;
    if (!type || underRecursive(file, type)) continue;
    dirs[type].add(file.slice(0, file.lastIndexOf('/')));
  }

  const rules: Array<{ category: string; pattern: string; type: 'json' | 'png'; required: boolean; why?: string; smallMode?: boolean }> = [];
  if (localization) {
    rules.push({ category: 'localization', pattern: 'Hotta/Content/Localization/Game/[^/]+/Game\\.locres:json', type: 'json', required: true });
  }
  for (const root of RECURSIVE_ROOTS) {
    rules.push({ category: 'tree', pattern: `${escape(root.root)}/.*\\.uasset:${root.type}`, type: root.type, required: false, why: root.why, ...(root.smallMode ? { smallMode: true } : {}) });
  }
  for (const type of ['json', 'png'] as const) {
    for (const dir of [...dirs[type]].sort()) {
      const directoryPattern = escape(dir).replace(/\/L10N\/[^/]+\//, '/L10N/[^/]+/');
      const pattern = `${directoryPattern}/[^/]+\\.uasset:${type}`;
      if (!rules.some(rule => rule.pattern === pattern)) rules.push({ category: type === 'json' ? 'tables' : 'textures', pattern, type, required: false });
    }
  }

  const requiredSet = new Set(required.map((file) => file.toLowerCase()));
  // A declaration-only refresh adds coverage; only an actual trace may prune it.
  if (refreshDeclared) {
    for (const rule of config.rules) if (!rules.some(candidate => candidate.pattern === rule.pattern)) rules.push(rule);
  }
  const keptRequirements = refreshDeclared ? config.requirements : config.requirements.filter((req: { paths?: string[] }) =>
    (req.paths ?? []).some((p) => requiredSet.has(p.toLowerCase()) || !p.includes('/')),
  );
  const summary = {
    rules: rules.length,
    jsonDirs: dirs.json.size,
    pngDirs: dirs.png.size,
    requirementsKept: keptRequirements.length,
    requirementsDropped: config.requirements.length - keptRequirements.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes('--write')) {
    const next = {
      ...config,
      version: '2.0.0',
      description: refreshDeclared
        ? 'Selective extraction rules refreshed from declared pipeline paths and generated site references, retaining the existing traced baseline (scripts/generate-export-rules.ts).'
        : 'Selective extraction rules generated from a traced pipeline run and declared references (scripts/generate-export-rules.ts).',
      categories: {
        localization: 'Game.locres in every client culture directory',
        tree: 'Folders exported with sub-folders because new content adds folders there',
        tables: 'Folders of data tables the processors and generators read',
        textures: 'Folders of textures the site references',
      },
      rules,
      requirements: keptRequirements,
    };
    fs.writeFileSync(rulesFile, JSON.stringify(next, null, 2) + '\n');
    console.log(`Wrote ${rulesFile}`);
  }
}

if (require.main === module) main();
