'use strict';
// Culture overlays for game text in the generated Gacha Build catalog.
// The page catalog owns its shape; localized game datasets and the canonical source catalog
// supply culture text by stable ID. English/Russian remain owned by the base generators.
// This module is called during each patch-exporter locale lane and can patch a published catalog:
//   node scripts/generators/build-page-locales.cjs [game-data dir] [--from public dir] [--culture locale]
const fs = require('node:fs');
const path = require('node:path');
if (fs.existsSync(path.resolve(__dirname, '../../packages/i18n/src/ui-text.ts'))) module.require('tsx/cjs');
const { writeRuntimeJson } = require('./build-runtime-data.cjs');
const CULTURES = ['de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'];
const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
// Exporter placeholders such as BuffPotion_01 and Jiuyu Cooking35 are not localized names.
const PLACEHOLDER = /^[A-Za-z0-9_ ]*(?:_|[A-Za-z]\d{1,3}$)[A-Za-z0-9_ ]*$/;
const text = (value) => (typeof value === 'string' && value.trim() && !PLACEHOLDER.test(value.trim()) ? value.trim() : null);
const byId = (rows) => new Map((rows || []).filter((row) => row && row.id !== undefined).map((row) => [row.id, row]));

let helpers;
function localizationHelpers() {
  if (helpers) return helpers;
  // These are shared i18n helpers, statically required so the portable exporter bundles them
  // with the generator instead of resolving repository-only web source paths at runtime.
  helpers = {
    translateUiText: require('../../packages/i18n/src/ui-text.ts').translateUiText,
    translateArtTitle: require('../../packages/i18n/src/art-title.ts').localizeArtTitle,
    localizeEffectLine: require('../../packages/i18n/src/effect-line.ts').localizeEffectLine,
    buildPhrases: require('../../packages/i18n/src/locales/extra/build/phrases.ts').buildPhraseTranslations,
  };
  return helpers;
}

function setCulture(target, culture, value) {
  const next = text(value);
  if (target && next && next !== target.en) target[culture] = next;
}

function firstText(row, keys) {
  for (const key of keys) {
    const value = text(row?.[key]);
    if (value) return value;
  }
  return null;
}

function skillIndex(item) {
  return byId(Object.values(item?.weapon?.skills || {}).flat());
}

function effectText(item, culture) {
  const list = [`formatted_effects_${culture}`, 'formatted_effects_en', 'formatted_effects']
    .map((key) => item?.[key]).find((value) => Array.isArray(value) && value.length);
  const single = firstText(item, [`effect_text_${culture}`, 'effect_text_en', 'effect_text']);
  const source = list ? list.join('<br>') : single || '';
  if (!source) return null;
  const localize = localizationHelpers().localizeEffectLine;
  return source.split(/(<br\s*\/?>)/i).map((part) => /^<br\s*\/?>$/i.test(part) ? part : localize(part, culture)).join('');
}

function sourceSimulacraIndex(sourceCatalog) {
  const rows = sourceCatalog?.simulacra || sourceCatalog?.items || [];
  return byId(rows);
}

function localizeAuthoredResonance(description, element, culture) {
  const match = /^(.*?) ATK \+([\d.]+)%, \1 resistance \+([\d.]+)%(?:\.|,)?\s+Active with at least 2 matching weapons\. Does not stack with another resonance of the same element\.$/i.exec(description || '');
  if (!match) return null;
  const { buildPhrases, translateUiText } = localizationHelpers();
  const template = buildPhrases[culture]?.['{0} ATK +{1}%, {0} resistance +{2}%. Active with at least 2 matching weapons. Does not stack with another resonance of the same element.'];
  if (!template) return null;
  const localizedElement = translateUiText(element, culture);
  return template.replaceAll('{0}', localizedElement).replace('{1}', match[2]).replace('{2}', match[3]);
}

