import fs from 'node:fs';
import path from 'node:path';
import { readGameSourceFileSync } from './game-source-reader';
import { cleanHtmlTags } from './localization-resolver';

type Row = Record<string, any>;
const read = (file: string) => fs.existsSync(file) ? JSON.parse(readGameSourceFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : null;

import { traceEnemyClass } from './enemy-class-chain.cjs';
export { traceEnemyClass } from './enemy-class-chain.cjs';

/** Identity and artwork only; encounter combat numbers belong to their own datasets. */
export function createEnemyIdentityResolver(rawDir: string, resolver: any, options: { mapping?: Row } = {}) {
  const mapping = options.mapping ?? read(path.join(__dirname, 'monster-image-mapping.json')) ?? {};
  const folded = new Map<string, { key: string; record: Row } | null>();
  for (const [key, record] of Object.entries<Row>(mapping)) {
    if (record.resolutionStatus !== 'confirmed') continue;
    const lower = key.toLowerCase(), previous = folded.get(lower);
    const signature = (value: Row) => JSON.stringify([value.lineupPortrait ?? value.image, value.detailImage ?? value.image]);
    folded.set(lower, previous === null || (previous && signature(previous.record) !== signature(record)) ? null : { key, record });
  }
  const actorImages = new Map<string, string>();
  for (const folder of ['UI/void/boss', 'UI/Scenery/monster', 'UI/SHTT/guaiwu/Btn', 'UI/plugin/FB/bigmon']) {
    const directory = path.join(rawDir, 'Hotta/Content/Resources', folder);
    for (const file of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
      if (!file.endsWith('.png')) continue;
      const key = path.basename(file, '.png').toLowerCase();
      if (!actorImages.has(key)) actorImages.set(key, `/Game/Resources/${folder}/${path.basename(file, '.png')}`);
    }
  }
  const cache = new Map<string, any>();
  const configured = new Map<string, Array<{ text: any; source: string }>>();
  for (const file of [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable.json',
  ]) {
    for (const object of read(path.join(rawDir, file)) ?? []) for (const [row, value] of Object.entries<Row>(object.Rows ?? {})) {
      for (const [index, monster] of (value.PoolMonsters ?? []).entries()) {
        const reference = monster.MonsterClass?.AssetPathName;
        if (!reference || !monster.MonsterName?.Key) continue;
        const key = reference.toLowerCase(), values = configured.get(key) ?? [];
        values.push({ text: monster.MonsterName, source: `${file}#Rows[${row}].PoolMonsters[${index}].MonsterName` });
        configured.set(key, values);
      }
    }
  }
  return (classPath: string, configuredName?: any, configuredSource?: string) => {
    const cacheKey = `${classPath}|${JSON.stringify(configuredName ?? null)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const className = path.posix.basename(classPath || '').split('.')[0].replace(/_C$/i, '');
    const chain = traceEnemyClass(rawDir, classPath);
    const oowNames = configured.get(classPath.toLowerCase()) ?? [];
    const oowNameKeys = new Set(oowNames.map(entry => JSON.stringify([entry.text.TableId ?? entry.text.Namespace, entry.text.Key])));
    const names = [
      ...(configuredName ? [{ text: configuredName, source: configuredSource ?? 'MonsterName' }] : []),
      ...(oowNameKeys.size === 1 ? oowNames : []),
      ...chain.flatMap(entry => [
        ...['MonsterName', 'CharacterName', 'ActorName'].filter(field => entry.properties[field]).map(field => ({ text: entry.properties[field], source: `${entry.file}#Default__.${field}` })),
        { text: { Namespace: 'ST_actorname', Key: path.posix.basename(entry.reference).split('.')[0].replace(/_C$/i, '') }, source: `${entry.file}#Blueprint package basename` },
      ]),
      { text: { Namespace: 'ST_actorname', Key: className }, source: 'MonsterClass package basename' },
    ];
    let name: { en: string; ru: string } | null = null, actorKey: string | null = null, nameSource: any = null;
    for (const candidate of names) {
      const english = resolver.resolve(candidate.text, { locale: 'en', defaultNamespace: 'ST_actorname' });
      if (english.provenance?.status !== 'resolved' || !english.text) continue;
      const russian = resolver.resolve(candidate.text, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ST_actorname' });
      name = { en: cleanHtmlTags(english.text), ru: cleanHtmlTags(russian.text || english.text) };
      actorKey = english.provenance?.matchedKey ?? candidate.text.Key ?? null;
      nameSource = { source: candidate.source, localization: english.provenance };
      break;
    }
    let portrait: string | null = null, detail: string | null = null, imageSource: any = null;
    const identityKeys = [classPath, className, ...chain.flatMap(entry => [entry.reference, path.posix.basename(entry.reference).split('.')[0].replace(/_C$/i, '')]), actorKey].filter(Boolean);
    for (const key of identityKeys) {
      const entry = folded.get(key.toLowerCase());
      if (!entry) continue;
      portrait = entry.record.lineupPortrait ?? entry.record.image ?? null;
      detail = entry.record.detailImage ?? entry.record.image ?? portrait;
      imageSource = { file: 'scripts/game-processors/processors/monster-image-mapping.json', row: entry.key, field: 'lineupPortrait/detailImage', strategy: 'confirmed_class_mapping' };
      break;
    }
    if (!portrait) for (const entry of chain) {
      const field = ['BossImage', 'PortraitImage', 'IconImage'].find(field => entry.properties[field]?.AssetPathName?.startsWith('/Game/'));
      if (!field) continue;
      portrait = detail = entry.properties[field].AssetPathName;
      imageSource = { file: entry.file, field: `Default__.${field}`, strategy: 'exact_blueprint_field' };
      break;
    }
    if (!portrait && actorKey && actorImages.has(actorKey.toLowerCase())) {
      portrait = detail = actorImages.get(actorKey.toLowerCase())!;
      imageSource = { actorKey, field: 'exact actor key / texture basename', strategy: 'exact_actor_texture' };
    }
    const result = { classPath, className, actorKey, canonicalEnemyId: actorKey ?? className, name, nameSource, portrait, detail,
      imageSource, classChain: chain.map(entry => entry.file), missing: { name: !name, portrait: !portrait } };
    cache.set(cacheKey, result);
    return result;
  };
}
