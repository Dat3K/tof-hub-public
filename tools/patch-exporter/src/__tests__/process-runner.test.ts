import test from 'node:test';
import assert from 'node:assert/strict';
import { DefaultProcessRunner } from '../process-runner';

test('Process runner: inherited console bypasses output capture', async () => {
  const runner = new DefaultProcessRunner();
  const result = await runner.run(process.execPath, ['-e', 'console.log("inherited stdout"); console.error("inherited stderr")'], {
    stdio: 'inherit', windowsHide: false,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('Process runner: other commands retain piped output', async () => {
  const result = await new DefaultProcessRunner().run(process.execPath, ['-e', 'console.log("captured stdout"); console.error("captured stderr"); process.exitCode = 2'], { streamOutput: false });
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /captured stdout/);
  assert.match(result.stderr, /captured stderr/);
});
