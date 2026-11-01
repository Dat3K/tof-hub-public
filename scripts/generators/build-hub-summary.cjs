// Section hubs (/info/, /datamine/, /tools/): one slim summary of the generated datasets so the hub
// cards show live counts and real previews instead of hand-written samples.
// Reads generated output under game-data and the exporter media manifest; it does not touch the raw export.
// `--check` fails when the committed file differs from a fresh run.
const sitePaths = require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createMatrixTraitIconResolver} = require('../lib/matrix-trait-icon.cjs');
const {buildWithLocaleViews} = require('../lib/locale-projection.cjs');

const gameData = path.join(sitePaths.publicDir, 'game-data');
const outFile = path.join(gameData, 'hub-summary.json');
const check = process.argv.includes('--check');

// Built once for en/ru and once per merged culture view (scripts/lib/locale-projection.cjs); provenance
// hashes come from the canonical files, so the pipeline output and `--check` are the same computation.
function buildSummary(reader) {
const sources = {};
function load(key, relative) {
  const {bytes, value} = reader(relative);
  if (bytes) sources[key] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  return value ?? JSON.parse(bytes);
}
const read = (name) => load('game-data/' + name, name);
const readPublic = (name) => load('public/' + name, path.relative(gameData, path.join(sitePaths.publicDir, name)));

const localized = (en, ru) => ({en: en ?? null, ru: ru ?? en ?? null});
// Plain-text preview of a game rich-text fragment (FCE mechanics are stored as escaped HTML).
const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#x27': "'", '#39': "'", nbsp: ' '};
const plainText = (html) => String(html ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/&(#x27|#39|amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ENTITIES[entity])
  .replace(/\s+/g, ' ')
  .trim();
// Evenly spaced samples including both ends.
function sample(list, count) {
  if (list.length <= count) return list;
  return Array.from({length: count}, (_, index) => list[Math.round((index * (list.length - 1)) / (count - 1))]);
}

// ---------- Info ----------
const simulacra = {en: read('en/simulacra.json'), ru: read('ru/simulacra.json')};
const mediaManifest = readPublic('game-assets/media-manifest.json');
const banners = read('wish-banners.json');
const matrices = read('en/matrices.json');
const matricesRu = read('ru/matrices.json');
const relics = read('en/relics.json');
const pets = read('en/pets.json');
const food = read('en/food.json');
const cosmetics = read('en/cosmetics.json');
const arts = read('en/arts.json');

// Release order mirrors the Info Simulacra catalog sort (apps/web/src/features/info-sections/common/
// catalog-release-order.ts compareSimulacraRelease): MMO season first, then matrix suit number, then imitation id.
// Banner dates are not shown: wish-banners.json carries the CN schedule.
function releaseSeason(item) {
  if (typeof item.season === 'number' && item.season > 0) return item.season;
  const value = parseInt(String(item.season || item.season_badge || item.season_tag || '').replace(/\D+/g, ''), 10);
  return Number.isNaN(value) ? 1 : value;
}
const suitNumber = (item) => (typeof item.matrix_suit_num === 'number' ? item.matrix_suit_num
  : parseInt(String(item.matrix_suit_id || '').replace(/\D/g, ''), 10) || 0);
const imitationNumber = (item) => parseInt(String(item.imitation_id || item.id).match(/\d+/)?.[0] || '0', 10);
const newestFirst = (mmo) => (a, b) => ((mmo ? releaseSeason(b) - releaseSeason(a) : 0)
  || suitNumber(b) - suitNumber(a) || imitationNumber(b) - imitationNumber(a)) || b.id.localeCompare(a.id);

const ruSimulacra = {gacha: new Map(simulacra.ru.gacha.map((item) => [item.slug, item])), mmo: new Map(simulacra.ru.mmo.map((item) => [item.slug, item]))};
const resolveMatrixTraitIcon = createMatrixTraitIconResolver(mediaManifest.assets);
function matrixTraitIcon(item) {
  const exportedPath = resolveMatrixTraitIcon(item);
  return exportedPath ? `/game-assets/webp/${exportedPath}` : null;
}

// Two latest SSR releases plus the latest Altered simulacrum. When the latest Altered one is already among
// the two, it keeps its place and the third slot takes the next release, so three different simulacra show.
function simulacraSlots(mode) {
  const released = simulacra.en[mode].filter((item) => item.rarity === 'SSR').sort(newestFirst(mode === 'mmo'));
  const picked = released.slice(0, 2).map((item, index) => ({item, slot: index === 0 ? 'latest' : 'previous'}));
  const altered = released.find((item) => item.element === 'Altered');
  if (altered && !picked.some(({item}) => item === altered)) picked.push({item: altered, slot: 'altered'});
  else if (released[2]) picked.push({item: released[2], slot: 'earlier'});
  return picked.map(({item, slot}) => {
    const ru = ruSimulacra[mode].get(item.slug);
    return {
      slot,
      slug: item.slug,
      name: localized(item.name, ru?.name),
      weapon: localized(item.weapon_name, ru?.weapon_name),
      element: item.element,
      elementSecondary: item.element_secondary ?? null,
      elementIcon: item.element_combo_icon ?? null,
      role: item.role ?? null,
      roleIcon: item.role_icon ?? null,
      avatar: item.avatar_thumb || item.avatar || null,
      // Transparent detail art (Info Simulacra profile), drawn behind the featured hub card.
      portrait: item.portrait_thumb || item.portrait || null,
      season: mode === 'mmo' ? releaseSeason(item) : null,
      matrixSuitId: item.matrix_suit_id ?? null,
    };
  });
}
const slots = {gacha: simulacraSlots('gacha'), mmo: simulacraSlots('mmo')};

const strip = (list, pick) => list.map((item) => ({id: item.id, name: localized(item.name_en ?? item.name, item.name_ru), image: pick(item)}))
  .filter((entry) => entry.image);
const countBy = (list, key) => list.reduce((counts, item) => ({...counts, [key(item)]: (counts[key(item)] ?? 0) + 1}), {});

// Every SSR matrix set, newest suit number first: the hub shows the two latest and two random ones.
const ruMatrices = new Map(matricesRu.items.map((item) => [item.id, item]));
const matrixSets = matrices.items.filter((item) => item.quality === 'SSR' && (item.icon_thumb || item.icon))
  .sort((a, b) => suitNumber({matrix_suit_id: b.id}) - suitNumber({matrix_suit_id: a.id}))
  .map((item) => ({id: item.id, name: localized(item.name, ruMatrices.get(item.id)?.name), image: item.icon_thumb || item.icon}));

const gachaRelics = relics.items.filter((item) => item.server_mode === 'gacha');
const relicQuality = countBy(gachaRelics, (item) => item.quality);
const petCategory = countBy(pets.items, (item) => item.category);
const latestArtSeason = Math.max(...arts.items.map((item) => Number(item.season) || 0));

const info = {
  counts: {
    simulacra: simulacra.en.gacha.length,
    simulacraMmo: simulacra.en.mmo.length,
    matrices: matrices.items.length,
    relics: gachaRelics.length,
    pets: pets.items.length,
    food: food.items.length,
    cosmetics: cosmetics.counts?.total ?? cosmetics.items.length,
    arts: arts.items.length,
  },
  simulacra: slots,
  matrices: {
    facts: [{key: 'sets', value: matrices.items.length}],
    strip: matrixSets,
  },
  relics: {
    facts: [{key: 'ssr', value: relicQuality.SSR ?? 0}, {key: 'sr', value: relicQuality.SR ?? 0}],
    strip: strip(gachaRelics.filter((item) => item.quality === 'SSR').slice(-4), (item) => item.item_icon_thumb || item.item_icon),
  },
  pets: {
    facts: [{key: 'combat', value: petCategory.combat ?? 0}, {key: 'cute', value: petCategory.cute ?? 0}],
    strip: strip(pets.items.filter((item) => item.category === 'combat').slice(-4), (item) => item.icon_thumb || item.icon),
  },
  food: {
    facts: [
      {key: 'dishes', value: food.counts?.dishes ?? food.items.length},
      {key: 'ingredients', value: food.counts?.ingredients ?? 0},
      {key: 'potions', value: food.counts?.potions ?? 0},
    ],
    strip: strip(food.items.filter((item) => item.icon).slice(-4), (item) => item.icon),
  },
  cosmetics: {
    facts: ['outfits', 'mounts', 'titles'].map((key) => ({key, value: cosmetics.counts?.[key] ?? 0})),
    strip: strip(cosmetics.outfits.filter((item) => item.icon).slice(-4), (item) => item.icon),
  },
  arts: {
    facts: [{key: 'season', value: latestArtSeason}],
    strip: arts.items.filter((item) => Number(item.season) === latestArtSeason && item.thumbUrl).slice(0, 3)
      .map((item) => ({id: item.id, name: localized(item.title, item.title), image: item.thumbUrl})),
  },
};

// ---------- Datamine ----------
const oow = read('en/datamine/oow.json');
const cards = fs.existsSync(path.join(gameData, 'fce-cards.json')) ? read('fce-cards.json') : null;
const fce = cards ? {en: {bosses: cards.standard}, ru: {bosses: cards.standard.map(boss => ({...boss, name: boss.name_ru, mechanics: boss.ru_mechanics}))}} : {en: read('en/datamine/fce.json'), ru: read('ru/datamine/fce.json')};
const bygone = read('en/datamine/bygone.json');
const seq = read('en/datamine/seq.json');
const multype = read('en/datamine/multype.json');
const items = read('en/datamine/items.json');

// Final floor of a season file (game-data/en/oow/seasons/s23.json, mmo_s04.json): its effectiveHp is the
// whole floor (all mobs), as the OOW floor table shows it.
function finalFloor(mode, number) {
  const name = `en/oow/seasons/${mode === 'mmo' ? 'mmo_' : ''}s${String(number).padStart(2, '0')}.json`;
  if (!fs.existsSync(path.join(gameData, name))) return null;
  const floors = read(name).floors ?? [];
  return floors.reduce((last, floor) => (!last || floor.floor > last.floor ? floor : last), null);
}

// Season boss as the OOW page shows it in its season rail (bossName / bossImage).
const season = (mode) => (entry) => ({
  season: entry.season,
  startDate: entry.startDate,
  endDate: entry.endDate,
  floorCount: entry.floorCount ?? null,
  boss: entry.bossName
    ? {name: localized(entry.bossName, entry.bossNameRu), image: entry.bossImage || entry.bossImageThumb || null}
    : null,
  // Raw HP values; the hub formats them like the OOW page (formatHpValue, G).
  finalBossHp: entry.finalBossHp ?? null,
  finalBossEffectiveHp: entry.finalBossEffectiveHp ?? null,
  finalFloor: (() => {
    const floor = finalFloor(mode, entry.season);
    return floor ? {floor: floor.floor, effectiveHp: floor.effectiveHp ?? null} : null;
  })(),
});
// `displayNumber` mirrors the OOW page (oow-view displaySeasonNumber): MMO seasons are numbered by their place in
// the season list (S1, S2, …) because the file numbers skip (mmo_s01, mmo_s03, …); Gacha keeps the season number.
const oowMode = (mode, recent) => {
  const sorted = [...recent].sort((a, b) => a.season - b.season);
  return {
    total: recent.length,
    seasons: sorted.map((entry, index) => ({entry, displayNumber: mode === 'mmo' ? index + 1 : entry.season})).slice(-6)
      .map(({entry, displayNumber}) => ({...season(mode)(entry), displayNumber})),
  };
};

// Game text of the other cultures (card.l10n from build-fce-cards) next to the en/ru pair; absent cultures fall back to en.
const withCultures = (value, boss, pick) => {
  for (const [culture, entry] of Object.entries(boss.l10n ?? {})) {
    const text = pick(entry);
    if (text) value[culture] = text;
  }
  return value;
};

const ruBosses = new Map(fce.ru.bosses.map((boss) => [boss.slug, boss]));
const bosses = fce.en.bosses.slice().sort((a, b) => a.order - b.order).map((boss) => {
  const ru = ruBosses.get(boss.slug);
  return {
    slug: boss.slug,
    nameColor: boss.name_color || null,
    name: withCultures(localized(boss.name, ru?.name ?? boss.name_ru), boss, (entry) => entry?.name),
    image: boss.cardThumbnail || boss.preview || boss.art,
    ladderLevel: boss.ladder_level ?? null,
    mechanicsCount: boss.mechanics?.length ?? 0,
    mechanic: withCultures(localized(plainText(boss.mechanics?.[0]?.html), plainText(ru?.mechanics?.[0]?.html)), boss, (entry) => {
      const first = boss.mechanics?.[0]?.index;
      const html = entry?.mechanics?.find((item) => item.index === first)?.html;
      return html ? plainText(html) : null;
    }),
  };
});

const uniqueFloors = bygone.floors.filter((floor) => !floor.is_duplicate);
const curvePoint = (x, y) => [x, Math.round(y)];
const seqStages = seq.stages.slice().sort((a, b) => a.stage - b.stage);

let multypeBuffs = 0;
const moduleCounts = Object.entries(multype.mapping).map(([key, subs]) => {
  const count = Object.values(subs).reduce((sum, files) => sum + files.length, 0);
  multypeBuffs += count;
  return {key, label: multype.mainRenames?.[key] || null, count};
}).sort((a, b) => b.count - a.count);

// Weapon rows of the three latest Gacha simulacra (`<weapon_id>_trial_OS`): recognizable icons next to the
// internal id and original name. Untranslated rows repeat their id as the name, so that name is dropped.
const itemRows = Object.values(items);
const itemById = new Map(itemRows.map((row) => [row.id, row]));
const itemSample = simulacra.en.gacha.filter((item) => item.rarity === 'SSR').sort(newestFirst(false)).slice(0, 3)
  .map((item) => ({item, row: itemById.get(`${item.weapon_id}_trial_OS`)}))
  .filter(({row}) => row)
  .map(({item, row}) => {
    const name = row.rename || row.name;
    return {
      id: row.id,
      original: row.original || null,
      name: name && name !== row.id ? name : null,
      icon: row.icon || null,
      owner: {slug: item.slug, name: localized(item.name, ruSimulacra.gacha.get(item.slug)?.name)},
    };
  });


// ---------- Team raids (Original server): newest eight in ascending order, the card previews the last (latest) ----------
const teamRaids = fs.existsSync(path.join(gameData, 'handbook/team-raids.json')) ? read('handbook/team-raids.json') : null;
// The Challenge row repeats the raid name plus a difficulty word after a separator; when the Heroic row starts with
// the same segment that segment is the plain name.
const SEPARATOR = /\s*[-–—・:：]\s*/u;
const raidName = (heroic, challenge) => {
  const out = {};
  for (const culture of Object.keys(challenge ?? {})) {
    const full = String(challenge[culture] ?? '');
    const head = full.split(SEPARATOR)[0];
    const parts = full.split(SEPARATOR);
    const sameHead = heroic?.[culture] && String(heroic[culture]).split(SEPARATOR)[0] === head;
    out[culture] = head && head !== full && (sameHead || (parts.length === 2 && head.length >= 3)) ? head : full;
  }
  return out;
};
const plainLocalized = (values) => Object.fromEntries(Object.entries(values ?? {}).map(([culture, text]) => [culture, plainText(text)]));
const raidEntries = (teamRaids?.raids ?? []).map((raid) => {
  const challenge = raid.variants.find((variant) => variant.id.endsWith('_D_II')) ?? raid.variants[1] ?? raid.variants[0];
  const heroic = raid.variants.find((variant) => variant !== challenge);
  const first = challenge?.mechanics?.[0];
  return {
    id: raid.id,
    index: raid.index,
    name: raidName(heroic?.name, challenge?.name),
    image: challenge?.artwork?.thumbnail || challenge?.artwork?.title || null,
    mechanicsCount: challenge?.mechanics?.length ?? 0,
    mechanic: first ? plainLocalized(first.text) : null,
  };
}).sort((a, b) => b.index - a.index);

const datamine = {
  counts: {
    oow: oow.recentSeasons.length,
    fce: fce.en.bosses.length,
    bygone: uniqueFloors.length,
    seq: seqStages.length,
    multype: multypeBuffs,
    items: itemRows.length,
    raids: raidEntries.length,
  },
  oow: {gacha: oowMode('gacha', oow.recentSeasons), mmo: oowMode('mmo', oow.mmoRecentSeasons ?? [])},
  fce: {bosses},
  // Same metrics as the section charts: Bygone plots the HP buff stacks (shown as G = 1M stacks),
  // Sequential plots the boss MaxHealth.
  bygone: {curve: sample(uniqueFloors, 40).map((floor) => curvePoint(floor.floor, floor.hp_buff_stacks))},
  seq: {curve: seqStages.map((stage) => curvePoint(stage.stage, stage.maxHealth))},
  multype: {modules: moduleCounts.slice(0, 5)},
  items: {sample: itemSample},
  // The eight newest, oldest first, so the latest raid is the last chip.
  raids: {entries: raidEntries.slice(0, 8).reverse()},
};

// ---------- Tools ----------
const latestBanner = banners.filter((banner) => banner.banner_type === 'weapon_limited')
  .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
// Banner dates are left out: wish-banners.json carries the CN schedule, not the Global one.
const statIcons = read('build-stat-icons.json');
const gearIcons = read('build-gear-icons.json');
// '/game-assets/webp/Hotta/…/x.webp' -> 'Hotta/…/x' (the id form gameAsset resolves).
const assetId = (url) => (url ? url.replace(/^\/game-assets\/webp\//, '').replace(/\.webp$/, '') : null);
const iconStrip = (entries) => entries.filter((entry) => entry.image).map((entry) => ({...entry, name: localized(entry.name, entry.name)}));
const tools = {
  // Element icons: Ranking ranks gear for every element and element pair.
  ranking: {strip: iconStrip(['Flame', 'Frost', 'Volt', 'Physical', 'Altered']
    .map((id) => ({id, name: id, image: assetId(statIcons.elements?.[id]?.icon)})))},
  // Titan gear of all twelve slots in the Build card equipment order (the hub draws a miniature card).
  build: {strip: iconStrip(Object.keys(gearIcons.gear ?? {})
    .map((id) => ({id, name: id, image: assetId(gearIcons.gear[id]?.icons?.titan || gearIcons.gear[id]?.icons?.normal)})))},
  // Stats the Optimizer weighs: HP, ATK, Crit, Crit damage.
  optimizer: {strip: iconStrip(['MaxHealth', 'CommonAtkAdded', 'CritAdded', 'CritDam']
    .map((id) => ({id, name: id, image: assetId(statIcons.attributes?.[id]?.icon)})))},
  // Latest Gacha SSR simulacra for team compositions.
  comp: {strip: simulacra.en.gacha.filter((item) => item.rarity === 'SSR').sort(newestFirst(false)).slice(0, 5)
    .map((item) => ({
      id: item.slug,
      name: localized(item.name, ruSimulacra.gacha.get(item.slug)?.name),
      image: matrixTraitIcon(item) || item.avatar_thumb || item.avatar,
      // Weapon item icon for the weapons column of the Build card miniature.
      weaponIcon: item.icon_thumb || item.icon || null,
    }))
    .filter((entry) => entry.image)},
  wish: latestBanner ? {
    id: latestBanner.id,
    characterSlug: latestBanner.character_id,
    name: localized(latestBanner.name_en, latestBanner.name_ru),
    // Same banner media the Wish page uses (public paths, not game-asset ids).
    image: latestBanner.assets?.splash || null,
    background: latestBanner.assets?.background || null,
  } : null,
};

return {schemaVersion: 1, sources, info, datamine, tools};
}

const summary = buildWithLocaleViews(gameData, buildSummary);
const text = JSON.stringify(summary, null, 1) + '\n';
if (check) {
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (current !== text) {
    console.error('hub-summary.json is stale; run node scripts/generators/build-hub-summary.cjs');
    process.exit(1);
  }
  console.log('hub-summary.json is up to date');
} else {
  fs.writeFileSync(outFile, text);
  const describe = (list) => list.map((entry) => `${entry.slot}=${entry.slug}`).join(', ');
  console.log(`hub-summary.json: gacha ${describe(summary.info.simulacra.gacha)}; mmo ${describe(summary.info.simulacra.mmo)}; ${summary.datamine.fce.bosses.length} bosses`);
}
