import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {DRAFT_KEY} from '../build/model';
import {readBrowserOwner,rememberBrowserOwner} from '../players/browser-owner';
import {includeOwnerEntries,useRankingOwner} from './use-ranking-owner';
import type {PlayerTopEntry} from './types';

afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
const entry=(uid:string,rank=347)=>({rank,player:{uid,nickname:'Owner'}} as PlayerTopEntry);
const uid='1302104471';
describe('Ranking Me',()=>{
  it('reads the captured UID from old storage, excluding manual drafts and test examples',()=>{
    const draft={profile:{uid:'999999'},captureSource:{kind:'file',capture:{capture:{subject:{uid}},profile:{name:'Owner'}}}};
    localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
    expect(readBrowserOwner()).toEqual({uid,nickname:'Owner'});
    localStorage.setItem(DRAFT_KEY,JSON.stringify({...draft,demo:true}));expect(readBrowserOwner()).toBeNull();
    localStorage.setItem(DRAFT_KEY,JSON.stringify({profile:{uid}}));expect(readBrowserOwner()).toBeNull();
    localStorage.setItem(DRAFT_KEY,'broken');expect(readBrowserOwner()).toBeNull();
  });
  it('does not request or claim an identity without an imported owner',()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const {result}=renderHook(()=>useRankingOwner('board','/api/v1/ranking/players?track=all',[]));
    expect(result.current.owner).toBeNull();expect(fetcher).not.toHaveBeenCalled();
  });
  it('reveals an existing owner without requesting a duplicate row',()=>{
    rememberBrowserOwner({uid,nickname:'Owner'});
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const loaded=[entry(uid)];
    const {result}=renderHook(()=>useRankingOwner('board','/api/v1/ranking/players?track=all',loaded));
    act(()=>result.current.reveal());
    expect(result.current.status).toBe('ready');expect(result.current.entries).toEqual(loaded);expect(fetcher).not.toHaveBeenCalled();
    act(()=>result.current.hide());
    expect(result.current.active).toBe(false);expect(result.current.entries).toEqual([]);
  });
  it('finds the exact UID with board filters and original rank, then removes the pin on board change',async()=>{
    rememberBrowserOwner({uid,nickname:'Owner'});
    const own=entry(uid),loaded=[entry('1302100000',1)];
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({available:true,entries:[own,entry('13021044710')]})));
    vi.stubGlobal('fetch',fetcher);
    const {result,rerender}=renderHook(({board})=>useRankingOwner(board,'/api/v1/ranking/players?track=Frost&role=tank&region=EU&verified=1&q=other&offset=100',loaded),{initialProps:{board:'frost'}});
    expect(fetcher).not.toHaveBeenCalled();act(()=>result.current.reveal());
    await waitFor(()=>expect(result.current.status).toBe('ready'));
    expect(result.current.entries).toEqual([{...own,ownerPin:true}]);expect(result.current.entries[0]?.rank).toBe(347);
    const url=new URL(fetcher.mock.calls[0]![0],window.location.origin);
    expect(Object.fromEntries(url.searchParams)).toEqual({track:'Frost',role:'tank',region:'EU',verified:'1',q:uid});
    expect(includeOwnerEntries(loaded,[own],item=>item.player.uid!)).toEqual([own,...loaded]);
    expect(includeOwnerEntries([own],[own],item=>item.player.uid!)).toEqual([own]);
    expect(includeOwnerEntries([...loaded,own],[{...own,ownerPin:true}],item=>item.player.uid!,true)).toEqual([{...own,ownerPin:true},...loaded,own]);
    act(()=>result.current.hide());expect(result.current.entries).toEqual([]);
    act(()=>result.current.reveal());expect(result.current.entries).toEqual([{...own,ownerPin:true}]);
    expect(result.current.status).toBe('ready');expect(fetcher).toHaveBeenCalledOnce();
    rerender({board:'flame'});expect(result.current.active).toBe(false);expect(result.current.entries).toEqual([]);
    rerender({board:'frost'});expect(result.current.active).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('allows retry after failure and distinguishes a missing match',async()=>{
    rememberBrowserOwner({uid,nickname:null});
    const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Response(JSON.stringify({available:true,entries:[]})));
    vi.stubGlobal('fetch',fetcher);const loaded:PlayerTopEntry[]=[];
    const {result}=renderHook(()=>useRankingOwner('board','/api/v1/ranking/players?track=all',loaded));
    act(()=>result.current.reveal());await waitFor(()=>expect(result.current.status).toBe('error'));
    act(()=>result.current.reveal());await waitFor(()=>expect(result.current.status).toBe('missing'));
    expect(fetcher).toHaveBeenCalledTimes(2);
    act(()=>result.current.hide());act(()=>result.current.reveal());
    expect(result.current.status).toBe('missing');expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares a pending lookup across toggles, but aborts it when another imported owner replaces it',async()=>{
    rememberBrowserOwner({uid,nickname:null});let signal:AbortSignal|undefined;
    vi.stubGlobal('fetch',vi.fn((_url,options)=>{signal=options.signal;return new Promise(()=>{});}));
    const loaded:PlayerTopEntry[]=[];
    const {result,unmount}=renderHook(()=>useRankingOwner('board','/api/v1/ranking/players',loaded));
    act(()=>result.current.reveal());await waitFor(()=>expect(signal).toBeDefined());
    act(()=>result.current.hide());expect(signal?.aborted).toBe(false);
    act(()=>result.current.reveal());
    expect(fetch).toHaveBeenCalledOnce();
    act(()=>rememberBrowserOwner({uid:'1302104472',nickname:'New owner'}));
    expect(signal?.aborted).toBe(true);expect(result.current.active).toBe(false);
    expect(result.current.owner?.nickname).toBe('New owner');unmount();
  });
  it('does not retain an owner rank after the board data version changes',async()=>{
    rememberBrowserOwner({uid,nickname:'Owner'});
    const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({available:true,entries:[entry(uid)]})));
    vi.stubGlobal('fetch',fetcher);const loaded:PlayerTopEntry[]=[];
    const {result,rerender}=renderHook(({version})=>useRankingOwner(`board-v${version}`,'/api/v1/ranking/players?track=all',loaded),{initialProps:{version:1}});
    act(()=>result.current.reveal());await waitFor(()=>expect(result.current.status).toBe('ready'));
    rerender({version:2});expect(result.current.active).toBe(false);
    act(()=>result.current.reveal());await waitFor(()=>expect(result.current.status).toBe('ready'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
