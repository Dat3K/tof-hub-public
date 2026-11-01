import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { assertSafeInputOutputPaths, resolveRawExportTree } from '../path-guards';

test('Path Guards: rejects empty or missing paths', () => {
  assert.throws(
    () => assertSafeInputOutputPaths('', 'C:\\output'),
    /Prepared input directory parameter is required/
  );
  assert.throws(
    () => assertSafeInputOutputPaths('C:\\input', ''),
    /Output directory parameter is required/
  );
});

test('Path Guards: throws clear error if prepared input does not exist', () => {
  const nonExistent = path.join(os.tmpdir(), 'non-existent-input-' + Date.now());
  assert.throws(
    () => assertSafeInputOutputPaths(nonExistent, path.join(os.tmpdir(), 'out')),
    /Prepared input directory does not exist:.*Please provide a valid, pre-extracted game data directory/
  );
});

test('Path Guards: throws if prepared input is a file, not a directory', () => {
  const tempFile = path.join(os.tmpdir(), 'test-file-' + Date.now() + '.txt');
  fs.writeFileSync(tempFile, 'hello', 'utf8');

  try {
    assert.throws(
      () => assertSafeInputOutputPaths(tempFile, path.join(os.tmpdir(), 'out')),
      /Prepared input path is not a directory/
    );
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});

test('Path Guards: rejects identical input and output directories', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-test-'));
  try {
    assert.throws(
      () => assertSafeInputOutputPaths(tempDir, tempDir),
      /Output directory cannot be identical to input directory.*Outputs must reside outside source/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Path Guards: enforces "outputs outside source" (output inside input rejected)', () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-in-'));
  const nestedOutput = path.join(inputDir, 'subfolder', 'output');

  try {
    assert.throws(
      () => assertSafeInputOutputPaths(inputDir, nestedOutput),
      /Output directory.*cannot reside inside input directory.*Outputs must reside strictly outside source/
    );
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true });
  }
});

test('Path Guards: rejects input inside output directory', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-out-'));
  const nestedInput = path.join(outputDir, 'nested-input');
  fs.mkdirSync(nestedInput, { recursive: true });

  try {
    assert.throws(
      () => assertSafeInputOutputPaths(nestedInput, outputDir),
      /Input directory.*cannot reside inside output directory/
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('Path Guards: accepts valid separate input and output directories', () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-valid-in-'));
  const outputDir = path.join(os.tmpdir(), 'guard-valid-out-' + Date.now());

  try {
    const result = assertSafeInputOutputPaths(inputDir, outputDir);
    assert.equal(result.canonicalInput, path.resolve(inputDir));
    assert.equal(result.canonicalOutput, path.resolve(outputDir));
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true });
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('resolveRawExportTree: resolves single-level and double-nested raw_exports', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-test-'));

  try {
    // 1. Single level with Hotta
    const hottaDir = path.join(rootDir, 'Hotta');
    fs.mkdirSync(hottaDir);
    const treeSingle = resolveRawExportTree(rootDir);
    assert.equal(treeSingle.workingRoot, path.resolve(rootDir));
    assert.equal(treeSingle.unpackedRoot, path.resolve(rootDir));
    assert.equal(treeSingle.hasHottaContent, true);
    assert.equal(treeSingle.isDoubleNested, false);

    // 2. Double-nested: rootDir/raw_exports/Hotta
    const doubleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-double-'));
    const innerRawExports = path.join(doubleDir, 'raw_exports');
    const innerHotta = path.join(innerRawExports, 'Hotta');
    fs.mkdirSync(innerHotta, { recursive: true });
    fs.writeFileSync(path.join(innerRawExports, 'full-manifest.json'), '{}');

    const treeDouble = resolveRawExportTree(doubleDir);
    assert.equal(treeDouble.workingRoot, path.resolve(doubleDir));
    assert.equal(treeDouble.unpackedRoot, path.resolve(innerRawExports));
    assert.equal(treeDouble.hasHottaContent, true);
    assert.equal(treeDouble.hasManifest, true);
    assert.equal(treeDouble.isDoubleNested, true);

    fs.rmSync(doubleDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
