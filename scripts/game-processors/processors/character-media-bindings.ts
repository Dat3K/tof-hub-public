import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readGameSourceFileSync } from './game-source-reader';

type Node = { file: string; row?: string; value: any; refs: Array<{ ref: string; field: string }>; owners: Set<string>; links: string[] };
type Binding = { ref: string; source: { file: string; row?: string; field: string; chain: string[]; join: string } };
const cb = 'Hotta/Content/Resources/CoreBlueprints/DataTable/';
const os = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
const fold = (value: unknown) => String(value ?? '').toLowerCase();

type Computed = { byCharacter: Record<string, Binding[]>; ambiguous: Array<{ file: string; row?: string; characters: string[] }> };
const CACHE_VERSION = 1;

/**
 * Build once for the complete roster. Texture names and folder abbreviations never identify a character.
 * The result depends only on raw tables and roster identities (never on localized text), so within one pipeline run
 * (TOF_RUN_CACHE_DIR) the base pass computes it and every locale lane reuses it.
 */
export function createCharacterMediaBindings(rawDir: string, characters: any[]) {
  const identityKey = characters.map(character => [character.id, character.imitation_id, character.avatar_id, character.weapon_id, character.weapon?.id]);
  const cacheDir = process.env.TOF_RUN_CACHE_DIR;
  const cacheFile = cacheDir ? path.join(cacheDir, `character-media-bindings-${createHash('sha256').update(JSON.stringify([CACHE_VERSION, path.resolve(rawDir), identityKey])).digest('hex').slice(0, 16)}.json`) : null;
  let computed: Computed | null = null;
  if (cacheFile && fs.existsSync(cacheFile)) computed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (!computed) {
    computed = computeCharacterMediaBindings(rawDir, characters);
    if (cacheFile) {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      const partial = `${cacheFile}.${process.pid}.partial`;
      fs.writeFileSync(partial, JSON.stringify(computed));
      fs.renameSync(partial, cacheFile);
    }
  }
  const byCharacter = new Map(Object.entries(computed.byCharacter));
  const families = { specialOrder: /\/chouka\//i, gashapon: /gashapon|niudan/i, dorm: /\/LeisureRoom\//i };
  return { get: (id: string) => byCharacter.get(id) ?? [], ambiguous: computed.ambiguous,
    missing: characters.flatMap(character => {
      const bindings = byCharacter.get(character.id) ?? [];
      const missingFamilies = Object.entries(families).filter(([, pattern]) => !bindings.some(binding => pattern.test(binding.ref))).map(([family]) => family);
      return missingFamilies.length ? [{ id: character.id, families: missingFamilies }] : [];
    }) };
}

function computeCharacterMediaBindings(rawDir: string, characters: any[]): Computed {
  const identities = new Map<string, Set<string>>();
  const identity = (value: unknown, owner: string) => {
    if (!value || value === 'None') return;
    const key = fold(value), owners = identities.get(key) ?? new Set<string>();
    owners.add(owner); identities.set(key, owners);
  };
  for (const character of characters) {
    for (const value of [character.imitation_id, character.avatar_id, character.weapon_id, character.weapon?.id]) identity(value, character.id);
  }
  const read = (file: string) => {
    const full = path.join(rawDir, file);
    return fs.existsSync(full) ? JSON.parse(readGameSourceFileSync(full, 'utf8').replace(/^\uFEFF/, '')) : null;
  };
  for (const file of [cb + 'Fashion/DT_Imitation.json', 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_Imitation_MMO.json']) {
    for (const object of read(file) ?? []) for (const [key, row] of Object.entries<any>(object.Rows ?? {})) {
      const owners = identities.get(fold(key)) ?? identities.get(fold(row.WeaponId));
      for (const owner of owners ?? []) {
        identity(key, owner); identity(row.CharacterType, owner); identity(row.AvatarId, owner);
      }
    }
  }
  const nodes = new Map<string, Node>();
  const rowsByName = new Map<string, string[]>();
  const identityFields = new Set(['weaponid', 'ssrweaponidarray', 'imitationid', 'ownerimitationid', 'charactertype', 'avatarid']);
  const assetFile = (ref: string) => {
    if (!ref.startsWith('/Game/')) return null;
    const relative = ref.slice('/Game/'.length).split('.')[0];
    return relative.split('/').includes('..') ? null : `Hotta/Content/${relative}.json`;
  };
  const addNode = (file: string, value: any, row?: string) => {
    const id = row ? `${file}#${row}` : file;
    if (nodes.has(id)) return;
    const node: Node = { file, row, value, refs: [], owners: new Set(), links: [] };
    nodes.set(id, node);
    if (row) rowsByName.set(fold(row), [...(rowsByName.get(fold(row)) ?? []), id]);
    const walk = (value: any, field = '', parent = '') => {
      if (typeof value === 'string') {
        if (identityFields.has(fold(parent))) for (const owner of identities.get(fold(value)) ?? []) node.owners.add(owner);
        if (value.startsWith('/Game/')) node.refs.push({ ref: value, field });
        else if (value.startsWith('Hotta/Content/')) node.refs.push({ ref: `/Game/${value.slice('Hotta/Content/'.length)}`, field });
      } else if (Array.isArray(value)) value.forEach((child, index) => walk(child, `${field}[${index}]`, parent));
      else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, field ? `${field}.${key}` : key, key);
    };
    walk(value);
    return node;
  };
  const load = (file: string) => {
    if (nodes.has(file)) return;
    const data = read(file);
    if (!data) return;
    const objects = Array.isArray(data) ? data : [data];
    if (objects.some(object => object.Rows)) {
      for (const object of objects) for (const [row, value] of Object.entries(object.Rows ?? {})) addNode(file, value, row);
    } else addNode(file, data);
  };
  const walkFiles = (folder: string) => {
    const full = path.join(rawDir, folder);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.isDirectory()) walkFiles(`${folder}/${entry.name}`);
      else if (entry.name.endsWith('.json')) load(`${folder}/${entry.name}`);
    }
  };
  for (const folder of [cb + 'Fashion', cb + 'Gashapon', os + 'Gashapon', cb + 'LeisureRoom', 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/MMOGashapon', 'Hotta/Content/SevenForest/Blueprint/Lottery']) walkFiles(folder);
  load(cb + 'DT_UIClass.json');
  const neededUiRows = new Set([...nodes.values()].map(node => fold(node.value?.MainFormClassID)).filter(Boolean));
  // Follow only exported UI/preview assets. A shared DataTable needs an explicit row link.
  const expanded = new Set<string>();
  for (const [id, node] of nodes) {
    if (node.file === cb + 'DT_UIClass.json' && !neededUiRows.has(fold(node.row))) continue;
    if (expanded.has(id)) continue;
    expanded.add(id);
    for (const reference of node.refs) {
      const file = assetFile(reference.ref);
      if (!file || /\/DataTable(?:_MMO)?\//.test(file) || /\/(?:Characters|Abilities|Materials|Movies)[_/]/.test(file)) continue;
      if (fs.existsSync(path.join(rawDir, file))) { load(file); if (nodes.has(file)) node.links.push(file); }
    }
    const values: string[] = [];
    if (Array.isArray(node.value?.PoolIDArray)) values.push(...node.value.PoolIDArray);
    if (node.value?.MainFormClassID) values.push(node.value.MainFormClassID);
    for (const key of values) node.links.push(...(rowsByName.get(fold(key)) ?? []).filter(id => {
      const target = nodes.get(id)!;
      return key === node.value?.MainFormClassID ? target.file === cb + 'DT_UIClass.json'
        : /\/GashaponPoolConfigDataTable(?:_Overseas)?\.json$/.test(target.file);
    }));
  }
  // A preview can establish its parent activity's owner, and that activity can
  // establish the owner of its pool artwork. Conflicting ownership stays ambiguous.
  for (let pass = 0; pass < 32; pass++) {
    let changed = false;
    for (const node of nodes.values()) for (const link of node.links) {
      const target = nodes.get(link);
      if (!target) continue;
      for (const owner of target.owners) if (!node.owners.has(owner)) { node.owners.add(owner); changed = true; }
      // Pool rows are children of a character-owned activity. Shared UI widgets
      // never receive ownership from their callers.
      if (target.row && target.file.includes('/Gashapon/')) for (const owner of node.owners) if (!target.owners.has(owner)) { target.owners.add(owner); changed = true; }
    }
    if (!changed) break;
  }
  const byCharacter = new Map<string, Binding[]>();
  const ambiguous: Array<{ file: string; row?: string; characters: string[] }> = [];
  for (const node of nodes.values()) {
    if (node.owners.size > 1) { ambiguous.push({ file: node.file, row: node.row, characters: [...node.owners] }); continue; }
    const owner = [...node.owners][0];
    if (!owner) continue;
    const bindings = byCharacter.get(owner) ?? [];
    const visited = new Set<string>();
    const collect = (entry: Node, chain: string[]) => {
      const key = `${entry.file}#${entry.row ?? ''}`;
      if (visited.has(key) || chain.length > 32 || [...entry.owners].some(candidate => candidate !== owner)) return;
      visited.add(key);
      for (const reference of entry.refs) {
        if (!/\/Resources(?:OverSea)?\/(?:UI|Icon)\//.test(reference.ref) && !/\/L10N\/[^/]+\/Resources\/UI\//.test(reference.ref)) continue;
        const file = assetFile(reference.ref)!;
        if (fs.existsSync(path.join(rawDir, file))) continue;
        if (!bindings.some(binding => fold(binding.ref) === fold(reference.ref))) bindings.push({ ref: reference.ref,
          source: { file: entry.file, row: entry.row, field: reference.field, chain, join: 'exact weapon/imitation identity and exported asset reference' } });
      }
      for (const link of entry.links) { const child = nodes.get(link); if (child) collect(child, [...chain, key]); }
    };
    collect(node, []);
    byCharacter.set(owner, bindings);
  }
  return { byCharacter: Object.fromEntries(byCharacter), ambiguous };
}
