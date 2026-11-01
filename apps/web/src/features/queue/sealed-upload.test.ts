import {afterEach,describe,expect,it,vi} from 'vitest';
import {SealedFileError,submitSealedFile} from './sealed-upload';

const job=(state:string,result?:unknown)=>({id:'job-1',seq:1,kind:'wish-import',state,position:0,estimateMs:null,
  createdAt:'2026-10-08T00:00:00Z',startedAt:null,finishedAt:null,result});

afterEach(()=>{vi.unstubAllGlobals();});

describe('sealed upload through the queue',()=>{
  it('refuses a foreign file before anything is sent',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(submitSealedFile('wish',new File(['{"format":"tof-hub-build-sealed"}'],'history.tofwish'),{url:'/x',locale:'en'}))
      .rejects.toBeInstanceOf(SealedFileError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends a JSON envelope with the extra fields and resolves with the job result',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(job('complete',{profileId:'p'})),{status:200}));
    vi.stubGlobal('fetch',fetch);
    const updates:string[]=[];
    const result=await submitSealedFile('wish',new File(['{"format":"tof-hub-wish-sealed","version":1}'],'history.tofwish'),
      {url:'/api/v1/wish/import/jobs',locale:'en',encode:envelope=>({...envelope,manual_pity:[]}),onUpdate:next=>updates.push(next.state)});
    expect(result).toEqual({profileId:'p'});
    expect(updates).toEqual(['complete']);
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({format:'tof-hub-wish-sealed',version:1,manual_pity:[]});
  });
  it('sends a players file as raw bytes',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(job('complete',{stored:1})),{status:200}));
    vi.stubGlobal('fetch',fetch);
    const file=new File(['{"format":"tof-hub-players-sealed"}'],'players.tofplayers');
    await submitSealedFile('players',file,{url:'/api/v1/ranking/inspect',locale:'ru'});
    expect(fetch.mock.calls[0]![1]).toMatchObject({body:file,headers:{'Content-Type':'application/octet-stream'}});
  });
});
