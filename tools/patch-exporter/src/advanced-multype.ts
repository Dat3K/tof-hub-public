import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

export interface MultypeGuessCandidate {
  label: string;
  labelRu?: string;
  entityType: string;
  entityId: string;
  confidence: number;
  evidence: string[];
}

export interface MultypeGuess {
  sourceKey: string;
  candidates: MultypeGuessCandidate[];
}

export interface AdvancedMultypeResult {
  mapping: Record<string, Record<string, string[]>>;
  guesses: Record<string, MultypeGuess>;
  filesScanned: number;
  filesWithAttributes: number;
  durationMs: number;
  outputDir: string;
}

interface ScanRecord {
  fileName: string;
  pairs: Array<[string, string]>;
}

interface ScanChunkResult {
  records: ScanRecord[];
  entities: ReferenceEntity[];
}

interface ProgressState {
  processed: number;
  bytes: number;
}

interface ReferenceEntity {
  id: string;
  type: string;
  name: string;
  nameRu?: string;
  identities: string[];
  source: string;
}

async function runDynamicQueue<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runner = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

function createDynamicBatches<T>(items: T[], jobs: number, batchesPerWorker = 4): T[][] {
  const batchCount = Math.max(1, Math.min(items.length || 1, jobs * batchesPerWorker));
  const batches = Array.from({ length: batchCount }, () => [] as T[]);
  items.forEach((item, index) => batches[index % batchCount].push(item));
  return batches.filter((batch) => batch.length > 0);
}

