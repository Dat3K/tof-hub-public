import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  exportMediaAssets,
  findReferencedAssetAliases,
  findReferencedPngFiles,
  findReferencedPreparedWebpFiles,
  findReferencedWebpAliases,
  findMissingReferencedAssetPaths,
  clearMediaReferenceCache,
} from './media-exporter';
import { copyLegacySiteAssets, copyReferencedSimulacraArtwork } from './materializer-adapter';
import { publishCosmeticAnimations } from './cosmetic-animation';
import { reconcileOowEnemyPngDownloads, validateOowEffectCatalogMedia } from './oow-media';
import { withGameLocalizationSource } from '../../../scripts/game-processors/processors/game-source-reader';
import { prepareLocalizationSources, publishLocaleProjection, writeLocalizationManifest, type LocalizationSource } from './localization';
import { SUPPORTED_LOCALES } from '../../../packages/i18n/src/constants';
import {readArtworkHistory} from '../../../scripts/normalize-game-data/artwork-history';

type WishBannerAssetRow = { assets?: Record<string, string | null> };
type WishPoolCandidate = {
  recordName: string;
  kind: 'weapon' | 'matrix';
  key: string;
  featuredItem: string;
  maxUnluckyCount: number | null;
  voucherItem: string | null;
  awardPool: string | null;
  widgetPath: string | null;
  sourcePath: string;
  mappingIssue?: string;
};

/** Reconcile generated Wish URLs at the exporter boundary without importing app scripts. */
function reconcileWishBannerAssetUrls(banners: WishBannerAssetRow[], publicDir: string): number {
  let changed = 0;
  for (const banner of banners) {
    for (const [key, value] of Object.entries(banner.assets ?? {})) {
      if (!value) continue;
      if (value.startsWith('/Game/')) {
        delete banner.assets![key];
        changed++;
        continue;
      }
      if (!value.startsWith('/game-assets/') && !value.startsWith('/datamine/')) continue;
      if (value.split('/').includes('..')) {
        delete banner.assets![key];
        changed++;
        continue;
      }
      const diskPath = path.join(publicDir, ...value.split('/').filter(Boolean));
      if (fs.existsSync(diskPath)) continue;
      const webp = value.match(/^\/game-assets\/webp\/(.+)\.webp$/i);
      if (webp) {
        const pngUrl = `/game-assets/png/${webp[1]}.png`;
        const pngPath = path.join(publicDir, ...pngUrl.split('/').filter(Boolean));
        if (fs.existsSync(pngPath)) {
          banner.assets![key] = pngUrl;
          changed++;
          continue;
        }
      }
      delete banner.assets![key];
      changed++;
    }
  }
  return changed;
}

/**
 * Raw game export -> web `public/` tree, without the legacy site.
 *
 *   stage       curated inputs -> work/stage (the legacy-shaped tree the processors expect)
 *   processors  legacy processors (scripts/game-processors) in dependency order
 *   normalize   EN/RU datasets -> public/game-data
 *   media       referenced textures -> public/game-assets/{png,webp}, character art
 *   generators  tool-page data (scripts/generators/build-*.cjs) -> public/game-data, then media again
 *   validate    dataset checks -> pre-release/
 *
 * The same code runs from the repository (`pnpm --filter @tof-hub/tof-exporter pipeline`)
 * and from the portable package, which only swaps the input locations.
 */

