import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { collectArchiveEntries, type ArchiveEntry } from './archive';
import { findGameInstallation, findMappingConfigDirectory } from './discovery';
import { runExtractionAdapter } from './extraction-adapter';
import { resolveGamePath } from './game-path-prompt';
import { resolveRawExportTree } from './path-guards';
import { runPipeline, type PipelineStep } from './pipeline-run';
import { buildReleasePackage, loadBaseline } from './release-package';

/**
 * `RUN.bat` → `cli.js run`: the whole update on the player's PC.
 *   1. game folder (asked once, remembered in GAME_PATH.txt)
 *   2. selective extraction of the files the site needs (UnrealExporter)
 *   3. processors → datasets → tool data → media (pipeline-run)
 *   4. release folder `output/tof-update-<version>-<date>/` (laid out like the extracted ZIP) for the site maintainer
 *
 *   --raw <dir>        skip extraction and process an existing raw export
 *   --game-path <dir>  game folder without asking
 *   --baseline <file|dir>  pack only files that differ from this manifest/public tree
 *   --full             full archive (default after the first run: delta vs output/last-sent-manifest.json)
 *   --steps a,b        run a subset of pipeline steps (stage, processors, normalize, generators, media, validate)
 *   --jobs N           parallel workers (default: all logical CPUs)
 *   --zip              pack `output/tof-update-<version>-<date>.zip` instead of the unpacked folder
 *   --no-archive       keep output/site/public only (no release folder or ZIP)
 */

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

function fceReportEntries(reportsDir: string): ArchiveEntry[] {
  const reportFiles = [
    ['fce-all-bosses.md', 'ALL_BOSSES_TEXTS.md'],
    ['fce-new-bosses.md', 'NEW_BOSSES_TEXTS.md'],
    ['fce-boss-card-drafts.md', 'BOSS_CARD_DRAFTS.md'],
  ] as const;
  const entries = reportFiles.flatMap(([sourceName, archiveName]) => {
    const source = path.join(reportsDir, sourceName);
    return fs.existsSync(source) ? [{ source, name: `tools/patch-exporter/pre-release/fce/${archiveName}` }] : [];
  });
  const draftsDir = path.join(reportsDir, 'fce-boss-drafts');
  if (fs.existsSync(draftsDir)) {
    entries.push(...collectArchiveEntries(draftsDir, 'tools/patch-exporter/pre-release/fce/boss-drafts/'));
  }
  return entries;
}

export function preReleaseReportEntries(reportsDir: string): ArchiveEntry[] {
  const entries = fceReportEntries(reportsDir);
  for (const name of ['cosmetics-source-report.json', 'oow-enemy-png.json', 'oow-enemy-png.md', 'localization-manifest.json', 'character-art-bindings.json']) {
    const source = path.join(reportsDir, name);
    if (fs.existsSync(source)) entries.push({ source, name: `tools/patch-exporter/pre-release/${name}` });
  }
  const wishPools = path.join(reportsDir, 'wish-unmapped-pools.json');
  if (fs.existsSync(wishPools)) {
    entries.push({ source: wishPools, name: 'tools/patch-exporter/pre-release/wish-unmapped-pools.json' });
  }
  const wishArt = path.join(reportsDir, 'wish-artwork-candidates');
  if (fs.existsSync(wishArt)) {
    entries.push(...collectArchiveEntries(wishArt, 'tools/patch-exporter/pre-release/wish-artwork-candidates/'));
  }
  return entries;
}

/** Locations inside the portable package (see scripts/package.ts). */
export function packageLocations(root: string) {
  return {
    processorsRoot: path.join(root, 'processors'),
    generatorsDir: path.join(root, 'generators'),
    generatorDataDir: path.join(root, 'generators', 'data'),
    siteInputsDir: path.join(root, 'site-inputs'),
    webDir: path.join(root, 'site-inputs', 'web'),
    webReferencesFile: path.join(root, 'site-inputs', 'ui-references.json'),
    sharpModule: path.join(root, 'node_modules', 'sharp'),
    captureExampleScript: path.join(root, 'generators', 'build-capture-example.js'),
    traceHook: path.join(root, 'scripts', 'fs-trace.cjs'),
  };
}

