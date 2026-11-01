import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';

@Module({ imports: [DatabaseModule, NotificationsModule] })
class NotificationWorkerModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(NotificationWorkerModule);
  app.enableShutdownHooks();
  const notifications = app.get(NotificationsService);
  const targets = [process.env.TELEGRAM_HEALTH_API, process.env.TELEGRAM_HEALTH_WEB].filter((url): url is string => !!url);
  const failures = new Map<string, number>();
  const down = new Set<string>();
  const started = Date.now();
  const bootGrace = Number(process.env.TELEGRAM_HEALTH_START_GRACE_MS ?? 31 * 60 * 1000);
  const seenHealthy = new Set<string>();
  let checking = false;
  const timer = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      for (const [index, target] of targets.entries()) {
        const service = index === 0 ? 'API' : 'Web';
        let healthy = false;
        try { const response = await fetch(target, { signal: AbortSignal.timeout(5000) }); healthy = response.ok; await response.body?.cancel(); } catch { /* Count an unavailable service. */ }
        if (healthy) {
          seenHealthy.add(target);
          failures.set(target, 0);
          if (down.delete(target)) notifications.error('Health monitor', `${service} recovered`);
        } else {
          const count = (failures.get(target) ?? 0) + 1;
          failures.set(target, count);
          if (count >= 3 && !down.has(target) && (seenHealthy.has(target) || Date.now() - started >= bootGrace)) {
            down.add(target); notifications.error('Health monitor', `${service} unavailable after three checks`);
          }
        }
      }
    } finally { checking = false; }
  }, 30_000);
  process.on('SIGTERM', () => clearInterval(timer));
}
bootstrap().catch(() => { console.error('Notification worker startup failed'); process.exitCode = 1; });
