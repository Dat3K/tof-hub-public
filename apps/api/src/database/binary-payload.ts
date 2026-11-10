// PostgreSQL and its driver can hold several copies of a bytea parameter or result.
// Keep each operation small even when the application accepts a much larger file.
export const DATABASE_BINARY_PART_BYTES = 1024 * 1024;
export const DATABASE_BINARY_TRANSACTION_TIMEOUT_MS = 60_000;

export function* binaryPayloadParts(payload: Uint8Array) {
  for (let offset = 0; offset < payload.length; offset += DATABASE_BINARY_PART_BYTES) {
    yield {part: offset / DATABASE_BINARY_PART_BYTES, bytes: new Uint8Array(payload.subarray(offset, offset + DATABASE_BINARY_PART_BYTES))};
  }
}

export async function readBinaryPayload(
  size: number,
  read: (part: number, offset: number, length: number) => Promise<Uint8Array | null | undefined>,
): Promise<Buffer> {
  const payload = Buffer.allocUnsafe(size);
  for (let offset = 0; offset < size; offset += DATABASE_BINARY_PART_BYTES) {
    const length = Math.min(DATABASE_BINARY_PART_BYTES, size - offset);
    const bytes = await read(offset / DATABASE_BINARY_PART_BYTES, offset, length);
    if (bytes?.length !== length) throw new Error('Missing or invalid binary payload part');
    payload.set(bytes, offset);
  }
  return payload;
}
