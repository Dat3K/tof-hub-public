import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prepareJsonImport } from './json-import';
import { decryptEnvelope, sealedEnvelopeSchema } from './sealed-envelope';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 3072 }).privateKey;

describe('direct JSON import transport', () => {
  it.each([
    ['build', { format: 'tof-hub-build-capture', schemaVersion: 2 }],
    ['wish', { version: 2, batches: [] }],
    ['players', { version: 1, players: [] }],
  ] as const)('preserves %s JSON for its existing domain validator', (kind, payload) => {
    const envelope = sealedEnvelopeSchema(kind).parse(prepareJsonImport(kind, Buffer.from(JSON.stringify(payload)), privateKey));
    expect(decryptEnvelope(envelope, privateKey, 1024)).toEqual(payload);
  });
  it('does not reinterpret another import kind', () => {
    const payload = { version: 2, batches: [] };
    expect(prepareJsonImport('build', payload, privateKey)).toBe(payload);
  });
  it('retains existing sealed envelopes', () => {
    const envelope = { ciphertext: 'existing' };
    expect(prepareJsonImport('build', envelope, privateKey)).toBe(envelope);
  });
  it('rejects malformed JSON and unsafe object keys', () => {
    expect(() => prepareJsonImport('wish', Buffer.from('{'), privateKey)).toThrow();
    expect(() => prepareJsonImport('wish', Buffer.from('{"__proto__":{}}'), privateKey)).toThrow();
  });
});
