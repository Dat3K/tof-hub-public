import { buildDataManifest, type BuildManifestOptions } from './builder';

export * from './builder';

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith('build-data-manifest/index.ts') || process.argv[1].endsWith('build-data-manifest\\index.ts'))) {
  const args = process.argv.slice(2);
  const options: BuildManifestOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--legacy-source' || arg === '-s') {
      options.legacySourceDir = args[++i];
    } else if (arg === '--data-dir' || arg === '-d') {
      options.publicDataDir = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.manifestOutput = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--snapshot-version') {
      const version = args[++i];
      if (!version) throw new Error('--snapshot-version requires major.minor.patch');
      options.snapshotVersion = version;
    }
  }

  buildDataManifest(options)
    .then((manifest) => {
      console.log('✅ Release manifest built successfully:');
      console.log(`   Game Version: ${manifest.gameVersion}`);
      console.log(`   Generated At: ${manifest.generatedAt}`);
      console.log(`   Snapshot: ${manifest.snapshot.version} (${manifest.snapshot.sources[0]?.client})`);
      console.log(`   Client Regions: ${Object.keys(manifest.clientVersions || {}).join(', ')}`);
      console.log(`   File Counts: ${JSON.stringify(manifest.fileCounts)}`);
    })
    .catch((err) => {
      console.error('❌ Failed to build release manifest:', err);
      process.exit(1);
    });
}