const SCAN_WORKER = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
function visit(value, pairs) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) visit(item, pairs); return; }
  const props = value.Properties && typeof value.Properties === 'object' ? value.Properties : value;
  const blocks = [];
  if (Array.isArray(props.ModuleExtraModifierInfos)) blocks.push(...props.ModuleExtraModifierInfos);
  if (Array.isArray(props.Modifiers)) blocks.push(...props.Modifiers);
  if (Array.isArray(props.CustomApplicationRequirement)) {
    for (const block of props.CustomApplicationRequirement) {
      if (Array.isArray(block && block.GameplayModifierInfos)) blocks.push(...block.GameplayModifierInfos);
    }
  }
  for (const block of blocks) {
    const info = block && block.GameplayModifierInfo ? block.GameplayModifierInfo : block;
    const attribute = info && info.Attribute ? info.Attribute : block && block.Attribute;
    const attributeName = attribute && attribute.AttributeName;
    if (typeof attributeName === 'string' && attributeName) {
      const moduleType = typeof block.ModuleExtraType === 'string' && block.ModuleExtraType
        ? block.ModuleExtraType : 'NoModule';
      pairs.push([moduleType, attributeName]);
    }
  }
  for (const child of Object.values(value)) visit(child, pairs);
}
function collectEntities(value, source, entities) {
  if (Array.isArray(value)) { for (const item of value) collectEntities(item, source, entities); return; }
  if (!value || typeof value !== 'object') return;
  const ids = ['canonical_id','id','artifact_id','item_id','buff_id','matrix_id','pet_id','weapon_id','slug','codeName','character'];
  const names = ['name_en','name','title_en','weapon_name','display_name'];
  const idKey = ids.find(key => typeof value[key] === 'string' && value[key]);
  const nameKey = names.find(key => typeof value[key] === 'string' && value[key]);
  if (idKey && nameKey) {
    const normalize = item => String(item || '').toLowerCase().replace(/\.json$/i, '').replace(/[^a-z0-9]+/g, '');
    const identityKeys = Object.keys(value).filter(key => /(^id$|_id$|id$|asset|ability|icon|image|code|slug|effect_figure|source_file)/i.test(key));
    const identities = [value[idKey], ...identityKeys.map(key => value[key])]
      .filter(item => typeof item === 'string').map(normalize).filter(item => item.length >= 4);
    entities.push({ id: value[idKey], type: path.basename(source, '.json'), name: value[nameKey],
      nameRu: typeof value.name_ru === 'string' ? value.name_ru : undefined, identities, source });
  }
  for (const child of Object.values(value)) collectEntities(child, source, entities);
}
const records = [];
let processed = 0;
let bytes = 0;
for (const file of workerData.files) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    bytes += Buffer.byteLength(raw);
    const parsed = JSON.parse(raw);
    const pairs = [];
    const entities = [];
    visit(parsed, pairs);
    collectEntities(parsed, file, entities);
    const unique = [...new Map(pairs.map(pair => [pair[0] + '\\0' + pair[1], pair])).values()];
    records.push({ fileName: path.basename(file), pairs: unique, entities });
  } catch (error) {
    records.push({ fileName: path.basename(file), pairs: [], entities: [], error: String(error && error.message || error) });
  }
  processed++;
  if (processed % 200 === 0) parentPort.postMessage({ type: 'progress', processed, bytes });
}
const entityMap = new Map();
for (const record of records) {
  for (const entity of record.entities) {
    const key = entity.type + '\\0' + entity.id + '\\0' + entity.name;
    const existing = entityMap.get(key);
    if (existing) existing.identities = [...new Set([...existing.identities, ...entity.identities])];
    else entityMap.set(key, entity);
  }
  delete record.entities;
}
parentPort.postMessage({ type: 'done', records, entities: [...entityMap.values()], processed, bytes });
`;

const REFERENCE_WORKER = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
function fragments(value) {
  const normalized = String(value || '').toLowerCase().replace(/\.json$/i, '').replace(/[^a-z0-9]+/g, '');
  return normalized.length >= 4 ? [normalized] : [];
}
function visit(value, source, entities) {
  if (Array.isArray(value)) { for (const item of value) visit(item, source, entities); return; }
  if (!value || typeof value !== 'object') return;
  const ids = ['canonical_id','id','artifact_id','item_id','buff_id','matrix_id','pet_id','weapon_id','slug','codeName','character'];
  const names = ['name_en','name','title_en','weapon_name','display_name','en','title'];
  const idKey = ids.find(key => typeof value[key] === 'string' && value[key]);
  const nameKey = names.find(key => typeof value[key] === 'string' && value[key]);
  if (idKey && nameKey && String(value[idKey]).length < 180 && String(value[nameKey]).length < 260) {
    const identityKeys = Object.keys(value).filter(key => /(^id$|_id$|id$|asset|ability|icon|image|code|slug|effect_figure|source_file)/i.test(key));
    const identities = [value[idKey], ...identityKeys.map(key => value[key])]
      .filter(item => typeof item === 'string').flatMap(fragments);
    entities.push({ id: value[idKey], type: path.basename(source, '.json'), name: value[nameKey],
      nameRu: typeof value.name_ru === 'string' ? value.name_ru : (typeof value.ru === 'string' ? value.ru : undefined), identities, source });
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const childName = typeof child.name_en === 'string' ? child.name_en
        : (typeof child.name === 'string' ? child.name : (typeof child.en === 'string' ? child.en : undefined));
      if (childName && key.length >= 4 && key.length < 180) {
        entities.push({
          id: key,
          type: path.basename(source, '.json'),
          name: childName,
          nameRu: typeof child.name_ru === 'string' ? child.name_ru : (typeof child.ru === 'string' ? child.ru : undefined),
          identities: fragments(key),
          source,
        });
      }
    }
    visit(child, source, entities);
  }
}
const entities = [];
let processed = 0;
let bytes = 0;
for (const file of workerData.files) {
  try { const raw = fs.readFileSync(file, 'utf8'); bytes += Buffer.byteLength(raw); visit(JSON.parse(raw), file, entities); } catch {}
  processed++;
  if (processed % 25 === 0) parentPort.postMessage({ type: 'progress', processed, bytes });
}
parentPort.postMessage({ type: 'done', entities, processed, bytes });
`;

/** Client recorded by the extraction step (export-version.json) for the scanned tree. */
function readScannedClient(inputDir: string): { gameVersion: string | null; clientName: string | null; clientUpdatedAt: string | null } {
  for (const candidate of [path.join(inputDir, 'export-version.json'), path.join(path.dirname(inputDir), 'export-version.json')]) {
    try {
      const info = JSON.parse(fs.readFileSync(candidate, 'utf8').replace(/^﻿/, ''));
      return {
        gameVersion: info.version ? String(info.version) : null,
        clientName: info.clientName ? String(info.clientName) : null,
        clientUpdatedAt: info.lastUpdateIso ? String(info.lastUpdateIso) : null,
      };
    } catch {
      // Try the next location.
    }
  }
  return { gameVersion: null, clientName: null, clientUpdatedAt: null };
}

