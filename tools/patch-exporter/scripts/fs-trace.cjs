'use strict';
// Preloaded with `node --require fs-trace.cjs` (NODE_OPTIONS) by the pipeline's --trace mode.
// Appends one JSON line per filesystem read/write to $TOF_FS_TRACE_DIR/<pid>.jsonl so the
// pipeline can derive (a) which raw-export files each step needs — the selective extraction
// list — and (b) which staged outputs a processor reads before the step that produces them.
const fs = require('fs');
const path = require('path');

const dir = process.env.TOF_FS_TRACE_DIR;
if (dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${process.pid}.jsonl`);
  const script = path.basename(process.argv[1] || 'node');
  const seen = new Set();
  const original = { appendFileSync: fs.appendFileSync };
  const log = (op, target) => {
    if (typeof target !== 'string' && !(target instanceof URL)) return;
    const full = path.resolve(String(target instanceof URL ? target.pathname.replace(/^\/(\w:)/, '$1') : target));
    const key = op + '\0' + full;
    if (seen.has(key)) return;
    seen.add(key);
    try {
      original.appendFileSync(file, JSON.stringify({ script, op, path: full }) + '\n');
    } catch (_) {}
  };
  const wrap = (name, op) => {
    const fn = fs[name];
    if (typeof fn !== 'function') return;
    fs[name] = function traced(target, ...rest) {
      log(op, target);
      return fn.call(this, target, ...rest);
    };
  };
  for (const name of ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open']) wrap(name, 'read');
  for (const name of ['existsSync', 'statSync', 'lstatSync', 'stat', 'access', 'accessSync']) wrap(name, 'probe');
  for (const name of ['readdirSync', 'readdir', 'opendirSync']) wrap(name, 'list');
  for (const name of ['writeFileSync', 'writeFile', 'createWriteStream', 'appendFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'renameSync']) wrap(name, 'write');
  const copy = fs.copyFileSync;
  fs.copyFileSync = function tracedCopy(source, target, ...rest) {
    log('read', source);
    log('write', target);
    return copy.call(this, source, target, ...rest);
  };
  for (const name of ['readFile', 'open', 'stat', 'readdir', 'writeFile', 'copyFile']) {
    const fn = fs.promises[name];
    if (typeof fn !== 'function') continue;
    const op = name === 'stat' ? 'probe' : name === 'readdir' ? 'list' : /write/.test(name) ? 'write' : 'read';
    fs.promises[name] = function tracedPromise(target, ...rest) {
      log(op, target);
      if (name === 'copyFile') log('write', rest[0]);
      return fn.call(this, target, ...rest);
    };
  }
}
