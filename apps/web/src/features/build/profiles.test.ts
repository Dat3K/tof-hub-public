import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseProfileSlot,profileArtwork,profileHref,profileSlot,saveProfile,loadProfileDraft} from './profiles';
import type {BuildCatalog} from './types';
import {draftFromCapture} from './capture-import';
import {runQueued} from '../queue/client';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import captureFixture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';

vi.mock('./capture-import',()=>({draftFromCapture:vi.fn()}));
vi.mock('./capture-catalogs',()=>({loadCaptureCatalogs:vi.fn(async()=>({mapping:{}}))}));
vi.mock('../queue/client',async importOriginal=>({...await importOriginal<typeof import('../queue/client')>(),runQueued:vi.fn()}));
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});

describe('saved profile slots',()=>{
  it('round-trips role and element through the URL slot',()=>{
    expect(profileSlot('healer','Volt')).toBe('healer-volt');
    expect(parseProfileSlot('healer-volt')).toEqual({role:'healer',element:'Volt'});
    expect(parseProfileSlot('balance-volt')).toBeNull();
    expect(parseProfileSlot(null)).toBeNull();
    expect(profileHref('1300506653','dps-frost')).toBe('/tools/build/1300506653/dps-frost/');
    expect(profileHref('1300506653')).toBe('/tools/build/1300506653/');
  });
  it('keeps valid catalog framing and chooses a stable fallback for legacy or invalid artwork',()=>{
    const id=catalog.artworks[0]!.id;
    const art={id,zoom:1.4,x:44,y:31,offsetX:12,offsetY:-9};
    expect(profileArtwork(art,catalog,'1501400024:dps-volt')).toEqual(art);
    const fallback=profileArtwork(null,catalog,'1501400024:dps-volt');
    expect(fallback).toEqual(profileArtwork({id:'blob:private',zoom:3,x:0,y:0},catalog,'1501400024:dps-volt'));
    expect(catalog.artworks.some(item=>item.id===fallback?.id)).toBe(true);
    expect(fallback).toMatchObject({zoom:1,x:50,y:50,offsetX:0,offsetY:0});
    expect(profileArtwork(null,{...catalog,artworks:[]},'empty')).toBeNull();
  });
  it('loads a legacy null-art profile with a catalog background instead of a blank card',async()=>{
    const draft=structuredClone(catalog.demoDraft);draft.art.id='';
    vi.mocked(draftFromCapture).mockReturnValue(draft);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({role:'dps',element:'Volt',savedAt:'2026-10-18T00:00:00Z',capture:{},source:{digest:'test',signature:'test'},art:null}))));
    const loaded=await loadProfileDraft('1501400024','dps-volt',catalog,'en');
    expect(loaded.art).toEqual(profileArtwork(null,catalog,'1501400024:dps-volt'));
    expect(loaded.profile.role).toBe('dps');
  });
  it('sends only the catalog ID and its own framing when saving a personal-background card',async()=>{
    const draft=structuredClone(catalog.demoDraft);
    draft.captureSource={kind:'file',digest:'a'.repeat(64),signature:'signed-fixture',unresolved:[],capture:BuildCaptureSchema.parse(captureFixture)};
    draft.art={id:catalog.artworks[0]!.id,zoom:3,x:0,y:0,offsetX:999,offsetY:-999};
    const siteArt=profileArtwork({...draft.art,zoom:1.2,x:50,y:40,offsetX:2,offsetY:3},catalog,'fixture');
    vi.mocked(runQueued).mockResolvedValue({slot:'dps-volt'});
    expect(await saveProfile(draft,{role:'dps',element:'Volt'},siteArt,false)).toEqual({ok:true,slot:'dps-volt'});
    const body=JSON.parse(vi.mocked(runQueued).mock.calls[0]![1]!.body as string);
    expect(body.art).toEqual(siteArt);
    expect(JSON.stringify(body.art)).not.toMatch(/blob:|data:|999/);
  });
});
