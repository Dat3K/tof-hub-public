import { sanitizeError } from '@tof-hub/contracts';
import type { Instrumentation } from 'next';

/** Next SSR/route failures use authenticated, server-only intake; browser-facing env never contains its key. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const secret = process.env.TELEGRAM_RELAY_SECRET;
  if (!secret || secret.length < 32 || request.path.startsWith('/api/v1/notifications')) return;
  if (process.env.NODE_ENV !== 'production' && process.env.TELEGRAM_MODE === 'off') return;
  const safe = sanitizeError(error);
  const origin = process.env.API_INTERNAL_URL ?? 'http://localhost:3001/api/v1';
  const endpoint = process.env.TELEGRAM_MODE === 'relay' && process.env.TELEGRAM_RELAY_URL
    ? process.env.TELEGRAM_RELAY_URL : `${origin.replace(/\/$/, '')}/notifications/relay`;
  try {
    await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ id: crypto.randomUUID(), environment: process.env.NODE_ENV === 'production' ? 'normal' : 'local',
        category: 'errors', type: 'error', at: new Date().toISOString(), source: `Next.js ${context.routeType}`,
        code: safe.name.slice(0, 80), message: safe.message.slice(0, 1000), route: request.path.split('?')[0].slice(0, 300),
        ...(safe.digest ? { digest: safe.digest.slice(0, 80) } : {}) }), signal: AbortSignal.timeout(1500),
    });
  } catch { /* Keep the original application's error handling. */ }
};
