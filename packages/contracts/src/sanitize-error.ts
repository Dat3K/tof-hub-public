/**
 * Error Sanitization Utility
 * Redacts credentials, tokens, passwords, database URIs, and authorization headers
 * before errors are displayed in client boundaries or logged to monitoring.
 */

export interface SanitizedErrorInfo {
  name: string;
  message: string;
  digest?: string;
  stack?: string;
}

/**
 * Strips secrets, credentials, tokens, and database connection strings from an error message.
 */
export function sanitizeErrorMessage(message: unknown): string {
  if (typeof message !== 'string') {
    return 'An unexpected error occurred.';
  }

  let sanitized = message;

  // 1. Redact URL credentials: protocol://user:password@host
  sanitized = sanitized.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/:]+):([^@/]+)@/g,
    '$1$2:[REDACTED]@'
  );

  // 2. Redact Authorization Bearer / Basic tokens
  sanitized = sanitized.replace(
    /\b(Bearer|Basic)\s+[A-Za-z0-9-_.~+/=]+/gi,
    '$1 [REDACTED]'
  );

  // 3. Redact Query parameters containing secrets
  sanitized = sanitized.replace(
    /([?&](?:token|key|api_?key|secret|password|passwd|pwd|access_?token|auth|credentials?)=)[^&"'\s]+/gi,
    '$1[REDACTED]'
  );

  // 4. Redact Key-Value pairs in JSON or config strings
  sanitized = sanitized.replace(
    /(["']?(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|auth|authorization|private[_-]?key|credentials?|cookie)["']?\s*[:=]\s*)(["']?)[^"'\s&,;}{]+(\3)/gi,
    '$1$2[REDACTED]$2'
  );

  // 5. Redact JWT tokens
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*\b/g,
    '[REDACTED_JWT]'
  );

  // 6. Redact common API key patterns (GitHub, AWS, etc.)
  sanitized = sanitized.replace(
    /\b(ghp|gho|ghu|ghs|ghr|AKIA)[A-Za-z0-9_-]{16,}\b/g,
    '[REDACTED_KEY]'
  );

  // Telegram tokens also appear inside the Bot API URL path, outside query parameters.
  sanitized = sanitized.replace(/(?:bot)?\d{6,16}:[A-Za-z0-9_-]{30,}/g, '[REDACTED_BOT_TOKEN]');
  sanitized = sanitized.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
  return sanitized;
}

/**
 * Extracts a safe representation of an Error object without leaking internal secrets.
 */
function sanitizeReadableError(error: unknown): SanitizedErrorInfo {
  if (!error) {
    return {
      name: 'Error',
      message: 'An unknown error occurred.',
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: sanitizeErrorMessage(error),
    };
  }

  const err = error as Record<string, unknown>;
  const name = typeof err.name === 'string' ? err.name : 'Error';
  const rawMessage = typeof err.message === 'string' ? err.message : String(error);
  const message = sanitizeErrorMessage(rawMessage);
  const digest = typeof err.digest === 'string' ? err.digest : undefined;

  let stack: string | undefined = undefined;
  if (typeof err.stack === 'string') {
    stack = sanitizeErrorMessage(err.stack);
  }

  return {
    name,
    message,
    digest,
    stack,
  };
}

/** Reporting must not throw when a rejection object has throwing getters/toString. */
export function sanitizeError(error: unknown): SanitizedErrorInfo {
  try { return sanitizeReadableError(error); }
  catch { return { name: 'Error', message: 'An unexpected error occurred.' }; }
}

