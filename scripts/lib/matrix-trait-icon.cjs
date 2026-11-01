const path = require('node:path');

/**
 * Build a deterministic resolver for circular character portraits from the
 * exporter media manifest. Returns a WebP path relative to the game-assets root.
 */
function createMatrixTraitIconResolver(assets) {
  const exported = new Map();

  for (const asset of Array.isArray(assets) ? assets : []) {
    if (asset?.status !== 'converted' || typeof asset.relativePath !== 'string') continue;

    const relativePath = asset.relativePath.replace(/\\/g, '/');
    if (!/^Hotta\/Content\/Resources\/Icon\/Matrix\//i.test(relativePath)) continue;

    const stem = path.posix.basename(relativePath).replace(/\.(?:png|webp)$/i, '').toLowerCase();
    if (!stem) continue;

    const webpPath = relativePath.replace(/\.(?:png|webp)$/i, '.webp');
    // Prefer the canonical-size image over its optional _2x variant.
    if (!exported.has(stem) || !/_2x$/i.test(stem)) exported.set(stem, webpPath);
  }

  return (character) => {
    const candidates = [
      character?.avatar_id,
      typeof character?.weapon_id === 'string' ? character.weapon_id.split('_')[0] : null,
      typeof character?.id === 'string' ? character.id.replace(/-mmo$/i, '') : null,
    ]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim().toLowerCase());

    for (const candidate of candidates) {
      const exact = exported.get(candidate);
      if (exact) return exact;
      const highResolution = exported.get(`${candidate}_2x`);
      if (highResolution) return highResolution;
    }

    return null;
  };
}

module.exports = { createMatrixTraitIconResolver };
