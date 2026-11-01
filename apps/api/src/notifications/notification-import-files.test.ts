import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NotificationImportFiles, IMPORT_FILE_PART_BYTES } from './notification-import-files';
import { NotificationsService } from './notifications.service';
import { TelegramClient, TelegramFailure } from './telegram-client';

afterEach(() => vi.unstubAllEnvs());

describe('Encrypted import file delivery', () => {
  it('sends an actual multipart document and does not expose tokens in transport errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } })));
    const client = new TelegramClient('private-token', fetcher);
    await expect(client.document('123', 'file.tofbuild', Buffer.from('encrypted'), 'validated')).resolves.toEqual({ message_id: 42 });
    const request = fetcher.mock.calls[0]![1]!;
    const form = request.body as FormData;
    expect(form.get('chat_id')).toBe('123');
    expect(form.get('caption')).toBe('validated');
    const file = form.get('document') as File;
    expect(file.name).toBe('file.tofbuild');
    expect(await file.text()).toBe('encrypted');
    expect(request.headers).toBeUndefined(); // fetch supplies the multipart boundary.
    fetcher.mockRejectedValue(new Error('https://api.telegram.org/botprivate-token'));
    await expect(client.document('123', 'file.tofbuild', Buffer.from('x'), '')).rejects.toThrow('Telegram request failed (0)');
  });

  it('persists every encrypted byte, splits large files reversibly, and deduplicates re-imports', async () => {
    const rows = new Map<string, { id: string; payload: Uint8Array; filename: string; sha256: string; parts: number }>();
    const table = { createMany: vi.fn(async ({ data }: { data: Array<typeof rows extends Map<string, infer R> ? R : never> }) => {
      for (const row of data) if (!rows.has(row.id)) rows.set(row.id, row);
    }) };
    const prisma = { $transaction: async (work: (tx: unknown) => Promise<void>) => work({ notificationImportFile: table }) };
    const files = new NotificationImportFiles(prisma as never);
    const envelope = { format: 'tof-hub-players-sealed', ciphertext: 'x'.repeat(IMPORT_FILE_PART_BYTES + 19), tag: 'preserved' };
    await files.add('players', envelope, 'normal', {uid:'1302104471',nickname:'Owner'});
    await files.add('players', envelope, 'normal', {uid:'1302104471',nickname:'Owner'});
    expect(rows.size).toBe(2);
    expect([...rows.values()][0]).toMatchObject({ownerUid:'1302104471',ownerNickname:'Owner'});
    const joined = Buffer.concat([...rows.values()].map(row => Buffer.from(row.payload)));
    expect(JSON.parse(joined.toString())).toEqual(envelope);
    expect([...rows.values()][0]!.sha256).toBe(createHash('sha256').update(joined).digest('hex'));
    expect([...rows.values()].every(row => row.parts === 2 && row.filename.includes('.tofplayers.part'))).toBe(true);
  });

  it('clears bytes only after Telegram acknowledges them and retains bytes on rate limits', async () => {
    const row = { id: 'file', kind: 'build', environment: 'normal', filename: 'file.tofbuild', sha256: 'a'.repeat(64),
      ownerUid:'1302104471',ownerNickname:'Owner\nName',part: 1, parts: 1, attempts: 0, payload: Buffer.from('encrypted') };
    const update = vi.fn();
    const files = new NotificationImportFiles({ notificationImportFile: { findFirst: async () => row, update } } as never);
    const document = vi.fn().mockRejectedValue(new TelegramFailure(429, 60));
    const start = Date.now();
    await files.deliver({ document } as unknown as TelegramClient, '123');
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('payload');
    expect(update.mock.calls[0]![0].data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(start + 60_000);
    document.mockResolvedValue({ message_id: 42 });
    await files.deliver({ document } as unknown as TelegramClient, '123');
    expect(update.mock.calls[1]![0].data).toMatchObject({ payload: null, messageId: 42, deliveredAt: expect.any(Date) });
    expect(document.mock.calls[1]![3]).toContain('authenticity is not attested');
    expect(document.mock.calls[1]![3]).toContain('Nickname: Owner Name\nUID: 1302104471');
  });

  it('keeps the feature off by default and fails closed when enabled without durable intake', async () => {
    vi.stubEnv('TELEGRAM_MODE', 'producer');
    vi.stubEnv('TELEGRAM_IMPORT_FILES', 'false');
    await expect(new NotificationsService(null).acceptedImport('build', {})).resolves.toBeUndefined();
    vi.stubEnv('TELEGRAM_IMPORT_FILES', 'true');
    await expect(new NotificationsService(null).acceptedImport('build', {})).rejects.toThrow('storage is unavailable');
  });

  it('honors pause without dropping files, independently of the text queue category', async () => {
    vi.stubEnv('TELEGRAM_MODE', 'controller'); vi.stubEnv('TELEGRAM_IMPORT_FILES', 'true');
    vi.stubEnv('TELEGRAM_OWNER_ID', '123'); vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test');
    const findFirst = vi.fn(async () => null);
    let pausedUntil: string | null = new Date(Date.now() + 60_000).toISOString();
    const service = new NotificationsService(null);
    Object.assign(service, { store: { prisma: { notificationImportFile: { findFirst } },
      settings: async () => ({ queue: false, pausedUntil }), lock: async (_key: number, work: () => Promise<void>) => work() } });
    const deliver = () => (service as unknown as { deliverFiles: () => Promise<void> }).deliverFiles();
    await deliver(); expect(findFirst).not.toHaveBeenCalled();
    pausedUntil = null;
    await deliver(); expect(findFirst).toHaveBeenCalledOnce();
  });
});
