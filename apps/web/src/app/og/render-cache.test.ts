// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPreviewCache} from './render-cache';

const image=(body='image',extra:Record<string,string>={})=>new Response(body,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600',...extra}});
afterEach(()=>vi.useRealTimers());

describe('bounded Open Graph rendering',()=>{
  it('holds admission until a streamed render finishes and shares identical requests',async()=>{
    const render=createPreviewCache();
    let finish!:()=>void;
    const first=vi.fn(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('first'));finish=()=>controller.close();}}),{headers:{'Cache-Control':'public, max-age=3600'}}));
    const second=vi.fn(async()=>image('second'));
    const a=render('/one',first), duplicate=render('/one',first), b=render('/two',second);
    await vi.waitFor(()=>expect(first).toHaveBeenCalledOnce());
    expect(second).not.toHaveBeenCalled();
    finish();
    expect(await (await a).text()).toBe('first');
    expect(await (await duplicate).text()).toBe('first');
    expect(await (await b).text()).toBe('second');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(await (await render('/one',first)).text()).toBe('first');
    expect(first).toHaveBeenCalledOnce();
  });

  it('bounds retained bytes and age rather than retaining every preview forever',async()=>{
    vi.useFakeTimers();
    const render=createPreviewCache({maxBytes:8,maxEntries:2,ttl:1000});
    const produce=vi.fn(async()=>image('12345'));
    await render('/a',produce);await render('/b',produce);await render('/a',produce);
    expect(produce).toHaveBeenCalledTimes(3);
    await render('/a',produce);expect(produce).toHaveBeenCalledTimes(3);
    vi.setSystemTime(Date.now()+1001);
    await render('/a',produce);expect(produce).toHaveBeenCalledTimes(4);
  });

  it('does not retain private responses or let a failed render block later work',async()=>{
    const render=createPreviewCache();
    const privateImage=vi.fn(async()=>image('private',{'Cache-Control':'private, no-store'}));
    await render('/private',privateImage);await render('/private',privateImage);
    expect(privateImage).toHaveBeenCalledTimes(2);
    await expect(render('/bad',async()=>{throw new Error('render failed');})).rejects.toThrow('render failed');
    expect((await render('/good',async()=>image())).status).toBe(200);
  });

  it('limits queued unique work while letting duplicate visitors join the same pending render',async()=>{
    const render=createPreviewCache({maxPending:1});
    let finish!:(response:Response)=>void;
    const produce=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));
    const a=render('/a',produce), duplicate=render('/a',produce);
    const refused=await render('/b',async()=>image());
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('2');
    finish(image());
    expect((await a).status).toBe(200);expect((await duplicate).status).toBe(200);
    expect(produce).toHaveBeenCalledOnce();
  });
});
