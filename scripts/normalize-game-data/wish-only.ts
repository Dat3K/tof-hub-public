import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, tryGetRawGameSourceDir } from '../_shared';
import buildRuntimeDataModule from '../generators/build-runtime-data.cjs';
import { materializeWishTitleArt, normalizeWishBannersDataset, reconcileWishBannerAssetUrls } from './adapters/wish-banners';

// Refresh the wish registry without requiring unrelated raw game exports.
const projectRoot = findProjectRoot();
const outputPath = path.join(projectRoot, 'apps', 'web', 'public', 'game-data', 'wish-banners.json');
const publicDir = path.join(projectRoot, 'apps', 'web', 'public');
const rawGameDir = tryGetRawGameSourceDir({ projectRoot }) ?? undefined;
const simulacraPath = path.join(projectRoot, 'apps', 'web', 'public', 'game-data', 'en', 'simulacra.json');
const simulacra = JSON.parse(fs.readFileSync(simulacraPath, 'utf8')) as { items?: Parameters<typeof normalizeWishBannersDataset>[2] };
const result = normalizeWishBannersDataset(
  path.join(projectRoot, 'legacy-source-unavailable'),
  publicDir,
  simulacra.items ?? [],
  rawGameDir,
);
type BannerPatch = {
  id: string;
  raw_banner_codes?: string[];
  assets?: Record<string, string | null>;
};
const generated = result.materialized.en as BannerPatch[];
const generatedById = new Map(generated.map((banner) => [banner.id, banner]));
const current = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as BannerPatch[];
const updated = current.map((banner) => {
  const source = generatedById.get(banner.id);
  const generatedAssets = source?.assets ?? {};
  const existingAssets = banner.assets ?? {};
  const assets = { ...existingAssets };
  for (const [key, value] of Object.entries(generatedAssets)) {
    if (value) assets[key] = value;
  }
  // Older generated catalogs could retain unresolved UE paths after the resolver returned no file.
  for (const [key, value] of Object.entries(existingAssets)) {
    if ((!generatedAssets[key] || !String(generatedAssets[key]).trim()) && typeof value === 'string' && value.startsWith('/Game/')) {
      delete assets[key];
    }
  }
  return {
    ...banner,
    raw_banner_codes: source?.raw_banner_codes ?? [],
    assets,
  };
});
// Title emblems are encoded to WebP before the registry that references them is written.
void (async () => {
  await materializeWishTitleArt(result.titleArtJobs);
  const reconciled = reconcileWishBannerAssetUrls(updated, publicDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryOutputPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryOutputPath, `${JSON.stringify(updated, null, 2)}\n`);
  fs.renameSync(temporaryOutputPath, outputPath);
  console.log(`Generated ${outputPath} (${result.titleArtJobs.length} title emblems encoded to WebP; ${reconciled} unavailable asset URL(s) repaired)`);
  if (result.unmappedLotteryCodes.length) {
    console.log(`Unmapped limited-order pools (no matching scheduled banner row): ${result.unmappedLotteryCodes
      .map(({ recordName, featuredItem, maxUnluckyCount, voucherItem, awardPool, widgetPath, sourcePath, mappingIssue }) =>
        `${recordName} (${featuredItem}; pity=${maxUnluckyCount ?? 'unknown'}; voucher=${voucherItem ?? 'unknown'}; pool=${awardPool ?? 'unknown'}; widget=${widgetPath ?? 'unknown'}${mappingIssue ? `; mapping=${mappingIssue}` : ''}) [${sourcePath}]`)
      .join('; ')}`);
  }
  buildRuntimeDataModule.buildRuntimeData(path.dirname(outputPath));
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
