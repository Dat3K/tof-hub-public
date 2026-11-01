import { sanitizeError } from '@tof-hub/contracts';
export { sanitizeError, sanitizeErrorMessage } from '@tof-hub/contracts';
export type { SanitizedErrorInfo } from '@tof-hub/contracts';

/**
 * Logs an error safely to the console with all credentials and secrets redacted.
 */
export function logSanitizedError(context: string, error: unknown): void {
  const safe = sanitizeError(error);
  const prefix = `[${context}]`;

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `${prefix} ${safe.name}: ${safe.message}`,
      safe.digest ? `(digest: ${safe.digest})` : '',
      safe.stack ? `\n${safe.stack}` : ''
    );
  } else {
    // Production logging: concise, redacted, structured
    console.error(`${prefix} ${safe.name}: ${safe.message}`, {
      digest: safe.digest,
      timestamp: new Date().toISOString(),
    });
  }
}
