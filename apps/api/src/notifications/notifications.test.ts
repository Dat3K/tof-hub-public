import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationEventSchema, NotificationSettingsSchema, DEFAULT_NOTIFICATION_SETTINGS, emptyFeedbackRatings, sanitizeErrorMessage, sanitizeError, type NotificationEvent } from '@tof-hub/contracts';
import { feedbackNotificationTexts, notificationText, queueResultSummary } from './notification-format';
import { TelegramClient, TelegramFailure } from './telegram-client';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.module';

const id = '319d693a-2d99-40c1-8a21-2ad943962142';
const queued: NotificationEvent = { id, environment: 'normal', category: 'queue', type: 'queue.queued',
  at: '2026-10-14T16:00:00.000Z', jobId: id, seq: 1, action: 'build-import', requester: '123456abcdef', bytes: 2000 };
const feedback: NotificationEvent = { id, environment: 'normal', category: 'feedback', type: 'feedback.submitted',
  at: queued.at, feedback: { id, ratings: { ...emptyFeedbackRatings(), visual: 0, aiTrace: 10 },
    aiComment: '<b>literal text</b>', locale: 'ru', source: 'footer', notes: [
      { page: '/info/food/', category: 'data', message: '<script>alert(1)</script> ' + '😀'.repeat(1400) },
      { page: '/tools/comp/', category: 'idea', message: 'Second page ' + 'я'.repeat(2900) },
    ], client: { player: { uid: '1300701214', nickname: '<i>Nick</i>' }, timeZone: 'Europe/Kyiv', screen: '1920x1080' } },
  feedbackOrigin: { country: 'UA', device: 'desktop', os: 'Windows', browser: 'Chrome' } };
const visibleText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('Notification privacy and transport', () => {
  it('accepts only matching feedback events and upgrades existing owner preferences', () => {
    expect(NotificationEventSchema.parse(feedback).feedback?.aiComment).toBe('<b>literal text</b>');
    expect(NotificationEventSchema.safeParse({ ...feedback, feedback: undefined }).success).toBe(false);
    expect(NotificationEventSchema.safeParse({ ...feedback, id: '7e0baeb4-7bed-4a16-87a8-8cec8b43888c' }).success).toBe(false);
    expect(NotificationEventSchema.safeParse({ ...queued, feedback: feedback.feedback }).success).toBe(false);
    expect(NotificationSettingsSchema.parse({ queue: true, errors: true, validation: false, pausedUntil: null }).feedback).toBe(true);
  });
  it('preserves all escaped feedback text across balanced HTML parts with player, place and device context', () => {
    vi.stubEnv('SITE_URL', 'https://tof.example');
    const texts = feedbackNotificationTexts({ ...feedback, environment: 'local' });
    vi.unstubAllEnvs();
    expect(texts.length).toBeGreaterThan(1);
    for (const text of texts) {
      expect(visibleText(text).length).toBeLessThanOrEqual(4096);
      expect(Array.from(text).some(char => char.length === 1 && /[\uD800-\uDFFF]/.test(char))).toBe(false);
      // Every part stands alone: Telegram rejects a message with an unclosed tag.
      for (const tag of ['b', 'i', 'code', 'pre', 'blockquote', 'a']) expect(text.split(new RegExp(`<${tag}[ >]`)).length).toBe(text.split(`</${tag}>`).length);
    }
    expect(texts[0]).toMatch(/^\[LOCAL\] 🔴 <b>New site review<\/b> · avg <b>0<\/b>\/10/);
    expect(texts[0]).toContain('&lt;i&gt;Nick&lt;/i&gt;'); expect(texts[0]).toContain('<code>1300701214</code>');
    expect(texts[0]).toContain('href="https://tof.example/tools/ranking/?q=1300701214"');
    expect(texts[0]).toContain('🇺🇦 Ukraine · Europe/Kyiv'); expect(texts[0]).toContain('Desktop · Windows · Chrome · 1920×1080');
    expect(texts[0]).toContain('██████████ 10'); expect(texts[0]).toContain('skipped'); expect(texts[0]).toContain('10 = AI is very noticeable');
    expect(texts.join('')).not.toContain('<script>');
    const visible = texts.map(visibleText).join('');
    for (const note of feedback.feedback!.notes) for (const piece of Array.from(note.message).join('').match(/[\s\S]{1,400}/gu)!) expect(visible).toContain(piece);
    expect(visible).toContain('<b>literal text</b>');
    expect(texts.join('')).toContain('href="https://tof.example/info/food/"');
  });
  it('labels feedback without a linked character or known country honestly', () => {
    const [text] = feedbackNotificationTexts({ ...feedback, feedbackOrigin: undefined,
      feedback: { ...feedback.feedback!, notes: [], aiComment: '', client: { player: null, timeZone: null, screen: null } } });
    expect(text).toContain('No character linked'); expect(text).toContain('Unknown country'); expect(text).toContain('Unknown device');
    expect(text).not.toContain('href=');
  });
  it('rejects extra payload/private delivery fields and formats normal/local messages', () => {
    expect(NotificationEventSchema.safeParse({ ...queued, payload: { ciphertext: 'private' } }).success).toBe(false);
    expect(notificationText(queued)).toContain('Build upload');
    expect(notificationText(queued)).not.toContain('production');
    expect(notificationText({ ...queued, environment: 'local' })).toMatch(/^\[LOCAL\]/);
    expect(queueResultSummary({} as any, { uid: '1300701214', name: 'Live name', source: { signature: 'secret' },
      inventory: [{ private: true }], gear: 7 })).toEqual({ identity: { uid: '1300701214', nickname: 'Live name' }, counts: { gear: 7 } });
  });
  it('redacts Telegram URL tokens and credentials without serializing error causes', () => {
    const token = '123456789:abcdefghijklmnopqrstuvwxyz_123456789';
    const message = sanitizeErrorMessage(`https://api.telegram.org/bot${token}/sendMessage postgres://user:secret@db Bearer tokenvalue`);
    expect(message).not.toContain(token);
    expect(message).not.toContain('secret');
    expect(message).not.toContain('tokenvalue');
    expect(NotificationEventSchema.parse({ ...queued, source: `Bearer private-token` }).source).not.toContain('private-token');
    expect(sanitizeError({ get message() { throw new Error('unreadable'); } }).message).toBe('An unexpected error occurred.');
  });
  it('respects Telegram retry_after and never exposes transport URLs', async () => {
    const client = new TelegramClient('private-token', vi.fn().mockResolvedValue({ status: 429, json: async () => ({ ok: false,
      error_code: 429, parameters: { retry_after: 30 } }) }));
    await expect(client.call('sendMessage', {})).rejects.toMatchObject({ status: 429, retryAfter: 30 });
    const broken = new TelegramClient('private-token', vi.fn().mockRejectedValue(new Error('https://api.telegram.org/botprivate-token')));
    await expect(broken.call('sendMessage', {})).rejects.toThrow('Telegram request failed (0)');
  });
});

