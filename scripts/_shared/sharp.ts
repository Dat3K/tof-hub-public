import { createRequire } from 'node:module';
import path from 'node:path';
import type sharp from 'sharp';
import { findProjectRoot } from './env';

/**
 * sharp for pipeline media steps: the portable package ships it and sets
 * TOF_SHARP_MODULE; in this repository it is the web app's Next.js dependency.
 */
export function loadSharp(): typeof sharp {
  const require = createRequire(__filename);
  if (process.env.TOF_SHARP_MODULE) return require(process.env.TOF_SHARP_MODULE);
  const webDir = path.join(findProjectRoot(), 'apps', 'web');
  return require(require.resolve('sharp', { paths: [require.resolve('next', { paths: [webDir] })] }));
}
