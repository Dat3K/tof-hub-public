import {cache} from 'react';
import type {Metadata} from 'next';
import {parseProfileSlot, type BuildCapture, type ProfileSummary} from '@tof-hub/contracts';
import {loadServerGameData} from '@/lib/game-data-server';
import {deserializeSquadState} from '@/features/comp/codecs';
import {buildMetadata} from './index';
import {NOINDEX_ROUTES, routeCopy, routeTitle, type PreviewEntity, type PreviewManifest} from './routes';

export type SeoSearch = Record<string, string | string[] | undefined>;
export type SeoPageProps = {searchParams?: Promise<SeoSearch>};
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export const loadPreviewManifest = cache(async (): Promise<PreviewManifest> => {
  const data = await loadServerGameData<PreviewManifest | null>('', 'link-previews', {throwOnNotFound:false});
  return data?.schemaVersion === 1 ? data : {schemaVersion:1, images:{}, entities:[]};
});

const loadPreviewEntities = cache(async (pathname: string): Promise<PreviewEntity[]> => {
  const manifest = await loadPreviewManifest();
  const dataset = manifest.datasets?.[pathname];
  if (!dataset || !/^link-previews-[a-z-]+$/.test(dataset)) return manifest.entities;
  const data = await loadServerGameData<{schemaVersion:number;entities:PreviewEntity[]} | null>('',dataset,{throwOnNotFound:false});
  return data?.schemaVersion === 1 ? data.entities : [];
});

export type LinkPreview = PreviewEntity & {noindex?: boolean; canonicalPath?: string; pageTitle?: string};
const selectors: Record<string, string[]> = {
  '/info/simulacra/':['char'], '/info/matrices/':['suit'], '/info/relics/':['relic'],
  '/info/pets/':['pet','module'], '/info/food/':['item','dish','potion'],
  '/info/cosmetics/':['outfit','id'], '/info/arts/':['art','id'],
  '/datamine/items/':['item'], '/datamine/fce/':['boss'], '/datamine/oow/':['mob','floor','s','season'],
  '/datamine/bygone/':['floor'],
};

