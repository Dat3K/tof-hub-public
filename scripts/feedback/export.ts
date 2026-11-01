import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const key = process.env.FEEDBACK_ADMIN_KEY || process.env.ADMIN_KEY;
  if (!key || !/^[\x21-\x7e]{32,512}$/.test(key)) throw new Error('Set FEEDBACK_ADMIN_KEY (32–512 visible ASCII characters)');
  const origin = new URL(process.env.FEEDBACK_REPORT_ORIGIN || 'http://127.0.0.1:3001');
  if (origin.username || origin.password) throw new Error('The report origin must not contain credentials');
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))) {
    throw new Error('Feedback export requires HTTPS or a loopback HTTP address');
  }
  let cursor: string | null = null;
  let summary: Record<string, unknown> = {};
  const responses: unknown[] = [];
  do {
    const url = new URL('/api/v1/feedback/admin/', origin);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { headers: { 'x-admin-key': key }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Feedback export returned HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.responses)) throw new Error('Invalid feedback export');
    if (!cursor) { const { responses: _rows, nextCursor: _next, ...rest } = data; summary = rest; }
    responses.push(...data.responses);
    if (responses.length > 100_000) throw new Error('Export is too large; use the paginated administrative API');
    const next = typeof data.nextCursor === 'string' ? data.nextCursor : null;
    if (next && next === cursor) throw new Error('Export cursor did not advance');
    cursor = next;
  } while (cursor);
  const directory = path.resolve('ignore/feedback');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `feedback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), ...summary, responses }, null, 2), { flag: 'wx' });
  process.stdout.write(`Saved ${responses.length} responses to ${file}\n`);
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Feedback export failed'}\n`); process.exitCode = 1; });
