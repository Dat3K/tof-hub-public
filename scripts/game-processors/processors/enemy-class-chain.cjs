'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Shared by compiled processors and plain-Node site generators. */
function traceEnemyClass(rawDir, classPath, readRaw) {
  const chain = [], seen = new Set();
  let reference = classPath;
  while (typeof reference === 'string' && (reference.startsWith('/Game/') || reference.startsWith('Hotta/Content/')) && !seen.has(reference.toLowerCase()) && seen.size < 64) {
    seen.add(reference.toLowerCase());
    const packagePath = (reference.startsWith('/Game/') ? reference.slice('/Game/'.length) : reference.slice('Hotta/Content/'.length)).split('.')[0];
    if (packagePath.split('/').includes('..')) break;
    const file = `Hotta/Content/${packagePath}.json`;
    const full = path.join(rawDir, file);
    const objects = readRaw ? readRaw(file) : fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '')) : null;
    if (!Array.isArray(objects)) break;
    chain.push({ reference, file, properties: objects.find(object => object.Name?.startsWith('Default__'))?.Properties ?? {} });
    const generated = objects.find(object => object.Type === 'BlueprintGeneratedClass');
    reference = generated?.Super?.ObjectPath ?? generated?.SuperStruct?.ObjectPath;
  }
  return chain;
}
module.exports = { traceEnemyClass };
