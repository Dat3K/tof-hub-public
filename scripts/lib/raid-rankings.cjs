'use strict';
const assert = require('node:assert/strict');

/** DT_Title.ConditionText projected by the existing cosmetics pipeline; never infer a season from a title ID. */
function raidTitleRewards(en, ru, styles = {}) {
  const translated = new Map((ru.titles ?? []).map(title => [title.id, title]));
  const seasons = new Map();
  for (const title of en.titles ?? []) {
    // DA_Title -> DT_TitleCategory.Rows.2, raid group Title_1_8_0 (the Global title family).
    // The combined cosmetics catalog also contains Balance's 0_8_0 titles with a different season sequence.
    if (!title.id.startsWith('Title_1_8_0_')) continue;
    const description = (title.description ?? '').trim();
    if (!/^Rank\b.*\bLimited-Time Raid\b/.test(description)) continue;
    const match = /^Rank (?:Top (\d+)|(\d+)[–-](\d+)) in (?:Phase (\d+) of )?the Limited-Time Raid at the results tally\.$/.exec(description);
    assert.ok(match, `Unrecognized raid title condition: ${title.id}: ${description}`);
    // The unnumbered first phase is confirmed by the owner's S1 title screenshot.
    const season = match[4] ? Number(match[4]) : 1;
    const minRank = match[1] ? 1 : Number(match[2]);
    const maxRank = Number(match[1] || match[3]);
    assert.ok(season > 0 && minRank > 0 && maxRank >= minRank, `Invalid raid title range: ${title.id}`);
    assert.ok(title.name?.trim(), `Missing raid title name: ${title.id}`);
    const localized = translated.get(title.id);
    if (!seasons.has(season)) seasons.set(season, []);
    seasons.get(season).push({id: title.id, minRank, maxRank,
      name: {en: title.name.trim(), ru: localized?.name?.trim() || null},
      description: {en: description, ru: localized?.description?.trim() || null},
      color: styles[title.id.replace(/^Title_/, '')]?.color ?? null});
  }
  return [...seasons].sort(([a], [b]) => a - b).map(([season, titles]) => ({seasonId: `S${season}`,
    titles: titles.sort((a, b) => a.minRank - b.minRank || a.id.localeCompare(b.id))}));
}
/** Community notation only; this establishes no unit for future game packet fields. */
function historicalDuration(raw) {
  const match = /^(\d+):([0-5]\d):(\d{2})$/.exec(raw);
  assert.ok(match, `Invalid historical raid duration: ${raw}`);
  return {raw, milliseconds: (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(match[3]) * 10};
}

function buildRaidRankings(history, raids, sha256) {
  assert.equal(history.timeNotation, 'M:SS:CC');
  const seasons = history.seasons.map(season => {
    // A documented name association, not a client foreign key or site Event-number join.
    const needle = season.bossLabel.toLowerCase();
    const candidates = raids.filter(raid => raid.bosses.some(boss => boss.name?.en?.toLowerCase().includes(needle)));
    return {id: season.id, label: season.id, bossLabel: season.bossLabel,
      raidId: candidates.length === 1 ? candidates[0].id : null,
      raidJoin: candidates.length === 1 ? 'unique-boss-name' : 'unresolved'};
  });
  const boards = history.regions.flatMap(region => {
    assert.equal(region.first.length, seasons.length, `Missing historical times for ${region.region}`);
    return seasons.map((season, index) => ({
      id: `${history.source.id}:${season.id}:${region.region}`, seasonId: season.id, sourceId: history.source.id,
      scope: {kind: 'region', region: region.region, serverId: null, serverName: null},
      coverage: 'summary', capturedAt: null,
      entries: [{id: `${season.id}:${region.region}:1`, rank: 1, duration: historicalDuration(region.first[index]), recordedAt: null, members: null}],
    }));
  });
  return {schemaVersion: 1, sources: [{...history.source, sha256}], seasons, boards};
}

module.exports = {buildRaidRankings, historicalDuration, raidTitleRewards};

function addRaidCapture(dataset, input, raids) {
  const matches = input.bossLabel ? raids.filter(raid => raid.bosses.some(boss => boss.name?.en?.toLowerCase().includes(input.bossLabel.toLowerCase()))) : [];
  dataset.sources.push(input.source);
  if (!dataset.seasons.some(season => season.id === input.seasonId)) dataset.seasons.push({id: input.seasonId, label: input.seasonId, bossLabel: input.bossLabel, raidId: matches.length === 1 ? matches[0].id : null, raidJoin: matches.length === 1 ? 'unique-boss-name' : 'unresolved'});
  dataset.boards.push({id: input.source.id, seasonId: input.seasonId, sourceId: input.source.id,
    scope: {kind: 'region', region: input.region, ...(input.subregion ? {subregion: input.subregion} : {}), serverId: null, serverName: null},
    coverage: 'partial', capturedAt: input.source.observedAt, raw: {...input.response.raw, rankKey: input.response.rankKey, server: input.response.server},
    entries: input.response.entries.map(entry => {
      const props = entry.properties, ticks = BigInt(props.RacingUseTimeTrue);
      assert.ok(ticks >= 0n && ticks <= BigInt(Number.MAX_SAFE_INTEGER) * 10000n);
      const ms = Number(ticks / 10000n), cs = Math.floor(ms / 10) % 100;
      const raw = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
      return {id: `${input.source.id}:${entry.index}`, rank: entry.index + 1, duration: {raw, milliseconds: ms, exactTicks: ticks.toString()},
        recordedAt: new Date(Number((BigInt(props.LevyCloneRacingDateTrue) - 621355968000000000n) / 10000n)).toISOString().replace(/Z$/, ''),
        members: props.PlayerListSerialize.split('|').map(value => {
          const a = value.indexOf(','), c = value.indexOf(',', a + 1);
          assert.ok(a > 0 && c > a, 'participant tuple');
          return {identifier: value.slice(0, a), identifierEvidence: 'packet', nickname: value.slice(c + 1), resonance: {label: value.slice(a + 1, c), raw: value.slice(a + 1, c), icon: null}};
        }), raw: {index: entry.index, key: entry.key, offset: entry.offset, ...props}};
    })});
  return dataset;
}
module.exports.addRaidCapture = addRaidCapture;

/** Reviewed season associations only; never derive a raid from a reused numeric rank key. */
function applyRaidSeasonBindings(dataset, observations, raids) {
  assert.equal(observations.schemaVersion, 1);
  const seen = new Set();
  for (const binding of observations.bindings) {
    assert.ok(!seen.has(binding.seasonId), 'Duplicate season-to-raid association');
    seen.add(binding.seasonId);
    assert.ok(['recorded-window', 'owner-confirmation'].includes(binding.evidence?.method), 'Missing season association evidence');
    const season = dataset.seasons.find(item => item.id === binding.seasonId);
    const raid = raids.find(item => item.id === binding.raidId);
    if (!season || !raid) continue;
    assert.ok(!season.raidId || season.raidId === raid.id, 'Conflicting season-to-raid association');
    season.raidId = raid.id;
    season.raidJoin = 'documented-season';
  }
  return dataset;
}
module.exports.applyRaidSeasonBindings = applyRaidSeasonBindings;

/** Curated OCR observations. Name matching is an explicitly authorized offline migration, never a generator behavior. */
function addRaidScreenshot(dataset, input) {
  assert.equal(input.source.method, 'ocr');
  assert.equal(input.source.kind, 'community');
  assert.ok(dataset.seasons.some(season => season.id === input.seasonId), 'Screenshot season must have verified metadata');
  dataset.sources.push(input.source);
  dataset.boards.push({id: input.source.id, seasonId: input.seasonId, sourceId: input.source.id,
    scope: {kind: 'region', region: input.region, serverId: null, serverName: null}, coverage: 'partial', capturedAt: null,
    raw: {image: input.image.file, imageSha256: input.image.sha256, imageWidth: input.image.width, imageHeight: input.image.height, method: 'ocr',
      identityAuthorization: input.identityAuthorization ?? '', identitySources: JSON.stringify(input.identitySources ?? {})},
    entries: input.entries.map(entry => ({id: `${input.source.id}:${entry.rank}`, rank: entry.rank,
      duration: entry.duration ? historicalDuration(entry.duration) : {raw: '—', milliseconds: null}, recordedAt: entry.recordedAt ?? null,
      members: entry.members.map(member => {
        if (member.identifier) {
          assert.ok(input.identityAuthorization, 'Name-based identity assignment requires one-time authorization');
          assert.ok(['exact-name-once', 'normalized-name-once', 'owner-confirmed'].includes(member.identityEvidence?.method));
          assert.equal(member.identityEvidence?.nickname, member.nickname);
          assert.equal(member.identityEvidence?.region, input.region);
          assert.equal(member.identityEvidence?.identifier, member.identifier);
          if (member.identityEvidence.method === 'owner-confirmed') {
            assert.match(member.identityEvidence.confirmation?.uid ?? '', /^[1-9]\d*$/);
            assert.match(member.identityEvidence.confirmation?.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
            assert.ok(member.identityEvidence.confirmation?.statement, 'Ambiguous identities need explicit owner disambiguation');
          }
          if (member.identityEvidence.method === 'normalized-name-once') {
            const {normalizeSearchText} = require('../../packages/contracts/src/search-text.ts');
            assert.equal(member.identityEvidence.normalizedNickname, normalizeSearchText(member.nickname ?? ''));
            assert.ok(member.identityEvidence.matchedNames?.length && member.identityEvidence.matchedNames.every(name => normalizeSearchText(name) === member.identityEvidence.normalizedNickname));
          }
        }
        const nicknameStatus = member.nicknameStatus ?? (member.nickname == null ? 'unreadable' : member.nickname === '' ? 'blank' : undefined);
        return {nickname: member.nickname ?? '', ...(nicknameStatus ? {nicknameStatus} : {}),
          ...(!member.identifier && nicknameStatus ? {observationId: `${input.source.id}:${entry.rank}:${member.slot ?? entry.members.indexOf(member)}`} : {}),
          ...(member.identifier ? {identifier: member.identifier, identifierEvidence: member.identityEvidence.method} : {}),
          resonance: member.resonance == null ? null : {label: member.resonance, raw: null, icon: null}};
      }), raw: {image: input.image.file, imageSha256: input.image.sha256,
        bbox: JSON.stringify(entry.bbox), ocrTime: entry.ocrTime ?? '', ocrDate: entry.ocrDate ?? '',
        unrecognizedNames: entry.members.filter(member => member.nickname == null).length,
        blankNames: entry.members.filter(member => member.nicknameStatus === 'blank' || member.nickname === '').length,
        members: JSON.stringify(entry.members)},
    }))});
  return dataset;
}
module.exports.addRaidScreenshot = addRaidScreenshot;
