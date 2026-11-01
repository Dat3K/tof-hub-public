import fs from 'node:fs';
import path from 'node:path';
import { loadExportRules } from '../src/selective-list';

/**
 * Reads the JSONL written by fs-trace.cjs during `pipeline --trace` and reports:
 *   requiredRaw   raw-export files the pipeline actually opened (selective extraction list)
 *   uncovered     required files no export rule matches (the next game export would miss them)
 *   probedMissing optional raw paths a step looked for but the export does not contain
 *   hiddenDeps    staged files a processor reads although the DAG does not order it after the writer
 *   optionalProbes staged paths existence-checked without a recorded read; probe success is unknown
 *
 *   tsx scripts/trace-report.ts --trace <work>/trace --raw <raw root> --stage <work>/stage
 *       --jobs ../../scripts/game-processors/contracts/jobs.json --out <report.json>
 */

interface TraceLine { script: string; op: 'read' | 'probe' | 'list' | 'write'; path: string }

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`--${name} is required`);
  return path.resolve(value);
}

const norm = (value: string) => value.replace(/\\/g, '/').toLowerCase();

function readTrace(dir: string): TraceLine[] {
  const lines: TraceLine[] = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
      if (!line) continue;
      try {
        lines.push(JSON.parse(line));
      } catch {
        // A process killed mid-write leaves a partial last line.
      }
    }
  }
  return lines;
}

function main(): void {
  const raw = option('raw');
  const stage = option('stage');
  const trace = readTrace(option('trace'));
  const jobs: Array<{ id: string; script: string; dependsOn: string[] }> = JSON.parse(fs.readFileSync(option('jobs'), 'utf8')).jobs;
  const rawPrefix = norm(raw) + '/';
  const stagePrefix = norm(stage) + '/';
  const isStageFile = (fullPath: string): boolean => {
    try {
      return fs.statSync(fullPath).isFile();
    } catch {
      return false;
    }
  };

  const required = new Map<string, Set<string>>();
  const probedMissing = new Set<string>();
  // Directory listings mean a step discovers files by folder: the export must keep the whole folder.
  const listedDirs = new Map<string, Set<string>>();
  const writers = new Map<string, Set<string>>();
  const stageReads = new Map<string, Set<string>>();
  const stageProbes = new Map<string, Set<string>>();
  for (const entry of trace) {
    const full = norm(entry.path);
    if (full.startsWith(rawPrefix)) {
      const rel = entry.path.replace(/\\/g, '/').slice(rawPrefix.length);
      if (entry.op === 'write') continue;
      if (entry.op === 'list') {
        (listedDirs.get(rel) ?? listedDirs.set(rel, new Set()).get(rel)!).add(entry.script);
        continue;
      }
      if (fs.existsSync(entry.path) && fs.statSync(entry.path).isFile()) {
        if (entry.op === 'read') (required.get(rel) ?? required.set(rel, new Set()).get(rel)!).add(entry.script);
      } else if (entry.op === 'probe' && !fs.existsSync(entry.path)) {
        probedMissing.add(rel);
      }
    } else if (full.startsWith(stagePrefix)) {
      const rel = full.slice(stagePrefix.length);
      // mkdirSync and directory probes/reads were logged as paths too. They are
      // not generated-data dependencies; only compare actual staged files.
      if (!isStageFile(entry.path)) continue;
      const bucket = entry.op === 'write' ? writers : entry.op === 'read' ? stageReads : entry.op === 'probe' ? stageProbes : null;
      if (bucket) (bucket.get(rel) ?? bucket.set(rel, new Set()).get(rel)!).add(entry.script);
    }
  }

  // Transitive DAG dependencies by script name.
  const byScript = new Map(jobs.map((job) => [job.script, job]));
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const ancestors = (script: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [...(byScript.get(script)?.dependsOn ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      const job = byId.get(id);
      if (!job || seen.has(job.script)) continue;
      seen.add(job.script);
      stack.push(...job.dependsOn);
    }
    return seen;
  };
  const hiddenDeps: Array<{ reader: string; writer: string; file: string }> = [];
  for (const [file, readers] of stageReads) {
    for (const writer of writers.get(file) ?? []) {
      for (const reader of readers) {
        if (reader === writer || !byScript.has(reader) || !byScript.has(writer)) continue;
        if (!ancestors(reader).has(writer)) hiddenDeps.push({ reader, writer, file });
      }
    }
  }
  const optionalProbes: Array<{ reader: string; writer: string; file: string }> = [];
  for (const [file, readers] of stageProbes) {
    for (const writer of writers.get(file) ?? []) {
      for (const reader of readers) {
        if (reader === writer || !byScript.has(reader) || !byScript.has(writer)) continue;
        if (!ancestors(reader).has(writer)) optionalProbes.push({ reader, writer, file });
      }
    }
  }

  const rules = loadExportRules();
  const patterns = rules.rules.map((rule) => {
    const [regex, format] = rule.pattern.split(/:(?=json$|png$)/);
    return { regex: new RegExp(`^${regex}$`, 'i'), format };
  });
  const covered = (rel: string) => {
    const asset = rel.replace(/\.(json|png)$/i, '.uasset');
    const format = /\.png$/i.test(rel) ? 'png' : 'json';
    return patterns.some((p) => p.format === format && (p.regex.test(asset) || p.regex.test(rel.replace(/\.json$/i, '.locres'))));
  };
  const requiredList = [...required.keys()].sort();
  const uncovered = requiredList.filter((rel) => /^(Hotta|Engine)\//.test(rel) && !covered(rel));
  const summary = {
    generatedAt: new Date().toISOString(),
    requiredRaw: requiredList.length,
    uncovered: uncovered.length,
    hiddenDeps: hiddenDeps.length,
    optionalProbes: optionalProbes.length,
    bySuffix: requiredList.reduce<Record<string, number>>((acc, rel) => ((acc[path.extname(rel)] = (acc[path.extname(rel)] || 0) + 1), acc), {}),
  };
  const report = {
    summary,
    uncovered,
    hiddenDeps: hiddenDeps.sort((a, b) => a.reader.localeCompare(b.reader) || a.file.localeCompare(b.file)),
    optionalProbes: optionalProbes.sort((a, b) => a.reader.localeCompare(b.reader) || a.file.localeCompare(b.file)),
    requiredRaw: Object.fromEntries(requiredList.map((rel) => [rel, [...required.get(rel)!].sort()])),
    listedDirs: Object.fromEntries([...listedDirs.keys()].sort().map((rel) => [rel, [...listedDirs.get(rel)!].sort()])),
    probedMissing: [...probedMissing].sort(),
  };
  fs.writeFileSync(option('out'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main();
