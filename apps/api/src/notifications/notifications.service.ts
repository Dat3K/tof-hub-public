import { Inject, Injectable, Optional, ServiceUnavailableException, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationEventSchema, NotificationSettingsSchema, sanitizeError, sanitizeErrorMessage, type FeedbackOrigin, type FeedbackSubmission, type NotificationEvent, type NotificationSettings } from '@tof-hub/contracts';
import { PRISMA } from '../database/database.module';
import type { StoredJob, JobError } from '../queue/job-queue.store';
import { NotificationStore } from './notification-store';
import { notificationConfig } from './notification-config';
import { feedbackNotificationTexts, notificationText, queueResultSummary } from './notification-format';
import { TelegramClient, TelegramFailure } from './telegram-client';
import type { SealedFileKind } from '@tof-hub/contracts';
import { NotificationImportFiles, type ImportFileOwner } from './notification-import-files';

interface TelegramUpdate { update_id: number; message?: { from?: { id: number }; chat: { id: number }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: { id: number } } } }

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly config = notificationConfig();
  private readonly store: NotificationStore | null;
  private readonly telegram: TelegramClient;
  private timers: ReturnType<typeof setInterval>[] = [];
  private delivering = false;
  private polling = false;
  private deliveringFiles = false;
  private stopped = false;
  private readonly repeatedErrors = new Map<string, number>();
  private validationEnabled = false;
  private validationCheckedAt = 0;
  private cachedPreferences: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
  private lastStorageAlert = 0;
  private persistedPreferences = '';
  constructor(@Optional() @Inject(PRISMA) prisma: PrismaClient | null = null) {
    this.store = prisma ? new NotificationStore(prisma) : null;
    this.telegram = new TelegramClient(this.config.token);
    if (this.config.mode === 'controller' && this.config.preferenceCachePath) {
      try {
        this.cachedPreferences = NotificationSettingsSchema.parse(JSON.parse(fs.readFileSync(this.config.preferenceCachePath, 'utf8')));
        this.persistedPreferences = JSON.stringify(this.cachedPreferences);
      }
      catch { /* First boot uses the agreed default preferences. */ }
    }
  }
  async onModuleInit() {
    if (this.config.mode === 'off') return;
    if (!this.store) { console.warn('Telegram notifications require Postgres'); return; }
    if (this.config.mode === 'controller') {
      try { this.cachePreferences(await this.store.settings()); }
      catch { await this.storageAlert(); }
      // Do not delete an existing webhook: a second deployment must not silently steal this bot.
      const webhook = await this.telegram.call<{ url: string }>('getWebhookInfo', {});
      if (webhook.url) throw new Error('Telegram webhook is configured; controller polling was not started');
      await this.telegram.call('setMyCommands', { commands: [
        { command: 'start', description: 'Open notification settings' }, { command: 'settings', description: 'Notification settings' },
        { command: 'status', description: 'Delivery status' }, { command: 'test', description: 'Send a test notification' },
      ] });
      this.timers.push(setInterval(() => void this.poll(), 3000));
      void this.poll();
    }
    if (['controller', 'relay'].includes(this.config.mode)) {
      this.timers.push(setInterval(() => void this.deliver(), 1500));
      void this.deliver();
    }
    if (this.config.mode === 'controller' && this.config.importFiles) {
      this.timers.push(setInterval(() => void this.deliverFiles(), 3000));
      void this.deliverFiles();
    }
    this.timers.push(setInterval(() => void this.cleanup(), 60 * 60 * 1000));
    for (const timer of this.timers) timer.unref();
  }
  onModuleDestroy() { this.stopped = true; for (const timer of this.timers) clearInterval(timer); }

  async acceptedImport(kind: SealedFileKind, envelope: unknown, owner?: ImportFileOwner): Promise<void> {
    if (!this.config.importFiles || this.config.mode === 'off') return;
    if (!this.store) throw new ServiceUnavailableException('Import file delivery storage is unavailable');
    // Await durable intake before game persistence. Telegram downtime itself never blocks an import.
    try { await new NotificationImportFiles(this.store.prisma).add(kind, envelope, this.config.environment, owner); }
    catch { throw new ServiceUnavailableException('Could not retain the verified import file; please retry'); }
  }

  /** Called inside the feedback transaction: save the response and its durable delivery together. */
  async acceptedFeedback(tx: Prisma.TransactionClient, feedback: FeedbackSubmission, origin: FeedbackOrigin, release: string | null): Promise<void> {
    if (this.config.mode === 'off') return;
    if (!this.store) throw new ServiceUnavailableException('Feedback delivery storage is unavailable');
    await this.store.add(NotificationEventSchema.parse({ ...this.base('feedback', 'feedback.submitted'),
      id: feedback.id, feedback, feedbackOrigin: origin, ...(release ? { release } : {}) }), tx);
  }

  private async deliverFiles() {
    if (this.deliveringFiles || this.stopped || !this.store) return;
    this.deliveringFiles = true;
    try {
      await this.store.lock(734925, async () => {
        const settings = await this.store!.settings();
        if (settings.pausedUntil && Date.parse(settings.pausedUntil) > Date.now()) return;
        await new NotificationImportFiles(this.store!.prisma).deliver(this.telegram, this.config.owner);
      });
    } catch { console.warn('Import file delivery storage unavailable'); }
    finally { this.deliveringFiles = false; }
  }

  async record(event: NotificationEvent): Promise<void> {
    if (this.config.mode === 'off' || !this.store) return;
    try {
      if (event.category === 'validation' && this.config.mode === 'producer') {
        if (Date.now() - this.validationCheckedAt > 5000) {
          this.validationEnabled = (await this.store.settings()).validation; this.validationCheckedAt = Date.now();
        }
        if (!this.validationEnabled) return;
      }
      await this.store.add(NotificationEventSchema.parse(event));
    }
    catch { console.warn('Notification persistence unavailable; application operation continues'); }
  }
  async accept(event: NotificationEvent) {
    if (!this.store || !['producer', 'controller'].includes(this.config.mode)) throw new Error('Notification controller storage unavailable');
    if (event.category === 'validation' && !(await this.store.settings()).validation) return;
    await this.store.add(NotificationEventSchema.parse(event));
  }
  private base(category: NotificationEvent['category'], type: NotificationEvent['type']) {
    return { id: randomUUID(), environment: this.config.environment, category, type, at: new Date().toISOString() };
  }
  async queued(job: StoredJob, bytes: number) {
    await this.record({ ...this.base('queue', 'queue.queued'), jobId: job.id, seq: job.seq, action: job.kind,
      requester: job.ipHash.slice(0, 12), bytes });
  }
  async finished(job: StoredJob, result: unknown, error: JobError | null) {
    const event: NotificationEvent = { ...this.base('queue', 'queue.finished'), jobId: job.id, seq: job.seq,
      action: job.kind, requester: job.ipHash.slice(0, 12), state: error ? 'failed' : 'complete',
      durationMs: job.startedAt ? Date.now() - job.startedAt.getTime() : undefined,
      ...queueResultSummary(job, result), ...(error ? { code: String(error.status), message: sanitizeErrorMessage(error.message).slice(0, 1000) } : {}) };
    await this.record(event);
    if (error) await this.record({ ...event, id: randomUUID(), category: 'errors', type: 'error', source: 'Tools Queue' });
  }
  error(source: string, error: unknown, fields: Pick<NotificationEvent, 'route' | 'code' | 'digest'> = {}, validation = false) {
    const safe = sanitizeError(error);
    const message = safe.name.startsWith('Prisma') ? `Database operation failed (${safe.name})` : safe.message.slice(0, 1000);
    // Bound repeated errors locally; all distinct faults are recorded, recurring faults are summarized once per minute.
    const fingerprint = createHash('sha256').update(JSON.stringify([source, safe.name, message, fields])).digest('hex');
    const now = Date.now();
    for (const [key, until] of this.repeatedErrors) if (until < now) this.repeatedErrors.delete(key);
    if (this.repeatedErrors.has(fingerprint)) return;
    if (this.repeatedErrors.size >= 1000) return;
    this.repeatedErrors.set(fingerprint, now + 60_000);
    void this.record({ ...this.base(validation ? 'validation' : 'errors', 'error'), source: source.slice(0, 100),
      code: safe.name.slice(0, 80), message, ...fields });
  }

  private messageKey(event: NotificationEvent) { return `${event.environment}:${event.jobId ?? event.id}`; }
  private async deliver() {
    if (this.delivering || this.stopped || !this.store) return;
    this.delivering = true;
    try {
      await this.store.lock(734923, async () => {
        const row = await this.store!.prisma.notificationEvent.findFirst({ where: { deliveredAt: null, nextAttemptAt: { lte: new Date() } }, orderBy: { seq: 'asc' } });
        if (!row) return;
        try {
          const event = NotificationEventSchema.parse(row.event);
          if (this.config.mode === 'relay') {
            const response = await fetch(this.config.relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json',
              Authorization: `Bearer ${this.config.relaySecret}` }, body: JSON.stringify(event), signal: AbortSignal.timeout(8000) });
            if (!response.ok) throw new TelegramFailure(response.status);
          } else {
            const settings = await this.store!.settings();
            this.cachePreferences(settings);
            const paused = settings.pausedUntil && Date.parse(settings.pausedUntil) > Date.now();
            const key = this.messageKey(event);
            const existing = await this.store!.prisma.notificationMessage.findUnique({ where: { id: key } });
            if (paused) { await this.store!.prisma.notificationEvent.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(settings.pausedUntil!) } }); return; }
            // A queued card already sent remains accurate even if action logging is switched off before it finishes.
            if (settings[event.category] || (event.type === 'queue.finished' && existing)) {
              if (event.type === 'feedback.submitted') {
                // One part per worker tick respects per-chat pacing. Persist each acknowledged part.
                const texts = feedbackNotificationTexts(event);
                for (const [index, text] of texts.entries()) {
                  const partId = `${event.environment}:feedback:${event.id}:${index}`;
                  if (await this.store!.prisma.notificationMessage.findUnique({ where: { id: partId } })) continue;
                  const sent = await this.telegram.call<{ message_id: number }>('sendMessage', {
                    chat_id: this.config.owner, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
                  });
                  await this.store!.prisma.notificationMessage.upsert({ where: { id: partId },
                    create: { id: partId, messageId: sent.message_id }, update: { messageId: sent.message_id } });
                  if (index < texts.length - 1) return;
                }
              } else if (event.type === 'queue.finished' && existing) {
                try {
                  await this.telegram.call('editMessageText', { chat_id: this.config.owner, message_id: existing.messageId, text: notificationText(event) });
                } catch (error) {
                  if (error instanceof TelegramFailure && error.unchanged) { /* Idempotent replay after a worker restart. */ }
                  else if (error instanceof TelegramFailure && error.missingMessage) {
                    const sent = await this.telegram.call<{ message_id: number }>('sendMessage', { chat_id: this.config.owner, text: notificationText(event) });
                    await this.store!.prisma.notificationMessage.update({ where: { id: key }, data: { messageId: sent.message_id } });
                  } else throw error;
                }
              } else if (!(event.type === 'queue.queued' && existing)) {
                const sent = await this.telegram.call<{ message_id: number }>('sendMessage', { chat_id: this.config.owner,
                  text: notificationText(event), link_preview_options: { is_disabled: true } });
                if (event.type.startsWith('queue.')) await this.store!.prisma.notificationMessage.upsert({ where: { id: key },
                  create: { id: key, messageId: sent.message_id }, update: { messageId: sent.message_id } });
              }
            }
          }
          await this.store!.prisma.notificationEvent.update({ where: { id: row.id }, data: { deliveredAt: new Date() } });
        } catch (error) {
          const retry = error instanceof TelegramFailure && error.retryAfter ? error.retryAfter * 1000 : Math.min(60 * 60 * 1000, 5000 * 2 ** Math.min(row.attempts, 10));
          await this.store!.prisma.notificationEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + retry) } });
          // No Logger call here: monitoring failure must never recursively notify itself.
          console.warn('Notification delivery deferred');
        }
      });
    } catch { console.warn('Notification worker storage unavailable'); await this.storageAlert(); }
    finally { this.delivering = false; }
  }

  private keyboard(settings: NotificationSettings) {
    return { inline_keyboard: [
      ...(['queue', 'errors', 'validation', 'feedback'] as const).map(key => [{ text: `${settings[key] ? 'ON' : 'OFF'} · ${key === 'queue' ? 'Queued actions' : key === 'errors' ? 'Errors' : key === 'feedback' ? 'Site feedback' : 'Validation errors'}`, callback_data: `set:${key}:${settings[key] ? '0' : '1'}` }]),
      [{ text: 'Pause 1 hour', callback_data: 'pause:1h' }, { text: 'Resume', callback_data: 'resume' }],
      [{ text: 'Delivery status', callback_data: 'status' }, { text: 'Test notification', callback_data: 'test' }],
    ] };
  }
  private async menu(messageId?: number) {
    const settings = await this.store!.settings();
    this.cachePreferences(settings);
    const text = `ToF Hub notifications\nSettings apply to normal operation and local development.\nLocal notifications use [LOCAL].\n${settings.pausedUntil && Date.parse(settings.pausedUntil) > Date.now() ? `Paused until ${settings.pausedUntil}` : 'Delivery active'}`;
    try {
      await this.telegram.call(messageId ? 'editMessageText' : 'sendMessage', { chat_id: this.config.owner,
        ...(messageId ? { message_id: messageId } : {}), text, reply_markup: this.keyboard(settings) });
    } catch (error) { if (!(error instanceof TelegramFailure && error.unchanged)) throw error; }
  }
  private async status() {
    const pending = await this.store!.prisma.notificationEvent.count({ where: { deliveredAt: null } });
    const files = this.config.importFiles ? await this.store!.prisma.notificationImportFile.count({ where: { deliveredAt: null } }) : null;
    await this.telegram.call('sendMessage', { chat_id: this.config.owner, text: `Notification delivery\nPending events: ${pending}${files === null ? '' : `\nPending file parts: ${files}`}\nController: main server` });
  }
  private async poll() {
    if (this.polling || this.stopped || !this.store) return;
    this.polling = true;
    try {
      await this.store.lock(734924, async () => {
        const offset = await this.store!.offset();
        const updates = await this.telegram.call<TelegramUpdate[]>('getUpdates', { offset, timeout: 0, limit: 1, allowed_updates: ['message', 'callback_query'] });
        for (const update of updates) {
          const callback = update.callback_query;
          const from = callback?.from.id ?? update.message?.from?.id;
          const chat = callback?.message?.chat.id ?? update.message?.chat.id;
          if (String(from) === this.config.owner && String(chat) === this.config.owner) {
            if (callback) {
              await this.telegram.call('answerCallbackQuery', { callback_query_id: callback.id });
              const settings = await this.store!.settings();
              const set = /^set:(queue|errors|validation|feedback):(0|1)$/.exec(callback.data ?? '');
              if (set) { settings[set[1] as 'queue' | 'errors' | 'validation' | 'feedback'] = set[2] === '1'; await this.store!.updateSettings(settings); this.cachePreferences(settings); await this.menu(callback.message?.message_id); }
              else if (callback.data === 'pause:1h' || callback.data === 'resume') {
                const previousPause = settings.pausedUntil;
                settings.pausedUntil = callback.data === 'resume' ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString();
                await this.store!.updateSettings(settings);
                this.cachePreferences(settings);
                if (callback.data === 'resume' && previousPause) await this.store!.prisma.notificationEvent.updateMany({
                  where: { deliveredAt: null, nextAttemptAt: new Date(previousPause) }, data: { nextAttemptAt: new Date() },
                });
                await this.menu(callback.message?.message_id);
              } else if (callback.data === 'status') await this.status();
              else if (callback.data === 'test') await this.telegram.call('sendMessage', { chat_id: this.config.owner, text: 'Test notification · ToF Hub\nTelegram delivery is working.' });
            } else {
              const command = update.message?.text?.split(/[ @]/)[0];
              if (command === '/start' || command === '/settings') await this.menu();
              else if (command === '/status') await this.status();
              else if (command === '/test') await this.telegram.call('sendMessage', { chat_id: this.config.owner, text: 'Test notification · ToF Hub\nTelegram delivery is working.' });
            }
          } else if (callback) await this.telegram.call('answerCallbackQuery', { callback_query_id: callback.id, text: 'Access denied' });
          await this.store!.setOffset(update.update_id + 1);
        }
      });
    } catch { console.warn('Telegram control polling deferred'); }
    finally { this.polling = false; }
  }
  private async cleanup() {
    if (!this.store) return;
    try {
      const cutoff = new Date(Date.now() - 7 * 86_400_000);
      await this.store.prisma.notificationEvent.deleteMany({ where: { deliveredAt: { lt: cutoff } } });
      await this.store.prisma.notificationMessage.deleteMany({ where: { updatedAt: { lt: cutoff } } });
      if (this.config.importFiles) await this.store.prisma.notificationImportFile.deleteMany({ where: { deliveredAt: { lt: cutoff } } });
    } catch { console.warn('Notification retention cleanup deferred'); }
  }
  private cachePreferences(settings: NotificationSettings) {
    this.cachedPreferences = { ...settings };
    const text = JSON.stringify(settings);
    if (!this.config.preferenceCachePath || this.persistedPreferences === text) return;
    try {
      fs.mkdirSync(path.dirname(this.config.preferenceCachePath), { recursive: true });
      const temporary = `${this.config.preferenceCachePath}.${randomUUID()}.tmp`;
      fs.writeFileSync(temporary, text, { mode: 0o600 });
      fs.renameSync(temporary, this.config.preferenceCachePath);
      this.persistedPreferences = text;
    } catch { console.warn('Notification preference cache write deferred'); }
  }
  /** PostgreSQL outage is itself reportable; use cached switches without creating a recursive outbox error. */
  private async storageAlert() {
    if (this.config.mode !== 'controller' || !this.cachedPreferences.errors ||
      (this.cachedPreferences.pausedUntil && Date.parse(this.cachedPreferences.pausedUntil) > Date.now()) ||
      Date.now() - this.lastStorageAlert < 10 * 60_000) return;
    this.lastStorageAlert = Date.now();
    try {
      await this.telegram.call('sendMessage', { chat_id: this.config.owner,
        text: 'Error · Notification storage\nThe monitoring database is unavailable. Persistent delivery and controls will resume when it recovers.' });
    } catch { console.warn('Notification storage alert delivery deferred'); }
  }
}