describe('Durable notification worker and owner controls', () => {
  let service: NotificationsService;
  let state: any;
  let messages: Map<string, { id: string; messageId: number }>;
  let pending: any;
  let calls: { method: string; body: any }[];
  let updates: any[];
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_MODE', 'controller'); vi.stubEnv('TELEGRAM_OWNER_ID', '1000017'); vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_PREFERENCE_CACHE_PATH', '');
    state = { ...DEFAULT_NOTIFICATION_SETTINGS }; messages = new Map(); calls = []; updates = [];
    pending = { id, seq: 1, event: queued, attempts: 0 };
    service = new NotificationsService(null);
    const prisma = { notificationEvent: { findFirst: vi.fn(async () => pending), update: vi.fn(async () => {}),
      updateMany: vi.fn(async () => {}), count: vi.fn(async () => 1) },
      notificationMessage: { findUnique: vi.fn(async ({ where }: any) => messages.get(where.id) ?? null),
        upsert: vi.fn(async ({ create }: any) => { messages.set(create.id, create); }), update: vi.fn(async () => {}) } };
    (service as any).store = { prisma, settings: async () => state, updateSettings: async (next: any) => { state = next; },
      lock: async (_: number, work: any) => work(), offset: async () => 0, setOffset: vi.fn(async () => {}) };
    (service as any).telegram = { call: vi.fn(async (method: string, body: any) => {
      calls.push({ method, body }); return method === 'getUpdates' ? updates : { message_id: 20 };
    }) };
  });
  afterEach(() => { service.onModuleDestroy(); vi.unstubAllEnvs(); });
  it('resumes multi-part feedback after a transport failure without resending acknowledged parts', async () => {
    pending.event = feedback;
    const send = (service as any).telegram.call;
    await (service as any).deliver();
    expect(calls.filter(call => call.method === 'sendMessage')).toHaveLength(1);
    expect((service as any).store.prisma.notificationEvent.update).not.toHaveBeenCalled();
    send.mockRejectedValueOnce(new TelegramFailure(429, 30));
    await (service as any).deliver();
    expect((service as any).store.prisma.notificationEvent.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempts: { increment: 1 } }) }));
    await (service as any).deliver();
    await (service as any).deliver();
    const parts = feedbackNotificationTexts(feedback);
    expect(calls.map(call => call.body.text)).toEqual(parts);
    for (const call of calls) { expect(call.body.parse_mode).toBe('HTML'); expect(call.body.link_preview_options).toEqual({ is_disabled: true }); }
    expect((service as any).store.prisma.notificationEvent.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deliveredAt: expect.any(Date) } }));
  });
  it('creates one queued card and edits it with a validated completion', async () => {
    await (service as any).deliver();
    pending.event = { ...queued, id: 'fd2186c9-8189-4d90-8d75-a33c47d5fe13', type: 'queue.finished', state: 'complete', identity: { uid: '1300701214', nickname: 'A player' } };
    state.queue = false;
    await (service as any).deliver();
    expect(calls.map(call => call.method)).toEqual(['sendMessage', 'editMessageText']);
    expect(calls[1].body.message_id).toBe(20);
    expect(calls[1].body.text).toContain('A player');
  });
  it('suppresses disabled categories and postpones paused events', async () => {
    state.queue = false;
    await (service as any).deliver();
    expect(calls).toHaveLength(0);
    state.queue = true; state.pausedUntil = new Date(Date.now() + 60_000).toISOString();
    await (service as any).deliver();
    expect(calls).toHaveLength(0);
    expect((service as any).store.prisma.notificationEvent.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { nextAttemptAt: new Date(state.pausedUntil) } }));
  });
  it('allows only the configured owner in the private owner chat', async () => {
    updates = [{ update_id: 1, callback_query: { id: '1', from: { id: 12 }, data: 'set:errors:0', message: { message_id: 4, chat: { id: 1000017 } } } }];
    await (service as any).poll();
    expect(state.errors).toBe(true);
    expect(calls.find(call => call.method === 'answerCallbackQuery')?.body.text).toBe('Access denied');
    calls = [];
    updates = [{ update_id: 2, callback_query: { id: '2', from: { id: 1000017 }, data: 'set:queue:0', message: { message_id: 4, chat: { id: 1000017 } } } }];
    await (service as any).poll();
    expect(state.queue).toBe(false);
    expect(calls.some(call => call.method === 'editMessageText')).toBe(true);
  });
  it('backs off after rate limiting and handles idempotent Telegram edits', async () => {
    (service as any).telegram.call = vi.fn().mockRejectedValue(new TelegramFailure(429, 45));
    const start = Date.now();
    await (service as any).deliver();
    const update = (service as any).store.prisma.notificationEvent.update.mock.calls.at(-1)[0];
    expect(update.data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(start + 45_000);
    messages.set('normal:' + id, { id: 'normal:' + id, messageId: 20 });
    pending.event = { ...queued, type: 'queue.finished', state: 'complete' };
    (service as any).telegram.call = vi.fn().mockRejectedValue(new TelegramFailure(400, 0, true));
    await (service as any).deliver();
    expect((service as any).store.prisma.notificationEvent.update.mock.calls.at(-1)[0].data.deliveredAt).toBeInstanceOf(Date);
  });
  it('does not create another queued card on replay and resumes paused work immediately', async () => {
    messages.set('normal:' + id, { id: 'normal:' + id, messageId: 20 });
    await (service as any).deliver();
    expect(calls).toHaveLength(0);
    state.pausedUntil = '2026-10-15T16:00:00.000Z';
    updates = [{ update_id: 3, callback_query: { id: '3', from: { id: 1000017 }, data: 'resume', message: { message_id: 4, chat: { id: 1000017 } } } }];
    await (service as any).poll();
    expect(state.pausedUntil).toBeNull();
    expect((service as any).store.prisma.notificationEvent.updateMany).toHaveBeenCalled();
  });
  it('refuses unauthenticated relay requests before storing data', async () => {
    vi.stubEnv('TELEGRAM_RELAY_SECRET', 'a'.repeat(40));
    const controller = new NotificationsController(service);
    await expect(controller.relay('Bearer wrong', queued)).rejects.toThrow();
  });
  it('forwards a local event to authenticated intake without calling Telegram', async () => {
    (service as any).config = { mode: 'relay', relayUrl: 'https://example.test/intake', relaySecret: 'a'.repeat(40) };
    const forward = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', forward);
    try {
      pending.event = { ...queued, environment: 'local' };
      await (service as any).deliver();
      expect(forward).toHaveBeenCalledWith('https://example.test/intake', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ' + 'a'.repeat(40) }),
      }));
      expect(calls).toHaveLength(0);
      expect(JSON.parse(forward.mock.calls[0][1].body).environment).toBe('local');
    } finally { vi.unstubAllGlobals(); }
  });
  it('reports database outages without an outbox and honors cached error/pause switches', async () => {
    (service as any).store.lock = vi.fn().mockRejectedValue(new Error('Database unavailable'));
    await (service as any).deliver();
    expect(calls.find(call => call.method === 'sendMessage')?.body.text).toContain('monitoring database is unavailable');
    calls = [];
    (service as any).lastStorageAlert = 0;
    (service as any).cachedPreferences.errors = false;
    await (service as any).deliver();
    expect(calls).toHaveLength(0);
  });
});
