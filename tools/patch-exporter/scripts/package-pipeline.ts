import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { exporterBuildConfig } from '../build.config';
import { SITE_BOOTSTRAP_FILES, SITE_GENERATORS, SITE_INPUT_FILES } from '../src/pipeline-run';
import { compileProcessors, PROCESSORS_SOURCE } from './compile-processors';
import {readArtworkHistory} from '../../../scripts/normalize-game-data/artwork-history';

/**
 * Adds the game pipeline to the portable package (see src/run-command.ts packageLocations):
 *   processors/   scripts/game-processors compiled to JS (processors, DAG, contracts) + curated inputs
 *   generators/   site generators bundled with esbuild (+ data/, build-capture-example.js)
 *   site-inputs/  snapshots the raw export cannot provide + web sources read as data
 *   node_modules/ sharp and its runtime dependencies for the generators
 *   bin/          optional UnrealExporter runtime DLLs (Detex, Oodle, zlib-ng)
 */

const repoRoot = path.resolve(__dirname, '../../..');
const webDir = path.join(repoRoot, 'apps/web');

function copyDir(from: string, to: string): void {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

async function bundleGenerators(target: string): Promise<string[]> {
  const scripts = [...new Set(SITE_GENERATORS.map((step) => step.script))];
  fs.rmSync(target, { recursive: true, force: true });
  const common: esbuild.BuildOptions = {
    ...exporterBuildConfig.esbuildOptions,
    bundle: true,
    sourcemap: false,
    logLevel: 'warning',
    external: [...(exporterBuildConfig.esbuildOptions.external ?? []), 'sharp', 'next', 'tsx/cli', 'tsx/cjs'],
  };
  for (const script of scripts) {
    await esbuild.build({ ...common, entryPoints: [path.join(repoRoot, 'scripts/generators', script)], outfile: path.join(target, script) });
  }
  await esbuild.build({
    ...common,
    entryPoints: [path.join(repoRoot, 'scripts/generators/build-capture-example.ts')],
    outfile: path.join(target, 'build-capture-example.js'),
    tsconfig: path.join(webDir, 'tsconfig.json'),
    // The script reads import.meta.dirname; in CJS that becomes the bundle directory.
    define: { 'import.meta.dirname': '__dirname' },
  });
  copyDir(path.join(repoRoot, 'scripts/data'), path.join(target, 'data'));
  return scripts;
}

/** UI-owned texture references (TS/TSX/CSS) so media export keeps them without shipping the web source. */
function collectUiReferences(): string[] {
  const references = new Set<string>();
  const pattern = /(?:Hotta|Engine)[\\/][A-Za-z0-9_./\\-]+/g;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:[cm]?[jt]sx?|css)$/i.test(entry.name)) for (const match of fs.readFileSync(full, 'utf8').matchAll(pattern)) references.add(match[0].replace(/\\/g, '/'));
    }
  };
  walk(path.join(webDir, 'src'));
  return [...references].sort();
}

function stageSiteInputs(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, {recursive: true});
  const publicDir = path.join(webDir, 'public');
  const history = readArtworkHistory(path.join(publicDir, 'game-data/en/arts.json'))
    ?? readArtworkHistory(path.join(PROCESSORS_SOURCE, 'curated/info/arts/artwork-history.json'));
  if (history) fs.writeFileSync(path.join(target, 'artwork-history.json'), JSON.stringify(history));
  for(const directory of ['datamine/shared/assets','info']) {
    const source=path.join(publicDir,directory);
    if(fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(path.join(target,directory)),{recursive:true});
      fs.cpSync(source,path.join(target,directory),{recursive:true});
    }
  }
  for (const file of [...SITE_INPUT_FILES, ...SITE_BOOTSTRAP_FILES]) {
    const source = path.join(publicDir, file);
    if (!fs.existsSync(source)) throw new Error(`Cannot package site input ${file}: ${source} is missing (run the repository generators first).`);
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.copyFileSync(source, path.join(target, file));
  }
  // Web sources the generators parse as data (Comp/element icon registries).
  for (const source of ['src/features/comp/data.ts', 'src/features/simulacra/constants.ts']) {
    fs.mkdirSync(path.dirname(path.join(target, 'web', source)), { recursive: true });
    fs.copyFileSync(path.join(webDir, source), path.join(target, 'web', source));
  }
  fs.writeFileSync(path.join(target, 'ui-references.json'), JSON.stringify({ references: collectUiReferences() }, null, 2));
}

