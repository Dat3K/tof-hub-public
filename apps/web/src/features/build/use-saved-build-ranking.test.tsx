import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {emptyDraft} from './model';
import {useSavedBuildRanking,type SavedRankingSource} from './use-saved-build-ranking';
import type {BuildCatalog,BuildDraft} from './types';
import * as verification from './card-verification';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('saved ranking origin',()=>{
  it('posts verified imports without a database profile and hides them after an edit',async()=>{
    const draft=emptyDraft(catalog);draft.rv={element:'Frost',includeCrit:true};
    draft.captureSource={kind:'file',digest:'signed',signature:'proof',capture,unresolved:[]} as BuildDraft['captureSource'];
    vi.spyOn(verification,'verifyBuildCard').mockImplementation(async current=>current.combat.crit===draft.combat.crit?'verified':'edited');
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>({available:true,digest:'signed',global:123})}));
    vi.stubGlobal('fetch',fetcher);
    const {result,rerender}=renderHook(({draft})=>useSavedBuildRanking(draft,catalog,null),{initialProps:{draft}});
    await waitFor(()=>expect(result.current?.global).toBe(123));
    expect(fetcher).toHaveBeenCalledWith('/api/v1/build/import/ranking',expect.objectContaining({method:'POST',body:expect.stringContaining('"signature":"proof"')}));
    rerender({draft:{...draft,combat:{...draft.combat,crit:draft.combat.crit+1}}});
    expect(result.current).toBeUndefined();
    await act(async()=>{});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('unsigned files do not rank; saved gear edits hide ranking, pair switches reuse it and roles refetch',async()=>{
    const draft=emptyDraft(catalog);draft.rv={...draft.rv,element:'Frost',includeCrit:true};
    draft.captureSource={digest:'saved',kind:'file'} as BuildDraft['captureSource'];
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>({available:true,digest:'saved',global:123,region:{code:'EU',rank:21}})}));
    vi.stubGlobal('fetch',fetcher);
    const source:SavedRankingSource={uid:'1301564092',slot:'dps-frost',digest:'saved',gear:JSON.stringify(draft.gear)};
    const {result,rerender}=renderHook(({draft,source}:{draft:BuildDraft;source:SavedRankingSource|null})=>useSavedBuildRanking(draft,catalog,source),{initialProps:{draft,source:null as SavedRankingSource|null}});
    expect(fetcher).not.toHaveBeenCalled();
    rerender({draft,source});
    await waitFor(()=>expect(result.current?.global).toBe(123));
    rerender({draft:{...draft,rv:{...draft.rv,element:'Volt',includeCrit:true}},source});
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender({draft:{...draft,profile:{...draft.profile,role:'healer'}},source});
    await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
    await act(async()=>{});
    rerender({draft:{...draft,gear:[]},source});
    expect(result.current).toBeUndefined();
    rerender({draft,source:null});
    expect(result.current).toBeUndefined();
  });
});
