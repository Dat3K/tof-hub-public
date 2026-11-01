import {describe,it,expect} from 'vitest';
import {createDraftHistory,commitDraftHistory,stepDraftHistory,draftEditGroup,DRAFT_HISTORY_LIMIT,withCustomArtwork,withoutCustomArtwork,buildArtworkSettings} from './draft-history';
import {emptyDraft} from './model';
import type {BuildCatalog} from './types';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
const snapshot=()=>({draft:emptyDraft(catalog),customArt:''});
describe('build session history',()=>{
  it('retains the catalog crop across personal replacements, positioning, storage and undo',()=>{
    const initial=snapshot();initial.draft.art={id:catalog.artworks[0]!.id,zoom:1.6,x:45,y:30,offsetX:7,offsetY:-4};
    const custom=withCustomArtwork(initial,'blob:personal-one');
    custom.draft.art={...custom.draft.art,zoom:3,offsetX:500,offsetY:-500};
    const replaced=withCustomArtwork(custom,'blob:personal-two');
    expect(replaced.siteArt).toEqual(initial.draft.art);
    expect(buildArtworkSettings(replaced)).toMatchObject({version:1,siteArt:initial.draft.art,art:replaced.draft.art});
    expect(withoutCustomArtwork(replaced).draft.art).toEqual(initial.draft.art);
    const history=commitDraftHistory(createDraftHistory(initial),replaced);
    expect(stepDraftHistory(history,'undo').present).toEqual(initial);
    expect(stepDraftHistory(stepDraftHistory(history,'undo'),'redo').present.siteArt).toEqual(initial.draft.art);
  });
  it('groups scalar typing, ignores timestamps and resets redo after a new edit',()=>{
    const initial=snapshot();let history=createDraftHistory(initial);
    const next=structuredClone(initial);next.draft.profile.name='a';
    expect(draftEditGroup(initial.draft,next.draft)).toBe('profile.name');
    history=commitDraftHistory(history,next,'profile.name',100);
    const typed=structuredClone(next);typed.draft.profile.name='abc';
    history=commitDraftHistory(history,typed,'profile.name',200);
    expect(history.past).toHaveLength(1);
    const undone=stepDraftHistory(history,'undo');expect(undone.present).toEqual(initial);
    expect(stepDraftHistory(undone,'redo').present).toEqual(typed);
    const changed=structuredClone(initial);changed.draft.profile.level=10;
    expect(commitDraftHistory(undone,changed).future).toEqual([]);
    const dateOnly=structuredClone(typed);dateOnly.draft.updatedAt='2026-10-03T00:00:00Z';
    expect(commitDraftHistory(history,dateOnly)).toBe(history);
  });
  it('keeps a whole art gesture together and restores uploaded artwork references',()=>{
    const initial=snapshot(),scaled=structuredClone(initial);scaled.draft.art.zoom=2;scaled.customArt='blob:uploaded';
    let history=commitDraftHistory(createDraftHistory(initial),scaled,'art-position:1',100,true);
    const moved=structuredClone(scaled);moved.draft.art.offsetX=-150;
    history=commitDraftHistory(history,moved,'art-position:1',10000,true);
    expect(history.past).toHaveLength(1);
    expect(stepDraftHistory(history,'undo').present).toEqual(initial);
    expect(stepDraftHistory(stepDraftHistory(history,'undo'),'redo').present).toEqual(moved);
  });
  it('bounds retained history and removes cancelled grouped edits',()=>{
    const initial=snapshot();let history=createDraftHistory(initial);
    for(let i=1;i<=DRAFT_HISTORY_LIMIT+10;i++){const next=snapshot();next.draft.profile.name=String(i);history=commitDraftHistory(history,next);}
    expect(history.past).toHaveLength(DRAFT_HISTORY_LIMIT);
    const next=snapshot();next.draft.profile.name='changed';
    history=commitDraftHistory(createDraftHistory(initial),next,'name',100);
    expect(commitDraftHistory(history,initial,'name',200).past).toHaveLength(0);
  });
});
