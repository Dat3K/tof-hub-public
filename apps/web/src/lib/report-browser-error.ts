import { sanitizeError } from '@tof-hub/contracts';

const reported = new Map<string, number>();
/** Best-effort public crash reports; no stack, query parameters, cookies or application state. */
export function reportBrowserError(source: 'boundary' | 'window' | 'promise', error: unknown) {
  if (typeof window === 'undefined') return;
  const safe = sanitizeError(error);
  const translated=document.documentElement.classList.contains('translated-ltr')||document.documentElement.classList.contains('translated-rtl');
  const body = { source, name: safe.name.slice(0, 80), message: (safe.message.slice(0, 460)+(translated?' [page translation active]':'')).slice(0,500),
    route: window.location.pathname.slice(0, 300), ...(safe.digest ? { digest: safe.digest.slice(0, 80) } : {}) };
  const key = JSON.stringify(body), now = Date.now();
  for (const [id, until] of reported) if (until < now) reported.delete(id);
  if (reported.has(key) || reported.size >= 100) return;
  reported.set(key, now + 60_000);
  void fetch('/api/v1/notifications/browser', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), keepalive: true }).catch(() => { /* Telemetry failure must not produce another error. */ });
}