function revealInExplorer(file: string): void {
  if (process.platform !== 'win32') return;
  try {
    spawn('explorer.exe', [`/select,${file}`], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Opening Explorer is a convenience only.
  }
}

export async function runOneClick(args: string[], packageRoot: string, dataRoot = process.env.TOF_EXPORTER_DATA_DIR || packageRoot): Promise<void> {
  const startedAt = Date.now();
  const launcher = process.env.TOF_EXPORTER_DATA_DIR ? 'ToFExporter.exe' : 'RUN.bat';
  const work = path.join(dataRoot, 'work');
  const output = path.join(dataRoot, 'output');
  const jobs = option(args, 'jobs') ? Number(option(args, 'jobs')) : undefined;
  if (args.includes('--jobs') && (jobs === undefined || !Number.isInteger(jobs) || jobs < 1)) {
    throw new Error('--jobs must be a positive integer.');
  }
  let rawRoot = option(args, 'raw');

  if (!rawRoot) {
    const gamePath = await resolveGamePath({ savedFile: path.join(dataRoot, 'GAME_PATH.txt'), explicitPath: option(args, 'game-path') });
    const discovery = findGameInstallation({ customGamePath: gamePath });
    console.log(`\n[1/4] Extracting from ${discovery.paksDir}`);
    console.log(`      Client: ${discovery.versionInfo.clientName} ${discovery.versionInfo.version}`);
    const extracted = await runExtractionAdapter({ discovery, outputDir: path.join(work, 'raw'), mode: 'Full', aesKey: option(args, 'aes-key') });
    if (!extracted.success) {
      const missing = extracted.validationReport.results.filter((result) => !result.found).map((result) => result.label);
      throw new Error(`UnrealExporter did not produce a complete export (exit code 0 does not guarantee success). Check its console output above. Run ${launcher} directly in a Windows console without redirecting output. Missing required files: ${missing.join(', ')}. See ${path.join(extracted.outputDir, 'export-validation.txt')}.`);
    }
    rawRoot = extracted.outputDir;
  }
  const raw = resolveRawExportTree(path.resolve(rawRoot)).unpackedRoot;
  // Item id mappings live in the client's Hotta/Config, not in .pak files: an unpacked (e.g. FModel)
  // export lacks them, and build-items-json would otherwise publish only the Oversea string table.
  const steps = option(args, 'steps')?.split(',') as PipelineStep[] | undefined;
  // Only the processors read item mappings; a run of other steps needs no game folder.
  if ((!steps || steps.includes('processors')) && !fs.existsSync(path.join(raw, 'MappingItemId.json')) && !process.env.TOF_ITEM_MAPPING_DIR) {
    const gamePath = await resolveGamePath({ savedFile: path.join(dataRoot, 'GAME_PATH.txt'), explicitPath: option(args, 'game-path') });
    const { configDir } = findMappingConfigDirectory(gamePath);
    if (!configDir) throw new Error(`MappingItemId.json is missing from ${raw} and from the game folder ${gamePath} (Hotta/Config).`);
    console.log(`      Item mappings: ${configDir}`);
    process.env.TOF_ITEM_MAPPING_DIR = configDir;
  }
  const version = (() => {
    try {
      return String(JSON.parse(fs.readFileSync(path.join(raw, 'export-version.json'), 'utf8').replace(/^﻿/, '')).version || '') || null;
    } catch {
      return null;
    }
  })();

  console.log(`\n[2/4] Processing (${raw})`);
  const runOutput = path.join(output, 'site');
  if (!steps) fs.rmSync(runOutput, { recursive: true, force: true });
  const result = await runPipeline({ rawDir: raw, outDir: runOutput, workDir: work, jobs, steps, verbose: args.includes('--verbose'), trace: args.includes('--trace'), locations: packageLocations(packageRoot) });

  if (args.includes('--no-archive')) {
    console.log(`\n[SUCCESS] ${result.publicDir}`);
    return;
  }
  const zip = args.includes('--zip');
  console.log(`\n[3/4] ${zip ? 'Packing' : 'Writing release folder'}`);
  // Updates after the first one are deltas against the previous release this folder produced
  // (its manifest is kept as output/last-sent-manifest.json). --full sends everything again,
  // e.g. when the maintainer did not apply an earlier release.
  const lastSent = path.join(output, 'last-sent-manifest.json');
  const baselineSource = option(args, 'baseline') ?? (!args.includes('--full') && fs.existsSync(lastSent) ? lastSent : undefined);
  if (baselineSource === lastSent) {
    console.log(`      Changes since the previous release (full: ${launcher} --full)`);
  }
  const baseline = await loadBaseline(baselineSource);
  const stamp = new Date().toISOString().slice(0, 10);
  const release = path.join(output, `tof-update-${version ?? 'unknown'}-${stamp}${baseline ? '-delta' : ''}${zip ? '.zip' : ''}`);
  let lastPercent = -1;
  let lastHashPercent = -10;
  const pack = await buildReleasePackage({
    publicDir: result.publicDir,
    outFile: release,
    format: zip ? 'zip' : 'directory',
    additionalEntries: preReleaseReportEntries(result.reportsDir),
    baseline,
    gameVersion: version,
    jobs,
    onHashProgress: (done, total) => {
      const percent = total === 0 ? 100 : Math.floor(done / total * 100);
      if (percent === 100 || percent >= lastHashPercent + 10) {
        console.log(`      Hashing ${percent}% (${done}/${total})`);
        lastHashPercent = percent;
      }
    },
    onProgress: (done, total) => {
      const percent = Math.floor((done / total) * 100);
      if (percent === 100 || percent >= lastPercent + 10) {
        console.log(`      ${zip ? 'ZIP' : 'Copy'} ${percent}% (${done}/${total})`);
        lastPercent = percent;
      }
    },
  });
  fs.copyFileSync(pack.manifestFile, lastSent);
  const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(`\n[4/4] Done in ${minutes} min`);
  console.log(`      ${release} (${(pack.bytes / 1024 / 1024).toFixed(1)} MB, ${pack.manifest.packed} files${baseline ? `, ${pack.manifest.deleted.length} deleted` : ''})`);
  console.log(`      Reports: ${result.reportsDir}`);
  console.log(`      Send ${zip ? 'the archive' : 'this folder'} to the site maintainer.`);
  revealInExplorer(release);
}
