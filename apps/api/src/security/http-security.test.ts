// @vitest-environment node
import 'reflect-metadata';
import {Body,Controller,Module,Post} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {AbuseService,UploadViolation} from './abuse.service';
import {parserErrorMiddleware,securityMiddleware,UploadViolationFilter} from './http-security';
import {assertJsonDepth,safeJsonReviver} from './json-safety';
import {EventEmitter} from 'node:events';

@Controller('build/import')
class UploadController {
  @Post() receive(@Body() body:unknown) {if((body as {bad?:boolean})?.bad)throw new UploadViolation('Invalid signature');return {ok:true};}
}
@Module({controllers:[UploadController]})
class TestModule {}

describe('HTTP protection before body parsing',()=>{
  let app:NestExpressApplication,origin:string;
  beforeAll(async()=>{
    const abuse=new AbuseService();
    app=await NestFactory.create<NestExpressApplication>(TestModule,{bodyParser:false,logger:false});
    app.set('trust proxy',0);
    app.use(securityMiddleware(abuse));
    app.useGlobalFilters(new UploadViolationFilter(abuse));
    app.useBodyParser('json',{limit:'5mb',inflate:false,reviver:safeJsonReviver,verify:(_req:unknown,_res:unknown,body:Buffer)=>assertJsonDepth(body.toString('utf8'))});
    app.use(parserErrorMiddleware(abuse));
    await app.listen(0,'127.0.0.1');origin=await app.getUrl();
  },30_000);
  afterAll(()=>app?.close());
  const post=(body:string,headers:Record<string,string>={})=>fetch(`${origin}/build/import`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  it('accepts normal JSON, rejects MIME disguises, compression and route oversize bodies',async()=>{
    expect((await post('{}')).status).toBe(201);
    expect((await post('{}',{'Content-Type':'text/plain'})).status).toBe(415);
    expect((await post('{}',{'Content-Encoding':'gzip'})).status).toBe(415);
    expect((await post(JSON.stringify({value:'a'.repeat(1024*1024)}))).status).toBe(413);
  });
  it('records malformed and forged files, bans persistently and ignores spoofed forwarding headers',async()=>{
    expect((await post('['.repeat(65)+'0'+']'.repeat(65))).status).toBe(400);
    expect((await post('{oops')).status).toBe(400);
    for(let index=0;index<2;index++)expect((await post('{"bad":true}')).status).toBe(400);
    const blocked=await post('{"bad":true}');expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    const spoof=await post('{}',{'X-Forwarded-For':'192.0.2.200'});
    expect(spoof.status).toBe(429);expect((await spoof.json() as {code:string}).code).toBe('IP_BLOCKED');
    expect((await fetch(`${origin}/BUILD/IMPORT`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(429);
  });
});

describe('HTTP admission bounds',()=>{
  const request=(ip:string,url='/api/v1/ranking/gear')=>Object.assign(new EventEmitter(),{method:'GET',url,headers:{},socket:{remoteAddress:ip},setTimeout:()=>undefined,destroy:()=>undefined});
  const response=()=>Object.assign(new EventEmitter(),{statusCode:200,setHeader:()=>undefined,status(code:number){this.statusCode=code;return this;},json:()=>undefined});
  it('counts batched player-name POST lookups as reads while retaining body and write protections',async()=>{
    const middleware=securityMiddleware(new AbuseService());let calls=0;
    const lookup=(url='/api/v1/ranking/player-names')=>Object.assign(request('192.0.2.1',url),{method:'POST',headers:{'content-type':'application/json','content-length':'40'}});
    for(let index=0;index<40;index++) {
      const res=response();await middleware(lookup(index%2?'/API/V1/RANKING/PLAYER-NAMES/?x=1':undefined) as never,res as never,()=>calls++);res.emit('finish');
      expect(res.statusCode).toBe(200);
    }
    expect(calls).toBe(40);
    const oversize=response();await middleware({...lookup(),headers:{'content-type':'application/json','content-length':String(65537)}} as never,oversize as never,()=>calls++);
    expect(oversize.statusCode).toBe(413);
    const crossSite=response();await middleware({...lookup(),headers:{'content-type':'application/json','sec-fetch-site':'cross-site'}} as never,crossSite as never,()=>calls++);
    expect(crossSite.statusCode).toBe(403);
    for(let index=0;index<20;index++) {
      const res=response();await middleware(lookup('/api/v1/ranking/cache/warmup') as never,res as never,()=>calls++);res.emit('finish');
      expect(res.statusCode).toBe(200);
    }
    const blocked=response();await middleware(lookup('/api/v1/ranking/cache/warmup') as never,blocked as never,()=>calls++);
    expect(blocked.statusCode).toBe(429);
  });
  it('enforces concurrency and releases successful requests without clearing the rate counter',async()=>{
    let now=1000,admitted=0;
    const middleware=securityMiddleware(new AbuseService(),()=>now);
    const pending=Array.from({length:8},()=>response());
    for(const res of pending)await middleware(request('192.0.2.1') as never,res as never,()=>admitted++);
    const refused=response();await middleware(request('192.0.2.1') as never,refused as never,()=>admitted++);
    expect(refused.statusCode).toBe(503);expect(admitted).toBe(8);
    for(const res of pending)res.emit('finish');
    for(let i=0;i<291;i++) {
      const res=response();await middleware(request('192.0.2.1') as never,res as never,()=>admitted++);res.emit('finish');
    }
    const limited=response();await middleware(request('192.0.2.1') as never,limited as never,()=>admitted++);
    expect(limited.statusCode).toBe(429);
    now+=60_001;const fresh=response();await middleware(request('192.0.2.1') as never,fresh as never,()=>admitted++);
    expect(fresh.statusCode).toBe(200);fresh.emit('finish');
  });
  it('allows bodyless token revocation and refuses cross-site mutation and long URLs',async()=>{
    const middleware=securityMiddleware(new AbuseService());let calls=0;
    const deletion=Object.assign(request('192.0.2.1','/api/v1/wish/profiles/id/tokens'),{method:'DELETE'});
    const res=response();await middleware(deletion as never,res as never,()=>calls++);res.emit('finish');
    expect(calls).toBe(1);
    const cross=response();await middleware({...deletion,headers:{'sec-fetch-site':'cross-site'}} as never,cross as never,()=>calls++);
    expect(cross.statusCode).toBe(403);
    const long=response();await middleware(request('192.0.2.1','/'+ 'a'.repeat(4096)) as never,long as never,()=>calls++);
    expect(long.statusCode).toBe(414);
    const readBody=response();await middleware({...request('192.0.2.1'),headers:{'content-length':'10','content-type':'application/octet-stream'}} as never,readBody as never,()=>calls++);
    expect(readBody.statusCode).toBe(400);
  });
  it('keeps active requests attached to their identity through a window rollover',async()=>{
    let now=1000,calls=0;
    const middleware=securityMiddleware(new AbuseService(),()=>now),pending=response();
    await middleware(request('192.0.2.1') as never,pending as never,()=>calls++);
    now+=60_001;
    const next=response();await middleware(request('192.0.2.1') as never,next as never,()=>calls++);next.emit('finish');pending.emit('finish');
    for(let index=0;index<8;index++)await middleware(request('192.0.2.1') as never,response() as never,()=>calls++);
    expect(calls).toBe(10);
  });
});
