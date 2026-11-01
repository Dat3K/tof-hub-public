import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { exporterBuildConfig } from '../build.config';

export interface BundleResult {
  readonly outDir: string;
  readonly bundledFiles: string[];
}

/**
 * Bundles TypeScript exporter scripts into standalone JavaScript files.
 */
export async function buildBundle(customOutDir?: string): Promise<BundleResult> {
  const outDir = customOutDir
    ? path.resolve(customOutDir)
    : path.join(exporterBuildConfig.bundleDir, 'scripts');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Find all entrypoints to bundle
  const scriptsDir = path.resolve(__dirname);
  const candidateFiles = ['process-existing.ts', path.resolve(__dirname, '../src/cosmetic-animation.ts')];

  // Check if src/cli.ts exists (for future phases)
  const srcCliPath = path.resolve(__dirname, '../src/cli.ts');
  if (fs.existsSync(srcCliPath)) {
    candidateFiles.push(srcCliPath);
  }

  const entryPoints: Record<string, string> = {};
  for (const file of candidateFiles) {
    const fullPath = path.isAbsolute(file) ? file : path.join(scriptsDir, file);
    if (fs.existsSync(fullPath)) {
      const name = path.basename(file, path.extname(file));
      entryPoints[name] = fullPath;
    }
  }

  console.log(`[BUNDLE] Compiling and bundling TypeScript scripts to ${outDir}...`);
  console.log(`  Entrypoints: ${Object.keys(entryPoints).join(', ')}`);

  const result = await esbuild.build({
    ...exporterBuildConfig.esbuildOptions,
    entryPoints,
    outdir: outDir,
    bundle: true,
    write: true,
    metafile: true,
  });

  const bundledFiles: string[] = [];
  if (result.metafile) {
    for (const outputFile of Object.keys(result.metafile.outputs)) {
      if (outputFile.endsWith('.js')) {
        bundledFiles.push(path.resolve(outputFile));
      }
    }
  }

  console.log(`[BUNDLE] Bundled ${bundledFiles.length} file(s) successfully.`);
  return { outDir, bundledFiles };
}

// CLI entrypoint
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('build-bundle.ts'))) {
  const args = process.argv.slice(2);
  let customOut: string | undefined;
  const outIdx = args.indexOf('--outdir');
  if (outIdx !== -1 && args[outIdx + 1]) {
    customOut = args[outIdx + 1];
  }

  buildBundle(customOut)
    .then((res) => {
      console.log(`[SUCCESS] Bundle created in ${res.outDir}`);
      for (const f of res.bundledFiles) {
        console.log(`  - ${path.basename(f)}`);
      }
    })
    .catch((err) => {
      console.error(`[ERROR] Bundle failed: ${err.message}`);
      process.exit(1);
    });
}
