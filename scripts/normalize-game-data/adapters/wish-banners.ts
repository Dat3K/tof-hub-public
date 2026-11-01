import fs from 'node:fs';
import { gameLocalizationLocale } from '../../game-processors/processors/game-source-reader';
import path from 'node:path';
import { loadSharp } from '../../_shared/sharp';
import type { DatasetNormalizationResult, WishPoolCandidate } from '../types';

type LegacyBanner = {
  id: string;
  name: string;
  name_en: string;
  name_ru: string;
  type: string;
  raw_banner_codes?: string[];
  character_id: string | null;
  weapon_id: string | null;
  matrix_id: string | null;
  start_date: string;
  end_date: string;
  currency: string;
  cashback_currency: string;
  featured_ssr: string[];
  featured_sr: string[];
  standard_pool_items: string[];
  assets: Record<string, string | null>;
};

const CURATED_SOURCE = path.join(__dirname, '..', 'curated', 'wish-banners.json');

function readSource(legacySourceDir: string): LegacyBanner[] {
  const legacyPath = path.join(legacySourceDir, 'tools', 'wish', 'data', 'banners.json');
  const curated: unknown = JSON.parse(fs.readFileSync(CURATED_SOURCE, 'utf8'));
  if (!Array.isArray(curated)) throw new Error(`Invalid wish banner registry: ${CURATED_SOURCE}`);
  if (!fs.existsSync(legacyPath)) return curated as LegacyBanner[];

  const legacy: unknown = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
  if (!Array.isArray(legacy)) throw new Error(`Invalid wish banner registry: ${legacyPath}`);
  const curatedById = new Map((curated as LegacyBanner[]).map((banner) => [banner.id, banner]));
  return (legacy as LegacyBanner[]).map((banner) => {
    const curatedAssets = curatedById.get(banner.id)?.assets;
    return {
      ...banner,
      assets: {
        ...banner.assets,
        title_image_en: banner.assets?.title_image_en || curatedAssets?.title_image_en || null,
        title_image_ru: banner.assets?.title_image_ru || curatedAssets?.title_image_ru || null,
      },
    };
  });
}

