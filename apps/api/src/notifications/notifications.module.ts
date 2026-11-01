import { BadRequestException, Body, Controller, ForbiddenException, Global, Headers, HttpCode, Ip, Module, Post, ServiceUnavailableException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { BrowserErrorReportSchema, NotificationEventSchema, sanitizeErrorMessage } from '@tof-hub/contracts';
import { NotificationsService } from './notifications.service';
import { notificationConfig } from './notification-config';

@Controller('notifications')
export class NotificationsController {
  private readonly reporters = new Map<string, number>();
  constructor(private readonly notifications: NotificationsService) {}
  @Post('relay') @HttpCode(202)
  async relay(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const config = notificationConfig();
    const expected = Buffer.from(`Bearer ${config.relaySecret}`), actual = Buffer.from(authorization ?? '');
    if (config.relaySecret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ForbiddenException();
    if (!['producer', 'controller'].includes(config.mode)) throw new ServiceUnavailableException('Notification intake unavailable');
    const parsed = NotificationEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid notification event');
    const event = parsed.data;
    await this.notifications.accept({ ...event, message: event.message ? sanitizeErrorMessage(event.message) : undefined });
    return { accepted: true };
  }
  @Post('browser') @HttpCode(202)
  browser(@Body() body: unknown, @Ip() ip: string) {
    const now = Date.now();
    for (const [key, expires] of this.reporters) if (expires < now) this.reporters.delete(key);
    if (this.reporters.has(ip) || this.reporters.size >= 1000) return { accepted: false };
    this.reporters.set(ip, now + 60_000);
    const parsed = BrowserErrorReportSchema.safeParse(body);
    // Public browser reports are untrusted diagnostics. Do not reflect submitted text or throw a notification loop.
    if (parsed.success) this.notifications.error('Browser report', { name: parsed.data.name, message: parsed.data.message }, {
      route: parsed.data.route.split('?')[0].slice(0, 300), digest: parsed.data.digest,
    });
    return { accepted: true };
  }
}

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
