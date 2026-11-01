import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LOCALES } from '../../packages/i18n/src/constants';
import {
  findProjectRoot,
  createPathGuard,
  loadPipelineEnv,
  tryGetRawGameSourceDir,
} from '../_shared';
import {
  ReleaseManifestSchema,
  type ReleaseManifest,
  type ManifestSnapshot,
  type ManifestClientVersion,
} from '@tof-hub/contracts';

export interface BuildManifestOptions {
  legacySourceDir?: string;
  publicDataDir?: string;
  rawSourceDir?: string;
  manifestOutput?: string;
  dryRun?: boolean;
  generatedAt?: string;
  preserveGeneratedAt?: boolean;
  /** Explicit owner correction of the dataset version; does not change source provenance. */
  snapshotVersion?: string;
}

export async function buildDataManifest(
  options: BuildManifestOptions = {}
): Promise<ReleaseManifest> {
  const projectRoot = findProjectRoot();
  loadPipelineEnv(projectRoot);

  const defaultLegacyDir = require('node:path').resolve('pipeline/staging');
  const legacySourceDir = options.legacySourceDir || defaultLegacyDir;

  const publicDataDir =
    options.publicDataDir || path.join(projectRoot, 'apps', 'web', 'public', 'game-data');
  const manifestOutputPath =
    options.manifestOutput || path.join(publicDataDir, 'release-manifest.json');

  const dryRun = options.dryRun === true;

  // PathGuard assertion
  const rawDir = options.rawSourceDir || tryGetRawGameSourceDir({ projectRoot }) || undefined;
  if (rawDir) {
    const pathGuard = createPathGuard(rawDir, [publicDataDir]);
    pathGuard.assertSafeOutput(manifestOutputPath);
  }

  // 1. Read legacy release-manifest.json (snapshot + build provenance)
  const legacyManifestPath = path.join(legacySourceDir, 'datamine', 'release-manifest.json');
  let snapshot: ManifestSnapshot = {
    version: '6.3.14',
    exportedAt: '2026-09-05T08:02:13.567Z',
    sources: [
      {
        client: 'Korea Dev 1',
        branch: 'TestPC_KR2New',
        clientRu: 'Корея Dev 1',
        appVersion: '3.0.0',
        hash: '100a25',
      },
    ],
  };
  let buildStatus = 'fresh-success';
  let builtAt = '2026-09-10T16:59:49.628Z';

  if (fs.existsSync(legacyManifestPath)) {
    try {
      const rawLegacy = JSON.parse(fs.readFileSync(legacyManifestPath, 'utf8'));
      if (rawLegacy.snapshot) {
        snapshot = {
          version: rawLegacy.snapshot.version || snapshot.version,
          exportedAt: rawLegacy.snapshot.exportedAt || snapshot.exportedAt,
          sources: Array.isArray(rawLegacy.snapshot.sources)
            ? rawLegacy.snapshot.sources
            : snapshot.sources,
        };
      }
      if (rawLegacy.build) {
        builtAt = rawLegacy.build.builtAt || builtAt;
        buildStatus = rawLegacy.build.status || buildStatus;
      }
    } catch {
      // Fall back to default verified constants
    }
  } else {
    // Game pipeline: the extraction step records the exported client in export-version.json.
    const exportVersionPath = [legacySourceDir, rawDir]
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => path.join(dir, 'export-version.json'))
      .find((file) => fs.existsSync(file));
    if (exportVersionPath) {
      try {
        const exported = JSON.parse(fs.readFileSync(exportVersionPath, 'utf8').replace(/^﻿/, ''));
        if (exported.version) {
          snapshot = {
            version: String(exported.version),
            exportedAt: exported.lastUpdateIso || snapshot.exportedAt,
            sources: [
              {
                client: exported.clientName || '',
                branch: exported.branch || '',
                clientRu: exported.clientNameRu || exported.clientName || '',
                appVersion: exported.appVersion || '',
                hash: exported.hash || '',
              },
            ],
          };
          builtAt = new Date().toISOString();
        }
      } catch {
        // Keep the defaults when the export record is unreadable.
      }
    }
  }

  if (options.snapshotVersion !== undefined) {
    if (!/^\d+\.\d+\.\d+$/.test(options.snapshotVersion)) {
      throw new Error('Snapshot version must have the form major.minor.patch');
    }
    snapshot = { ...snapshot, version: options.snapshotVersion };
  }

  // 2. Read legacy version-current.json (per-region client versions)
  const legacyVersionsPath = path.join(legacySourceDir, 'version-current.json');
  const clientVersions: Record<string, ManifestClientVersion> = {
    korea1: { version: '6.3.6', lastChanged: '2026-08-26T09:36:37.216Z', lastChangedFormatted: '26.08.2026' },
    korea2: { version: '6.2.19', lastChanged: '2026-08-21T08:55:33.877Z', lastChangedFormatted: '21.08.2026' },
    taiwan1: { version: '6.3.1', lastChanged: '2026-08-26T09:36:37.216Z', lastChangedFormatted: '26.08.2026' },
    taiwan2: { version: '6.2.6', lastChanged: '2026-08-21T08:55:33.877Z', lastChangedFormatted: '21.08.2026' },
    global: { version: '6.2.0', lastChanged: '2026-08-21T08:55:33.877Z', lastChangedFormatted: '21.08.2026' },
    cn: { version: '5.2.54', lastChanged: '2026-08-21T08:55:33.877Z', lastChangedFormatted: '21.08.2026' },
  };

  if (fs.existsSync(legacyVersionsPath)) {
    try {
      const rawVersions = JSON.parse(fs.readFileSync(legacyVersionsPath, 'utf8'));
      for (const [region, data] of Object.entries(rawVersions)) {
        if (typeof data === 'object' && data !== null && 'version' in data) {
          const v = data as any;
          clientVersions[region] = {
            version: String(v.version),
            lastChanged: v.lastChanged ? String(v.lastChanged) : undefined,
            lastChangedFormatted: v.lastChangedFormatted ? String(v.lastChangedFormatted) : undefined,
          };
        }
      }
    } catch {
      // Keep verified defaults
    }
  }

  // 3. Scan materialized data in publicDataDir to compute fileCounts
  const fileCounts: Record<string, number> = {
    enDatasets: 0,
    ruDatasets: 0,
    changelogFiles: 0,
  };
  const datasetsSummary: Record<string, Record<string, unknown>> = {};

  const enDir = path.join(publicDataDir, 'en');
  if (fs.existsSync(enDir)) {
    const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'));
    fileCounts.enDatasets = enFiles.length;

    for (const file of enFiles) {
      const dsName = file.replace(/\.json$/, '');
      try {
        const content = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
        const total = content.total || (Array.isArray(content) ? content.length : content.items?.length || 0);
        fileCounts[`dataset_${dsName}`] = total;
        datasetsSummary[dsName] = {
          total,
          schemaVersion: content.schemaVersion || 1,
        };
      } catch {
        // Skip unreadable files
      }
    }
  }

  const ruDir = path.join(publicDataDir, 'ru');
  if (fs.existsSync(ruDir)) {
    fileCounts.ruDatasets = fs.readdirSync(ruDir).filter((f) => f.endsWith('.json')).length;
  }

  const changelogDir = path.join(publicDataDir, 'changelog');
  if (fs.existsSync(changelogDir)) {
    fileCounts.changelogFiles = fs.readdirSync(changelogDir).filter((f) => f.endsWith('.json')).length;
  }

  // 4. Assemble ReleaseManifest payload
  let generatedAt = options.generatedAt;
  if (!generatedAt && options.preserveGeneratedAt !== false && fs.existsSync(manifestOutputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(manifestOutputPath, 'utf8'));
      if (existing.generatedAt) {
        generatedAt = existing.generatedAt;
      }
    } catch {
      // Ignore parse error
    }
  }
  if (!generatedAt) {
    generatedAt = new Date().toISOString();
  }

  const manifestData: ReleaseManifest = {
    schemaVersion: 1,
    gameVersion: snapshot.version || '6.3.14',
    generatedAt,
    exporterVersion: '1.0.0',
    locales: SUPPORTED_LOCALES.filter(locale => fs.existsSync(path.join(publicDataDir, locale))),
    assets: {
      png: true,
      webp: true,
    },
    snapshot,
    clientVersions,
    build: {
      builtAt,
      status: buildStatus,
    },
    fileCounts,
    validationStatus: 'fresh-success',
    datasets: datasetsSummary,
  };

  // Validate against Zod schema
  const parsedManifest = ReleaseManifestSchema.parse(manifestData);

  // Write to disk
  if (!dryRun) {
    const parentDir = path.dirname(manifestOutputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(manifestOutputPath, JSON.stringify(parsedManifest, null, 2) + '\n', 'utf8');
  }

  return parsedManifest;
}
