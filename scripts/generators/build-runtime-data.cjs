'use strict';

// Materialized datasets remain the provenance/export source. Runtime files are
// derived only from those datasets, never from independently authored game facts.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { publicDir } = require('../lib/site-paths.cjs');
const { SUPPORTED_LOCALES } = require('../../packages/i18n/src/constants.ts');
const { RUNTIME_DATASETS } = require('../../packages/contracts/src/runtime-datasets.ts');

function writeRuntimeJson(target, value) {
  const contents = JSON.stringify(value) + '\n';
  // Docker bind mounts on Windows can prevent replacement of an open file.
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === contents) return;
  fs.mkdirSync(path.dirname(target), {recursive:true});
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, contents);
    try {
      fs.renameSync(tmp, target);
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      // Copying into the existing file works when Windows denies renaming it.
      fs.copyFileSync(tmp, target);
    }
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

const INFO = new Set(['simulacra', 'matrices', 'relics', 'pets', 'food', 'food-mmo', 'cosmetics', 'arts']);
const SIM_FIELDS = 'id slug canonical_id avatar_id imitation_id weapon_id matrix_suit_id matrix_suit_num name name_en name_ru weapon_name weapon_name_en weapon_name_ru element element_secondary element_combo_icon role role_icon resonance rarity server_mode edition has_matrices no_matrices season season_tag season_badge season_name_en season_name_ru avatar avatar_thumb portrait portrait_thumb card card_thumb detail_art detail_art_thumb icon icon_thumb art_focus base_stats max_stats efficiency_radar radar_abilities round_icon changelogs'.split(' ');
const pick = (row, fields) => Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
const COMP_FIELDS = {
  roles: 'id name_en name_ru short_en short_ru color bg_color icon',
  simulacra: 'id server_mode season imitation_id matrix_suit_num avatar trait_icon weapon_id name_en name_ru weapon_name_en weapon_name_ru weapon_icon icon element element_secondary element_combo_icon role role_icon rarity matrix_suit_id card trait_name_en trait_name_ru trait_desc_en trait_desc_ru release_order season_badge season_tag',
  matrices: 'id name_en name_ru quality icon suit_portrait remould_icon desc_2p_en desc_2p_ru desc_3p_en desc_3p_ru desc_4p_en desc_4p_ru simulacrum_id sim_name_en sim_name_ru carriers',
  relics: 'id server_mode edition name_en name_ru quality property icon desc_en desc_ru stars',
  pets: 'id name_en name_ru quality icon stars',
};

function summary(dataset, row) {
  if (dataset === 'simulacra') return { ...pick(row, SIM_FIELDS), ...(row.weapon?.icon ? {weapon: {icon: row.weapon.icon}} : {}) };
  if (dataset === 'relics') {
    const {variants, ...rest} = row;
    // All star text stays searchable and the card's passive-stat parser is unchanged.
    return rest;
  }
  if (dataset === 'pets' && row.category === 'combat') {
    const {skills, stats_progression, stars, ...rest} = row;
    return {...rest,skills:Array.isArray(skills) ? skills.map(skill=>pick(skill,['name','name_en','name_ru'])) : skills};
  }
  // These catalogs render/search descriptions, recipes, matrix pieces/effects,
  // module ranks or image metadata in the list itself. Keep those fields.
  return row;
}

function projectInfo(dataset, data, write, growth = {}) {
  const output = {...data, _runtime: 1};
  // Drop redundant legacy mirrors; consumers already use the canonical collection.
  const aliases = {
    simulacra: ['items'], matrices: ['suits'], relics: ['relics'], pets: ['pets', 'modules'],
    food: ['dishes'], cosmetics: ['chatStickers', 'badges', 'avatars', 'avatarFrames', 'chatBackgrounds', 'mounts', 'outfits', 'titles', 'cutePets', 'enemies'],
  };
  for (const key of aliases[dataset] || []) {
    const canonical = dataset === 'simulacra' ? 'gacha' : key === 'modules' ? 'module_families' : 'items';
    if (Array.isArray(data[canonical])) delete output[key];
  }
  if (dataset === 'relics' && Array.isArray(data.gacha) && Array.isArray(data.mmo)) delete output.items;
  for (const [collection, rows] of Object.entries(output)) {
    if (!Array.isArray(rows)) continue;
    output[collection] = rows.map(row => {
      if (!row || typeof row !== 'object' || !row.id) return row;
      const detail = dataset === 'simulacra' && growth[String(row.weapon_id).toLowerCase()]
        ? {...row, growth: growth[String(row.weapon_id).toLowerCase()]} : row;
      const compact = summary(dataset, row);
      if (compact === row) return row;
      const bytes = JSON.stringify(detail);
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0,24);
      const file = `runtime/details/${dataset}/${hash}`;
      write(file, detail);
      return {...compact, _detail: file};
    });
  }
  return output;
}

