import fs from 'node:fs';
import path from 'node:path';

type ManagedOutput = { path: string; root?: string };
type OutputContract = {
  managed?: ManagedOutput[];
  buildIntermediates?: string[];
  curatedPreserve?: string[];
  secondaryCuratedPreserve?: string[];
};

function argsMap(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (const item of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(item);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function stageTargets(projectRoot: string, output: ManagedOutput | string): string[] {
  const relative = typeof output === 'string' ? output : output.path;
  const root = typeof output === 'string' ? undefined : output.root;
  const clean = path.normalize(relative.replace(/[\\/]+/g, path.sep));
  if (path.isAbsolute(clean) || clean === '..' || clean.startsWith(`..${path.sep}`)) {
    throw new Error(`Output contract path must be relative: ${relative}`);
  }
  if (root === 'datamine2') return [path.join(projectRoot, 'datamine2', clean)];
  if (/^(datamine|info|data|shared)([\\/]|$)/i.test(relative)) return [path.join(projectRoot, clean)];
  // The default legacy tree for processor outputs is datamine/; info processors
  // declare root=datamine2 in outputs.json.
  return [path.join(projectRoot, 'datamine', clean)];
}

function removeManagedFile(projectRoot: string, target: string, preserve: string[]): boolean {
  const absolute = path.resolve(target);
  if (!inside(projectRoot, absolute)) throw new Error(`Refusing to clean outside staging root: ${target}`);
  if (preserve.some((item) => inside(item, absolute))) return false;
  if (!fs.existsSync(absolute)) return false;
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() && !stat.isSymbolicLink()) return false;
  fs.rmSync(absolute, { force: true });
  return true;
}

function main(): void {
  const args = argsMap(process.argv.slice(2));
  const projectRoot = path.resolve(args.get('project-root') ?? '');
  const contractPath = path.resolve(args.get('contract') ?? '');
  if (!args.has('project-root') || !args.has('contract')) {
    throw new Error('Usage: prepare-staging.js --project-root=<stage> --contract=<outputs.json>');
  }
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new Error(`Staging root does not exist: ${projectRoot}`);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8').replace(/^\uFEFF/, '')) as OutputContract;
  const preserve = [...(contract.curatedPreserve ?? []), ...(contract.secondaryCuratedPreserve ?? [])]
    .flatMap((item) => ['datamine', 'datamine2'].map((root) => path.resolve(projectRoot, root, item)));
  let removed = 0;
  for (const output of contract.managed ?? []) {
    for (const target of stageTargets(projectRoot, output)) if (removeManagedFile(projectRoot, target, preserve)) removed++;
  }
  for (const intermediate of contract.buildIntermediates ?? []) {
    for (const target of stageTargets(projectRoot, intermediate)) if (removeManagedFile(projectRoot, target, preserve)) removed++;
  }
  console.log(`[prepare-staging] Cleared ${removed} stale managed files from ${projectRoot}.`);
}

main();
