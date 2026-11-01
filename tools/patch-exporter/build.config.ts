import type { BuildOptions } from 'esbuild';
import path from 'node:path';

export interface ExporterBuildConfig {
  readonly bundleDir: string;
  readonly portableOutputDir: string;
  readonly esbuildOptions: BuildOptions;
}

const zodPath = require.resolve('zod', {
  paths: [path.resolve(__dirname, '../../packages/contracts')],
});

export const exporterBuildConfig: ExporterBuildConfig = {
  bundleDir: path.resolve(__dirname, 'dist'),
  portableOutputDir: path.resolve(__dirname, 'dist/tof-exporter-portable'),
  esbuildOptions: {
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    bundle: true,
    minify: true,
    keepNames: true,
    sourcemap: false,
    alias: {
      '@tof-hub/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@tof-hub/game-assets': path.resolve(__dirname, '../../packages/game-assets/src/index.ts'),
      '@tof-hub/game-domain': path.resolve(__dirname, '../../packages/game-domain/src/index.ts'),
      'zod': zodPath,
    },
    // Node.js built-ins remain external
    external: [
      'node:*',
      'assert',
      'buffer',
      'child_process',
      'crypto',
      'events',
      'fs',
      'fs/promises',
      'http',
      'https',
      'net',
      'os',
      'path',
      'stream',
      'url',
      'util',
      'zlib',
    ],
  },
};

export default exporterBuildConfig;
