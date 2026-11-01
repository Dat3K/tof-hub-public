import {Catch,type ArgumentsHost,type ExceptionFilter,HttpException} from '@nestjs/common';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {SEALED_FILES} from '@tof-hub/contracts';
import {AbuseService,UploadViolation} from './abuse.service';

type Request=IncomingMessage&{ip?:string;originalUrl?:string};
type Response=ServerResponse&{status:(code:number)=>Response;json:(value:unknown)=>void};
type Next=(error?:unknown)=>void;
const write=(req:Request)=>!['GET','HEAD','OPTIONS'].includes(req.method??'GET');
const upload=(req:Request)=>write(req)&&/\/(build\/import(?:\/ranking)?|build\/profiles|ranking\/inspect|wish\/import\/jobs)\/?(?:\?|$)/i.test(req.originalUrl??req.url??'');
export const requestIp=(req:Request)=>req.ip??req.socket.remoteAddress??'unknown';
function reject(res:Response,status:number,code:string,message:string,retryAfter?:number) {
  if(retryAfter)res.setHeader('Retry-After',Math.ceil(retryAfter));
  res.setHeader('Cache-Control','no-store');
  res.status(status).json({statusCode:status,code,message,...(retryAfter?{retryAfter:Math.ceil(retryAfter)}:{})});
}

/** Installed before parsers: even invalid/chunked bodies must first pass admission. Memory is bounded. */
export function securityMiddleware(abuse:AbuseService,now=Date.now) {
  const clients=new Map<string,{expires:number;read:number;write:number;expensive:number;active:number}>();
  let active=0,large=0,nextSweep=0;
  return async(req:Request,res:Response,next:Next)=>{
    // Express routes are case-insensitive by default; security classification must match that behavior.
    const time=now(),url=(req.originalUrl??req.url??'').toLowerCase(),mutation=write(req),isUpload=upload(req);
    // This POST only reads exact identities; retain POST body/origin checks, but use the read budget.
    const identityLookup=req.method==='POST'&&/^\/(?:api\/v1\/)?ranking\/player-names\/?(?:\?|$)/.test(url);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    if(url.length>4096)return reject(res,414,'REQUEST_LIMIT','Request URL is too long');
    if(req.method==='OPTIONS')return reject(res,405,'METHOD_NOT_ALLOWED','Cross-origin API requests are not supported');
    const key=abuse.identity(requestIp(req));
    if(time>=nextSweep) {
      for(const [id,row] of clients)if(row.expires<=time&&row.active===0)clients.delete(id);
      nextSweep=time+60_000;
    }
    let client=clients.get(key);
    if(!client) {
      if(clients.size>=10_000)return reject(res,503,'SERVER_BUSY','Server is busy',60);
      client={expires:time+60_000,read:0,write:0,expensive:0,active:0};clients.set(key,client);
    } else if(client.expires<=time)Object.assign(client,{expires:time+60_000,read:0,write:0,expensive:0});
    const expensive=/\/(export|analytics|rank|ranks)\/?(?:\?|$)/.test(url);
    if((mutation&&!identityLookup?++client.write>20:++client.read>300)||(expensive&&++client.expensive>30))return reject(res,429,'RATE_LIMIT','Too many requests; wait a minute',(client.expires-time)/1000);
    const isLarge=/\/ranking\/inspect\/?(?:\?|$)/.test(url)&&mutation;
    if(active>=32||client.active>=8||(isLarge&&large>=2))return reject(res,503,'SERVER_BUSY','Too many concurrent requests',5);
    const contentType=String(req.headers['content-type']??'').split(';')[0]?.trim().toLowerCase();
    const hasBody=Number(req.headers['content-length']??0)>0||!!req.headers['transfer-encoding'];
    if(!mutation&&hasBody)return reject(res,400,'BODY_NOT_ALLOWED','Read requests cannot contain a body');
    let limit=64*1024;
    if(isLarge)limit=SEALED_FILES.players.maxBytes;
    else if(/\/build\/import\/?(?:\?|$)/.test(url))limit=SEALED_FILES.build.maxBytes;
    else if(/\/wish\/import\/jobs\/?(?:\?|$)/.test(url))limit=SEALED_FILES.wish.maxBytes;
    else if(/\/build\/(profiles|import\/ranking)\/?(?:\?|$)/.test(url))limit=1024*1024;
    if(mutation) {
      if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')return reject(res,415,'CONTENT_ENCODING','Compressed request bodies are not accepted');
      const acceptedType=isLarge?(contentType==='application/octet-stream'||contentType==='application/json'):contentType==='application/json';
      if((isUpload||hasBody)&&!acceptedType)return reject(res,415,'CONTENT_TYPE','Unsupported request content type');
      if(req.headers['sec-fetch-site']==='cross-site')return reject(res,403,'CROSS_SITE_WRITE','Cross-site writes are not accepted');
      if(Number(req.headers['content-length']??0)>limit)return reject(res,413,'BODY_LIMIT','Request body exceeds the endpoint limit');
    }
    active++;client.active++;if(isLarge)large++;
    let released=false;
    const release=()=>{if(!released) {released=true;active--;client!.active--;if(isLarge)large--;}};
    res.once('finish',release);
    // Client disconnects must not release admission while database work is still running.
    res.once('close',()=>{if(!released)setTimeout(release,30_000).unref();});
    // Destroy stalled sockets; do not leave a parsed request indefinitely occupying the admission pool.
    req.setTimeout(30_000,()=>req.destroy());
    try {
      if(isUpload)await abuse.assertAllowed(requestIp(req));
      if(req.destroyed||res.destroyed) {release();return;}
      // Enforce route-specific caps also for chunked bodies, before any parser gets them.
      let bytes=0;
      if(mutation)req.on('data',(chunk:Buffer)=>{
        bytes+=chunk.length;
        if(bytes>limit&&!res.headersSent) {reject(res,413,'BODY_LIMIT','Request body exceeds the endpoint limit');req.destroy();}
      });
      next();
    } catch(error) {
      if(res.destroyed) {release();return;}
      if(error instanceof HttpException) {
        const body=error.getResponse() as {code:string;message:string;retryAfter?:number};
        reject(res,error.getStatus(),body.code,body.message,body.retryAfter);
      } else reject(res,503,'SECURITY_UNAVAILABLE','Security checks are temporarily unavailable',30);
    }
  };
}

