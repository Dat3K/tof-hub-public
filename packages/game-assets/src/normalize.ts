const KNOWN_IMAGE_EXTENSIONS = new Set([
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.tga',
  '.bmp',
  '.svg',
  '.gif',
]);

export interface PathNormalizationResult {
  normalizedPath: string;
  isLegacyMigrated: boolean;
  legacyType?: 'datamine' | 'ue_game_ref' | 'pre_resolved' | 'filesystem';
  error?: string;
}

/**
 * Normalizes any asset reference (in-game relative, legacy URL, UE reference, etc.)
 * into a clean, format-agnostic in-game relative path.
 *
 * Examples:
 * - 'Hotta/Content/Resources/UI/wuqi/icon_element_huo.png' -> 'Hotta/Content/Resources/UI/wuqi/icon_element_huo'
 * - '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp' -> 'Hotta/Content/Resources/UI/wuqi/icon_fangyu'
 * - '/Game/Resources/UI/Artifact/itemicon/artifact_ssr_001.artifact_ssr_001' -> 'Hotta/Content/Resources/UI/Artifact/itemicon/artifact_ssr_001'
 * - '/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp' -> 'Hotta/Content/Resources/UI/wuqi/icon_element_huo'
 */
export function normalizeAssetPath(rawPath: unknown): PathNormalizationResult {
  if (rawPath === null || rawPath === undefined) {
    return { normalizedPath: '', isLegacyMigrated: false, error: 'Path is null or undefined' };
  }
  if (typeof rawPath !== 'string') {
    return { normalizedPath: '', isLegacyMigrated: false, error: `Path must be a string, received ${typeof rawPath}` };
  }

  let p = rawPath.trim();
  if (!p) {
    return { normalizedPath: '', isLegacyMigrated: false, error: 'Path is empty or whitespace' };
  }

  // Convert Windows backslashes to forward slashes
  p = p.replace(/\\/g, '/');

  // Strip query string and hash if present
  const queryIndex = p.indexOf('?');
  if (queryIndex !== -1) {
    p = p.slice(0, queryIndex);
  }
  const hashIndex = p.indexOf('#');
  if (hashIndex !== -1) {
    p = p.slice(0, hashIndex);
  }

  // Normalize multiple slashes
  p = p.replace(/\/+/g, '/');

  let isLegacyMigrated = false;
  let legacyType: PathNormalizationResult['legacyType'] = undefined;

  // Check for path traversal attempts
  const segments = p.split('/');
  let depth = 0;
  for (const seg of segments) {
    if (seg === '..') {
      depth--;
      if (depth < 0) {
        return { normalizedPath: '', isLegacyMigrated: false, error: 'Path traversal detected' };
      }
    } else if (seg && seg !== '.') {
      depth++;
    }
  }

  // 1. Check for legacy datamine site paths:
  // e.g. /datamine/shared/media/Hotta/Content/... or datamine/shared/media/...
  const datamineRegex = /^\/?datamine\/shared\/media\/(.+)$/i;
  const datamineMatch = p.match(datamineRegex);
  if (datamineMatch) {
    p = datamineMatch[1];
    isLegacyMigrated = true;
    legacyType = 'datamine';
  }

  // 2. Check for Unreal Engine /Game/ reference paths:
  // e.g. /Game/Resources/UI/Artifact/itemicon/artifact_ssr_001.artifact_ssr_001
  // In ToF UE, /Game/ maps to Hotta/Content/
  const ueGameRegex = /^\/?Game\/(.+)$/i;
  const ueGameMatch = p.match(ueGameRegex);
  if (ueGameMatch) {
    p = 'Hotta/Content/' + ueGameMatch[1];
    // UE asset refs often append `.AssetName` to the file: e.g. `artifact_ssr_001.artifact_ssr_001`
    const lastSlash = p.lastIndexOf('/');
    const filename = lastSlash !== -1 ? p.slice(lastSlash + 1) : p;
    const dotIndex = filename.indexOf('.');
    if (dotIndex !== -1) {
      const baseName = filename.slice(0, dotIndex);
      const suffix = filename.slice(dotIndex + 1);
      if (baseName.toLowerCase() === suffix.toLowerCase() || suffix === 'uasset' || suffix === 'uexp') {
        p = (lastSlash !== -1 ? p.slice(0, lastSlash + 1) : '') + baseName;
      }
    }
    isLegacyMigrated = true;
    legacyType = 'ue_game_ref';
  }

  // 3. Check for existing /game-assets/ or game-assets/ URLs:
  // e.g. /game-assets/webp/Hotta/Content/... or /game-assets/png/Hotta/Content/...
  const gameAssetsRegex = /^\/?game-assets\/(?:webp|png)\/(.+)$/i;
  const gameAssetsMatch = p.match(gameAssetsRegex);
  if (gameAssetsMatch) {
    p = gameAssetsMatch[1];
    isLegacyMigrated = true;
    legacyType = 'pre_resolved';
  }

  // 4. Check for filesystem paths like apps/web/public/game-assets/(webp|png)/...
  const fsRegex = /^(?:.*?\/)?public\/game-assets\/(?:webp|png)\/(.+)$/i;
  const fsMatch = p.match(fsRegex);
  if (fsMatch) {
    p = fsMatch[1];
    isLegacyMigrated = true;
    legacyType = 'filesystem';
  }

  // Remove leading and trailing slashes
  p = p.replace(/^\/+|\/+$/g, '');

  // Strip known image extensions so format can be dynamically applied
  const lastDot = p.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = p.slice(lastDot).toLowerCase();
    if (KNOWN_IMAGE_EXTENSIONS.has(ext)) {
      p = p.slice(0, lastDot);
    }
  }

  if (!p) {
    return { normalizedPath: '', isLegacyMigrated, error: 'Path resulted in empty string after normalization' };
  }

  return {
    normalizedPath: p,
    isLegacyMigrated,
    legacyType,
  };
}
