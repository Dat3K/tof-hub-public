import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
const {buildTracker}=createRequire(import.meta.url)('../../scripts/generators/build-version-tracker.cjs');
describe('public launcher monitoring seed',()=>{
 it('starts without invented observations and monitors only live clients',()=>{
  const seed=buildTracker();
  expect(seed.branches.map((branch:{id:string})=>branch.id)).toEqual(['live-global','cn-live']);
  expect(seed.branches.every((branch:{group:string;version:unknown;history:unknown[]})=>branch.group==='live'&&branch.version===null&&branch.history.length===0)).toBe(true);
 });
});
