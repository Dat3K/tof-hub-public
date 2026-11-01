import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,it} from 'vitest';
import {setConsumableRemainingTime} from './consumable-expiry';
import {emptyDraft,restoreDraft} from './model';
import type {BuildCatalog} from './types';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

it('anchors a game lifetime to its snapshot and preserves it across restoration',()=>{
  const draft=emptyDraft(catalog),id=catalog.consumables[1].items[0].id;
  setConsumableRemainingTime(draft,id,3600,Date.parse('2026-10-03T10:00:00Z'));
  expect(restoreDraft(draft,catalog)?.consumableExpiresAt?.[id]).toBe('2026-10-03T11:00:00.000Z');
  expect(restoreDraft({...draft,consumableExpiresAt:{[id]:'invalid'}},catalog)).toBeNull();
  expect(restoreDraft({...draft,consumableExpiresAt:{[id]:'2026-02-31T10:00:00Z'}},catalog)).toBeNull();
  expect(restoreDraft({...draft,consumableExpiresAt:{unknown:'2026-10-03T11:00:00Z'}},catalog)).toBeNull();
  expect(restoreDraft(emptyDraft(catalog),catalog)?.consumableExpiresAt).toBeUndefined();
});
