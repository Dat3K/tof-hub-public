import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {resolveGameAsset} from '@tof-hub/game-assets';
import {getServerGameDataRoot} from '@/lib/game-data-server';

/** Fixed card texts. Link previews are English only, whatever the UI locale (docs/architecture/link-previews.md). */
export const OG_BRAND = 'TOF HUB';
export const OG_FOOTER = 'Tower of Fantasy · game data and tools';

export interface LocalImageSize {
  width: number;
  height: number;
  /** `inside` keeps the whole picture (default); `cover` fills the box and crops. */
  fit?: 'inside' | 'cover';
}

/**
 * A local public or game-asset image as a PNG data URL for ImageResponse. Only site-relative paths from generated
 * data are accepted; a missing or oversized file returns undefined so the card stays usable as text.
 */
export async function localImage(url: string | null | undefined, size: LocalImageSize = {width:480, height:590}): Promise<string | undefined> {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('..') || url.includes('\\')) return;
  if (/^\/(?:datamine\/shared\/media\/(?:Hotta|Engine)\/|game-assets\/)/.test(url)) {
    const resolved = resolveGameAsset({path:url, silent:true});
    if (!resolved.isFallback) url = `/game-assets/${resolved.format}/${resolved.fileRelativePath}`;
  }
  const roots = [path.join(process.cwd(), 'public'), path.join(process.cwd(), 'apps/web/public'), path.dirname(getServerGameDataRoot())];
  for (const root of roots) {
    try {
      const file = path.resolve(root, `.${decodeURIComponent(url)}`);
      if (path.relative(root, file).startsWith('..')) continue;
      if ((await fs.stat(file)).size > 15 * 1024 * 1024) continue;
      const data = await fs.readFile(file);
      // ImageResponse's renderer needs PNG/JPEG; game assets are predominantly WebP.
      const png = await sharp(data, {limitInputPixels:40_000_000})
        .resize({width:size.width, height:size.height, fit:size.fit ?? 'inside', withoutEnlargement:size.fit !== 'cover'}).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { /* A missing game image keeps the text card usable. */ }
  }
}
