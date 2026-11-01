import { readGameSourceFileSync } from './game-source-reader';

/**
 * build-cute-pets.js — decorative pets for the /info/cosmetics "Cute pets" tab.
 *
 * Raw source: Hotta/Content/Resources/CoreBlueprints/DataTable/CutePetDataTable.json, [0].Rows.
 * Per row: PetName (localized name), PetPhoto (texture), PetType (ECutePetType::fish | Common).
 * The legacy site carried this file without a generator; the shape below is that file's.
 * `dog` is the placeholder row the game ships without a photo; it was never listed.
 *
 * Output: <project-root>/info/cosmetics/data/cute-pets.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { createLocalizationResolver } from './localization-resolver';

function option(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

const readJson = (file) => JSON.parse(readGameSourceFileSync(file, 'utf8').replace(/^﻿/, ''));

// Editorial labels for the in-game pet types.
const SUB_TYPES = {
  fish: { en: 'Aquarium Fish', ru: 'Аквариумная рыба' },
  Common: { en: 'Companion Animal', ru: 'Домашний питомец' },
};
const EXCLUDED = new Set<any>(['dog']);
const MEDIA_PREFIX = '/datamine/shared/media/';

function run() {
  const projectRoot = option('project-root');
  const rawDir = option('raw-dir');
  if (!projectRoot || !rawDir) throw new Error('Usage: build-cute-pets.js --project-root=<stage> --raw-dir=<raw>');
  const table = path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/CutePetDataTable.json');
  if (!fs.existsSync(table)) throw new Error(`[required] CutePetDataTable missing: ${table}`);
  const rows = readJson(table)[0].Rows;

  const locResolver = createLocalizationResolver();
  for (const locale of ['en', 'ru']) {
    const file = path.join(rawDir, 'Hotta/Content/Localization/Game', locale, 'Game.json');
    if (fs.existsSync(file)) locResolver.loadLocale(locale, readJson(file));
  }
  const stItem = path.join(rawDir, 'Hotta/Content/Resources/Text/Oversea/ST_Item_Oversea.json');
  if (fs.existsSync(stItem)) locResolver.loadLocale('en', readJson(stItem));

  const items = [];
  for (const [id, row] of Object.entries(rows)) {
    if (EXCLUDED.has(id)) continue;
    const petType = String(row.PetType || '').replace(/^ECutePetType::/, '');
    const names = locResolver.resolveBilingual(row.PetName, { fallbackId: id });
    const original = row.PetName?.SourceString || row.PetName?.LocalizedString || id;
    const capitalize = (value) => (value && /^[a-z]/.test(value) ? value[0].toUpperCase() + value.slice(1) : value);
    const assetRef = row.PetPhoto?.AssetPathName && row.PetPhoto.AssetPathName !== 'None' ? row.PetPhoto.AssetPathName : '';
    const packagePath = assetRef ? assetRef.split('.')[0].replace(/^\/Game\//, 'Hotta/Content/') : '';
    const url = packagePath ? `${MEDIA_PREFIX}${packagePath}.webp` : '';
    const subType = SUB_TYPES[petType] || { en: petType, ru: petType };
    items.push({
      id,
      name_en: capitalize(names.name_en || original),
      name_ru: capitalize(names.name_ru || names.name_en || original),
      name_cn: original,
      original_name: original,
      desc_en: '',
      desc_ru: '',
      fashion_type: 'CutePet',
      quality: 'SR',
      sort_order: 900 + items.length,
      pet_type: petType,
      sub_type_en: subType.en,
      sub_type_ru: subType.ru,
      icon: url,
      icon_thumb: url,
      media: {
        photo: {
          assetRef,
          rawExportPath: packagePath ? `${packagePath}.png` : '',
          fullUrl: url,
          thumbUrl: url,
          strategy: 'exact_config_field',
          diagnosticStatus: url ? 'resolved' : 'missing',
          role: 'photo',
          joinIdentity: id,
        },
        source_edition: 'standard',
      },
    });
  }

  const outDir = path.join(projectRoot, 'info', 'cosmetics', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'cute-pets.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), total: items.length, items }, null, 2));
  console.log(`[build-cute-pets] ${items.length} cute pets.`);
}

run();
