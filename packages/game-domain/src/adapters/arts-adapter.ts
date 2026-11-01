import type { ArtworkCore, ArtworkCategory } from '../entities/art';

export function adaptArtwork(raw: any): ArtworkCore {
  let titleStr = '';
  if (typeof raw.title === 'string') {
    titleStr = raw.title;
  } else if (raw.title && typeof raw.title === 'object') {
    titleStr = raw.title.en || raw.title.ru || '';
  } else if (raw.id) {
    titleStr = raw.id;
  }

  let numAspectRatio = 1.777;
  if (typeof raw.aspectRatio === 'number') {
    numAspectRatio = raw.aspectRatio;
  } else if (typeof raw.aspectRatio === 'string') {
    const parsed = parseFloat(raw.aspectRatio);
    if (!isNaN(parsed)) {
      numAspectRatio = parsed;
    }
  }

  return {
    stableId: raw.id || '',
    title: titleStr,
    category: (raw.category || 'others') as ArtworkCategory,
    subCategory: raw.subCategory || null,
    themeTag: raw.themeTag || null,
    width: Number(raw.width ?? 1920),
    height: Number(raw.height ?? 1080),
    aspectRatio: numAspectRatio,
    aspectLabel: raw.aspectLabel || '16:9',
    url: raw.url || raw.webpUrl || '',
    webpUrl: raw.webpUrl || raw.url || '',
    pngUrl: raw.pngUrl || raw.url || '',
    thumbUrl: raw.thumbUrl || raw.webpUrl || raw.url || '',
    sizeBytes: Number(raw.sizeBytes ?? 0),
    pngSizeBytes: typeof raw.pngSizeBytes === 'number' ? raw.pngSizeBytes : undefined,
    characterKey: raw.characterKey || null,
    characterName: typeof raw.characterName === 'object' && raw.characterName !== null
      ? (raw.characterName.en || raw.characterName.ru || null)
      : (raw.characterName || null),
    season: raw.season != null ? String(raw.season) : null,
  };
}
