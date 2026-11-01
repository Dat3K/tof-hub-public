export type ArtworkCategory =
  | 'wallpapers'
  | 'characters'
  | 'character_bg'
  | 'events'
  | 'gashapon'
  | 'loading'
  | 'others';

export interface ArtworkCore {
  /**
   * Stable image identifier (e.g. gashapon__t_backgroundtexture_06)
   */
  stableId: string;
  title: string;
  category: ArtworkCategory;
  subCategory: string | null;
  themeTag: string | null;
  width: number;
  height: number;
  aspectRatio: number;
  aspectLabel: string;
  url: string;
  webpUrl: string;
  pngUrl: string;
  thumbUrl: string;
  sizeBytes: number;
  pngSizeBytes?: number;
  characterKey?: string | null;
  characterName?: string | null;
  season?: string | null;
}
