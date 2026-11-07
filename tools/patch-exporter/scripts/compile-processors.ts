import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

/**
 * scripts/game-processors (TypeScript) -> a runnable processors root:
 *   <out>/processors/*.js, <out>/build/*.js   one CommonJS file per source, same layout
 *   <out>/processors/** non-TS files           monster-image-mapping.json, shared/tof-formulas.js
 *   <out>/contracts/                           jobs.json, outputs.json
 * Files are transpiled, not bundled: run-processors spawns each processor as its own process
 * and processors resolve sibling files through __dirname, so the layout must stay identical.
 * Type checking is `tsc -p scripts/game-processors` (pnpm typecheck), not this step.
 */
const repoRoot = path.resolve(__dirname, '../../..');
export const PROCESSORS_SOURCE = path.join(repoRoot, 'scripts/game-processors');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export async function compileProcessors(outRoot: string, sourceRoot = PROCESSORS_SOURCE): Promise<number> {
  fs.rmSync(outRoot, { recursive: true, force: true });
  const entryPoints: string[] = [];
  for (const part of ['processors', 'build']) {
    for (const file of walk(path.join(sourceRoot, part))) {
      if (file.endsWith('.d.ts')) continue;
      // `node --test` sources import a `.ts` specifier; they are not part of the runtime tree.
      if (file.endsWith('.test.ts')) continue;
      if (file.endsWith('.ts')) entryPoints.push(file);
      else {
        const target = path.join(outRoot, path.relative(sourceRoot, file));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(file, target);
      }
    }
  }
  await build({
    entryPoints,
    outbase: sourceRoot,
    outdir: outRoot,
    bundle: false,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    logLevel: 'warning',
  });
  // This helper shares the application locale registry outside the processor tree.
  const localeCodes = path.join(sourceRoot, 'processors/locale-codes.ts');
  if (fs.existsSync(localeCodes)) await build({ entryPoints: [localeCodes],
    outfile: path.join(outRoot, 'processors/locale-codes.js'), bundle: true,
    platform: 'node', format: 'cjs', target: 'node24', logLevel: 'warning' });
  fs.cpSync(path.join(sourceRoot, 'contracts'), path.join(outRoot, 'contracts'), { recursive: true });
  return entryPoints.length;
}