@Catch(UploadViolation)
export class UploadViolationFilter implements ExceptionFilter {
  constructor(private readonly abuse:AbuseService) {}
  async catch(error:UploadViolation,host:ArgumentsHost) {
    const http=host.switchToHttp(),req=http.getRequest<Request>(),res=http.getResponse<Response>();
    try {
      const warning=await this.abuse.violation(requestIp(req));
      res.status(400).json({...error.getResponse() as object,...warning});
    } catch(reason) {
      if(reason instanceof HttpException) {
        const body=reason.getResponse() as {code:string;message:string;retryAfter?:number};
        reject(res,reason.getStatus(),body.code,body.message,body.retryAfter);
      } else reject(res,503,'SECURITY_UNAVAILABLE','Security checks are temporarily unavailable',30);
    }
  }
}

/** Parser failures happen before Nest controllers/filters; account for malformed upload bodies here. */
export function parserErrorMiddleware(abuse:AbuseService) {
  return async(error:unknown,req:Request,res:Response,next:Next)=>{
    const failure=error as {type?:string;status?:number};
    if(!['entity.parse.failed','entity.verify.failed','entity.too.large','request.size.invalid'].includes(failure?.type??''))return next(error);
    try {
      const warning=upload(req)?await abuse.violation(requestIp(req)):{};
      if(!res.headersSent)res.status(failure.status===413?413:400).json({message:'Invalid or oversized request body',...warning});
    } catch(reason) {
      if(reason instanceof HttpException) {
        const body=reason.getResponse() as {code:string;message:string;retryAfter?:number};
        if(!res.headersSent)reject(res,reason.getStatus(),body.code,body.message,body.retryAfter);
      } else if(!res.headersSent)reject(res,503,'SECURITY_UNAVAILABLE','Security checks are temporarily unavailable',30);
    }
  };
}
