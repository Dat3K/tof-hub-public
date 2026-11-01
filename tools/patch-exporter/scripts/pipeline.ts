import fs from 'node:fs';
import path from 'node:path';
import { findMappingConfigDirectory } from '../src/discovery';
import { PIPELINE_STEPS, runPipeline, type PipelineStep } from '../src/pipeline-run';
import { compileProcessors, PROCESSORS_SOURCE } from './compile-processors';

/**
 * Repository entry for the game pipeline:
 *   pnpm --filter @tof-hub/tof-exporter run pipeline --raw <raw export> --out <dir> [--work <dir>]
 *        [--jobs N] [--steps stage,processors,...] [--trace] [--game-path <client folder>]
 * --game-path supplies Hotta/Config/MappingItemId*.json when the raw export (e.g. FModel) lacks them.
 * Site inputs (upstream snapshots) and web sources come from this checkout.
 */
const repoRoot = path.resolve(__dirname, '../../..');

function option(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  if (index !== -1) return args[index + 1];
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main(): Promise<void> {
  // `tsx --tsconfig <relative>` exports TSX_TSCONFIG_PATH as given; children run in the work directory.
  if (process.env.TSX_TSCONFIG_PATH) process.env.TSX_TSCONFIG_PATH = path.resolve(process.env.TSX_TSCONFIG_PATH);
  const rawDir = option('raw') || process.env.TOF_RAW_GAME_DIR;
  const outDir = option('out');
  if (!rawDir || !outDir) throw new Error('Usage: pipeline --raw <raw export root> --out <output dir> [--work <dir>] [--jobs N] [--steps a,b] [--trace]');
  const steps = option('steps')?.split(',').map((step) => step.trim()) as PipelineStep[] | undefined;
  for (const step of steps ?? []) if (!PIPELINE_STEPS.includes(step)) throw new Error(`Unknown step ${step}; expected ${PIPELINE_STEPS.join(', ')}`);
  const gamePath = option('game-path');
  if (gamePath && !fs.existsSync(path.join(rawDir, 'MappingItemId.json'))) {
    const { configDir } = findMappingConfigDirectory(path.resolve(gamePath));
    if (!configDir) throw new Error(`No Hotta/Config/MappingItemId.json under ${gamePath}.`);
    process.env.TOF_ITEM_MAPPING_DIR = configDir;
  }
  const webDir = path.join(repoRoot, 'apps/web');
  const workDir = path.resolve(option('work') || path.join(outDir, '.work'));
  const processorsRoot = path.join(workDir, 'processors-dist');
  console.log(`[PIPELINE] Compiled ${await compileProcessors(processorsRoot)} processor sources -> ${processorsRoot}`);
  const result = await runPipeline({
    rawDir: path.resolve(rawDir),
    outDir: path.resolve(outDir),
    workDir,
    jobs: option('jobs') ? Number(option('jobs')) : undefined,
    steps,
    trace: process.argv.includes('--trace'),
    locations: {
      processorsRoot,
      curatedDir: path.join(PROCESSORS_SOURCE, 'curated'),
      generatorsDir: path.join(repoRoot, 'scripts/generators'),
      siteInputsDir: process.env.TOF_SITE_INPUTS_DIR ?? path.join(webDir, 'public'),
      webDir,
      webSourceDir: path.join(webDir, 'src'),
      sharpModule: require.resolve('sharp', { paths: [require.resolve('next', { paths: [webDir] })] }),
      traceHook: path.join(__dirname, 'fs-trace.cjs'),
      // tsx passes its loader as process flags, not NODE_OPTIONS; generators that require .ts sources need it too.
      generatorNodeArgs: process.execArgv.flatMap((flag, index, all) =>
        /^--(?:require|import)$/.test(flag) && /tsx/.test(all[index + 1] ?? '') ? [flag, all[index + 1]] : []),
    },
  });
  console.log(`[PIPELINE] Output: ${result.publicDir}`);
  const mediaStatus = result.mediaChecked
    ? `${result.missingMedia.length} referenced textures missing from the export`
    : 'media check not run';
  console.log(`[PIPELINE] Reports: ${result.reportsDir} (${mediaStatus})`);
}

main().catch((error) => {
  console.error(`[PIPELINE] FAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
