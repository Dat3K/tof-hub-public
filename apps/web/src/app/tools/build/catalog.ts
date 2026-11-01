import {loadServerGameData} from '@/lib/game-data-server';
import type {BuildCatalog,CharacterTitleStyle} from '@/features/build/types';

/** The Build catalog of every /tools/build/ card route, with the generated character-title presentation. */
export async function loadBuildCatalog():Promise<BuildCatalog> {
  const [catalog,titleStyles]=await Promise.all([loadServerGameData<BuildCatalog>('','build-page'),
    loadServerGameData<{titles?:Record<string,CharacterTitleStyle>}|null>('','build-title-styles',{throwOnNotFound:false})]);
  return titleStyles?.titles?{...catalog,titleStyles:titleStyles.titles}:catalog;
}
