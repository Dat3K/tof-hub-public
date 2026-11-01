// Boss mechanic texts and names of every game culture, taken from the raw Localization/Game/<culture>/Game.json.
// The curated cards only carry EN/RU prose, so each curated mechanic is matched to the game string it was written
// from (same boss, closest wording) and the identical key is read in every other culture. Nothing is translated here:
// a mechanic without a confident match gets no entry and the site falls back to English.
const fs = require('node:fs');
const path = require('node:path');

const LOCALIZATION = 'Hotta/Content/Localization/Game';
const BASE_CULTURES = new Set(['en', 'ru']);

const plain = text => String(text ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');
const words = text => new Set(plain(text).toLowerCase().match(/[a-z0-9%.]+/g) ?? []);

function readGame(rawDir, culture) {
  const file = path.join(rawDir, LOCALIZATION, culture, 'Game.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : null;
}

/** Cultures present in the raw export, except the two the cards already carry. */
function exportedCultures(rawDir) {
  const root = path.join(rawDir, LOCALIZATION);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, {withFileTypes: true}).filter(entry => entry.isDirectory() && !BASE_CULTURES.has(entry.name)
    && fs.existsSync(path.join(root, entry.name, 'Game.json'))).map(entry => entry.name).sort();
}

function bossCandidates(english) {
  const byBoss = new Map();
  for (const [namespace, table] of Object.entries(english)) {
    if (!table || typeof table !== 'object') continue;
    for (const [key, value] of Object.entries(table)) {
      const match = /^(boss_[a-z0-9_]+?)_(\d+)_des$/i.exec(key);
      if (!match || typeof value !== 'string' || plain(value).toLowerCase() === 'none') continue;
      const boss = match[1].toLowerCase();
      if (!byBoss.has(boss)) byBoss.set(boss, []);
      byBoss.get(boss).push({namespace, key, number: Number(match[2]), words: words(value)});
    }
  }
  return byBoss;
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'is', 'are', 'will', 'its', 'it', 'by', 'for', 'with', 'as', 'at', 'or', 'be', 'that', 'this', 'all', 'his', 'her', 'their']);
const contentWords = (text, ignore) => new Set([...words(text)].filter(word => !STOP.has(word) && !ignore.has(word) && word.length > 1));

/**
 * Best game string for a curated mechanic. Strict pass: the game wording is almost entirely inside the curated text.
 * Second pass for texts that name the boss differently ("Xing Tian" / "Xingtian"): Jaccard similarity of the content
 * words with the boss name left out. A mechanic without a confident match stays untranslated.
 */
function bestMatch(candidates, mechanicText, bossName = '') {
  const target = words(mechanicText);
  let best = null;
  for (const candidate of candidates) {
    if (!candidate.words.size) continue;
    let shared = 0;
    for (const word of candidate.words) if (target.has(word)) shared++;
    const gameCover = shared / candidate.words.size;
    const textCover = shared / Math.max(1, target.size);
    if (gameCover >= 0.8 && textCover >= 0.45 && (!best || gameCover + textCover > best.score)) best = {candidate, score: gameCover + textCover};
  }
  if (best) return best.candidate;
  const ignore = words(bossName);
  const left = contentWords(mechanicText, ignore);
  for (const candidate of candidates) {
    const right = new Set([...candidate.words].filter(word => !STOP.has(word) && !ignore.has(word) && word.length > 1));
    let shared = 0;
    for (const word of right) if (left.has(word)) shared++;
    const jaccard = shared / Math.max(1, left.size + right.size - shared);
    if (jaccard >= 0.4 && (!best || jaccard > best.score)) best = {candidate, score: jaccard};
  }
  return best?.candidate ?? null;
}

/** Boss number of an ID such as `boss_hum_064`, `Boss_017`, `boss_hum_64` (leading zeros ignored); null without one. */
const bossNumber = id => {
  const match = /^boss_(?:hum_)?0*(\d+)(?:_|$)/i.exec(String(id ?? ''));
  return match ? Number(match[1]) : null;
};

/**
 * In-game boss name for one culture. Same ST_actorname key as the card's `boss_id` (any casing) first; cards whose ID
 * spells the number differently (`boss_014` / `Boss_hum_014`, `boss_hum_64` / `boss_hum_064`) or names another
 * entry (`monster_row_number`) fall back to the keys of that boss number: the one whose English name is the card's
 * name (or ends with it, "Darkness: Iron Tomb"), else the bare `Boss_[hum_]<number>` key.
 */
function bossName(game, bossId, english, card = {}) {
  const table = game?.ST_actorname;
  if (!table || !bossId) return null;
  const read = key => key && typeof table[key] === 'string' ? plain(table[key]) || null : null;
  const exact = Object.keys(table).find(name => name.toLowerCase() === String(bossId).toLowerCase());
  const number = card.monster_row_number ?? bossNumber(bossId);
  if (number === null) return read(exact);
  const keys = Object.keys(table).filter(name => bossNumber(name) === number);
  const englishName = key => plain(english?.ST_actorname?.[key]).toLowerCase();
  const wanted = String(card.name ?? '').toLowerCase();
  const byName = wanted && (keys.find(key => englishName(key) === wanted) ?? keys.find(key => englishName(key).endsWith(`: ${wanted}`) || englishName(key).endsWith(`-${wanted}`)));
  const bare = keys.find(key => /^boss_(?:hum_)?0*\d+$/i.test(key));
  // The key that carries the card's own English name wins (boss 020: `Boss_hum_020_TFb06` "Sweetie", while `Boss_hum_020` is "Lucia").
  return read(byName) ?? read(exact) ?? read(bare);
}

