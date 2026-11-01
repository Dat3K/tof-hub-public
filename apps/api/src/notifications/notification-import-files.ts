import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { SEALED_FILES, type SealedFileKind } from '@tof-hub/contracts';
import { TelegramClient, TelegramFailure } from './telegram-client';

// Bound each worker read and multipart allocation, including .tofplayers files larger than Telegram's file limit.
export const IMPORT_FILE_PART_BYTES = 8 * 1024 * 1024;
export interface ImportFileOwner { uid: string | null; nickname: string | null }

/** Called only after the importer's existing authentication/schema/policy checks, never by a public intake route. */
export class NotificationImportFiles {
  constructor(private readonly prisma: PrismaClient) {}

  async add(kind: SealedFileKind, envelope: unknown, environment: 'normal' | 'local', owner?: ImportFileOwner) {
    // The HTTP import APIs receive JSON, so preserve the encrypted envelope, not original whitespace or filename.
    // Never accept the wish queue wrapper: it includes private device access tokens.
    const payload = Buffer.from(JSON.stringify(envelope));
    if (!payload.length || payload.length > SEALED_FILES[kind].maxBytes) throw new Error('Import archive exceeds file limit');
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const parts = Math.ceil(payload.length / IMPORT_FILE_PART_BYTES);
    const filename = `${kind}-${sha256}${SEALED_FILES[kind].extension}`;
    await this.prisma.$transaction(async tx => {
      for (let part = 1; part <= parts; part++) {
        // Commit every part together. Re-importing the same envelope does not create a second document.
        await tx.notificationImportFile.createMany({ data: [{
          id: `${environment}:${kind}:${sha256}:${part}`, sha256, environment, kind, part, parts,
          filename: parts === 1 ? filename : `${filename}.part${part}-of-${parts}`,
          ownerUid: owner?.uid&&/^\d{6,24}$/.test(owner.uid)?owner.uid:null, ownerNickname: owner?.nickname?.slice(0,64) ?? null,
          payload: new Uint8Array(payload.subarray((part - 1) * IMPORT_FILE_PART_BYTES, part * IMPORT_FILE_PART_BYTES)),
        }], skipDuplicates: true });
      }
    }, { timeout: 30_000, maxWait: 5000 });
  }

  async deliver(telegram: TelegramClient, owner: string) {
    const row = await this.prisma.notificationImportFile.findFirst({
      where: { deliveredAt: null, nextAttemptAt: { lte: new Date() }, payload: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { part: 'asc' }],
    });
    if (!row?.payload) return;
    try {
      const caption = `${row.environment === 'local' ? '[LOCAL] ' : ''}ToF Hub · encrypted import\n`
        + `Nickname: ${row.ownerNickname?.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0,64) || 'Unknown'}\nUID: ${row.ownerUid || 'Unknown'}\n`
        + `Format and integrity checks passed; game-data authenticity is not attested.\n`
        + `Type: ${row.kind}${row.parts > 1 ? ` · Part ${row.part}/${row.parts}; concatenate in order` : ''}\nSHA-256: ${row.sha256}`;
      const sent = await telegram.document(owner, row.filename, row.payload, caption);
      await this.prisma.notificationImportFile.update({ where: { id: row.id }, data: {
        deliveredAt: new Date(), messageId: sent.message_id, payload: null,
      } });
    } catch (error) {
      // Telegram timeouts can mean the file arrived but the acknowledgement was lost: at-least-once delivery.
      const delay = error instanceof TelegramFailure && error.retryAfter ? error.retryAfter * 1000
        : Math.min(60 * 60 * 1000, 5000 * 2 ** Math.min(row.attempts, 10));
      await this.prisma.notificationImportFile.update({ where: { id: row.id }, data: {
        attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + delay),
      } });
      console.warn('Import file delivery deferred');
    }
  }
}