/** Copies a package and its dependency closure (real directories, no pnpm symlinks). */
function copyModuleClosure(name: string, fromDir: string, nodeModules: string, seen = new Set<string>()): void {
  if (seen.has(name)) return;
  seen.add(name);
  // Packages may not export ./package.json: resolve the entry, then walk up to its manifest.
  let dir: string | null = null;
  try {
    let current = path.dirname(fs.realpathSync(require.resolve(name, { paths: [fromDir] })));
    while (current !== path.dirname(current)) {
      const candidate = path.join(current, 'package.json');
      if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) {
        dir = current;
        break;
      }
      current = path.dirname(current);
    }
  } catch {
    // Native platform packages (e.g. @img/sharp-win32-x64) have no JS entry: look for
    // the folder in the node_modules directories above the dependent package.
    let current = fromDir;
    while (current !== path.dirname(current)) {
      const candidate = path.join(current, 'node_modules', name);
      const sibling = path.join(path.basename(current) === 'node_modules' ? current : path.join(current, '..'), name);
      for (const option of [candidate, sibling]) {
        if (!dir && fs.existsSync(path.join(option, 'package.json'))) dir = fs.realpathSync(option);
      }
      if (dir) break;
      current = path.dirname(current);
    }
  }
  if (!dir) return; // Optional platform packages for other systems.
  const manifest = path.join(dir, 'package.json');
  copyDir(dir, path.join(nodeModules, name));
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
  for (const dep of Object.keys(deps)) {
    if (/^@img\/sharp-(?!win32-x64)/.test(dep) && !/libvips-win32-x64/.test(dep)) continue;
    copyModuleClosure(dep, dir, nodeModules, seen);
  }
}

function stageSharp(portableDir: string): void {
  const nodeModules = path.join(portableDir, 'node_modules');
  fs.rmSync(nodeModules, { recursive: true, force: true });
  const nextDir = path.dirname(require.resolve('next/package.json', { paths: [webDir] }));
  copyModuleClosure('sharp', nextDir, nodeModules);
}

const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** CUE4Parse loads these at runtime and otherwise downloads them on first use. */
function stageUnrealRuntimeDlls(binDir: string, runtimeDlls: Array<{ name: string; sha256: string }>): string[] {
  const sourceDir = process.env.TOF_UNREAL_RUNTIME_DIR;
  if (!sourceDir) {
    console.warn('[PACKAGE] TOF_UNREAL_RUNTIME_DIR not set: UnrealExporter will download Oodle/zlib-ng/Detex on first run (needs internet).');
    return [];
  }
  const staged: string[] = [];
  for (const dll of runtimeDlls) {
    const source = path.join(sourceDir, dll.name);
    if (!fs.existsSync(source)) throw new Error(`Missing ${dll.name} in ${sourceDir}`);
    if (sha256(source) !== dll.sha256) throw new Error(`${dll.name} checksum mismatch`);
    fs.copyFileSync(source, path.join(binDir, dll.name));
    staged.push(dll.name);
  }
  return staged;
}

export async function stagePipelinePackage(portableDir: string, runtimeDlls: Array<{ name: string; sha256: string }> = []): Promise<void> {
  console.log('[PACKAGE] Staging game processors and curated inputs...');
  const compiled = await compileProcessors(path.join(portableDir, 'processors'));
  copyDir(path.join(PROCESSORS_SOURCE, 'curated'), path.join(portableDir, 'processors', 'curated'));
  // Handbook generators resolve this curated mapping through their repo-relative
  // provenance path, so include it alongside the bundled CLI scripts as well.
  const monsterMapping = path.join(PROCESSORS_SOURCE, 'processors', 'monster-image-mapping.json');
  const generatorMapping = path.join(portableDir, 'scripts', 'game-processors', 'processors', 'monster-image-mapping.json');
  fs.mkdirSync(path.dirname(generatorMapping), { recursive: true });
  fs.copyFileSync(monsterMapping, generatorMapping);
  console.log(`  ${compiled} processor sources compiled`);
  // The bundled normalizer resolves its curated registry (wish banners) as <scripts>/../curated.
  copyDir(path.join(repoRoot, 'scripts/normalize-game-data/curated'), path.join(portableDir, 'curated'));
  console.log('[PACKAGE] Bundling site generators...');
  const generators = await bundleGenerators(path.join(portableDir, 'generators'));
  console.log(`  ${generators.length} generators + build-capture-example`);
  console.log('[PACKAGE] Staging site inputs and sharp...');
  stageSiteInputs(path.join(portableDir, 'site-inputs'));
  stageSharp(portableDir);
  fs.copyFileSync(path.join(__dirname, 'fs-trace.cjs'), path.join(portableDir, 'scripts', 'fs-trace.cjs'));
  // fetch-runtime extracts into _extract_* folders; they are not part of the package.
  for (const folder of ['bin', 'runtime']) {
    const dir = path.join(portableDir, folder);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) if (entry.startsWith('_extract_')) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
  const dlls = stageUnrealRuntimeDlls(path.join(portableDir, 'bin'), runtimeDlls);
  if (dlls.length) console.log(`  UnrealExporter runtime: ${dlls.join(', ')}`);
}
