import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { DATABASE_BINARY_PART_BYTES } from '../database/binary-payload';
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
    type FileRow = { id: string; payload?: Uint8Array; payloadBytes?: number; filename: string; sha256: string; parts: number };
    const rows = new Map<string, FileRow>();
    const chunks = new Map<string, Uint8Array>();
    const table = {
      createMany: vi.fn(async ({ data: [row] }: { data: [FileRow] }) => {
        if (rows.has(row.id)) return {count: 0};
        rows.set(row.id, row);
        return {count: 1};
      }),
      findFirst: async () => rows.values().next().value,
      update: vi.fn(),
    };
    const chunkTable = {
      create: vi.fn(async ({data}: {data: {fileId: string; part: number; bytes: Uint8Array}}) => {
        chunks.set(`${data.fileId}:${data.part}`, data.bytes);
      }),
      findUnique: async ({where: {fileId_part}}: {where: {fileId_part: {fileId: string; part: number}}}) =>
        ({bytes: chunks.get(`${fileId_part.fileId}:${fileId_part.part}`)}),
    };
    const models = {notificationImportFile: table, notificationImportFilePayloadChunk: chunkTable};
    const prisma = {...models, $transaction: async (work: (tx: unknown) => Promise<void>) => work(models)};
    const files = new NotificationImportFiles(prisma as never);
    const envelope = { format: 'tof-hub-players-sealed', ciphertext: 'x'.repeat(IMPORT_FILE_PART_BYTES + 19), tag: 'preserved' };
    await files.add('players', envelope, 'normal', {uid:'1302104471',nickname:'Owner'});
    await files.add('players', envelope, 'normal', {uid:'1302104471',nickname:'Owner'});
    expect(rows.size).toBe(2);
    const [first, last] = [...rows.values()];
    expect(first).toMatchObject({ownerUid:'1302104471',ownerNickname:'Owner',payloadBytes:IMPORT_FILE_PART_BYTES});
    expect(first!.payload).toBeUndefined();
    expect(chunkTable.create).toHaveBeenCalledTimes(IMPORT_FILE_PART_BYTES / DATABASE_BINARY_PART_BYTES);
    expect([...chunks.values()].every(bytes => bytes.length <= DATABASE_BINARY_PART_BYTES)).toBe(true);
    const document = vi.fn().mockResolvedValue({message_id: 42});
    await files.deliver({document} as unknown as TelegramClient, '123');
    const joined = Buffer.concat([document.mock.calls[0]![2], last!.payload!]);
    expect(JSON.parse(joined.toString())).toEqual(envelope);
    expect(first!.sha256).toBe(createHash('sha256').update(joined).digest('hex'));
    expect([...rows.values()].every(row => row.parts === 2 && row.filename.includes('.tofplayers.part'))).toBe(true);
  });

  it('clears bytes only after Telegram acknowledges them and retains bytes on rate limits', async () => {
    const row = { id: 'file', kind: 'build', environment: 'normal', filename: 'file.tofbuild', sha256: 'a'.repeat(64),
      ownerUid:'1302104471',ownerNickname:'Owner\nName',part: 1, parts: 1, attempts: 0, payloadBytes: null };
    const update = vi.fn();
    const legacy = Buffer.from('encrypted');
    const files = new NotificationImportFiles({
      notificationImportFile: {findFirst: async () => row, update},
      $queryRaw: async ([sql]: TemplateStringsArray) => sql?.includes('octet_length') ? [{size: legacy.length}] : [{bytes: legacy}],
    } as never);
    const document = vi.fn().mockRejectedValue(new TelegramFailure(429, 60));
    const start = Date.now();
    await files.deliver({ document } as unknown as TelegramClient, '123');
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('payload');
    expect(update.mock.calls[0]![0].data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(start + 60_000);
    document.mockResolvedValue({ message_id: 42 });
    await files.deliver({ document } as unknown as TelegramClient, '123');
    expect(update.mock.calls[1]![0].data).toMatchObject({payload: null, payloadBytes: null, payloadChunks: {deleteMany: {}}, messageId: 42, deliveredAt: expect.any(Date)});
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
