const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// FCE cards are pipeline output; the UI never selects a fixed MMO season roster.
const fs = require('node:fs');
const path = require('node:path');
const {rawDir, publicDir, legacyDir} = require('../lib/site-paths.cjs');
const baseline = require('../data/fce/cards.json');
const existingFile = path.join(publicDir, 'game-data/fce-cards.json');
const existing = fs.existsSync(existingFile) ? readGameSourceFileSync(existingFile, 'utf8') : null;
const previousCards = existing ? JSON.parse(existing) : null;
const previousStandardBySlug = new Map((previousCards?.standard ?? []).map(card => [card.slug, card]));

const staged = path.join(legacyDir, 'datamine/fce/data/bosses');
const curatedDir = process.env.TOF_LEGACY_DIR && fs.existsSync(staged) ? staged : path.join(__dirname, '../game-processors/curated/datamine/fce/data/bosses');
const read = file => JSON.parse(readGameSourceFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const rows = file => read(file).find(item => item.Rows)?.Rows || {};
const standard = baseline.standard.map(card => ({...card}));
for (const name of fs.readdirSync(curatedDir).filter(name => name.endsWith('.json'))) {
  const source = read(path.join(curatedDir, name));
  const previous = standard.find(card => card.slug === source.slug);
  const card = {...previous, ...source, name: source.en.name, name_ru: source.ru?.name || source.en.name,
    mechanics: source.en.mechanics, ru_mechanics: source.ru?.mechanics || [], mechanics_count: source.en.mechanics.length,
    preview: previous?.preview || source.art, displayWebpUrl: previous?.displayWebpUrl || source.art};
  delete card.en; delete card.ru;
  if (previous) Object.assign(previous, card); else standard.push(card);
}
// Preserve generated locale lanes that this patch did not export. They are cache inputs,
// not replacements for translations from any locale present in the current raw export.
for (const card of standard) {
  const previous = previousStandardBySlug.get(card.slug);
  if (previous?.l10n) card.l10n = previous.l10n;
}
const seasonFile = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/BorderWarSeasonDataTable_MMO.json';
const rawSeasonPath = path.join(rawDir, seasonFile);
const mmo = [];
if (fs.existsSync(rawSeasonPath)) {
  const loc = Object.fromEntries(['en', 'ru'].map(locale => [locale, read(path.join(rawDir, `Hotta/Content/Localization/Game/${locale}/Game.json`))]));
  const localize = (text, locale) => {
    const ns = text?.TableId?.split('.').pop();
    return loc[locale]?.[ns]?.[text.Key] || text?.LocalizedString || text?.SourceString || '';
  };
  for (const [key, seasonRow] of Object.entries(rows(rawSeasonPath))) {
    const season = (seasonRow.BorderWarSeasonIndex ?? Number(key)) - 1;
    if (season < 1) continue;
    for (const [index, encounter] of seasonRow.BorderWarAllBossList.entries()) {
      const waves = encounter.AllChallengeWaves || [];
      const attribute = waves[0]?.AttributeID?.toLowerCase() || '';
      const matches = card => card.ladder_key === encounter.BorderWarMapName || (card.boss_id && attribute.startsWith(card.boss_id.toLowerCase() + '_'));
      const known = baseline.mmo.find(matches);
      const visual = known || standard.find(matches);
      const skills = [...new Map(waves.flatMap(wave => wave.BossSkillInfo || []).filter(skill => skill.SkillDec?.Key).map(skill => [skill.SkillDec.Key, skill])).values()];
      const mechanics = locale => skills.map((skill, i) => ({index: String(i + 1), html: localize(skill.SkillDec, locale)}));
      const baseSlug = visual?.slug.replace(/^s\d+-/, '') || encounter.BorderWarMapName.toLowerCase();
      mmo.push({...visual, slug: `s${season}-${baseSlug}`, season, order: index + 1,
        boss_id: visual?.boss_id || attribute.replace(/_\d+$/, ''), boss_num: visual?.boss_num || 0,
        name: visual?.name || localize(encounter.BossName, 'en'), name_ru: visual?.name_ru || localize(encounter.BossName, 'ru'),
        art: visual?.art || '', preview: visual?.preview || '',
        ladder_level: waves[0]?.BossLevel, ladder_key: encounter.BorderWarMapName,
        mechanics: known?.mechanics || mechanics('en'), ru_mechanics: known?.ru_mechanics || mechanics('ru'),
        source: {file: seasonFile, row: key, map: encounter.BorderWarMapName, attributeIds: waves.map(wave => wave.AttributeID)},
      });
    }
  }
} else {
  // Builds without raw inputs can use an existing generated payload; do not replace it with an obsolete roster.
  if (previousCards) mmo.push(...previousCards.mmo.filter(card => card.encounter !== 'oow'));
}
// Mechanic texts and boss names of every exported game culture (the curated cards only carry EN/RU prose).
const {localizeCards} = require('../lib/fce-localization.cjs');
const overridesFile = path.join(__dirname, '../game-processors/curated/datamine/fce/data/mechanic-l10n-overrides.json');
const mechanicOverrides = fs.existsSync(overridesFile) ? read(overridesFile) : {};
for (const [group, cards] of [['standard', standard], ['mmo', mmo]]) {
  const stats = localizeCards(cards, rawDir, mechanicOverrides);
  console.log(`FCE ${group} localization: ${stats.matched}/${stats.mechanics} mechanics matched to game text in ${stats.cultures.length} cultures`);
  for (const card of cards) {
    const missing = (card.mechanics || []).length - (card.l10n?.de?.mechanics.length ?? 0);
    if (stats.cultures.length && missing > 0) console.log(`  ${card.slug}: ${missing} mechanic(s) have no game-text match and stay in English`);
  }
}
// Last-phase boss stats: DT_MonsterStaticData row `Boss_[hum_]<number>_<phase>` with the highest phase (shared with the raid processor).
const {loadMonsterTables, lastPhaseStats, lastPhaseStatsByAttributeIds} = require('../game-processors/processors/shared/boss-monster-stats.js');
const monsterTables = loadMonsterTables(rawDir);
const hasMonsterSource = monsterTables.length > 0;
// BorderWar ladder (written by build-fce-index) links a card to its wave attribute IDs when the card number names no rows.
const ladderPath = path.join(legacyDir, 'datamine/fce/data/fce-ladder.json');
const ladder = fs.existsSync(ladderPath) ? read(ladderPath) : [];
for (const card of standard) {
  const ladderEntry = ladder.find(entry => entry.boss_key === card.ladder_key);
  const stats = lastPhaseStats(card.monster_row_number ?? card.boss_num, monsterTables) || lastPhaseStatsByAttributeIds(ladderEntry?.attribute_ids, monsterTables);
  const previous = previousStandardBySlug.get(card.slug);
  if (stats) card.last_phase = stats;
  else if (!hasMonsterSource && previous?.last_phase) card.last_phase = previous.last_phase;
  else delete card.last_phase;
}
fs.mkdirSync(path.join(publicDir, 'game-data'), {recursive:true});
fs.writeFileSync(path.join(publicDir, 'game-data/fce-cards.json'), JSON.stringify({schemaVersion:1, standard, mmo}, null, 2)+'\n');
console.log(`FCE cards: ${standard.length} standard, ${mmo.length} MMO encounters`);
