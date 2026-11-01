'use client';

import {RaidCurrentNamesRequestSchema, RaidCurrentNamesResponseSchema} from '@tof-hub/contracts';

type Result = ReturnType<typeof RaidCurrentNamesResponseSchema.parse>;
type Entry = Result['entries'][number];
type Cached = {until: number; entry: Entry | null};
const STORAGE = 'tof-raid-player-cache-v1';
const MAX_ENTRIES = 12000;
const cache = new Map<string, Cached>();
const flights = new Map<string, Promise<Result>>();
const queued: (() => void)[] = [];
let activeRequests = 0;
let restored = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

async function requestPlayers(identifiers: string[], uids: string[]) {
  // Leave admission capacity for the page's other API requests and participant hovers.
  if (activeRequests >= 4) await new Promise<void>(resolve => queued.push(resolve));
  else activeRequests++;
  try {
    const response = await fetch('/api/v1/ranking/player-names', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({identifiers, uids})});
    if (!response.ok) throw new Error('Player lookup failed');
    return RaidCurrentNamesResponseSchema.parse(await response.json());
  } finally {
    const next = queued.shift();
    if (next) next(); else activeRequests--;
  }
}

function restore() {
  if (restored || typeof window === 'undefined') return;
  restored = true;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    if (!Array.isArray(saved)) return;
    for (const item of saved.slice(-MAX_ENTRIES)) {
      if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
      const value = item[1] as Cached | undefined;
      if (!value || !Number.isFinite(value.until) || value.until <= Date.now() || value.until > Date.now() + 60000) continue;
      const parsed = RaidCurrentNamesResponseSchema.safeParse({available: true, entries: value.entry === null ? [] : [value.entry]});
      if (parsed.success && (!parsed.data.entries.length || item[0] === `role:${parsed.data.entries[0].identifier}` || item[0] === `uid:${parsed.data.entries[0].uid}`)) {
        const valueToCache = {until: value.until, entry: parsed.data.entries[0] ?? null};
        cache.set(item[0], valueToCache);
        if (valueToCache.entry?.uid) cache.set(`uid:${valueToCache.entry.uid}`, valueToCache);
      }
    }
  } catch { /* Browser storage is optional. */ }
}

function persist() {
  for (const [key, value] of cache) if (value.until <= Date.now()) cache.delete(key);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  // Positive UID keys are rebuilt from role records instead of storing duplicate profiles.
  const saved = [...cache].filter(([key, value]) => key.startsWith('role:') || value.entry === null);
  try { localStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Keep the in-memory cache. */ }
}

/** A shared browser cache for current names, UID search, hover and player details. */
export async function loadRaidPlayers(identifiers: string[], uids: string[] = []): Promise<Result> {
  restore();
  const request = RaidCurrentNamesRequestSchema.parse({identifiers: [...new Set(identifiers)], uids: [...new Set(uids)]});
  const wanted = [...request.identifiers.map(value => ({kind: 'role', value})), ...(request.uids ?? []).map(value => ({kind: 'uid', value}))];
  const entries = new Map<string, Entry>();
  const missing = wanted.filter(item => {
    const saved = cache.get(`${item.kind}:${item.value}`);
    if (!saved || saved.until <= Date.now()) return true;
    if (saved.entry) entries.set(saved.entry.identifier, saved.entry);
    return false;
  });
  if (!missing.length) return {available: true, entries: [...entries.values()]};
  const waiting = new Set<Promise<Result>>();
  const requested = missing.filter(item => {
    const pending = flights.get(`${item.kind}:${item.value}`);
    if (!pending) return true;
    waiting.add(pending);
    return false;
  });
  if (requested.length) {
    const pending = requestPlayers(requested.filter(item => item.kind === 'role').map(item => item.value), requested.filter(item => item.kind === 'uid').map(item => item.value)).then(result => {
      if (result.available) {
        for (const item of requested) cache.set(`${item.kind}:${item.value}`, {until: Date.now() + 15000, entry: null});
        for (const entry of result.entries) {
          const value = {until: Date.now() + (entry.uid ? 60000 : 15000), entry};
          cache.set(`role:${entry.identifier}`, value);
          if (entry.uid) cache.set(`uid:${entry.uid}`, value);
        }
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persist, 50);
      }
      return result;
    });
    for (const item of requested) flights.set(`${item.kind}:${item.value}`, pending);
    waiting.add(pending);
    void pending.finally(() => {
      for (const item of requested) flights.delete(`${item.kind}:${item.value}`);
    }).catch(() => {});
  }
  const results = await Promise.all(waiting);
  const identifiersWanted = new Set(request.identifiers), uidsWanted = new Set(request.uids);
  for (const result of results) for (const entry of result.entries) {
    if (identifiersWanted.has(entry.identifier) || entry.uid && uidsWanted.has(entry.uid)) entries.set(entry.identifier, entry);
  }
  return {available: results.every(result => result.available), entries: [...entries.values()]};
}
