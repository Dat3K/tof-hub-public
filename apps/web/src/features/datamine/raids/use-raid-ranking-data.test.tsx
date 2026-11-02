import {renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {RaidRankingBoard, RaidRankingDataset} from '@tof-hub/game-domain';
import {gameDataCache} from '@/lib/game-data-client';
import {useRaidRankingData} from './use-raid-ranking-data';

const entry = (id:string,rank:number) => ({id,rank,duration:{raw:'1:00:00',milliseconds:60000},recordedAt:null,members:[]});
const full = (id:string):RaidRankingBoard => ({id,seasonId:'s1',sourceId:'source',scope:{kind:'region',region:id,serverId:null,serverName:null},coverage:'complete',capturedAt:null,entries:[entry(`${id}-1`,1),entry(`${id}-2`,2)]});
const eu=full('EU'), na=full('NA');
const index:RaidRankingDataset = {schemaVersion:1,sources:[],seasons:[],boards:[eu,na].map((board,index)=>({...board,entries:board.entries.slice(0,1),entryCount:2,_detail:`runtime/details/raid-rankings/${String(index+1).repeat(24)}`}))};
const reply=(data:unknown)=>({ok:true,status:200,json:async()=>data}) as Response;

beforeEach(()=>gameDataCache.clear());
afterEach(()=>vi.unstubAllGlobals());

describe('raid observation detail loading',()=>{
  it('loads only selected boards, reuses their immutable browser cache, and keeps the comparison index inline',async()=>{
    const fetch=vi.fn<typeof globalThis.fetch>(async url=>reply(String(url).includes('111111')?eu:na));
    vi.stubGlobal('fetch',fetch);
    const {result,rerender}=renderHook(({ids,enabled})=>useRaidRankingData(index,ids,enabled),{initialProps:{ids:['EU'],enabled:true}});
    await waitFor(()=>expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.boards).toEqual([eu]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/game-data/handbook/runtime/details/raid-rankings/111111111111111111111111.json');
    rerender({ids:['NA'],enabled:true});
    await waitFor(()=>expect(result.current.data?.boards).toEqual([na]));
    rerender({ids:['EU'],enabled:true});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.boards).toEqual([eu]);
    expect(fetch).toHaveBeenCalledTimes(2);
    rerender({ids:['EU','NA'],enabled:false});
    expect(result.current.data).toBe(index);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('restores cached boards synchronously when history supplies a fresh index object',()=>{
    gameDataCache.seed('handbook',index.boards[0]._detail!,eu);
    const {result,rerender}=renderHook(({source})=>useRaidRankingData(source,['EU']),{initialProps:{source:index}});
    expect(result.current.isLoading).toBe(false);
    rerender({source:structuredClone(index)});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.boards).toEqual([eu]);
  });

  it('does not let a late previous region overwrite a newer selection',async()=>{
    let finish!:(response:Response)=>void;
    vi.stubGlobal('fetch',vi.fn(async url=>String(url).includes('111111')?new Promise<Response>(resolve=>{finish=resolve;}):reply(na)));
    const {result,rerender}=renderHook(({ids})=>useRaidRankingData(index,ids),{initialProps:{ids:['EU']}});
    rerender({ids:['NA']});
    await waitFor(()=>expect(result.current.data?.boards).toEqual([na]));
    finish(reply(eu));
    await waitFor(()=>expect(gameDataCache.hasResolved('handbook',index.boards[0]._detail!)).toBe(true));
    expect(result.current.data?.boards).toEqual([na]);
  });

  it('reports a mismatched shard as an error instead of showing an incomplete ranking',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>reply(na)));
    const {result}=renderHook(()=>useRaidRankingData(index,['EU']));
    await waitFor(()=>expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.boards).toEqual([]);
  });

  it('does not fetch legacy full fixtures or one-entry observations already carried by the index',()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const complete={...index,boards:[eu]};
    const {result}=renderHook(()=>useRaidRankingData(complete,['EU']));
    expect(result.current.data?.boards).toEqual([eu]);
    expect(result.current.isLoading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