/** Lookup is constrained to generated entities; arbitrary URL parameters never become metadata or file paths. */
export const getLinkPreview = cache(async (href: string): Promise<LinkPreview> => {
  const url = new URL(href, 'https://preview.invalid');
  const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const [title, description] = routeCopy(pathname) || ['ToF Hub', 'Tower of Fantasy game data and tools.'];
  const manifest = await loadPreviewManifest();
  const image = manifest.images[pathname] || manifest.images[`/${pathname.split('/')[1]}/`];
  const base: LinkPreview = {path:pathname, title, pageTitle:routeTitle(pathname), description, section:'Tower of Fantasy', image, noindex:NOINDEX_ROUTES.has(pathname) || !routeCopy(pathname)};
  if (/^\/tools\/build\/\d{6,20}\//.test(pathname)) return savedBuildPreview(pathname, base);
  if (pathname === '/tools/comp/' && (url.searchParams.has('c') || url.searchParams.has('comp'))) {
    const code = url.searchParams.get('c') || url.searchParams.get('comp') || '';
    const squad = deserializeSquadState(code);
    if (!squad) return {...base, noindex:true};
    const ids = squad.players.flatMap(player => player.weapons.flatMap(weapon => [weapon.id, weapon.id2])).filter(Boolean);
    const characters = await loadPreviewEntities('/info/simulacra/');
    const selectedCharacters = ids.map(id => characters.find(entity => new URL(entity.path, url).searchParams.get('char') === id || entity.aliases?.includes(id!)));
    const names = [...new Set(selectedCharacters.map(character => character?.title).filter(Boolean))];
    return {...base, pageTitle:undefined, path:`${pathname}?${new URLSearchParams({c:code})}`, canonicalPath:pathname, noindex:true,
      image:selectedCharacters.find(character => character?.image)?.image,
      title:squad.title?.trim().slice(0,100) || 'Shared team',
      description:`${squad.server === 'mmo' ? 'MMO' : 'Standard'} · ${squad.players.length} players${names.length ? ` · ${names.slice(0,6).join(', ')}` : ''}. Weapons, matrices, traits and relics.`};
  }
  const selector = selectors[pathname]?.find(key => url.searchParams.get(key));
  if (!selector) return base;
  const requested = url.searchParams.get(selector)!.toLowerCase();
  const requestedMode = url.searchParams.get('server') || url.searchParams.get('mode');
  const requestedSeason = url.searchParams.get('s') || url.searchParams.get('season');
  const entities = await loadPreviewEntities(pathname);
  const matches = entities.filter(entity => {
    if (!entity.path.startsWith(`${pathname}?`)) return false;
    const candidate = new URL(entity.path, url);
    if (candidate.pathname !== pathname) return false;
    const canonicalSelector = selector === 'id' ? (pathname === '/info/arts/' ? 'art' : 'outfit') : ['dish','potion'].includes(selector) ? 'item' : selector === 'season' ? 's' : selector;
    if (selectors[pathname]?.find(key => candidate.searchParams.get(key)) !== canonicalSelector) return false;
    const id = candidate.searchParams.get(canonicalSelector)?.toLowerCase();
    if (id !== requested && !entity.aliases?.some(alias => alias.toLowerCase() === requested)) return false;
    const mode = candidate.searchParams.get('server') || candidate.searchParams.get('mode');
    if (requestedMode && mode && (requestedMode === 'mmo') !== (mode === 'mmo')) return false;
    if (selector === 'item' && pathname === '/info/food/' && url.searchParams.has('view') && candidate.searchParams.get('view') !== url.searchParams.get('view')) return false;
    return !requestedSeason || !['mob','floor'].includes(selector) || candidate.searchParams.get('s') === requestedSeason;
  });
  const selected = matches.sort((a,b) => {
    const aUrl = new URL(a.path,url), bUrl = new URL(b.path,url);
    const values = (candidate: URL) => [...candidate.searchParams.values()];
    const exact = (candidate: URL) => values(candidate).some(value => value.toLowerCase() === requested) ? 1 : 0;
    const season = (candidate: URL) => Number(candidate.searchParams.get('boss')?.match(/^s(\d+)-/)?.[1] || 0);
    const standard = (candidate: URL) => (candidate.searchParams.get('server') || candidate.searchParams.get('mode')) === 'mmo' ? 0 : 1;
    return exact(bUrl)-exact(aUrl) || standard(bUrl)-standard(aUrl) || season(bUrl)-season(aUrl);
  })[0];
  return selected ? {...selected, noindex:false} : {...base, noindex:true};
});

async function savedBuildPreview(pathname: string, base: LinkPreview): Promise<LinkPreview> {
  const [, , , uid, requestedSlot] = pathname.split('/');
  const slot = requestedSlot && parseProfileSlot(requestedSlot) ? requestedSlot : null;
  const fallback = {...base, pageTitle:undefined, path:pathname, image:undefined, noindex:true, title:slot ? `${slot} build · ${uid}` : `Saved builds · ${uid}`, description:'Saved Tower of Fantasy character equipment, weapons and stats.'};
  if (requestedSlot && !slot) return fallback;
  const api = (process.env.API_INTERNAL_URL || `${process.env.TOF_HUB_API_ORIGIN || 'http://127.0.0.1:3001'}/api/v1`).replace(/\/$/, '');
  try {
    const response = await fetch(`${api}/build/profiles/${uid}${slot ? `/${slot}` : ''}`, {cache:'no-store', signal:AbortSignal.timeout(2500)});
    if (!response.ok) return fallback;
    if (!slot) {
      const data = await response.json() as {profiles?:ProfileSummary[]};
      const profiles = data.profiles || [];
      return {...fallback, title:profiles[0]?.name ? `${profiles[0].name.slice(0,80)} · Saved builds` : fallback.title,
        description:profiles.length ? profiles.map(profile => `${profile.element} ${profile.role}`).join(' · ').slice(0,180) : fallback.description};
    }
    const data = await response.json() as {capture?:BuildCapture; role?:string; element?:string; art?:{id:string}};
    const art = data.art && (await loadPreviewEntities('/info/arts/')).find(entity => new URL(entity.path,'https://preview.invalid').searchParams.get('art') === data.art!.id);
    return {...fallback, title:`${data.capture?.profile.name?.slice(0,80) || uid} · ${data.element || ''} ${data.role || 'build'}`,
      description:`Saved character build${data.capture?.profile.level != null ? ` · Level ${data.capture.profile.level}` : ''}. Equipment, weapons, matrices and stats.`, image:art?.image || fallback.image};
  } catch { return fallback; }
}

export async function generatePageMetadata(path: string, props: SeoPageProps = {}): Promise<Metadata> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await props.searchParams || {})) {
    const item = first(value);
    if (item) params.set(key, item);
  }
  const preview = await getLinkPreview(`${path}${params.size ? `?${params}` : ''}`);
  return buildMetadata({title:preview.pageTitle ?? preview.title, description:preview.description, path:preview.path,
    canonicalPath:preview.canonicalPath, ogTitle:preview.title, ogDescription:preview.description, noindex:preview.noindex});
}