export const PIPELINE_STEPS = ['stage', 'processors', 'normalize', 'media', 'generators', 'locales', 'validate'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export interface PipelineLocations {
  /** Compiled scripts/game-processors (scripts/compile-processors.ts): processors/, build/, contracts/. */
  readonly processorsRoot: string;
  /** Curated inputs (scripts/game-processors/curated); defaults to processorsRoot/curated. */
  readonly curatedDir?: string;
  /** Directory holding the site generators (scripts/generators/build-*.cjs or their bundles). */
  readonly generatorsDir: string;
  /**
   * Snapshots the raw export cannot provide (upstream gear contract, capture card map,
   * server list, a bootstrap CS research file, web sources read as data).
   */
  readonly siteInputsDir: string;
  /** Web sources read as data by generators (TOF_WEB_DIR); defaults to siteInputsDir/web. */
  readonly webDir?: string;
  /** Web source tree scanned for UI-owned asset references, if available. */
  readonly webSourceDir?: string;
  /** Pre-collected UI asset references (`{ "references": [...] }`) when no web source is shipped. */
  readonly webReferencesFile?: string;
  /** sharp module path for generators (TOF_SHARP_MODULE). */
  readonly sharpModule?: string;
  /** Node flags for generator processes, e.g. the tsx loader in repository runs (packaged generators are bundled). */
  readonly generatorNodeArgs?: readonly string[];
  /** Pre-bundled build-capture-example script (TOF_CAPTURE_EXAMPLE_JS). */
  readonly captureExampleScript?: string;
  /** scripts/data copy for bundled generators (TOF_GENERATOR_DATA_DIR). */
  readonly generatorDataDir?: string;
  /** Pre-load hook used by --trace. */
  readonly traceHook?: string;
}

export interface PipelineOptions {
  readonly rawDir: string;
  readonly outDir: string;
  readonly workDir: string;
  readonly locations: PipelineLocations;
  readonly jobs?: number;
  /** Locale projections processed at once (default: every pending locale, bounded by logical CPUs and free memory; or TOF_LOCALE_LANES). */
  readonly localeLanes?: number;
  readonly steps?: readonly PipelineStep[];
  readonly trace?: boolean;
  readonly verbose?: boolean;
}

export interface PipelineResult {
  readonly publicDir: string;
  readonly stageDir: string;
  readonly reportsDir: string;
  readonly durations: Record<string, number>;
  readonly missingMedia: string[];
  readonly mediaChecked: boolean;
}

type SiteGenerator = { readonly script: string; readonly args?: string[]; readonly why: string; readonly parallel?: true; readonly lanes?: false };

/** Only the initial independent generators may overlap; later generators consume prior outputs. `lanes: false`: rebuilt after the locale merge, so locale lanes skip it. */
export const SITE_GENERATORS: ReadonlyArray<SiteGenerator> = [
  { script: 'build-reference.cjs', why: 'pinned upstream gear definitions and raw game refinements' },
  { script: 'build-weapon-growth.cjs', parallel: true, why: 'weapon stat growth' },
  { script: 'build-progression-costs.cjs', parallel: true, why: 'gear/weapon/matrix upgrade costs' },
  { script: 'build-supercomputing.cjs', parallel: true, why: 'supercomputing, space support, stat icons' },
  { script: 'build-temporary-attack-effects.cjs', parallel: true, why: 'temporary ATK effects and capture food' },
  { script: 'build-title-styles.cjs', parallel: true, why: 'Build card character-title colours and plates' },
  { script: 'build-cs-research.cjs', why: 'CS research from raw tables and normalized matrix identities' },
  { script: 'build-card.cjs', args: ['--page'], why: 'Build page catalog with fresh CS research' },
  { script: 'build-loadout-progression.cjs', why: 'loadout progression' },
  { script: 'build-handbook.cjs', why: 'datamine handbook' },
  { script: 'build-fce-cards.cjs', why: 'FCE cards and MMO seasons from raw season rows' },
  { script: 'build-mmo-food.cjs', why: 'MMO food' },
  { script: 'build-mmo-card.cjs', why: 'MMO Build card catalog (reads MMO food, simulacra and Brainfield)' },
  { script: 'build-wish-media.cjs', why: 'Wish item art and localized names from the generated catalogs' },
  { script: 'build-optimizer-demo.cjs', why: 'optimizer demo inventory' },
  { script: 'build-hub-summary.cjs', why: 'section hub cards (reads the generated catalogs)' },
  { script: 'build-main-hub.cjs', why: 'main hub artwork from the generated catalogs' },
  { script: 'build-version-tracker.cjs', why: 'launcher sources and legacy observations for the main hub' },
  { script: 'build-link-previews.cjs', why: 'English link previews from normalized catalogs and encounter data' },
  { script: 'build-runtime-data.cjs', lanes: false, why: 'compact runtime catalogs and per-entity detail files' },
];

/**
 * Generators that read only generated catalogs. They run once more after every locale is merged (and after the
 * final media pass), so their provenance hashes and culture variants describe the published files; their
 * `--check` performs the same computation (scripts/lib/locale-projection.cjs).
 */
export const POST_LOCALE_GENERATORS: ReadonlyArray<SiteGenerator> = [
  { script: 'build-handbook.cjs', args: ['--supercomputer-from-build'], why: 'Handbook supercomputer nodes from the merged Build catalog' },
  { script: 'build-mmo-card.cjs', args: ['--refresh-threshold-references'], why: 'verified historical MMO thresholds over the merged catalog' },
  { script: 'build-hub-summary.cjs', why: 'section hub cards from the merged catalogs' },
];

/** Inputs the raw export cannot provide; copied into game-data before the generators run. */
export const SITE_INPUT_FILES = [
  'game-data/build-reference.json',
  'game-data/capture-card-map.json',
  'game-data/server-list.json',
] as const;

/** Only consulted when no earlier run produced it: build-card and build-cs-research read each other. */
export const SITE_BOOTSTRAP_FILES: readonly string[] = [];

const log = (message: string) => console.log(`[PIPELINE] ${message}`);

function copyTree(source: string, target: string): number {
  if (!fs.existsSync(source)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) count += copyTree(from, to);
    else if (entry.isFile()) {
      fs.mkdirSync(target, { recursive: true });
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return count;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(args[0] || command)} exited with code ${code}`))));
  });
}

function cpuCount(): number {
  return typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
}

/** Serializes work that touches shared in-process state or shared output files. */
function createMutex(): <T>(work: () => Promise<T> | T) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (work) => {
    const result = tail.then(work);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

/** Hard-links (or copies when linking is impossible) a tree; existing targets are kept. mtimes stay equal to the source. */
function linkTree(source: string, target: string): number {
  if (!fs.existsSync(source)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) count += linkTree(from, to);
    else if (entry.isFile() && !fs.existsSync(to)) {
      fs.mkdirSync(target, { recursive: true });
      try {
        fs.linkSync(from, to);
      } catch {
        fs.copyFileSync(from, to);
      }
      count++;
    }
  }
  return count;
}

const LOCALE_LANE_MEMORY = 2 * 1024 ** 3;

function localeLaneCount(options: PipelineOptions, pending: number): number {
  // Lanes are mostly sequential generator chains, so running every locale at once keeps all logical CPUs busy;
  // free memory (LOCALE_LANE_MEMORY per lane) bounds it so lanes never push the machine into swap.
  const byMemory = Math.max(1, Math.floor(os.freemem() / LOCALE_LANE_MEMORY));
  const requested = options.localeLanes ?? (Number(process.env.TOF_LOCALE_LANES) || Math.min(cpuCount(), byMemory));
  return Math.max(1, Math.min(requested, pending));
}

const localeMarker = (workDir: string, locale: string) => path.join(workDir, 'locales', locale, 'complete.json');

/** Version of the exported client, recorded by the extraction step. */
function readExportVersion(rawDir: string): Record<string, unknown> | null {
  for (const candidate of [path.join(rawDir, 'export-version.json'), path.join(path.dirname(rawDir), 'export-version.json')]) {
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8').replace(/^﻿/, ''));
    } catch {
      // Try the next location.
    }
  }
  return null;
}

function curatedDir(locations: PipelineLocations): string {
  return locations.curatedDir ?? path.join(locations.processorsRoot, 'curated');
}

/** Stage the legacy-shaped tree: curated inputs + the legacy UI snapshots generators read. */
function prepareStage(options: PipelineOptions, stageDir: string): void {
  const curated = curatedDir(options.locations);
  fs.rmSync(stageDir, { recursive: true, force: true });
  for (const part of ['datamine', 'datamine2', 'info']) copyTree(path.join(curated, part), path.join(stageDir, part));
  copyTree(path.join(curated, 'site'), stageDir);
  const historyTarget = path.join(stageDir, 'info/arts/artwork-history.json');
  const history = [historyTarget, path.join(options.locations.siteInputsDir, 'game-data/en/arts.json'),
    path.join(options.locations.siteInputsDir, 'en/arts.json'), path.join(options.locations.siteInputsDir, 'artwork-history.json')]
    .map(readArtworkHistory).filter(Boolean).sort((a, b) => b!.revision - a!.revision)[0];
  if (history) {
    fs.mkdirSync(path.dirname(historyTarget), {recursive: true});
    fs.writeFileSync(historyTarget, JSON.stringify(history));
  }
  const version = readExportVersion(options.rawDir);
  if (version) fs.writeFileSync(path.join(stageDir, 'export-version.json'), JSON.stringify(version, null, 2));
}

async function runProcessors(options: PipelineOptions, stageDir: string, env: NodeJS.ProcessEnv, afterStaging?: () => void): Promise<void> {
  const root = options.locations.processorsRoot;
  const contracts = path.join(root, 'contracts');
  const processors = path.join(root, 'processors');
  const build = path.join(root, 'build');
  const jobs = Math.max(1, options.jobs ?? cpuCount());
  await run(process.execPath, [path.join(build, 'prepare-staging.js'), `--project-root=${stageDir}`, `--contract=${path.join(contracts, 'outputs.json')}`], env, stageDir);
  afterStaging?.();
  await run(process.execPath, [
    path.join(build, 'run-processors.js'),
    '--dag',
    `--dir=${processors}`,
    `--build-dir=${build}`,
    `--raw-dir=${options.rawDir}`,
    `--project-root=${stageDir}`,
    `--curated-dir=${path.join(curatedDir(options.locations), 'datamine')}`,
    `--contract=${path.join(contracts, 'outputs.json')}`,
    `--jobs-file=${path.join(contracts, 'jobs.json')}`,
    `--telemetry-file=${path.join(options.workDir, 'processor-timings.json')}`,
    `--concurrency=${jobs}`,
    `--max-heavy=${Math.max(1, Math.floor(jobs / 3))}`,
  ], env, stageDir);
}

type WishArtworkFolder = { folder: string; pngCount: number; archivePath: string };

export function writeWishPoolDiscoveryReport(
  reportsDir: string,
  candidates: WishPoolCandidate[],
  artworkFolders: WishArtworkFolder[] = [],
): string {
  fs.mkdirSync(reportsDir, { recursive: true });
  for (const report of ['oow-enemy-png.json', 'oow-enemy-png.md']) {
    fs.rmSync(path.join(reportsDir, report), { force: true });
  }
  const reportPath = path.join(reportsDir, 'wish-unmapped-pools.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    meaning: 'Unmapped raw limited-order pools are review candidates, not verified future banners. Raw pool blueprints do not provide server region or schedule dates. Artwork folder candidates are independent and are not linked to pool rows automatically.',
    count: candidates.length,
    pools: candidates,
    artworkFolders,
  }, null, 2) + '\n');
  return reportPath;
}

function copyUnreferencedWishArtwork(rawDir: string, gameDataDir: string, reportsDir: string): WishArtworkFolder[] {
  const sourceRoot = path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI', 'chouka', 'Newchouka');
  const targetRoot = path.join(reportsDir, 'wish-artwork-candidates');
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const wishPath = path.join(gameDataDir, 'wish-banners.json');
  if (!fs.existsSync(sourceRoot) || !fs.existsSync(wishPath)) return [];

  const scheduled = JSON.parse(fs.readFileSync(wishPath, 'utf8')) as Array<{ assets?: Record<string, string | null> }>;
  const referencedFolders = new Set<string>();
  for (const banner of scheduled) {
    for (const asset of Object.values(banner.assets ?? {})) {
      if (typeof asset !== 'string') continue;
      const match = asset.match(/^\/game-assets\/(?:webp|png)\/Hotta\/Content\/Resources\/UI\/chouka\/Newchouka\/([^/]+)\//i);
      if (match) referencedFolders.add(match[1].toLowerCase());
    }
  }

  const pngFiles = (directory: string): string[] => {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) found.push(...pngFiles(fullPath));
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) found.push(fullPath);
    }
    return found;
  };

  const folders: WishArtworkFolder[] = [];
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^UP[_\d]/i.test(entry.name) || referencedFolders.has(entry.name.toLowerCase())) continue;
    const sourceFolder = path.join(sourceRoot, entry.name);
    const files = pngFiles(sourceFolder);
    if (!files.length) continue;
    for (const sourceFile of files) {
      const relative = path.relative(sourceFolder, sourceFile);
      const targetFile = path.join(targetRoot, entry.name, relative);
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.copyFileSync(sourceFile, targetFile);
    }
    folders.push({
      folder: entry.name,
      pngCount: files.length,
      archivePath: `tools/patch-exporter/pre-release/wish-artwork-candidates/${entry.name}/`,
    });
  }
  return folders.sort((a, b) => a.folder.localeCompare(b.folder));
}

async function normalize(options: PipelineOptions, stageDir: string, publicDir: string, reportsDir: string): Promise<void> {
  // Shared modules resolve relative to this file both in the repository and in the bundle.
  const { normalizeGameData, buildDataManifest } = await import('../../../scripts/lib/pipeline-api.cjs');
  const gameData = path.join(publicDir, 'game-data');
  const summary = await normalizeGameData({
    legacySourceDir: stageDir,
    rawSourceDir: options.rawDir,
    publicOutputDir: gameData,
    normalizedOutputDir: path.join(options.workDir, 'normalized'),
    stagingDir: path.join(options.workDir, 'normalized-staging'),
    emitCoreAndOverlays: true,
    emitMaterialized: true,
    emitChangelogBaselines: true,
  });
  const artworkFolders = copyUnreferencedWishArtwork(options.rawDir, gameData, reportsDir);
  writeWishPoolDiscoveryReport(reportsDir, summary.unmappedWishPools ?? [], artworkFolders);
  if (artworkFolders.length) log(`Wish artwork review candidates: ${artworkFolders.map(({ folder, pngCount }) => `${folder} (${pngCount} PNG)`).join(', ')}.`);
  log(`Datasets: ${Object.entries(summary.countsByDataset).map(([name, count]) => `${name}=${count}`).join(', ')}`);
  await buildDataManifest({ legacySourceDir: stageDir, publicDataDir: gameData, rawSourceDir: options.rawDir, manifestOutput: path.join(gameData, 'release-manifest.json') });
  // Mirrors of the pre-game-data layout (public/{en,ru}, comp.json, tools/data/catalog.json,
  // changelog): the repository tracks these copies and Comp/Build readers still use them.
  for (const part of ['en', 'ru', 'changelog']) copyTree(path.join(gameData, part), path.join(publicDir, part));
  fs.copyFileSync(path.join(gameData, 'comp.json'), path.join(publicDir, 'comp.json'));
  fs.mkdirSync(path.join(publicDir, 'tools', 'data'), { recursive: true });
  fs.copyFileSync(path.join(gameData, 'tools', 'data', 'catalog.json'), path.join(publicDir, 'tools', 'data', 'catalog.json'));
  // Snapshots go in now so the first media pass already exports the textures they reference.
  copySiteInputs(options.locations.siteInputsDir, publicDir);
}

function copySiteInputs(siteInputsDir: string, publicDir: string): void {
  for(const directory of ['datamine/shared/assets','info']) {
    copyTree(path.join(siteInputsDir,directory),path.join(publicDir,directory));
  }
  for (const file of SITE_INPUT_FILES) {
    const source = path.join(siteInputsDir, file);
    if (!fs.existsSync(source)) throw new Error(`Missing site input ${file} in ${siteInputsDir}.`);
    fs.mkdirSync(path.dirname(path.join(publicDir, file)), { recursive: true });
    fs.copyFileSync(source, path.join(publicDir, file));
  }
}

function generatorEnvironment(options: PipelineOptions, stageDir: string, publicDir: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { siteInputsDir } = options.locations;
  return {
    ...env,
    TOF_RAW_GAME_DIR: options.rawDir,
    TOF_LEGACY_DIR: stageDir,
    TOF_PUBLIC_DIR: publicDir,
    TOF_WEB_DIR: options.locations.webDir ?? path.join(siteInputsDir, 'web'),
    ...(options.locations.sharpModule ? { TOF_SHARP_MODULE: options.locations.sharpModule } : {}),
    ...(options.locations.captureExampleScript ? { TOF_CAPTURE_EXAMPLE_JS: options.locations.captureExampleScript } : {}),
    ...(options.locations.generatorDataDir ? { TOF_GENERATOR_DATA_DIR: options.locations.generatorDataDir } : {}),
  };
}

async function runGenerators(options: PipelineOptions, stageDir: string, publicDir: string, env: NodeJS.ProcessEnv, generators: ReadonlyArray<SiteGenerator> = SITE_GENERATORS): Promise<void> {
  const { siteInputsDir } = options.locations;
  copySiteInputs(siteInputsDir, publicDir);
  for (const file of SITE_BOOTSTRAP_FILES) {
    const target = path.join(publicDir, file);
    if (!fs.existsSync(target) && fs.existsSync(path.join(siteInputsDir, file))) fs.copyFileSync(path.join(siteInputsDir, file), target);
  }
  await runGeneratorSteps(options, generators, generatorEnvironment(options, stageDir, publicDir, env));
}

async function runGeneratorSteps(options: PipelineOptions, generators: ReadonlyArray<SiteGenerator>, generatorEnv: NodeJS.ProcessEnv): Promise<void> {
  let completed = 0;
  const execute = async (step: SiteGenerator) => {
    const started = Date.now();
    log(`  generator START ${step.script} — ${step.why}`);
    await run(process.execPath, [...(options.locations.generatorNodeArgs ?? []), path.join(options.locations.generatorsDir, step.script), ...(step.args ?? [])], generatorEnv, options.workDir);
    completed++;
    log(`  generators ${Math.floor(completed / generators.length * 100)}% (${completed}/${generators.length}): ${step.script}${step.args ? ' ' + step.args.join(' ') : ''} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  };
  const jobs = options.jobs ?? cpuCount();
  for (let index = 0; index < generators.length;) {
    const batch = [generators[index++]];
    while (batch[0].parallel && index < generators.length && generators[index].parallel) {
      batch.push(generators[index++]);
    }
    let next = 0;
    let failed = false;
    // Drain every started process before propagating failure; never race a downstream writer.
    const results = await Promise.allSettled(Array.from({ length: Math.min(jobs, batch.length) }, async () => {
      while (!failed && next < batch.length) {
        const step = batch[next++];
        try {
          await execute(step);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }));
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }
}

/** Reuse the same extraction/normalization rules for each culture, in isolated output trees. */
export async function runLocaleProjections(
  options: PipelineOptions,
  publicDir: string,
  reportsDir: string,
  env: NodeJS.ProcessEnv,
  skipLocales: ReadonlySet<string> = new Set(),
): Promise<void> {
  const sources = prepareLocalizationSources(options.rawDir, options.workDir);
  const baseStageDir = path.join(options.workDir, 'stage');
  const pending = sources.filter((source) => {
    if (source.locale === 'en' || source.locale === 'ru' || skipLocales.has(source.locale)) return false;
    try {
      const marker = JSON.parse(fs.readFileSync(localeMarker(options.workDir, source.locale), 'utf8'));
      if (marker.projectionSha256 === source.projectionSha256 && fs.existsSync(path.join(publicDir, 'game-data', source.locale))) {
        log(`Locale ${source.locale}: already projected, resuming past it.`);
        return false;
      }
    } catch {
      // No valid marker: project this locale.
    }
    return true;
  });
  const lanes = localeLaneCount(options, pending.length);
  const laneJobs = Math.max(2, Math.floor((options.jobs ?? cpuCount()) / lanes));
  if (pending.length) log(`Locales to project: ${pending.map((source) => source.locale).join(', ')} (${lanes} at a time, ${laneJobs} workers each).`);
  // normalize() reads the localization through process-wide hooks and publishLocaleProjection()
  // merges into the shared base files, so only those two short phases are serialized.
  const exclusive = createMutex();

  const projectLocale = async (source: LocalizationSource) => {
    const started = Date.now();
    log(`Locale ${source.locale}: ${source.keys} translated keys, ${source.fallbackKeys} English fallback keys`);
    const workDir = path.join(options.workDir, 'locales', source.locale);
    const stageDir = path.join(workDir, 'stage');
    const lanePublic = path.join(workDir, 'public');
    const laneReports = path.join(workDir, 'reports');
    fs.rmSync(localeMarker(options.workDir, source.locale), { force: true });
    fs.mkdirSync(lanePublic, { recursive: true });
    fs.mkdirSync(laneReports, { recursive: true });
    // Media is shared, JSON output is isolated. Never mirror the raw tree or modify it.
    for (const part of ['game-assets', 'datamine']) {
      const target = path.join(lanePublic, part);
      const original = path.join(publicDir, part);
      if (!fs.existsSync(target) && fs.existsSync(original)) fs.symlinkSync(path.resolve(original), target, process.platform === 'win32' ? 'junction' : 'dir');
    }
    // Links left by an interrupted run must not make normalize write into the canonical en/ru trees.
    for (const locale of ['en', 'ru']) fs.rmSync(path.join(lanePublic, locale), { recursive: true, force: true });
    const lane: PipelineOptions = { ...options, workDir, jobs: laneJobs };
    const localeEnv = {
      ...env,
      TOF_GAME_LOCALIZATION_FILE: source.projectionFile,
      TOF_GAME_LOCALE: source.locale,
      TOF_BASE_PUBLIC_DIR: publicDir,
    };
    prepareStage(lane, stageDir);
    await runProcessors(lane, stageDir, localeEnv, () => {
      // Character media is locale-independent and build-simulacra-assets skips files that are up to
      // date, so seed the lane from the base stage instead of copying ~8k images per locale.
      const seeded = linkTree(path.join(baseStageDir, 'info', 'simulacra', 'assets'), path.join(stageDir, 'info', 'simulacra', 'assets'));
      log(`Locale ${source.locale}: reused ${seeded} character media files from the base stage.`);
    });
    await exclusive(() => withGameLocalizationSource(source.projectionFile, () => normalize(lane, stageDir, lanePublic, laneReports), source.locale));
    // Locale normalization projects the selected culture (e.g. German) into the
    // temporary en/ru fallback folders. Site generators still read canonical EN/RU
    // catalogs for authored cross-locale data such as the Build example.
    for (const locale of ['en', 'ru']) {
      const sourceLocaleDir = path.join(publicDir, locale);
      if (!fs.existsSync(sourceLocaleDir)) throw new Error(`Missing canonical ${locale} projection: ${sourceLocaleDir}`);
      const targetLocaleDir = path.join(lanePublic, locale);
      fs.rmSync(targetLocaleDir, { recursive: true, force: true });
      fs.symlinkSync(path.resolve(sourceLocaleDir), targetLocaleDir, process.platform === 'win32' ? 'junction' : 'dir');
    }
    await runGenerators(lane, stageDir, lanePublic, localeEnv, SITE_GENERATORS.filter((step) => step.lanes !== false));
    await exclusive(() => {
      publishLocaleProjection(path.join(lanePublic, 'game-data'), path.join(publicDir, 'game-data'), source.locale);
      copyTree(path.join(publicDir, 'game-data', source.locale), path.join(publicDir, source.locale));
    });
    fs.writeFileSync(localeMarker(options.workDir, source.locale), JSON.stringify({ locale: source.locale, projectionSha256: source.projectionSha256, completedAt: new Date().toISOString() }, null, 2));
    log(`Locale ${source.locale}: done in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
  };

  // Drain every started locale before propagating a failure; completed locales keep their markers.
  let nextLocale = 0;
  let stopLaunching = false;
  const results = await Promise.allSettled(Array.from({ length: lanes }, async () => {
    while (!stopLaunching && nextLocale < pending.length) {
      try {
        await projectLocale(pending[nextLocale++]);
      } catch (error) {
        stopLaunching = true;
        throw error;
      }
    }
  }));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const gameData = path.join(publicDir, 'game-data');
  writeLocalizationManifest(gameData, sources);
  for (const source of sources) copyTree(path.join(gameData, source.locale), path.join(publicDir, source.locale));
  if (sources.length !== SUPPORTED_LOCALES.length) log(`Localization sources absent: ${SUPPORTED_LOCALES.filter(locale => !sources.some(source => source.locale === locale)).join(', ')}; clients use English fallback.`);
}

/** After the merge and the final media pass: derived generators, runtime catalogs and the published locale trees. */
export async function finalizeLocaleOutputs(options: PipelineOptions, stageDir: string, publicDir: string, reportsDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  const gameData = path.join(publicDir, 'game-data');
  await runGeneratorSteps(options, POST_LOCALE_GENERATORS, generatorEnvironment(options, stageDir, publicDir, env));
  const runtimeModule = await import('../../../scripts/lib/pipeline-api.cjs');
  runtimeModule.buildRuntimeData(gameData);
  const localizationFile = path.join(gameData, 'localization-manifest.json');
  const locales: string[] = fs.existsSync(localizationFile) ? JSON.parse(fs.readFileSync(localizationFile, 'utf8')).availableLocales ?? [] : [];
  for (const locale of locales) copyTree(path.join(gameData, locale), path.join(publicDir, locale));
  copyTree(path.join(gameData, 'tools', 'data'), path.join(publicDir, 'tools', 'data'));
  if (fs.existsSync(path.join(gameData, 'comp.json'))) fs.copyFileSync(path.join(gameData, 'comp.json'), path.join(publicDir, 'comp.json'));
  const manifestFile = path.join(gameData, 'release-manifest.json');
  if (fs.existsSync(manifestFile) && locales.length) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.locales = locales;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  }
  if (fs.existsSync(localizationFile)) fs.copyFileSync(localizationFile, path.join(reportsDir, 'localization-manifest.json'));
}

function uiReferenceDirs(options: PipelineOptions, scratch: string): string[] {
  if (options.locations.webSourceDir && fs.existsSync(options.locations.webSourceDir)) return [options.locations.webSourceDir];
  const file = options.locations.webReferencesFile;
  if (!file || !fs.existsSync(file)) return [];
  // The resolvers scan source text; a generated stub lets them see the shipped list.
  const references: string[] = JSON.parse(fs.readFileSync(file, 'utf8')).references ?? [];
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'ui-references.ts'), references.map((ref) => `// ${ref}`).join('\n'));
  return [scratch];
}

async function exportMedia(options: PipelineOptions, stageDir: string, publicDir: string): Promise<string[]> {
  process.env.TOF_MEDIA_INDEX_CACHE = '1';
  clearMediaReferenceCache();
  process.env.TOF_MEDIA_CACHE_DIR = process.env.TOF_MEDIA_CACHE_DIR || path.join(options.workDir, 'webp-cache');
  const gameData = path.join(publicDir, 'game-data');
  // build-card.cjs reads gear icons from this curated page; fresh outputs must convert them before generators.
  const sources = [...uiReferenceDirs(options, path.join(options.workDir, 'ui-references')),
    path.join(stageDir, 'info', 'tools', 'gear-compare')];
  const raw = options.rawDir;
  const pngs = findReferencedPngFiles(raw, gameData, sources);
  const webpAliases = findReferencedWebpAliases(raw, gameData, sources);
  const assetAliases = findReferencedAssetAliases(raw, gameData, sources);
  const prepared = findReferencedPreparedWebpFiles(raw, gameData, sources);
  const files = [...new Set([...pngs, ...assetAliases.map((alias) => alias.sourceFile)])];
  log(`Media: ${files.length} referenced textures (${prepared.length} prepared WebP).`);
  let lastPercent = -1;
  const media = await exportMediaAssets({
    inputDir: raw,
    outputDir: publicDir,
    specificFiles: files,
    webpAliases: [...webpAliases, ...assetAliases],
    preparedWebpAliases: prepared,
    jobs: options.jobs ?? cpuCount(),
    verbose: options.verbose,
    onProgress: (completed, total) => {
      const percent = Math.floor((completed / total) * 100);
      if (percent === 100 || percent >= lastPercent + 10) {
        log(`  media ${percent}% (${completed}/${total})`);
        lastPercent = percent;
      }
    },
  });
  if (media.failedCount > 0) log(`Media conversion/copy failures: ${media.failedCount}.`);
  const animations = await publishCosmeticAnimations({stageDir, rawDir: raw, publicDir,
    cacheDir: path.join(options.workDir, 'animation-cache'), sharpModule: options.locations.sharpModule});
  if (animations.outputs.length) {
    log(`Cosmetic animations: ${animations.outputs.length} (${animations.cached} cached).`);
    fs.writeFileSync(path.join(options.outDir, 'pre-release', 'cosmetic-animations.json'), JSON.stringify(animations.outputs, null, 2));
  }
  const animationPosters = new Set(animations.outputs.map((output) => `cosmetic-animations/${output.id}`.toLowerCase()));
  // Preserved game media (curated archive of textures removed from the current client):
  // used only for references the export cannot satisfy.
  const preservedRoot = path.join(stageDir, 'datamine', 'shared', 'media');
  let missing = findMissingReferencedAssetPaths(raw, gameData, sources)
    .filter((reference) => !animationPosters.has(reference.toLowerCase()));
  if (missing.length > 0 && fs.existsSync(preservedRoot)) {
    const wanted = new Set(missing.map((reference) => reference.toLowerCase()));
    const relative = (file: string) => path.relative(preservedRoot, file).split(path.sep).join('/').replace(/\.(png|webp)$/i, '').toLowerCase();
    const preservedPngs = findReferencedPngFiles(preservedRoot, gameData, sources).filter((file) => wanted.has(relative(file)));
    const preservedWebp = findReferencedPreparedWebpFiles(preservedRoot, gameData, sources).filter((alias) => wanted.has(relative(alias.sourceFile)));
    if (preservedPngs.length + preservedWebp.length > 0) {
      await exportMediaAssets({ inputDir: preservedRoot, outputDir: publicDir, specificFiles: preservedPngs, preparedWebpAliases: preservedWebp, jobs: options.jobs ?? cpuCount() });
      log(`Preserved media: ${preservedPngs.length + preservedWebp.length} textures no longer in the client.`);
      const restored = new Set([...preservedPngs, ...preservedWebp.map((alias) => alias.sourceFile)].map(relative));
      missing = missing.filter((reference) => !restored.has(reference.toLowerCase()));
    }
  }
  const art = await copyReferencedSimulacraArtwork(stageDir, gameData, publicDir);
  const oowPngs = reconcileOowEnemyPngDownloads({
    publicDir, rawDir: raw, preservedDir: preservedRoot, reportsDir: path.join(options.outDir, 'pre-release'),
  });
  log(`OOW PNG originals: ${oowPngs.originals} raw, ${oowPngs.preserved} preserved, ${oowPngs.missing} unavailable (pre-release/oow-enemy-png.json).`);
  const icons = copyLegacySiteAssets(stageDir, publicDir);
  log(`Character art: ${art} files; site icons: ${icons}.`);
  const wishPath = path.join(gameData, 'wish-banners.json');
  if (fs.existsSync(wishPath)) {
    const wishBanners = JSON.parse(fs.readFileSync(wishPath, 'utf8')) as Array<{ assets?: Record<string, string | null> }>;
    const repairedUrls = reconcileWishBannerAssetUrls(wishBanners, publicDir);
    if (repairedUrls > 0) {
      fs.writeFileSync(wishPath, `${JSON.stringify(wishBanners, null, 2)}\n`, 'utf8');
      log(`Wish banner media: repaired ${repairedUrls} unavailable URL(s).`);
    }
    const wishRuntimePath = path.join(gameData, 'runtime', 'wish-banners.json');
    fs.mkdirSync(path.dirname(wishRuntimePath), { recursive: true });
    fs.copyFileSync(wishPath, wishRuntimePath);
  }
  validateOowEffectCatalogMedia(publicDir);
  return missing;
}

/**
 * Every enemy the datasets show with a placeholder instead of game art, with where it appears,
 * so a new enemy is noticed even when the game tables give no portrait link.
 */
export function writeEnemyArtReport(gameDataEnDir: string, reportsDir: string, rawDir?: string): number {
  const enemies = new Map<string, { name: string; monsterClass: string; places: Set<string> }>();
  const visit = (value: unknown, place: string): void => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, place));
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const image = String(record.image ?? record.art ?? record.lineupPortrait ?? '');
    const placeholder = record.imageMatchStatus === 'placeholder' || (/placeholder/i.test(image) && ('nameEn' in record || 'name' in record || 'name_en' in record));
    if (placeholder) {
      const monsterClass = String(record.normalizedMonsterClass ?? record.monsterClass ?? record.boss_id ?? record.id ?? '');
      const name = String(record.nameEn ?? record.name_en ?? record.name ?? monsterClass);
      const key = monsterClass || name;
      const entry = enemies.get(key) ?? { name, monsterClass, places: new Set<string>() };
      entry.places.add(place);
      enemies.set(key, entry);
    }
    for (const child of Object.values(record)) visit(child, place);
  };
  const scan = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith('.json') && /^(oow|bygone|seq|fce)/i.test(prefix + entry.name)) {
        try {
          visit(JSON.parse(fs.readFileSync(full, 'utf8')), prefix + entry.name);
        } catch {
          // Unreadable files are reported by validation.
        }
      }
    }
  };
  scan(gameDataEnDir, '');
  // Candidate textures follow the game's naming convention (same monster number under UI/).
  const textures: string[] = [];
  const collect = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.png$/i.test(entry.name)) textures.push(path.relative(rawDir!, full).split(path.sep).join('/').replace(/\.png$/i, ''));
    }
  };
  if (rawDir) collect(path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI'));
  const candidatesFor = (monsterClass: string) => {
    const match = monsterClass.match(/(mon|boss|elite)_(?:hum_)?(\d+)/i);
    if (!match) return [];
    const number = String(Number(match[2])).padStart(3, '0');
    const pattern = new RegExp(`_hum_${number}(?!\\d)`, 'i');
    return textures.filter((texture) => pattern.test(texture)).slice(0, 6);
  };
  const list = [...enemies.values()].sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(reportsDir, 'enemies-without-art.json'), JSON.stringify(list.map((e) => ({ ...e, places: [...e.places].sort(), candidates: candidatesFor(e.monsterClass) })), null, 2));
  const lines = [
    '# Enemies shown with a placeholder',
    '',
    'Bind art in scripts/game-processors/processors/monster-image-mapping.json (monster class -> texture) and run the pipeline again.',
    '',
    `Total: **${list.length}**.`,
    '',
    ...list.map((e) => {
      const candidates = candidatesFor(e.monsterClass);
      const hint = candidates.length ? `\n  - candidate textures: ${candidates.map((c) => `\`${c}\``).join(', ')}` : '';
      return `- **${e.name}** \`${e.monsterClass}\` — ${[...e.places].sort().join(', ')}${hint}`;
    }),
  ];
  fs.writeFileSync(path.join(reportsDir, 'enemies-without-art.md'), lines.join('\n') + '\n');
  return list.length;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  if (options.jobs !== undefined && (!Number.isInteger(options.jobs) || options.jobs < 1)) {
    throw new Error('--jobs must be a positive integer.');
  }
  const steps = new Set(options.steps ?? PIPELINE_STEPS);
  for (const step of steps) if (!PIPELINE_STEPS.includes(step)) throw new Error(`Unknown pipeline step: ${step}`);
  log(`Workers: ${options.jobs ?? cpuCount()} (available logical CPUs: ${cpuCount()}); independent generators: up to ${Math.min(4, options.jobs ?? cpuCount())}.`);
  const stageDir = path.join(options.workDir, 'stage');
  const publicDir = path.join(options.outDir, 'public');
  const reportsDir = path.join(options.outDir, 'pre-release');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  if (!steps.has('normalize')) {
    fs.rmSync(path.join(reportsDir, 'wish-unmapped-pools.json'), { force: true });
    fs.rmSync(path.join(reportsDir, 'wish-artwork-candidates'), { recursive: true, force: true });
  }
  // In-process steps (normalize media) and generator processes share the packaged sharp.
  if (options.locations.sharpModule) process.env.TOF_SHARP_MODULE = options.locations.sharpModule;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || String(cpuCount()),
    // Raw-only generator scans, shared by the base run and every locale lane.
    TOF_GENERATOR_CACHE_DIR: path.resolve(options.workDir, 'generator-cache'),
    // Raw-only processor scans valid for this run only (the raw export cannot change mid-run): computed by the
    // base pass, reused by every locale lane. A resumed run without the processors step recomputes them.
    TOF_RUN_CACHE_DIR: path.resolve(options.workDir, 'run-cache'),
  };
  if (steps.has('processors')) fs.rmSync(path.resolve(options.workDir, 'run-cache'), { recursive: true, force: true });
  // Repository runs start under tsx, whose loader would otherwise be inherited by every
  // processor/generator process and transpile on each require (3-4x slower). They are plain JS.
  if (env.NODE_OPTIONS) {
    const kept = env.NODE_OPTIONS.split(/\s+(?=--)/).filter((flag) => !/tsx[\\/]/.test(flag)).join(' ').trim();
    if (kept) env.NODE_OPTIONS = kept;
    else delete env.NODE_OPTIONS;
  }
  if (options.trace && options.locations.traceHook) {
    const traceDir = path.resolve(options.workDir, 'trace');
    if (path.dirname(traceDir) !== path.resolve(options.workDir)) {
      throw new Error('Trace output directory must be a direct child of the pipeline work directory.');
    }
    fs.rmSync(traceDir, { recursive: true, force: true });
    fs.mkdirSync(traceDir, { recursive: true });
    env.TOF_FS_TRACE_DIR = traceDir;
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ? env.NODE_OPTIONS + ' ' : ''}--require=${options.locations.traceHook}`;
  }

  const durations: Record<string, number> = {};
  const timed = async (step: PipelineStep, work: () => Promise<unknown> | unknown) => {
    if (!steps.has(step)) return;
    const started = Date.now();
    log(`${step}...`);
    const heartbeat = setInterval(() => log(`${step} running (${((Date.now() - started) / 1000).toFixed(0)}s elapsed)`), 15_000);
    try {
      await work();
    } finally {
      clearInterval(heartbeat);
    }
    durations[step] = Date.now() - started;
    log(`${step} done in ${(durations[step] / 1000).toFixed(1)}s`);
  };

  // Locale outputs are merged into the base datasets; regenerating those makes every marker stale.
  const localesRoot = path.join(options.workDir, 'locales');
  if ((steps.has('normalize') || steps.has('generators')) && fs.existsSync(localesRoot)) {
    for (const locale of fs.readdirSync(localesRoot)) fs.rmSync(localeMarker(options.workDir, locale), { force: true });
  }

  let missingMedia: string[] = [];
  let mediaChecked = false;
  await timed('stage', () => prepareStage(options, stageDir));
  await timed('processors', () => runProcessors(options, stageDir, env));
  await timed('normalize', () => normalize(options, stageDir, publicDir, reportsDir));
  // Media runs before the generators (some verify the textures they reference exist) and
  // once more after them for the textures only the tool data references; the WebP cache
  // makes the second pass cheap.
  await timed('media', async () => {
    missingMedia = await exportMedia(options, stageDir, publicDir);
    mediaChecked = true;
  });
  await timed('generators', async () => {
    await runGenerators(options, stageDir, publicDir, env);
    if (steps.has('media')) {
      missingMedia = await exportMedia(options, stageDir, publicDir);
      mediaChecked = true;
    }
  });
  await timed('locales', async () => {
    await runLocaleProjections(options, publicDir, reportsDir, env);
    if (steps.has('media')) {
      clearMediaReferenceCache();
      missingMedia = await exportMedia(options, stageDir, publicDir);
      mediaChecked = true;
    }
    await finalizeLocaleOutputs(options, stageDir, publicDir, reportsDir, env);
  });
  await timed('validate', async () => {
    const { validateGeneratedData } = await import('../../../scripts/lib/pipeline-api.cjs');
    const report = await validateGeneratedData({ publicDataDir: path.join(publicDir, 'game-data'), reportsDir, strict: false });
    log(`Validation: ${report.valid ? 'passed' : 'FAILED'} (${report.passedChecks}/${report.totalChecks}).`);
    if (!report.valid) throw new Error(`Generated data failed validation: ${report.errors.slice(0, 5).join('; ')}`);
  });

  // Editor-facing reports: new artworks, FCE bosses needing a card (with ready drafts),
  // enemies shown with a placeholder, missing textures.
  for (const [from, name] of [
    [path.join(stageDir, 'info', 'cosmetics', 'data', 'cosmetics-source-report.json'), 'cosmetics-source-report.json'],
    [path.join(stageDir, 'info', 'arts', 'data', 'artworks-new.json'), 'new-artworks.json'],
    [path.join(stageDir, 'info', 'simulacra', 'data', 'asset-binding-coverage.json'), 'character-art-bindings.json'],
    [path.join(stageDir, 'datamine', 'fce', 'data', 'fce-unregistered-bosses.json'), 'fce-unregistered-bosses.json'],
    [path.join(stageDir, 'datamine', 'fce', 'docs', 'ALL_BOSSES_TEXTS.md'), 'fce-all-bosses.md'],
    [path.join(stageDir, 'datamine', 'fce', 'docs', 'NEW_BOSSES_TEXTS.md'), 'fce-new-bosses.md'],
    [path.join(stageDir, 'datamine', 'fce', 'docs', 'BOSS_CARD_DRAFTS.md'), 'fce-boss-card-drafts.md'],
  ] as const) {
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(reportsDir, name));
  }
  copyTree(path.join(stageDir, 'datamine', 'fce', 'data', 'boss-drafts'), path.join(reportsDir, 'fce-boss-drafts'));
  if (fs.existsSync(path.join(publicDir, 'game-data', 'en'))) writeEnemyArtReport(path.join(publicDir, 'game-data', 'en'), reportsDir, options.rawDir);
  fs.writeFileSync(path.join(reportsDir, 'missing-media.json'), JSON.stringify({ checked: mediaChecked, missing: mediaChecked ? missingMedia : null }, null, 2));
  fs.writeFileSync(path.join(reportsDir, 'pipeline-timings.json'), JSON.stringify(durations, null, 2));
  return { publicDir, stageDir, reportsDir, durations, missingMedia, mediaChecked };
}
