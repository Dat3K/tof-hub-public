import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileProcessors } from '../../scripts/compile-processors';

function write(root: string, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
}

test('compile-processors: keeps the layout, resolves sibling imports and copies data files', async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-proc-src-'));
  const out = `${source}-out`;
  write(source, {
    'processors/shared/helper.ts': 'export function label(id: string): string { return `#${id}`; }\n',
    'processors/types.d.ts': 'interface Unused { x: number }\n',
    'processors/mapping.json': '{"a":1}\n',
    'processors/job.ts': [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "import { label } from './shared/helper';",
      "const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapping.json'), 'utf8'));",
      'if (require.main === module) console.log(label(String(mapping.a)));',
      '',
    ].join('\n'),
    'build/runner.ts': 'export const ok = true;\n',
    'contracts/jobs.json': '{"jobs":[]}\n',
  });
  assert.equal(await compileProcessors(out, source), 3);
  assert.ok(fs.existsSync(path.join(out, 'contracts/jobs.json')));
  assert.ok(fs.existsSync(path.join(out, 'build/runner.js')));
  assert.ok(!fs.existsSync(path.join(out, 'processors/types.js')));
  assert.equal(execFileSync(process.execPath, [path.join(out, 'processors/job.js')], { encoding: 'utf8' }).trim(), '#1');
});