/**
 * Mechanics the wording match missed (the curated text names the boss differently, e.g. "Xing Tian" / "Xingtian",
 * "Sphere" / "Formation Point Sphere") take the game string at the same position: curated index N is game key
 * `_<N + offset>_des` of the same text group. The offset is the one the matched mechanics of the card agree on; with no
 * match at all it is taken from the group only when it has exactly as many keys as the card has numbered mechanics.
 */
function positionalFallback(card, pool, matches) {
  const mechanics = card.mechanics ?? [];
  if (matches.every(Boolean)) return matches;
  const namespaces = new Map();
  for (const candidate of pool) namespaces.set(candidate.namespace, (namespaces.get(candidate.namespace) ?? 0) + 1);
  const offsets = new Map();
  matches.forEach((match, position) => {
    if (match) offsets.set(match.number - Number(mechanics[position].index), (offsets.get(match.number - Number(mechanics[position].index)) ?? 0) + 1);
  });
  let offset = [...offsets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const main = match => !matches.some(found => found && found.namespace !== match.namespace) || matches.some(found => found?.namespace === match.namespace);
  const group = pool.filter(main);
  if (offset === undefined) {
    const numbers = [...new Set(group.filter(candidate => candidate.namespace === [...namespaces.keys()][0]).map(candidate => candidate.number))].sort((a, b) => a - b);
    const numbered = mechanics.filter(mechanic => Number(mechanic.index) >= 1);
    if (numbers.length !== numbered.length) return matches;
    offset = numbers[0] - 1;
  }
  const used = new Set(matches.filter(Boolean).map(match => match.key));
  return matches.map((match, position) => {
    if (match) return match;
    const index = Number(mechanics[position].index);
    if (!(index >= 1)) return null;
    const pick = group.find(candidate => candidate.number === index + offset && !used.has(candidate.key));
    if (pick) used.add(pick.key);
    return pick ?? null;
  });
}

/** Adds `l10n: {<culture>: {name?, mechanics: [{index, html}]}}` to every card; returns match statistics. */
function localizeCards(cards, rawDir, overrides = {}) {
  const cultures = exportedCultures(rawDir);
  const english = readGame(rawDir, 'en');
  const stats = {cultures, mechanics: 0, matched: 0, cards: cards.length};
  if (!english || !cultures.length) return stats;
  const candidates = bossCandidates(english);
  // Cards whose ID spells the boss differently from the text keys (`boss_hum_64` vs `boss_hum_064_N_des`) join by number.
  const poolsByNumber = new Map();
  for (const [boss, list] of candidates) {
    const number = bossNumber(boss);
    if (number !== null) poolsByNumber.set(number, [...(poolsByNumber.get(number) ?? []), ...list]);
  }
  const games = Object.fromEntries(cultures.map(culture => [culture, readGame(rawDir, culture)]));
  for (const card of cards) {
    const pool = candidates.get(String(card.boss_id ?? '').toLowerCase())
      ?? poolsByNumber.get(card.monster_row_number ?? bossNumber(card.boss_id)) ?? [];
    // Locale exports are often partial. Refresh cultures present in this run, while keeping
    // previously generated translations for cultures the current patch did not include.
    const l10n = Object.fromEntries(Object.entries(card.l10n ?? {}).filter(([culture]) => !cultures.includes(culture)));
    for (const culture of cultures) {
      const name = bossName(games[culture], card.boss_id, english, card);
      if (name) l10n[culture] = {name, mechanics: []};
    }
    const matches = positionalFallback(card, pool, (card.mechanics ?? []).map(mechanic => bestMatch(pool, mechanic.html, card.name)));
    for (const [position, mechanic] of (card.mechanics ?? []).entries()) {
      stats.mechanics++;
      const match = matches[position];
      if (!match) {
        // Hand-added lines without a game string: curated translation, boss name of the same culture.
        const curated = overrides[card.slug]?.[mechanic.index];
        for (const culture of cultures) {
          if (!curated?.[culture]) continue;
          const text = curated[culture].replace('{name}', l10n[culture]?.name ?? card.name);
          const accent = /^<span class="fce-card__text-accent">/.test(mechanic.html);
          (l10n[culture] ??= {mechanics: []}).mechanics.push({index: mechanic.index, html: accent ? `<span class="fce-card__text-accent">${escapeHtml(text)}</span>` : escapeHtml(text)});
        }
        if (curated) stats.matched++;
        continue;
      }
      stats.matched++;
      for (const culture of cultures) {
        const value = games[culture]?.[match.namespace]?.[match.key];
        if (typeof value !== 'string' || !plain(value)) continue;
        (l10n[culture] ??= {mechanics: []}).mechanics.push({index: mechanic.index, html: escapeHtml(plain(value))});
      }
    }
    if (Object.keys(l10n).length) card.l10n = l10n;
  }
  return stats;
}

module.exports = {localizeCards, exportedCultures, plain, words, bestMatch, bossName};