function collectJsonFiles(root: string): string[] {
  const files: string[] = [];
  const pending = [path.resolve(root)];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function scanChunk(files: string[], onProgress: (state: ProgressState) => void): Promise<ScanChunkResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SCAN_WORKER, { eval: true, workerData: { files } });
    worker.on('message', (message) => {
      if (message?.type === 'progress') onProgress(message);
      if (message?.type === 'done') {
        onProgress(message);
        resolve({ records: message.records, entities: message.entities });
      }
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Multype worker exited with code ${code}.`));
    });
  });
}

function referenceChunk(files: string[], onProgress: (state: ProgressState) => void): Promise<ReferenceEntity[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(REFERENCE_WORKER, { eval: true, workerData: { files } });
    worker.on('message', (message) => {
      if (message?.type === 'progress') onProgress(message);
      if (message?.type === 'done') { onProgress(message); resolve(message.entities); }
    });
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Reference worker exited with code ${code}.`)); });
  });
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function createProgressReporter(
  phase: string,
  total: number,
  workerCount: number,
  onSnapshot?: (snapshot: { phase: string; processed: number; total: number; bytes: number; percent: number }) => void
) {
  const states = Array.from({ length: workerCount }, () => ({ processed: 0, bytes: 0 }));
  const startedAt = Date.now();
  let lastPrintedAt = 0;
  return (workerIndex: number, state: ProgressState, force = false) => {
    states[workerIndex] = state;
    const processed = states.reduce((sum, item) => sum + item.processed, 0);
    const bytes = states.reduce((sum, item) => sum + item.bytes, 0);
    const now = Date.now();
    if (!force && now - lastPrintedAt < 1000) return;
    lastPrintedAt = now;
    const elapsedSeconds = Math.max(0.001, (now - startedAt) / 1000);
    const rate = processed / elapsedSeconds;
    const remaining = rate > 0 ? Math.max(0, Math.round((total - processed) / rate)) : 0;
    const percent = total ? Math.min(100, processed / total * 100) : 100;
    onSnapshot?.({ phase, processed, total, bytes, percent: Number(percent.toFixed(1)) });
    process.stdout.write(`\r[${phase}] ${processed.toLocaleString()}/${total.toLocaleString()} ${percent.toFixed(1)}% | ${formatBytes(bytes)} | ${Math.round(rate).toLocaleString()} files/s | ETA ${remaining}s   `);
    if (force || processed >= total) process.stdout.write('\n');
  };
}

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/\.json$/i, '').replace(/[^a-z0-9]+/g, '');
}