function buildRuntimeData(dataRoot = path.join(publicDir, 'game-data')) {
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const growthFile = path.join(dataRoot, 'weapon-growth.json');
  const growth = fs.existsSync(growthFile) ? read(growthFile).weapons || {} : {};
  const sizes = [];
  for (const locale of SUPPORTED_LOCALES) {
    const dir = path.join(dataRoot, locale);
    if (!fs.existsSync(dir)) continue;
    const written = new Set();
    const write = (name, value) => {
      const target = path.join(dir, `${name}.json`);
      if (written.has(target)) return;
      writeRuntimeJson(target, value);
      written.add(target);
    };
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const dataset = entry.name.slice(0,-5);
      if (dataset === 'comp') continue;
      // Only served datasets get a runtime projection; the rest stay generator/provenance inputs.
      if (!RUNTIME_DATASETS.has(dataset)) {
        fs.rmSync(path.join(dir,'runtime',entry.name),{force:true});
        continue;
      }
      const data = read(path.join(dir,entry.name));
      let output = INFO.has(dataset) ? {...projectInfo(dataset,data,write,growth),_locale:locale} : data;
      if (dataset === 'bygone') {
        // Charts, directory, tooltips and CSV all consume this floor projection.
        const fields = 'floor is_boss_floor is_duplicate duplicated_from_floor hp_buff_stacks atk_buff_stacks displayed_difficulty monster_level round_gs final_hp final_atk weakness primary_enemy'.split(' ');
        output = {...pick(data,['schemaVersion','generatedAt','totalFloors']), floors: (data.floors || []).map(row=>pick(row,fields))};
      }
      write(`runtime/${dataset}`,output);
      sizes.push({locale,dataset,source:fs.statSync(path.join(dir,entry.name)).size,runtime:fs.statSync(path.join(dir,'runtime',entry.name)).size});
    }
    // Comp needs view data, not the full Simulacra/relic payloads and browser-side adaptation.
    const compFile = path.join(dir,'comp.json');
    if (fs.existsSync(compFile)) {
      const raw = read(compFile);
      const sims = fs.existsSync(path.join(dir,'simulacra.json')) ? read(path.join(dir,'simulacra.json')) : {};
      const relics = fs.existsSync(path.join(dir,'relics.json')) ? read(path.join(dir,'relics.json')) : {};
      const previous = new Map((raw.simulacra || []).map(row=>[row.id,row]));
      if (sims.mmo?.length) raw.simulacra = [
        ...(raw.simulacra || []).filter(row=>row.server_mode !== 'mmo' && !String(row.id).endsWith('-mmo')),
        ...sims.mmo.map(row=>({...previous.get(row.id),...row,server_mode:'mmo',weapon_icon:row.weapon_icon || row.icon || row.avatar})),
      ];
      const known = new Set((raw.relics || []).map(row=>row.id));
      raw.relics = [...(raw.relics || []),...(relics.mmo || []).filter(row=>!known.has(row.id)).map(row=>({...row,server_mode:'mmo',icon:row.icon || row.item_icon || row.attack_icon || row.card_image || ''}))];
      const catalog = {...pick(raw,['generatedAt','totalSimulacra','totalMatrices','totalRelics','totalPets']), _runtime:1, _locale:locale};
      for (const [collection,fields] of Object.entries(COMP_FIELDS)) catalog[collection] = (raw[collection] || []).map(row=>pick(row,fields.split(' ')));
      write('runtime/comp',catalog);
      sizes.push({locale,dataset:'comp',source:fs.statSync(compFile).size,runtime:fs.statSync(path.join(dir,'runtime/comp.json')).size});
    }
    // Details are content-addressed: drop the files no current catalog row points to.
    const details = path.join(dir,'runtime','details');
    for (const folder of fs.existsSync(details) ? fs.readdirSync(details,{withFileTypes:true}) : []) {
      if (!folder.isDirectory()) continue;
      for (const name of fs.readdirSync(path.join(details,folder.name))) {
        const file = path.join(details,folder.name,name);
        if (name.endsWith('.json') && !written.has(file)) fs.unlinkSync(file);
      }
    }
  }
  // Unlocalized page catalogs/metadata follow the same runtime boundary.
  // They keep every field needed by Build, Optimizer, Ranking, Wish and SEO.
  for (const entry of fs.readdirSync(dataRoot,{withFileTypes:true})) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'comp.json') continue;
    const target = path.join(dataRoot,'runtime',entry.name);
    writeRuntimeJson(target, read(path.join(dataRoot,entry.name)));
  }
  return sizes;
}

module.exports = {buildRuntimeData,projectInfo,summary,writeRuntimeJson};
if (require.main === module) {
  const sizes = buildRuntimeData(process.argv[2]);
  console.log(JSON.stringify(sizes,null,2));
}
