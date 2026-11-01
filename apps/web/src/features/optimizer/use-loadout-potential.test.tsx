import {act,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useLoadoutPotential,type LoadoutRequest,type LoadoutResponse} from './use-loadout-potential';

afterEach(()=>vi.unstubAllGlobals());
it('reports an unavailable result if a worker cannot start',()=>{
  vi.stubGlobal('Worker',class {constructor(){throw new Error('Unavailable');}});
  const input={} as LoadoutRequest;
  const {result}=renderHook(()=>useLoadoutPotential(input));
  expect(result.current.pending).toBe(false);
  expect(result.current.error).toBe(true);
  expect(result.current.potential).toBeNull();
});
it('cancels superseded searches and never displays their stale result',()=>{
  const workers:FakeWorker[]=[];
  class FakeWorker {
    terminate=vi.fn();postMessage=vi.fn();onmessage:((event:MessageEvent<LoadoutResponse>)=>void)|null=null;
    constructor(){workers.push(this);}
  }
  vi.stubGlobal('Worker',FakeWorker);
  const first={} as LoadoutRequest,second={} as LoadoutRequest;
  const {result,rerender,unmount}=renderHook(({input})=>useLoadoutPotential(input),{initialProps:{input:first}});
  expect(result.current.pending).toBe(true);
  rerender({input:second});
  expect(workers[0].terminate).toHaveBeenCalled();
  act(()=>workers[0].onmessage?.({data:{error:true}} as MessageEvent<LoadoutResponse>));
  expect(result.current.pending).toBe(true);expect(result.current.error).toBe(false);
  act(()=>workers[1].onmessage?.({data:{error:true}} as MessageEvent<LoadoutResponse>));
  expect(result.current.pending).toBe(false);expect(result.current.error).toBe(true);
  unmount();expect(workers[1].terminate).toHaveBeenCalled();
});
