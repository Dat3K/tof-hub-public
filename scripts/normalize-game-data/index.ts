import { normalizeGameData } from './normalizer';
import type { NormalizerOptions } from './types';

export * from './types';
export * from './split-merge';
export * from './adapters';
export * from './changelog-baselines';
export * from './normalizer';

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith('normalize-game-data/index.ts') || process.argv[1].endsWith('normalize-game-data\\index.ts'))) {
  const args = process.argv.slice(2);
  const options: NormalizerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--legacy-source' || arg === '-s') {
      options.legacySourceDir = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.publicOutputDir = args[++i];
    } else if (arg === '--normalized' || arg === '-n') {
      options.normalizedOutputDir = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--allow-fallbacks') {
      options.allowFallbacks = true;
    }
  }

  normalizeGameData(options)
    .then((summary) => {
      console.log('✅ Game data normalization completed successfully:');
      console.log(`   Total entities: ${summary.totalEntities}`);
      console.log(`   Output: ${summary.outputPath}`);
      console.log(`   Normalized: ${summary.normalizedPath}`);
      for (const [ds, count] of Object.entries(summary.countsByDataset)) {
        console.log(`   - ${ds}: ${count}`);
      }
    })
    .catch((err) => {
      console.error('❌ Failed to normalize game data:', err);
      process.exit(1);
    });
}
