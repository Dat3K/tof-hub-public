import { ConsoleLogger } from '@nestjs/common';
import type { NotificationsService } from './notifications.service';

export class NotificationLogger extends ConsoleLogger {
  constructor(private readonly notifications: NotificationsService) { super(); }
  override error(message: unknown, ...optional: unknown[]) {
    super.error(message, ...optional);
    const context = typeof optional.at(-1) === 'string' ? String(optional.at(-1)) : 'API';
    if (context.includes('Notification') || (context === 'JobQueue' && typeof message === 'string' && /#\d+ failed/.test(message))) return;
    this.notifications.error(context, message);
  }
  override warn(message: unknown, ...optional: unknown[]) {
    super.warn(message, ...optional);
    const context = typeof optional.at(-1) === 'string' ? String(optional.at(-1)) : 'API';
    if (context.includes('Notification') || typeof message !== 'string' || !/\b(failed|failure|unavailable|interrupted|stopped)\b/i.test(message)) return;
    this.notifications.error(context, { name: 'Operational warning', message });
  }
}