function localizeCulture(catalog, culture, root, sourceSimulacra) {
  const dir = path.join(root, culture);
  const cosmetics = read(path.join(dir, 'cosmetics.json'));
  const arts = read(path.join(dir, 'arts.json'));
  const food = read(path.join(dir, 'food.json'));
  const simulacra = read(path.join(dir, 'simulacra.json'));

  if (cosmetics) {
    for (const category of ['avatars', 'avatarFrames']) {
      const rows = byId(cosmetics[category]);
      for (const entry of catalog[category] || []) {
        const row = rows.get(entry.id);
        setCulture(entry.name, culture, firstText(row, [`name_${culture}`, 'name', 'name_en']));
      }
    }
  }

  if (arts) {
    const rows = byId(arts.items);
    const translate = localizationHelpers().translateArtTitle;
    for (const art of catalog.artworks || []) {
      const row = rows.get(art.id);
      const title = typeof row?.title === 'string' ? row.title : row?.title?.en || row?.title?.ru;
      if (title) setCulture(art.name, culture, translate(title, culture));
    }
  }

  if (food) {
    const rows = byId([...(food.items || []), ...(food.potions || [])]);
    for (const group of catalog.consumables || []) {
      for (const entry of group.items || []) {
        const row = rows.get(entry.id);
        if (!row) continue;
        setCulture(entry.name, culture, firstText(row, [`name_${culture}`, 'name', 'name_en']));
        setCulture(entry.description, culture, effectText(row, culture));
      }
    }
  }

  const projected = byId(simulacra?.items);
  for (const weapon of catalog.weapons || []) {
    const canonical = sourceSimulacra.get(weapon.id);
    // The canonical catalog carries every locale's exact source text for weapon identities and traits.
    setCulture(weapon.name, culture, canonical?.[`name_${culture}`]);
    setCulture(weapon.weapon, culture, canonical?.[`weapon_name_${culture}`]);
    setCulture(weapon.trait, culture, canonical?.[`trait_desc_${culture}`]);

    const projectedWeapon = projected.get(weapon.id);
    const skills = skillIndex(projectedWeapon);
    const present = (entry, authoredResonance = false) => {
      const skill = skills.get(entry.id);
      if (skill) {
        setCulture(entry.name, culture, firstText(skill, [`name_${culture}`, 'name', 'name_en']));
        if (authoredResonance) {
          setCulture(entry.description, culture, localizeAuthoredResonance(entry.description?.en, entry.element, culture));
        } else {
          setCulture(entry.description, culture, firstText(skill, [`desc_display_${culture}`, `desc_${culture}`, 'desc_display_en', 'desc_en']));
        }
      } else if (authoredResonance) {
        setCulture(entry.description, culture, localizeAuthoredResonance(entry.description?.en, entry.element, culture));
      }
    };
    for (const entry of weapon.resonances || []) present(entry, /Active with at least 2 matching weapons/.test(entry.description?.en || ''));
    for (const entry of weapon.selectableSkills || []) present(entry);
    for (const entry of weapon.selectableModes || []) present(entry);
  }

  // These catalog strings are authored UI labels, translated through the same phrase tables as the React UI.
  const { translateUiText } = localizationHelpers();
  for (const group of catalog.consumables || []) setCulture(group.name, culture, translateUiText(group.name?.en || '', culture));
  for (const item of catalog.gear || []) setCulture(item.name, culture, translateUiText(item.name?.en || '', culture));
  for (const slot of catalog.matrixStats?.slots || []) setCulture(slot.name, culture, translateUiText(slot.name?.en || '', culture));
  for (const node of catalog.computing || []) for (const effect of node.effects || []) {
    setCulture(effect.name, culture, translateUiText(effect.name?.en || '', culture));
  }
}

function localizeBuildPage(catalog, root, sourceCatalog, culture) {
  const sourceSimulacra = sourceSimulacraIndex(sourceCatalog);
  const cultures = culture ? [culture] : CULTURES;
  for (const locale of cultures) {
    if (CULTURES.includes(locale)) localizeCulture(catalog, locale, root, sourceSimulacra);
  }
  return catalog;
}

function patchBuildPage(root, from = path.dirname(root), culture) {
  const file = path.join(root, 'build-page.json');
  const catalog = read(file);
  if (!catalog) return false;
  const sourceCatalog = read(path.join(from, 'tools/data/catalog.json'));
  localizeBuildPage(catalog, from, sourceCatalog, culture);
  const output = JSON.stringify(catalog) + '\n';
  fs.writeFileSync(file, output);
  const runtime = path.join(root, 'runtime', 'build-page.json');
  if (fs.existsSync(runtime)) writeRuntimeJson(runtime, catalog);
  return true;
}

module.exports = { localizeBuildPage, patchBuildPage };

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const positional = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--from' && args[index - 1] !== '--culture');
  const root = path.resolve(positional || path.join(__dirname, '../../apps/web/public/game-data'));
  const from = option('--from') ? path.resolve(option('--from')) : path.dirname(root);
  const culture = option('--culture') || undefined;
  patchBuildPage(root, from, culture);
  console.log('Build page locales:', path.relative(process.cwd(), path.join(root, 'build-page.json')));
}
