import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type Job = {
  id: string;
  script: string;
  type: string;
  resourceClass?: string;
  argsTemplate?: string[];
  dependsOn?: string[];
  produces?: string[];
};
type JobContract = { defaultResourceCaps?: { maxHeavy?: number }; jobs: Job[] };
type Result = { id: string; status: 'success' | 'failed' | 'blocked'; startedAt?: string; durationMs?: number; exitCode?: number | null; error?: string };

function argsMap(argv: string[]): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const item of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(item);
    if (match) values.set(match[1], match[2]);
    else if (item.startsWith('--')) flags.add(item.slice(2));
  }
  return { values, flags };
}

function integer(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer`);
  return parsed;
}

function resolveProduced(projectRoot: string, relative: string): string[] {
  const clean = path.normalize(relative.replace(/[\\/]+/g, path.sep));
  if (path.isAbsolute(clean) || clean === '..' || clean.startsWith(`..${path.sep}`)) throw new Error(`Job output must be relative: ${relative}`);
  const first = clean.split(path.sep)[0].toLowerCase();
  if (['datamine', 'info', 'data', 'shared'].includes(first)) return [path.join(projectRoot, clean)];
  return [path.join(projectRoot, clean), path.join(projectRoot, 'datamine', clean), path.join(projectRoot, 'info', clean), path.join(projectRoot, 'datamine2', clean)];
}

function matchesOutput(projectRoot: string, pattern: string): boolean {
  const normalized = path.normalize(pattern.replace(/[\\/]+/g, path.sep));
  const paths = resolveProduced(projectRoot, normalized);
  if (!normalized.includes('*')) return paths.some((candidate) => fs.existsSync(candidate));
  const star = normalized.lastIndexOf('*');
  const slash = normalized.lastIndexOf(path.sep, star);
  const relativeDir = slash < 0 ? '' : normalized.slice(0, slash);
  const suffix = normalized.slice(star + 1);
  return resolveProduced(projectRoot, relativeDir || '.').some((directory) => {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return false;
    return fs.readdirSync(directory).some((entry) => entry.endsWith(suffix));
  });
}

function validateGraph(jobs: Job[]): Map<string, Job> {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  if (byId.size !== jobs.length) throw new Error('Job contract contains duplicate IDs.');
  for (const job of jobs) {
    for (const dependency of job.dependsOn ?? []) if (!byId.has(dependency)) throw new Error(`Job ${job.id} depends on unknown job ${dependency}.`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`Job dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const job of jobs) visit(job.id);
  return byId;
}

function spawnJob(command: string, script: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code }));
  });
}

