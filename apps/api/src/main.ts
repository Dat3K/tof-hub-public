import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from "./app.module";
import { SEALED_FILES } from "@tof-hub/contracts";
import {AbuseService} from './security/abuse.service';
import {securityMiddleware,UploadViolationFilter,parserErrorMiddleware} from './security/http-security';
import {assertJsonDepth,safeJsonReviver} from './security/json-safety';
import type {Server} from 'node:http';
import {NotificationsService} from './notifications/notifications.service';
import {NotificationLogger} from './notifications/notification-logger';

async function bootstrap() {
  if(process.env.NODE_ENV==='production'&&(!process.env.DATABASE_URL||process.env.WISH_DB_DRIVER!=='postgres'||!process.env.IP_HASH_SALT||process.env.IP_HASH_SALT.length<32))throw new Error('Production requires Postgres and IP_HASH_SALT of at least 32 characters for persistent abuse protection');
  const app = await NestFactory.create<NestExpressApplication>(AppModule,{bodyParser:false,bufferLogs:true});
  const notifications = app.get(NotificationsService);
  app.useLogger(new NotificationLogger(notifications));
  app.use((req: { method?: string; url?: string }, res: { statusCode: number; once: (name: string, fn: () => void) => void }, next: () => void) => {
    res.once('finish', () => {
      const route = (req.url ?? '').split('?')[0];
      if (!route.startsWith('/api/v1/notifications') && res.statusCode >= 400) {
        notifications.error('HTTP', `HTTP ${res.statusCode}`, { route: route.slice(0, 300), code: String(res.statusCode) }, res.statusCode < 500);
      }
    });
    next();
  });
  app.use(securityMiddleware(app.get(AbuseService)));
  app.useGlobalFilters(new UploadViolationFilter(app.get(AbuseService)));
  // Express options: `limit` (bodyLimit is the Fastify name and was silently ignored, leaving 100 kB).
  app.useBodyParser('json', { limit: '5mb',inflate:false,reviver:safeJsonReviver,verify:(_req:unknown,_res:unknown,body:Buffer)=>assertJsonDepth(new TextDecoder('utf-8',{fatal:true}).decode(body)) });
  // Players file from the capture app (POST /ranking/inspect): one sealed `.tofplayers` text file, read as raw bytes so
  // the first gate (import/sealed-file.ts) checks it before anything is parsed.
  app.useBodyParser('raw', { type: 'application/octet-stream', limit: SEALED_FILES.players.maxBytes,inflate:false });
  app.use(parserErrorMiddleware(app.get(AbuseService)));
  // Keep 0 unless the deployment explicitly configures proxy hops: per-IP
  // import queueing and job-poll binding rely on unspoofable remote addresses.
  const trustedHops = Number(process.env.WISH_TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustedHops) && trustedHops >= 0 && trustedHops <= 3) {
    app.set('trust proxy', trustedHops);
    if (trustedHops > 0) {
      // eslint-disable-next-line no-console
      console.warn(`trust proxy hops set to ${trustedHops}; ensure only the front proxy can reach the API`);
    }
  }
  app.setGlobalPrefix(process.env.API_PREFIX ?? "api/v1");
  const port = Number(process.env.API_PORT ?? 3001);
  const host=process.env.API_HOST;
  if(host)await app.listen(port,host);
  else await app.listen(port);
  const server=app.getHttpServer() as Server;
  server.requestTimeout=30_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;server.maxRequestsPerSocket=100;
}

// eslint-disable-next-line no-console
bootstrap().catch((err) => console.error(err));
