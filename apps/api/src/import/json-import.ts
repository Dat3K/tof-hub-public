import { constants, createCipheriv, createPublicKey, publicEncrypt, randomBytes, type KeyObject } from 'node:crypto';
import { SEALED_FILES, type SealedFileKind } from '@tof-hub/contracts';
import { BadRequestException } from '@nestjs/common';
import { assertJsonDepth, safeJsonReviver } from '../security/json-safety';
import { IMPORT_KEY_ID } from './sealed-envelope';

/** Accept public JSON through the existing schema, queue and persistence pipeline. */
export function prepareJsonImport(kind: SealedFileKind, body: unknown, privateKey: KeyObject | null): unknown {
  const limit = SEALED_FILES[kind].maxBytes;
  let value = body;
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (bytes.length > limit) throw new BadRequestException('Import file exceeds the size limit');
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      assertJsonDepth(text);
      value = JSON.parse(text, safeJsonReviver) as unknown;
    } catch { throw new BadRequestException('Import must be complete UTF-8 JSON'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = value as Record<string, unknown>;
  if ('ciphertext' in data) return value;
  const matches = kind === 'build' ? data.format === 'tof-hub-build-capture'
    : kind === 'wish' ? data.version === 2 && Array.isArray(data.batches)
    : data.version === 1 && Array.isArray(data.players);
  if (!matches) return value;
  if (!privateKey) throw new BadRequestException('Configure this installation\'s import key first');
  const { manual_pity, ...payload } = data;
  const text = JSON.stringify(kind === 'wish' ? payload : data);
  if (Buffer.byteLength(text) > limit) throw new BadRequestException('Import file exceeds the size limit');
  assertJsonDepth(text);
  const key = randomBytes(32), nonce = randomBytes(12), format = SEALED_FILES[kind].format;
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(`${format}:1:${IMPORT_KEY_ID}`));
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return {
      format, version: 1, key_id: IMPORT_KEY_ID,
      wrapped_key: publicEncrypt({ key: createPublicKey(privateKey), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64url'),
      nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'),
      ...(kind === 'wish' && manual_pity !== undefined ? { manual_pity } : {}),
    };
  } finally { key.fill(0); }
}
