import { localizeArtTitle } from '@tof-hub/i18n';
export { localizeArtTitle };
import type { SortOption } from '@tof-hub/ui';
import type { ArtCategory, ArtworkItem, ArtsStrings } from './types';
import type { ArtCategoryIconName } from './art-category-icon';

export const DEFAULT_ARTS_SORT = 'release_desc';

export interface ArtCategoryOption {
  id: ArtCategory;
  copyKey: keyof ArtsStrings;
  icon?: ArtCategoryIconName;
  tone?: ArtCategoryTone;
}

export type ArtCategoryTone =
  | 'neutral'
  | 'loading'
  | 'gashapon'
  | 'characters'
  | 'character-bg'
  | 'events'
  | 'others';

export const ART_CATEGORY_OPTIONS: ArtCategoryOption[] = [
  { id: 'all', copyKey: 'tabAll', tone: 'neutral' },
  { id: 'new', copyKey: 'tabNew', tone: 'neutral' },
  { id: 'loading', copyKey: 'tabLoading', icon: 'loading', tone: 'loading' },
  { id: 'gashapon', copyKey: 'tabGashapon', icon: 'gashapon', tone: 'gashapon' },
  { id: 'characters', copyKey: 'tabCharacters', icon: 'characters', tone: 'characters' },
  { id: 'character_bg', copyKey: 'tabCharacterBg', icon: 'character-bg', tone: 'character-bg' },
  { id: 'events', copyKey: 'tabEvents', icon: 'events', tone: 'events' },
  { id: 'others', copyKey: 'tabOthers', icon: 'others', tone: 'others' },
];

export function getArtsSortOptions(strings: ArtsStrings): SortOption[] {
  return [
    { value: 'release_desc', label: strings.sortReleaseDesc },
    { value: 'release_asc', label: strings.sortReleaseAsc },
    { value: 'title', label: strings.sortTitle, dividerBefore: true },
    { value: 'title_desc', label: strings.sortTitleDesc },
    { value: 'res', label: strings.sortRes, dividerBefore: true },
    { value: 'res_asc', label: strings.sortResAsc },
    { value: 'size', label: strings.sortSize, dividerBefore: true },
    { value: 'size_asc', label: strings.sortSizeAsc },
  ];
}

export function cleanArtTitle(str?: string | { en?: string; ru?: string } | null, isRu = false, locale?: string): string {
  if (!str) return '';
  const text = typeof str === 'string' ? str : isRu ? str.ru || str.en || '' : str.en || str.ru || '';
  const clean = text
    .replace(/\s*\((?:Season|Сезон)\s*\d+\)/gi, '')
    .replace(/^(?:Season\s*\d+\s*Ensemble|Ансамбль\s*\d+(?:-го)?\s*сезона)\s*:\s*/i, 'Ensemble: ')
    .trim();
  return !isRu && locale && locale !== 'en' ? localizeArtTitle(clean, locale) : clean;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getArtCategoryBadge(
  art: ArtworkItem,
  strings: ArtsStrings
): { text: string; variant: string } {
  if (art.category === 'characters') {
    return { text: strings.badgeCharacterArt, variant: 'character' };
  }
  if (art.category === 'character_bg' || art.subCategory === 'season_bg') {
    return { text: strings.badgeCharacterBg, variant: 'character-bg' };
  }
  if (art.subCategory && art.subCategory.includes('loading')) {
    return { text: strings.badgeLoading, variant: 'loading' };
  }
  if (art.subCategory === 'gashapon') {
    return { text: strings.badgeGashapon, variant: 'gashapon' };
  }
  if (art.subCategory === 'events' || art.category === 'events') {
    return { text: strings.badgeEvents, variant: 'events' };
  }
  if (art.subCategory === 'others' || art.category === 'others') {
    return { text: strings.badgeOthers, variant: 'others' };
  }
  return { text: strings.badgeWallpaper, variant: 'wallpaper' };
}

export function filterMatchesCategory(art: ArtworkItem, category: ArtCategory): boolean {
  if (category === 'all') return true;
  if (category === 'new') return art.isNew === true;
  if (category === 'wallpapers') return art.category === 'wallpapers';
  if (category === 'characters') return art.category === 'characters';
  if (category === 'character_bg') return art.category === 'character_bg' || art.subCategory === 'season_bg';
  if (category === 'loading') return Boolean(art.subCategory && art.subCategory.includes('loading'));
  if (category === 'gashapon') return art.subCategory === 'gashapon';
  if (category === 'events') return art.subCategory === 'events';
  if (category === 'others') return art.subCategory === 'others' || art.category === 'others';
  return true;
}

export function compareArtsByAdded(a: ArtworkItem, b: ArtworkItem): number {
  return (a.addedInRevision ?? 0) - (b.addedInRevision ?? 0)
    || a.id.localeCompare(b.id, undefined, {numeric: true});
}
