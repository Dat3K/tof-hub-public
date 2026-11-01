import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {normalizeUnrealSoftReference} from './canonical-media-library';
import {readGameSourceFileSync} from './game-source-reader';

interface EffectRoot {
  id: string;
  references: Array<{field: string; asset?: string; value?: string}>;
}

/** Follow exact exported references only. This report is evidence, never an animation recipe. */
export function inspectCosmeticEffects(rawDir: string, roots: EffectRoot[], maxPackages = 512) {
  const nodes: Array<Record<string, unknown>> = [];
  const pending: string[] = [];
  const seen = new Set<string>();
  const issues: Array<{reference: string; reason: string}> = [];
  const packagePath = (reference: string): string | null => {
    if (!/^(?:\/(?:Game|Engine)\/|(?:Hotta|Engine)\/Content\/)/.test(reference)) return null;
    try {
      let normalized = normalizeUnrealSoftReference(reference);
      if (normalized?.startsWith('Engine/') && !normalized.startsWith('Engine/Content/')) {
        normalized = normalized.replace(/^Engine\//, 'Engine/Content/');
      }
      return normalized;
    } catch (error) {
      issues.push({reference, reason: error instanceof Error ? error.message : String(error)});
      return null;
    }
  };
  const enqueue = (reference: string) => {
    const normalized = packagePath(reference);
    if (!normalized || seen.has(normalized)) return normalized;
    seen.add(normalized);
    pending.push(normalized);
    return normalized;
  };
  const bindings = roots.map(root => ({id: root.id, references: root.references.map(reference => ({
    ...reference, packagePath: reference.asset ? enqueue(reference.asset) : null,
  }))}));
  for (let index = 0; index < pending.length && index < maxPackages; index++) {
    const relative = pending[index];
    const dependencies: Array<{field: string; reference: string; packagePath: string}> = [];
    const files: Array<{path: string; sha256: string}> = [];
    const exports: Array<{name: unknown; type: unknown; properties: unknown}> = [];
    for (const extension of ['.json', '.png']) {
      const source = `${relative}${extension}`;
      const full = path.join(rawDir, source);
      if (!fs.existsSync(full)) continue;
      const bytes = readGameSourceFileSync(full);
      files.push({path: source, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
      if (extension !== '.json') continue;
      try {
        const document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        for (const entry of Array.isArray(document) ? document : [document]) {
          exports.push({name: entry.Name, type: entry.Type, properties: entry.Properties});
        }
        const visit = (value: unknown, field: string) => {
          if (typeof value === 'string') {
            const target = enqueue(value);
            if (target) dependencies.push({field, reference: value, packagePath: target});
          } else if (Array.isArray(value)) {
            value.forEach((child, childIndex) => visit(child, `${field}[${childIndex}]`));
          } else if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, child]) => visit(child, field ? `${field}.${key}` : key));
          }
        };
        visit(document, '');
      } catch (error) {
        issues.push({reference: source, reason: `Invalid exported JSON: ${error instanceof Error ? error.message : String(error)}`});
      }
    }
    nodes.push({packagePath: relative, files, exports, dependencies, missing: files.length === 0});
  }
  return {schemaVersion: 1, status: 'evidence-only', roots: bindings, nodes,
    truncated: pending.length > maxPackages, deferredPackages: pending.slice(maxPackages), issues};
}

type ParameterSource = {packagePath: string; field: string};

/**
 * Effective material parameters: instance overrides nearest the root win, then the base Material's
 * cooked defaults (CachedExpressionData RuntimeEntries are index-aligned with Scalar/Vector/TextureValues).
 * The cooked expression graph is absent, so this establishes inputs, not how the shader uses them.
 */
export function resolveMaterialParameters(rawDir: string, reference: string, maxDepth = 32) {
  const chain: Array<{packagePath: string; type: string; name: string}> = [];
  const scalars: Record<string, {value: number} & ParameterSource> = {};
  const textures: Record<string, {asset: string; size?: {x: number; y: number}} & ParameterSource> = {};
  const issues: string[] = [];
  let functions: string[] = [];
  let current: string | null = toPackagePath(reference);
  const readExport = (packagePath: string) => {
    const file = path.join(rawDir, `${packagePath}.json`);
    if (!fs.existsSync(file)) return null;
    const document = JSON.parse(readGameSourceFileSync(file).toString('utf8').replace(/^\uFEFF/, ''));
    return (Array.isArray(document) ? document : [document]).find(entry => /^Material/.test(entry.Type)) ?? null;
  };
  while (current && chain.length < maxDepth) {
    const entry = readExport(current);
    if (!entry) { issues.push(`Missing material package ${current}`); break; }
    chain.push({packagePath: current, type: entry.Type, name: entry.Name});
    const properties = entry.Properties ?? {};
    for (const [index, parameter] of (properties.ScalarParameterValues ?? []).entries()) {
      const name = parameter.ParameterInfo?.Name;
      if (name && !(name in scalars)) scalars[name] = {value: parameter.ParameterValue, packagePath: current, field: `Properties.ScalarParameterValues[${index}]`};
    }
    for (const [index, parameter] of (properties.TextureParameterValues ?? []).entries()) {
      const name = parameter.ParameterInfo?.Name;
      const asset = parameter.ParameterValue?.ObjectPath;
      if (name && asset && !(name in textures)) textures[name] = {asset, packagePath: current, field: `Properties.TextureParameterValues[${index}]`};
    }
    if (entry.Type === 'Material') {
      const cached = entry.CachedExpressionData ?? properties.CachedExpressionData;
      const entries = cached?.Parameters?.RuntimeEntries;
      const values = cached?.Parameters?.ScalarValues ?? [];
      (entries?.ParameterInfos ?? []).forEach((info: {Name: string}, index: number) => {
        if (!(info.Name in scalars) && typeof values[index] === 'number') {
          scalars[info.Name] = {value: values[index], packagePath: current!, field: `CachedExpressionData.Parameters.ScalarValues[${index}]`};
        }
      });
      functions = [...new Set<string>((cached?.FunctionInfos ?? []).map((info: any) => info.Function?.ObjectPath).filter(Boolean))];
      break;
    }
    current = properties.Parent?.ObjectPath ? toPackagePath(properties.Parent.ObjectPath) : null;
  }
  for (const texture of Object.values(textures)) {
    const packagePath = toPackagePath(texture.asset);
    const file = packagePath && path.join(rawDir, `${packagePath}.json`);
    if (!file || !fs.existsSync(file)) continue;
    const document = JSON.parse(readGameSourceFileSync(file).toString('utf8').replace(/^\uFEFF/, ''));
    const entry = (Array.isArray(document) ? document : [document]).find(item => item.Type === 'Texture2D');
    if (entry?.SizeX && entry?.SizeY) texture.size = {x: entry.SizeX, y: entry.SizeY};
  }
  return {chain, scalars, textures, baseMaterialFunctions: functions, issues};
}

function toPackagePath(reference: string) {
  try {
    const normalized = normalizeUnrealSoftReference(reference);
    return normalized?.startsWith('Engine/') && !normalized.startsWith('Engine/Content/')
      ? normalized.replace(/^Engine\//, 'Engine/Content/') : normalized ?? null;
  } catch {
    return null;
  }
}
