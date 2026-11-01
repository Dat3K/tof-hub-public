import { timingSafeEqual } from 'node:crypto';

/** Server-only comparison; callers choose the credential's scope and never send it to public clients. */
export function checkAdminKey(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const actualBytes = Buffer.from(provided), expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