function resolvePublicAsset(
  value: string | null | undefined,
  characterId: string,
  publicDir: string,
  rawGameDir?: string,
): string {
  if (!value) return '';
  if (value.startsWith('/datamine/')) {
    const diskPath = path.join(publicDir, ...value.split('/').filter(Boolean));
    if (fs.existsSync(diskPath)) return value;
  }
  if (value.startsWith('/Game/') || value.startsWith('/datamine/shared/media/')) {
    let relativePath = value.startsWith('/Game/')
      ? `Hotta/Content/${value.slice('/Game/'.length)}`
      : value.slice('/datamine/shared/media/'.length);
    // UE references may append `.ObjectName` or `.uasset`; public media files are format based.
    const basename = path.posix.basename(relativePath);
    const lastDot = basename.lastIndexOf('.');
    if (lastDot > 0) {
      const stem = basename.slice(0, lastDot);
      const suffix = basename.slice(lastDot + 1);
      if (stem.toLowerCase() === suffix.toLowerCase() || ['uasset', 'uexp'].includes(suffix.toLowerCase())) {
        relativePath = `${path.posix.dirname(relativePath)}/${stem}`;
      } else if (['png', 'webp', 'jpg', 'jpeg'].includes(suffix.toLowerCase())) {
        relativePath = relativePath.slice(0, -(suffix.length + 1));
      }
    }
    if (relativePath.split('/').includes('..')) return '';
    for (const extension of ['webp', 'png'] as const) {
      const fileName = `${relativePath}.${extension}`;
      const diskPath = path.join(publicDir, 'game-assets', extension, ...fileName.split('/'));
      if (fs.existsSync(diskPath)) return `/game-assets/${extension}/${fileName}`;
    }
    // The full pipeline normalizes before its media pass. Resolve only when the raw
    // source image exists so that the media pass can materialize this deterministic URL.
    if (rawGameDir) {
      const sourcePath = path.join(rawGameDir, ...relativePath.split('/')) + '.png';
      if (fs.existsSync(sourcePath)) return `/game-assets/webp/${relativePath}.webp`;
    }
  }
  if (value.startsWith('/Game/')) {
    const localizedMatch = value.match(/\/L10N\/(en|ru)\//i);
    const baseName = path.basename(value);
    const localizedBaseName = localizedMatch ? `${baseName}_L10N_${localizedMatch[1].toLowerCase()}` : baseName;
    const artworkDirectory = path.join(publicDir, 'datamine', 'shared', 'media', 'artworks', characterId);
    for (const fileNameBase of [localizedBaseName, baseName]) {
      for (const extension of ['webp', 'png']) {
        const fileName = `${fileNameBase}.${extension}`;
        if (fs.existsSync(path.join(artworkDirectory, fileName))) {
          return `/datamine/shared/media/artworks/${characterId}/${fileName}`;
        }
      }
    }
  }
  return '';
}

type SimulacraRecord = {
  id?: string;
  slug?: string;
  canonical_id?: string;
  weapon_id?: string | null;
  assets?: Array<{
    name?: string;
    name_en?: string;
    unrealPath?: string;
    webpUrl?: string;
    pngUrl?: string;
  }>;
};

/** A title emblem still to be encoded: raw game PNG (or a previously copied PNG) → WebP next to the banner art. */
export type WishTitleArtJob = { source: string; target: string };

function resolveLocalizedTitle(
  banner: LegacyBanner,
  locale: 'en' | 'ru',
  publicDir: string,
  simulacra: readonly SimulacraRecord[],
  rawGameDir: string | undefined,
  jobs: WishTitleArtJob[],
): string {
  const assetLocale = locale === 'en' ? gameLocalizationLocale() ?? locale : locale;
  const characterId = (banner.character_id || '').toLowerCase();
  const character = simulacra.find((item) =>
    [item.id, item.slug, item.canonical_id].some((id) => id?.toLowerCase() === characterId)
    || Boolean(banner.weapon_id && item.weapon_id === banner.weapon_id)
  );
  const bannerDirectory = path.posix.dirname(banner.assets?.background ?? '');
  const titleAsset = character?.assets?.find((asset) =>
    asset.unrealPath?.startsWith(`${bannerDirectory}/`)
    && /(?:^Title_.+|_Title(?:_?\d+)?)$/i.test(path.posix.basename(asset.unrealPath))
    && !/huodong/i.test(asset.unrealPath)
  );
  const sourcePath = banner.assets?.[`title_image_${locale}`] || titleAsset?.unrealPath;
  if (!sourcePath?.startsWith('/Game/Resources/UI/chouka/')) return '';
  const relativePath = sourcePath.slice('/Game/'.length).replace(/\/L10N\/(?:en|ru)\//i, '/');
  if (relativePath.split('/').includes('..')) return '';
  // Shipped as WebP (alpha kept): the raw PNG emblems averaged ~80 KB each.
  const baseName = `${path.posix.basename(relativePath)}_L10N_${assetLocale}`;
  const directory = banner.character_id || banner.id;
  const outputDirectory = path.join(publicDir, 'datamine', 'shared', 'media', 'artworks', directory);
  const url = `/datamine/shared/media/artworks/${directory}/${baseName}.webp`;
  const target = path.join(outputDirectory, `${baseName}.webp`);
  const rawPath = rawGameDir
    ? path.join(rawGameDir, 'Hotta', 'Content', 'L10N', assetLocale, ...relativePath.split('/')) + '.png'
    : '';
  if ((!rawPath || !fs.existsSync(rawPath)) && fs.existsSync(target)) return url;
  // The raw export is the source of truth; a PNG copied by an earlier run is the fallback without raw data.
  const source = [rawPath, path.join(outputDirectory, `${baseName}.png`)].find((candidate) => candidate && fs.existsSync(candidate));
  if (!source) return '';
  if (!jobs.some((job) => job.target === target)) jobs.push({ source, target });
  return url;
}

/** Encodes pending title emblems; callers await it before writing the dataset that references them. */
export async function materializeWishTitleArt(jobs: readonly WishTitleArtJob[]): Promise<void> {
  if (!jobs.length) return;
  const sharp = loadSharp();
  for (const job of jobs) {
    fs.mkdirSync(path.dirname(job.target), { recursive: true });
    // q90 with lossless alpha is visually identical to the PNG at 2× zoom and ~57% smaller over all titles.
    await sharp(job.source).webp({ quality: 90, alphaQuality: 100, effort: 4 }).toFile(job.target);
  }
}

function resolveMatrixPhotoTwo(
  banner: LegacyBanner,
  publicDir: string,
  simulacra: readonly SimulacraRecord[],
  rawGameDir?: string,
): string {
  const characterId = (banner.character_id || '').toLowerCase();
  const bannerCharacterId = banner.id.replace(/^matrix-/, '').toLowerCase();
  const character = simulacra.find((item) => {
    const ids = [item.id, item.slug, item.canonical_id].filter(Boolean).map((value) => value!.toLowerCase());
    return ids.includes(characterId) || ids.includes(bannerCharacterId) || Boolean(banner.weapon_id && item.weapon_id === banner.weapon_id);
  });
  const photoTwo = character?.assets?.find((asset) =>
    (asset.name_en ?? asset.name ?? '').trim().toLowerCase().endsWith('special order photo 2')
  );
  if (!photoTwo) return '';

  for (const value of [photoTwo.webpUrl, photoTwo.pngUrl]) {
    if (!value?.startsWith('/datamine/')) continue;
    const diskPath = path.join(publicDir, ...value.split('/').filter(Boolean));
    if (fs.existsSync(diskPath)) return value;
  }
  return resolvePublicAsset(photoTwo.unrealPath, banner.character_id || banner.id, publicDir, rawGameDir);
}

function normalizeBanner(banner: LegacyBanner, publicDir: string, simulacra: readonly SimulacraRecord[], rawGameDir: string | undefined, jobs: WishTitleArtJob[]) {
  const bannerType = banner.type;
  if (!['weapon_limited', 'matrix_limited', 'standard_weapon', 'standard_matrix', 'black_nucleus'].includes(bannerType)) {
    return null;
  }
  const pityTarget = bannerType.includes('matrix') ? 40 : bannerType === 'black_nucleus' ? 0 : 80;
  const titleImageEn = resolveLocalizedTitle(banner, 'en', publicDir, simulacra, rawGameDir, jobs);
  const titleImageRu = resolveLocalizedTitle(banner, 'ru', publicDir, simulacra, rawGameDir, jobs);
  return {
    id: banner.id,
    name: banner.name_en || banner.name,
    name_en: banner.name_en || banner.name,
    name_ru: banner.name_ru || banner.name,
    banner_type: bannerType,
    raw_banner_codes: banner.raw_banner_codes ?? [],
    character_id: banner.character_id || banner.id,
    ...(banner.weapon_id ? { weapon_id: banner.weapon_id } : {}),
    ...(banner.matrix_id ? { matrix_id: banner.matrix_id } : {}),
    pity_target: pityTarget,
    start_date: banner.start_date,
    end_date: banner.end_date,
    currency: banner.currency,
    cashback_currency: banner.cashback_currency,
    featured_ssr: banner.featured_ssr ?? [],
    featured_sr: banner.featured_sr ?? [],
    standard_pool_items: banner.standard_pool_items ?? [],
    assets: {
      background: resolvePublicAsset(banner.assets?.background, banner.character_id || banner.id, publicDir, rawGameDir),
      splash: bannerType === 'matrix_limited'
        ? resolveMatrixPhotoTwo(banner, publicDir, simulacra, rawGameDir) || resolvePublicAsset(banner.assets?.splash, banner.character_id || banner.id, publicDir, rawGameDir)
        : resolvePublicAsset(banner.assets?.splash, banner.character_id || banner.id, publicDir, rawGameDir),
      icon: resolvePublicAsset(banner.assets?.thumbnail ?? banner.assets?.icon, banner.character_id || banner.id, publicDir, rawGameDir),
      ...(resolvePublicAsset(banner.assets?.weapon_icon, banner.character_id || banner.id, publicDir, rawGameDir)
        ? { weapon_icon: resolvePublicAsset(banner.assets?.weapon_icon, banner.character_id || banner.id, publicDir, rawGameDir) }
        : {}),
      ...(resolvePublicAsset(banner.assets?.matrix_icon, banner.character_id || banner.id, publicDir, rawGameDir)
        ? { matrix_icon: resolvePublicAsset(banner.assets?.matrix_icon, banner.character_id || banner.id, publicDir, rawGameDir) }
        : {}),
      ...(titleImageEn ? { title_image_en: titleImageEn } : {}),
      ...(titleImageRu ? { title_image_ru: titleImageRu } : {}),
    },
  };
}

/**
 * Special Order codes from the raw lottery blueprints, relative to the raw-export root:
 * Hotta/Content/SevenForest/Blueprint/Lottery/BP_{Weapon,Artifact}Lottery_*.json, object with
 * `Properties.RecordName` (the code in captured history; it can differ from the file name, e.g.
 * BP_WeaponLottery_M_1 → WeaponLottery_Mei_1), `IsUPLottery = true`, `ssrWeaponIDArray`
 * (weapon id, or matrix_SSR<n>_<slot> pieces of suit_SSR<n>). Reruns reuse these codes.
 */
function readLotteryCodes(rawGameDir: string | undefined): WishPoolCandidate[] {
  if (!rawGameDir) return [];
  const directory = path.join(rawGameDir, 'Hotta', 'Content', 'SevenForest', 'Blueprint', 'Lottery');
  if (!fs.existsSync(directory)) return [];
  const codes: WishPoolCandidate[] = [];
  for (const file of fs.readdirSync(directory).sort()) {
    const kind = /^BP_WeaponLottery_.+\.json$/.test(file) ? 'weapon' : /^BP_ArtifactLottery_.+\.json$/.test(file) ? 'matrix' : null;
    // A ModuleN filename does not mean the pool is permanent: older limited orders
    // also live there. IsUPLottery plus a featured SSR item is the eligible signal;
    // permanent Weapon Module1/2 and Artifact Module1 pools lack that combination.
    if (!kind) continue;
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    const objects = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{ Properties?: Record<string, unknown> }>;
    const properties = objects.find((object) => typeof object?.Properties?.RecordName === 'string')?.Properties;
    const featured = properties?.ssrWeaponIDArray;
    if (!properties || properties.IsUPLottery !== true || !Array.isArray(featured) || typeof featured[0] !== 'string') continue;
    const recordName = String(properties.RecordName);
    if (!/^[A-Za-z0-9_]{1,80}$/.test(recordName)) continue;
    const key = kind === 'weapon' ? featured[0] : featured[0].replace(/^matrix_(SSR\d+)_\d+$/i, 'suit_$1');
    if (kind === 'matrix' && key === featured[0]) continue;
    const extractConfig = properties.ExtractConfigMap;
    const onePull = Array.isArray(extractConfig)
      ? (extractConfig as Array<{ Key?: unknown; Value?: Record<string, unknown> }>).find((entry) => entry.Key === '1')?.Value
      : undefined;
    const voucherItem = (onePull?.VoucherItem as { ItemId?: unknown } | undefined)?.ItemId;
    const awardPools = onePull?.AwardNamePools;
    const awardPool = Array.isArray(awardPools)
      ? (awardPools[0] as { Value?: unknown } | undefined)?.Value
      : undefined;
    const widgetPath = (properties.LotteryWidget as { AssetPathName?: unknown } | undefined)?.AssetPathName;
    codes.push({
      recordName,
      kind,
      key: key.toLowerCase(),
      featuredItem: featured[0],
      maxUnluckyCount: typeof properties.MaxUnluckyCount === 'number' ? properties.MaxUnluckyCount : null,
      voucherItem: typeof voucherItem === 'string' ? voucherItem : null,
      awardPool: typeof awardPool === 'string' ? awardPool : null,
      widgetPath: typeof widgetPath === 'string' ? widgetPath : null,
      sourcePath: `Hotta/Content/SevenForest/Blueprint/Lottery/${file}`,
    });
  }
  return codes;
}

/** Keep explicit raw-code mappings only when they uniquely match the featured item and track. */
function attachLotteryCodes<T extends { raw_banner_codes: string[] }>(
  banners: T[], codes: WishPoolCandidate[],
): { banners: T[]; unmapped: WishPoolCandidate[] } {
  const scheduledRows = new Map<string, T[]>();
  for (const banner of banners) {
    for (const code of banner.raw_banner_codes) {
      const rows = scheduledRows.get(code) ?? [];
      rows.push(banner);
      scheduledRows.set(code, rows);
    }
  }

  const invalidMappings = new Set<string>();
  const unmapped: WishPoolCandidate[] = [];
  for (const code of codes) {
    const rows = scheduledRows.get(code.recordName) ?? [];
    if (rows.length === 0) {
      unmapped.push(code);
      continue;
    }
    if (rows.length !== 1) {
      invalidMappings.add(code.recordName);
      unmapped.push({ ...code, mappingIssue: `code is assigned to ${rows.length} schedule rows` });
      continue;
    }

    const banner = rows[0] as T & { banner_type?: string; weapon_id?: string; matrix_id?: string };
    const expectedTrack = code.kind === 'weapon' ? 'weapon' : 'matrix';
    const expectedItem = code.kind === 'weapon' ? banner.weapon_id : banner.matrix_id;
    const itemMatches = typeof expectedItem === 'string'
      && expectedItem.toLowerCase() === code.key.toLowerCase();
    if (!banner.banner_type?.includes(expectedTrack) || !itemMatches) {
      invalidMappings.add(code.recordName);
      const issue = !banner.banner_type?.includes(expectedTrack)
        ? `raw ${code.kind} pool is assigned to ${banner.banner_type ?? 'unknown'} track`
        : `featured item ${code.key} does not match schedule item ${expectedItem ?? 'unknown'}`;
      unmapped.push({ ...code, mappingIssue: issue });
    }
  }

  if (!invalidMappings.size) return { banners, unmapped };
  return {
    banners: banners.map((banner) => ({
      ...banner,
      raw_banner_codes: banner.raw_banner_codes.filter((code) => !invalidMappings.has(code)),
    })),
    unmapped,
  };
}

export function normalizeWishBannersDataset(
  legacySourceDir: string,
  publicDir = path.resolve(__dirname, '../../../apps/web/public'),
  simulacra: readonly SimulacraRecord[] = [],
  rawGameDir?: string,
): DatasetNormalizationResult & { titleArtJobs: WishTitleArtJob[]; unmappedLotteryCodes: WishPoolCandidate[] } {
  const titleArtJobs: WishTitleArtJob[] = [];
  const attached = attachLotteryCodes(readSource(legacySourceDir)
    .map((banner) => normalizeBanner(banner, publicDir, simulacra, rawGameDir, titleArtJobs))
    .filter((banner): banner is NonNullable<typeof banner> => banner !== null), readLotteryCodes(rawGameDir));
  const banners = attached.banners.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
  return {
    datasetName: 'wish-banners',
    core: banners,
    overlays: { en: {}, ru: {} },
    materialized: { en: banners, ru: banners },
    counts: { total: banners.length },
    titleArtJobs,
    unmappedLotteryCodes: attached.unmapped,
  };
}

/** Keep Wish asset URLs aligned with files that survived the media export. */
export function reconcileWishBannerAssetUrls<T extends { assets?: Record<string, string | null> }>(
  banners: T[],
  publicDir: string,
): number {
  let changed = 0;
  for (const banner of banners) {
    for (const [key, value] of Object.entries(banner.assets ?? {})) {
      if (!value) continue;
      if (value.startsWith('/Game/')) {
        delete banner.assets![key];
        changed++;
        continue;
      }
      if (!value.startsWith('/game-assets/') && !value.startsWith('/datamine/')) continue;
      if (value.split('/').includes('..')) {
        delete banner.assets![key];
        changed++;
        continue;
      }
      const diskPath = path.join(publicDir, ...value.split('/').filter(Boolean));
      if (fs.existsSync(diskPath)) continue;
      const webp = value.match(/^\/game-assets\/webp\/(.+)\.webp$/i);
      if (webp) {
        const pngUrl = `/game-assets/png/${webp[1]}.png`;
        const pngPath = path.join(publicDir, ...pngUrl.split('/').filter(Boolean));
        if (fs.existsSync(pngPath)) {
          banner.assets![key] = pngUrl;
          changed++;
          continue;
        }
      }
      delete banner.assets![key];
      changed++;
    }
  }
  return changed;
}
