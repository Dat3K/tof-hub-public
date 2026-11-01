import { sanitizeErrorMessage, type NotificationEvent } from '@tof-hub/contracts';
import type { StoredJob } from '../queue/job-queue.store';

const ACTIONS = { 'wish-import': 'Wish history upload', 'players-import': 'Players upload',
  'build-import': 'Build upload', 'build-profile': 'Save build profile' };

const METRIC_LABELS = { visual: 'Visual', dataTrust: 'Data trust', usability: 'Usability', usefulness: 'Usefulness', aiTrace: 'AI visibility' };
const QUALITY = ['visual', 'dataTrust', 'usability', 'usefulness'] as const;
const NOTE_LABELS = { idea: '💡 Idea', data: '📊 Data', interface: '🖥 Interface', translation: '🌐 Translation', other: '📝 Other' };
const SOURCE_LABELS = { footer: 'footer link', prompt: 'invitation', direct: 'direct link' };
const DEVICE_LABELS = { desktop: '🖥 Desktop', mobile: '📱 Mobile', tablet: '📱 Tablet', unknown: '❔ Unknown device' };
const PART_LIMIT = 3800;

/** Visitor text is escaped before it enters Telegram HTML; only this formatter produces tags. */
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Telegram limits the text left after entity parsing. */
const visibleLength = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot);/g, '_').length;
const siteUrl = () => { const value = process.env.SITE_URL ?? ''; return /^https:\/\/[^/?#]+$/.test(value) ? value : null; };
const link = (path: string, label: string) => { const site = siteUrl(); return site ? `<a href="${escape(site + path)}">${label}</a>` : label; };

function flag(country: string) { return String.fromCodePoint(...Array.from(country, char => 0x1f1a5 + char.charCodeAt(0))); }
function countryName(country: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country; } catch { return country; }
}
function when(at: string) {
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(at))} UTC`;
}
/** Split on code points so a part never ends inside a surrogate pair. */
function pieces(text: string, size: number) {
  const chars = Array.from(text), parts: string[] = [];
  for (let offset = 0; offset < chars.length; offset += size) parts.push(chars.slice(offset, offset + size).join(''));
  return parts;
}

/** Telegram HTML message parts. Each block is self-contained, so a part boundary never splits a tag. */
export function feedbackNotificationTexts(event: NotificationEvent): string[] {
  if (event.type !== 'feedback.submitted' || !event.feedback) throw new Error('Missing feedback');
  const value = event.feedback, client = value.client, origin = event.feedbackOrigin;
  const answered = QUALITY.map(metric => value.ratings[metric]).filter((score): score is number => score !== null);
  const average = answered.length ? answered.reduce((sum, score) => sum + score, 0) / answered.length : null;
  const mood = average === null ? '💬' : average >= 8 ? '🟢' : average >= 5 ? '🟡' : '🔴';
  const prefix = event.environment === 'local' ? '[LOCAL] ' : '';
  const title = `${prefix}${mood} <b>New site review</b>${average === null ? '' : ` · avg <b>${Number(average.toFixed(1))}</b>/10`}`;

  const player = client.player
    ? `👤 <b>${escape(client.player.nickname ?? 'Unknown nickname')}</b> · <code>${client.player.uid}</code> · ${link(`/tools/ranking/?q=${client.player.uid}`, 'ranking')}`
      + '\n<i>character remembered in this browser, unverified</i>'
    : '👤 <i>No character linked in this browser</i>';
  const place = [origin?.country ? `${flag(origin.country)} ${escape(countryName(origin.country))}` : 'Unknown country',
    ...(client.timeZone ? [escape(client.timeZone)] : [])].join(' · ');
  const device = [DEVICE_LABELS[origin?.device ?? 'unknown'], origin?.os, origin?.browser, client.screen?.replace('x', '×')]
    .filter(Boolean).map(part => escape(part!)).join(' · ');
  const bar = (score: number | null) => score === null ? '··········  skipped' : `${'█'.repeat(score)}${'░'.repeat(10 - score)} ${String(score).padStart(2)}`;
  const scores = [...QUALITY.map(metric => `${METRIC_LABELS[metric].padEnd(13)} ${bar(value.ratings[metric])}`),
    `${METRIC_LABELS.aiTrace.padEnd(13)} ${bar(value.ratings.aiTrace)}`, '10 = AI is very noticeable'].join('\n');

  const blocks = [
    `${title}\n<i>${when(event.at)} · ${escape(value.locale.toUpperCase())} · via ${SOURCE_LABELS[value.source]}</i>`,
    [player, `🌍 ${place}`, device].join('\n'),
    `<pre>${escape(scores)}</pre>`,
    ...(value.aiComment ? pieces(value.aiComment, 3000).map((piece, index) =>
      `🤖 <b>About AI</b>${index ? ' (cont.)' : ''}\n<blockquote>${escape(piece)}</blockquote>`) : []),
    ...value.notes.flatMap((note, index) => pieces(note.message, 3000).map((piece, part) =>
      `${NOTE_LABELS[note.category]} · ${note.page ? link(note.page, `<code>${escape(note.page)}</code>`) : '<i>whole site</i>'}`
      + `${value.notes.length > 1 ? ` · ${index + 1}/${value.notes.length}` : ''}${part ? ' (cont.)' : ''}`
      + `\n<blockquote expandable>${escape(piece)}</blockquote>`)),
    `<code>${event.id}</code>${event.release ? ` · release <code>${escape(event.release)}</code>` : ''}`,
  ];
  const parts: string[][] = [[]];
  for (const block of blocks) {
    const current = parts.at(-1)!;
    if (current.length && visibleLength([...current, block].join('\n\n')) > PART_LIMIT) parts.push([block]);
    else current.push(block);
  }
  if (parts.length === 1) return [parts[0]!.join('\n\n')];
  return parts.map((part, index) => (index
    ? [`${prefix}${mood} <b>Site review</b> · part ${index + 1}/${parts.length}`, ...part]
    : [`${part[0]} · <i>part 1/${parts.length}</i>`, ...part.slice(1)]).join('\n\n'));
}

export function notificationText(event: NotificationEvent): string {
  const prefix = event.environment === 'local' ? '[LOCAL] ' : '';
  const lines = event.type.startsWith('queue.')
    ? [`${prefix}${ACTIONS[event.action!]} · #${event.seq}`, `Status: ${event.state ?? 'queued'}`]
    : [`${prefix}${event.category === 'validation' ? 'Validation failure' : 'Error'} · ${event.source ?? 'API'}`];
  if (event.requester) lines.push(`Requester: ${event.requester}`);
  if (event.type === 'error' && event.action) lines.push(`Action: ${ACTIONS[event.action]} · #${event.seq}`);
  if (event.bytes !== undefined) lines.push(`Upload size: ${(event.bytes / 1024).toFixed(1)} KiB`);
  if (event.identity) lines.push(`Player: ${event.identity.nickname ?? 'Unknown'}${event.identity.uid ? ` · UID ${event.identity.uid}` : ''}`);
  if (event.counts) for (const [name, count] of Object.entries(event.counts)) lines.push(`${name}: ${count}`);
  if (event.durationMs !== undefined) lines.push(`Duration: ${(event.durationMs / 1000).toFixed(1)} s`);
  if (event.route) lines.push(`Route: ${event.route}`);
  if (event.code) lines.push(`Code: ${event.code}`);
  if (event.message) lines.push(`Details: ${event.message}`);
  if (event.digest) lines.push(`Digest: ${event.digest}`);
  lines.push(`Time: ${event.at}`, `Event: ${event.jobId ?? event.id}`);
  return sanitizeErrorMessage(lines.join('\n')).slice(0, 3900);
}

/** Inspect only the handler's compact result; never parse a sealed upload to identify a queued user. */
export function queueResultSummary(job: StoredJob, result: unknown): Pick<NotificationEvent, 'identity' | 'counts'> {
  const value = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const identity: NonNullable<NotificationEvent['identity']> = {};
  if (typeof value.uid === 'string' && /^\d{6,24}$/.test(value.uid)) identity.uid = value.uid;
  if (typeof value.collectorUid === 'string' && /^\d{6,24}$/.test(value.collectorUid)) identity.uid = value.collectorUid;
  const nickname = value.name ?? value.nickname;
  if (typeof nickname === 'string') identity.nickname = nickname.slice(0, 64);
  const counts: NonNullable<NotificationEvent['counts']> = {};
  for (const key of ['total', 'stored', 'duplicates', 'rejected', 'inserted', 'unresolved', 'gear', 'observed'] as const) {
    if (typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0) counts[key] = value[key];
  }
  if (typeof value.files === 'number') counts.total = value.files;
  if (Array.isArray(value.players) && counts.total === undefined) counts.total = value.players.length;
  return { ...(Object.keys(identity).length ? { identity } : {}), ...(Object.keys(counts).length ? { counts } : {}) };
}
