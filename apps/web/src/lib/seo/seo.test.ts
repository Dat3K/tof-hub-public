import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {buildCanonicalUrl, buildMetadata, getSiteOrigin} from './index';
import {generatePageMetadata, getLinkPreview} from './server';
import {loadServerGameData} from '@/lib/game-data-server';
import type {PreviewManifest} from './routes';
import {setEntitySelection} from '@/features/info-sections/common/entity-url';

vi.mock('@/lib/game-data-server', () => ({loadServerGameData:vi.fn()}));
const manifest: PreviewManifest = {schemaVersion:1, images:{'/info/':'/info.webp'}, entities:[
  {path:'/info/simulacra/?server=gacha&char=sample',title:'Sample',description:'Frost · DPS.',image:'/sample.webp',section:'Simulacra'},
  {path:'/info/simulacra/?server=mmo&char=sample-mmo',title:'Sample MMO',description:'MMO · Frost.',section:'Simulacra',aliases:['sample']},
  {path:'/datamine/fce/?mode=mmo&boss=s2-boss',title:'Boss S2',description:'Season 2.',section:'Bosses',aliases:['boss']},
  {path:'/datamine/fce/?mode=mmo&boss=s10-boss',title:'Boss S10',description:'Season 10.',section:'Bosses',aliases:['boss']},
  {path:'/datamine/oow/?mode=mmo&s=4&floor=3',title:'Floor 3',description:'MMO floor.',section:'Origin of War'},
]};
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://tof.example');
  vi.mocked(loadServerGameData).mockResolvedValue(manifest);
});
afterEach(() => {vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});

describe('public metadata', () => {
  it('formats the home page title without redundant suffix', async () => {
    const m = await generatePageMetadata('/');
    expect(m.title).toBe('Tower of Fantasy Hub');
  });
  it('titles pages as a short name followed by the site name', async () => {
    expect((await generatePageMetadata('/datamine/handbook/')).title).toBe('Handbook | ToF Hub');
    expect((await generatePageMetadata('/datamine/oow/',{searchParams:Promise.resolve({mode:'mmo',s:'4',floor:'3'})})).title).toBe('Floor 3 | ToF Hub');
  });
  it('uses English previews for a Russian UI title', () => {
    const m = buildMetadata({path:'/info/relics/',title:'Реликвии',description:'Описание'});
    expect(m.openGraph).toMatchObject({title:'Relics',locale:'en_US',siteName:'ToF Hub'});
    expect(m.twitter).toMatchObject({title:'Relics',card:'summary_large_image'});
  });
  it('validates origins and separates the pathname from its query and hash', () => {
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','http://127.0.0.1:3000');vi.stubEnv('SITE_URL','javascript:alert(1)');
    expect(getSiteOrigin()).toBe('https://tof.smilekritik.beer');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://tof.example/nested');
    expect(buildCanonicalUrl('/info/simulacra?char=sample#skills')).toBe('https://tof.example/info/simulacra/?char=sample');
  });
  it('selects the exact edition, keeps identity parameters and discards filters', async () => {
    const m = await generatePageMetadata('/info/simulacra/', {searchParams:Promise.resolve({server:'mmo',char:'sample-mmo',q:'anything',sort:'name'})});
    expect(m.openGraph).toMatchObject({title:'Sample MMO',description:'MMO · Frost.'});
    expect(m.alternates?.canonical).toBe('https://tof.example/info/simulacra/?server=mmo&char=sample-mmo');
    expect(m.openGraph).toMatchObject({url:'https://tof.example/info/simulacra/?server=mmo&char=sample-mmo'});
  });
  it('prefers an exact standard ID over an MMO alias', async () => {
    expect(await getLinkPreview('/info/simulacra/?char=sample')).toMatchObject({title:'Sample'});
  });
  it('resolves old short boss IDs to the latest numeric season', async () => {
    expect(await getLinkPreview('/datamine/fce/?mode=mmo&boss=boss')).toMatchObject({title:'Boss S10'});
  });
  it('requires the matching OOW season for a floor', async () => {
    expect(await getLinkPreview('/datamine/oow/?mode=mmo&s=4&floor=3')).toMatchObject({title:'Floor 3'});
    expect(await getLinkPreview('/datamine/oow/?mode=mmo&s=1&floor=3')).toMatchObject({noindex:true});
  });
  it('does not turn unknown IDs into invented content', async () => {
    const m = await generatePageMetadata('/info/simulacra/',{searchParams:Promise.resolve({char:'unknown-private-value'})});
    expect(m.robots).toMatchObject({index:false,follow:true});
    expect(m.openGraph).toMatchObject({title:'Simulacra'});
    expect(JSON.stringify(m)).not.toContain('unknown-private-value');
  });
  it('keeps saved build previews unindexed and falls back when the API is unavailable', async () => {
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('unavailable')));
    const m = await generatePageMetadata('/tools/build/12345678/dps-frost/');
    expect(m.robots).toMatchObject({index:false,follow:true});
    expect(m.alternates?.canonical).toBe('https://tof.example/tools/build/12345678/dps-frost/');
  });
  it('keeps the queue and profile directory out of search', () => {
    for (const path of ['/tools/queue/','/tools/build/profiles/']) expect(buildMetadata({path,title:'Page',description:'Page'}).robots).toMatchObject({index:false});
  });
});

it('replaces an old entity hash with a query while retaining unrelated filters', () => {
  const url = new URL('https://tof.example/info/food/?server=mmo&view=potions&dish=old&q=test#old');
  setEntitySelection(url,'item','new');
  expect(url.searchParams.get('server')).toBe('mmo');expect(url.searchParams.get('q')).toBe('test');
  expect(url.searchParams.get('item')).toBe('new');expect(url.searchParams.has('dish')).toBe(false);expect(url.hash).toBe('');
  setEntitySelection(url,'item',null);expect(url.searchParams.has('item')).toBe(false);
});