function identityFragments(value: string): string[] {
  const base = value.replace(/\.json$/i, '');
  const parts = base.split(/[^A-Za-z0-9]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  const fragments = new Set<string>([normalizeIdentity(base)]);
  for (let start = 0; start < parts.length; start++) {
    for (let end = start + 1; end <= Math.min(parts.length, start + 4); end++) {
      const candidate = normalizeIdentity(parts.slice(start, end).join(''));
      if (candidate.length >= 5) fragments.add(candidate);
    }
  }
  return [...fragments];
}

function collectReferenceEntities(value: unknown, source: string, output: ReferenceEntity[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectReferenceEntities(item, source, output);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const id = [record.canonical_id, record.id, record.slug, record.codeName].find((item) => typeof item === 'string') as string | undefined;
  const name = [record.name_en, record.name, record.title_en, record.weapon_name].find((item) => typeof item === 'string') as string | undefined;
  if (id && name && id.length < 160 && name.length < 240) {
    const scalarIdentities = Object.entries(record)
      .filter(([key, item]) => typeof item === 'string' && /(^id$|_id$|id$|asset|ability|icon|image|code|slug)/i.test(key))
      .map(([, item]) => String(item));
    output.push({
      id,
      type: path.basename(source, '.json'),
      name,
      nameRu: typeof record.name_ru === 'string' ? record.name_ru : undefined,
      identities: [id, ...scalarIdentities].flatMap(identityFragments),
      source,
    });
  }
  for (const child of Object.values(record)) collectReferenceEntities(child, source, output);
}

function shouldIndexReference(file: string, root: string): boolean {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const base = path.basename(file).toLowerCase();
  if (relative.includes('/seasons/') || relative.includes('/changelog/')) return false;
  return /^(relics|items|simulacra|matrices|pets|multype|buffs)\.json$/.test(base) ||
    /(catalog|links|usage|descriptions|profiles_index|media_references)\.json$/.test(base);
}

async function loadReferenceEntities(referenceDir: string | undefined, jobs: number): Promise<ReferenceEntity[]> {
  if (!referenceDir || !fs.existsSync(referenceDir)) return [];
  const files = collectJsonFiles(referenceDir).filter((file) => shouldIndexReference(file, referenceDir));
  const batches = createDynamicBatches(files, jobs);
  console.log(`[3/5 REFERENCES] ${files.length.toLocaleString()} selected JSON files, ${jobs} workers, ${batches.length} dynamic batches.`);
  const progress = createProgressReporter('REFERENCES', files.length, batches.length);
  const workerStates = batches.map(() => ({ processed: 0, bytes: 0 }));
  const results = await runDynamicQueue(batches, jobs, (batch, index) => referenceChunk(batch, (state) => {
    workerStates[index] = state;
    progress(index, state);
  }));
  if (batches.length) progress(batches.length - 1, workerStates[batches.length - 1], true);
  const entities = results.flat();
  const unique = new Map<string, ReferenceEntity>();
  for (const entity of entities) unique.set(`${entity.type}:${entity.id}:${entity.name}`, entity);
  return [...unique.values()];
}

function buildGuesses(fileNames: string[], references: ReferenceEntity[]): Record<string, MultypeGuess> {
  const guesses: Record<string, MultypeGuess> = {};
  const index = new Map<string, ReferenceEntity[]>();
  const prefixIndex = new Map<string, ReferenceEntity[]>();
  for (const entity of references) {
    for (const identity of entity.identities) {
      const bucket = index.get(identity) || [];
      bucket.push(entity);
      index.set(identity, bucket);
      const prefix = identity.slice(0, 8);
      const prefixBucket = prefixIndex.get(prefix) || [];
      prefixBucket.push(entity);
      prefixIndex.set(prefix, prefixBucket);
    }
  }
  let processed = 0;
  for (const fileName of fileNames) {
    const fragments = identityFragments(fileName);
    const candidates: MultypeGuessCandidate[] = [];
    const possible = new Set<ReferenceEntity>();
    for (const fragment of fragments) {
      for (const entity of index.get(fragment) || []) possible.add(entity);
      for (const entity of prefixIndex.get(fragment.slice(0, 8)) || []) {
        for (const identity of entity.identities) {
        if (identity.length >= 8 && (fragment.includes(identity) || identity.includes(fragment))) {
            possible.add(entity);
          }
        }
      }
    }
    for (const entity of possible) {
      let best = 0;
      let matched = '';
      for (const left of fragments) {
        for (const right of entity.identities) {
          if (left === right && right.length >= 6) {
            const score = right === normalizeIdentity(entity.id) ? 0.98 : 0.92;
            if (score > best) { best = score; matched = right; }
          } else if (right.length >= 8 && (left.includes(right) || right.includes(left))) {
            const score = Math.min(0.88, 0.62 + Math.min(left.length, right.length) / Math.max(left.length, right.length) * 0.24);
            if (score > best) { best = score; matched = right; }
          }
        }
      }
      if (best >= 0.68) {
        candidates.push({
          label: entity.name,
          labelRu: entity.nameRu,
          entityType: entity.type,
          entityId: entity.id,
          confidence: Number(best.toFixed(2)),
          evidence: [`filename identity “${matched}”`, `reference ${path.basename(entity.source)}`],
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
    guesses[fileName] = { sourceKey: fileName, candidates: candidates.slice(0, 5) };
    processed++;
    if (processed % 1000 === 0 || processed === fileNames.length) {
      process.stdout.write(`\r[4/5 GUESSES] ${processed.toLocaleString()}/${fileNames.length.toLocaleString()} ${(processed / Math.max(1, fileNames.length) * 100).toFixed(1)}%   `);
    }
  }
  if (fileNames.length) process.stdout.write('\n');
  return guesses;
}

export async function runAdvancedMultype(options: {
  inputDir: string;
  outputDir: string;
  referenceDir?: string;
  jobs?: number;
}): Promise<AdvancedMultypeResult> {
  const startTime = Date.now();
  const inputDir = path.resolve(options.inputDir);
  const outputDir = path.resolve(options.outputDir);
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    throw new Error(`Advanced Multype input directory does not exist: ${inputDir}`);
  }
  if (inputDir === outputDir) {
    throw new Error('Advanced Multype output must not replace the scanned input directory.');
  }
  const files = collectJsonFiles(inputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const progressPath = path.join(outputDir, 'advanced-multype-progress.json');
  const writeProgress = (snapshot: Record<string, unknown>) => {
    fs.writeFileSync(progressPath, JSON.stringify({
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      ...snapshot,
    }, null, 2));
  };
  const detectedCpu = os.availableParallelism?.() || os.cpus().length;
  const jobs = Math.max(1, Math.min(options.jobs || detectedCpu, files.length || 1));
  console.log(`[1/5 DISCOVER] ${files.length.toLocaleString()} JSON files. Using ${jobs}/${detectedCpu} logical CPUs.`);
  const batches = createDynamicBatches(files, jobs);
  console.log(`[2/5 SCAN] Scanning gameplay modifiers in ${batches.length} dynamic batches...`);
  writeProgress({ status: 'running', phase: 'DISCOVER', processed: files.length, total: files.length, percent: 100 });
  const progress = createProgressReporter('SCAN', files.length, batches.length, (snapshot) =>
    writeProgress({ status: 'running', ...snapshot })
  );
  const states = batches.map(() => ({ processed: 0, bytes: 0 }));
  const scanResults = await runDynamicQueue(batches, jobs, (batch, index) => scanChunk(batch, (state) => {
    states[index] = state;
    progress(index, state);
  }));
  const records = scanResults.flatMap((result) => result.records);
  if (batches.length) progress(batches.length - 1, states[batches.length - 1], true);

  const mapping: Record<string, Record<string, string[]>> = {};
  for (const record of records) {
    for (const [moduleType, attributeName] of record.pairs) {
      const attributes = (mapping[moduleType] ||= {});
      const names = (attributes[attributeName] ||= []);
      if (!names.includes(record.fileName)) names.push(record.fileName);
    }
  }
  for (const attributes of Object.values(mapping)) {
    for (const names of Object.values(attributes)) names.sort((a, b) => a.localeCompare(b));
  }

  const extractedReferences = scanResults.flatMap((result) => result.entities);
  const supplementalReferences = await loadReferenceEntities(options.referenceDir, jobs);
  const references = [...extractedReferences, ...supplementalReferences];
  const matchedFiles = records.filter((record) => record.pairs.length).map((record) => record.fileName);
  const guesses = buildGuesses(matchedFiles, references);
  console.log('[5/5 WRITE] Writing deterministic artifacts...');
  const generatedAt = new Date().toISOString();
  // The site pipeline never rescans Multype, so the snapshot carries its own game version.
  fs.writeFileSync(path.join(outputDir, 'multype-scan.json'), JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    ...readScannedClient(inputDir),
  }, null, 2));
  fs.writeFileSync(path.join(outputDir, 'module_extra_to_files_mapping3.json'), JSON.stringify(mapping, null, 2));
  fs.writeFileSync(path.join(outputDir, 'multype_ai_guesses.json'), JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    source: 'advanced-multype',
    referenceDir: options.referenceDir ? path.resolve(options.referenceDir) : null,
    guesses,
  }, null, 2));
  fs.writeFileSync(path.join(outputDir, 'advanced-multype-report.json'), JSON.stringify({
    schemaVersion: 1,
    filesScanned: files.length,
    filesWithAttributes: matchedFiles.length,
    categories: Object.keys(mapping).length,
    guessesWithCandidates: Object.values(guesses).filter((guess) => guess.candidates.length).length,
    workers: jobs,
    durationMs: Date.now() - startTime,
  }, null, 2));
  writeProgress({
    status: 'complete',
    phase: 'WRITE',
    processed: files.length,
    total: files.length,
    percent: 100,
    durationMs: Date.now() - startTime,
  });

  return { mapping, guesses, filesScanned: files.length, filesWithAttributes: matchedFiles.length, durationMs: Date.now() - startTime, outputDir };
}