async function main(): Promise<void> {
  const { values, flags } = argsMap(process.argv.slice(2));
  const dir = path.resolve(values.get('dir') ?? '');
  const buildDir = path.resolve(values.get('build-dir') ?? path.dirname(dir));
  const rawDir = path.resolve(values.get('raw-dir') ?? '');
  const projectRoot = path.resolve(values.get('project-root') ?? '');
  const jobsFile = path.resolve(values.get('jobs-file') ?? '');
  const telemetryFile = values.get('telemetry-file') ? path.resolve(values.get('telemetry-file')!) : undefined;
  if (!values.has('dir') || !values.has('raw-dir') || !values.has('project-root') || !values.has('jobs-file') || !values.has('contract')) {
    throw new Error('Usage: run-processors.js --dag --dir=<processors> --build-dir=<build> --raw-dir=<raw> --project-root=<stage> --jobs-file=<jobs.json> --contract=<outputs.json>');
  }
  if (!flags.has('dag')) throw new Error('run-processors requires --dag.');
  if (!fs.statSync(dir).isDirectory() || !fs.statSync(projectRoot).isDirectory()) throw new Error('Processor and project directories must exist.');
  const jobContract = JSON.parse(fs.readFileSync(jobsFile, 'utf8').replace(/^\uFEFF/, '')) as JobContract;
  const jobs = (jobContract.jobs ?? []).filter((job) => job.type === 'processor');
  const byId = validateGraph(jobs);
  const concurrency = integer(values.get('concurrency'), 1, 'concurrency');
  const maxHeavy = integer(values.get('max-heavy'), jobContract.defaultResourceCaps?.maxHeavy ?? 1, 'max-heavy');
  const results = new Map<string, Result>();
  const running = new Map<string, Promise<void>>();
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    TOF_RAW_GAME_DIR: rawDir,
    TOF_PROJECT_ROOT: projectRoot,
    ...(values.get('curated-dir') ? { TOF_CURATED_DIR: path.resolve(values.get('curated-dir')!) } : {}),
  };

  const launch = (job: Job) => {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const script = path.join(dir, job.script);
    if (!fs.existsSync(script)) throw new Error(`Processor script for ${job.id} does not exist: ${script}`);
    const replacements: Record<string, string> = { rawDir, projectRoot, buildDir };
    const args = (job.argsTemplate ?? []).map((arg) => arg.replace(/\{(rawDir|projectRoot|buildDir)\}/g, (_match, key: string) => replacements[key]));
    console.log(`[processors] START ${job.id}${job.resourceClass && job.resourceClass !== 'default' ? ` [${job.resourceClass}]` : ''}`);
    const result: Result = { id: job.id, status: 'failed' };
    const task = spawnJob(process.execPath, script, args, projectRoot, baseEnv).then(({ code }) => {
      result.durationMs = Date.now() - started;
      result.exitCode = code;
      if (code !== 0) {
        result.status = 'failed';
        result.error = `Process exited with code ${code}`;
        console.error(`[processors] FAILED ${job.id} (${code})`);
        return;
      }
      const missing = (job.produces ?? []).filter((output) => !matchesOutput(projectRoot, output));
      if (missing.length) {
        result.status = 'failed';
        result.error = `Missing declared output(s): ${missing.join(', ')}`;
        console.error(`[processors] FAILED ${job.id}: ${result.error}`);
        return;
      }
      result.status = 'success';
      console.log(`[processors] DONE ${job.id} (${(result.durationMs / 1000).toFixed(1)}s)`);
    }).catch((error: unknown) => {
      result.durationMs = Date.now() - started;
      result.error = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      console.error(`[processors] FAILED ${job.id}: ${result.error}`);
    }).finally(() => {
      result.startedAt = startedAt;
      results.set(job.id, result);
      running.delete(job.id);
    });
    running.set(job.id, task);
  };

  while (results.size < jobs.length) {
    let launched = false;
    for (const job of jobs) {
      if (results.has(job.id) || running.has(job.id)) continue;
      const dependencies = job.dependsOn ?? [];
      const completedDependencies = dependencies.map((id) => results.get(id));
      if (completedDependencies.some((result) => result && result.status !== 'success')) {
        results.set(job.id, { id: job.id, status: 'blocked', error: 'A dependency did not complete successfully.' });
        launched = true;
        continue;
      }
      if (running.size >= concurrency || !completedDependencies.every((result) => result?.status === 'success')) continue;
      const isHeavy = (job.resourceClass ?? '').startsWith('heavy');
      const heavyRunning = [...running.keys()].filter((id) => (byId.get(id)?.resourceClass ?? '').startsWith('heavy')).length;
      if (isHeavy && heavyRunning >= maxHeavy) continue;
      launch(job);
      launched = true;
    }
    if (running.size) await Promise.race(running.values());
    else if (!launched && results.size < jobs.length) {
      for (const job of jobs) if (!results.has(job.id)) {
        results.set(job.id, { id: job.id, status: 'blocked', error: 'No runnable dependency-graph job.' });
      }
    }
  }

  if (telemetryFile) {
    fs.mkdirSync(path.dirname(telemetryFile), { recursive: true });
    fs.writeFileSync(telemetryFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), jobs: jobs.map((job) => results.get(job.id)) }, null, 2)}\n`);
  }
  const summary = [...results.values()].reduce((counts, result) => {
    counts[result.status]++;
    return counts;
  }, { success: 0, failed: 0, blocked: 0 });
  console.log(`[processors] ${summary.success} succeeded, ${summary.failed} failed, ${summary.blocked} blocked.`);
  if (summary.failed || summary.blocked) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(`[processors] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
