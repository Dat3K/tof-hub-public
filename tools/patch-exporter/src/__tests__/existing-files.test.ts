import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { processExistingFiles } from '../existing-files';
import { MockProcessRunner, ModeGuardedProcessRunner } from '../process-runner';

function addRequiredOowStatTextures(rawRoot: string) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==',
    'base64',
  );
  const textures = [
    'Hotta/Content/Resources/UI/AttributeIcon/icon_hp.png',
    'Hotta/Content/Resources/UI/AttributeIcon/icon_atk.png',
    'Hotta/Content/Resources/Icon/buff/buff_AddPowerImm.png',
    'Hotta/Content/Resources/Icon/new_debuff/debuff_dizzy.png',
  ];
  for (const texture of textures) {
    const file = path.join(rawRoot, texture);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
  }

  const summary = path.join(rawRoot, 'datamine/oow/data/current/summary.json');
  fs.mkdirSync(path.dirname(summary), { recursive: true });
  fs.writeFileSync(summary, '{}');

  // The OoW effect catalog reads EN/RU localization, both buff pools and the MMO Balance tips table.
  const tables: Record<string, unknown> = {
    'Hotta/Content/Resources/CoreBlueprints/DataTable/OriginWarBuffPoolDataTable.json': [{ Rows: { Fixture: {} } }],
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json': [{ Rows: { Fixture: {} } }],
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json': [{ Rows: { Fixture: {} } }],
  };
  for (const locale of ['en', 'ru']) {
    const file = path.join(rawRoot, `Hotta/Content/Localization/Game/${locale}/Game.json`);
    if (!fs.existsSync(file)) tables[`Hotta/Content/Localization/Game/${locale}/Game.json`] = {};
  }
  for (const [relative, value] of Object.entries(tables)) {
    const file = path.join(rawRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  }
}

test('Existing Files Entrypoint: throws if inputDir or outputDir is missing', async () => {
  await assert.rejects(
    async () => {
      await processExistingFiles({ inputDir: '', outputDir: 'C:\\out' });
    },
    /Missing mandatory argument: prepared input directory \(--input\) is required/
  );

  await assert.rejects(
    async () => {
      await processExistingFiles({ inputDir: 'C:\\in', outputDir: '' });
    },
    /Missing mandatory argument: output directory \(--output\) is required/
  );
});

test('Existing Files Entrypoint: throws clear error if prepared input directory does not exist', async () => {
  const missingDir = path.join(os.tmpdir(), 'missing-prepared-' + Date.now());
  const outDir = path.join(os.tmpdir(), 'out-' + Date.now());

  await assert.rejects(
    async () => {
      await processExistingFiles({ inputDir: missingDir, outputDir: outDir });
    },
    /Prepared input directory does not exist.*Please provide a valid, pre-extracted game data directory/
  );
});

test('Existing Files Entrypoint: throws clear error if prepared input directory is empty', async () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-prepared-'));
  const outDir = path.join(os.tmpdir(), 'out-' + Date.now());

  try {
    await assert.rejects(
      async () => {
        await processExistingFiles({ inputDir: emptyDir, outputDir: outDir });
      },
      /Prepared input directory.*is empty\. Extraction fallback is disabled; valid prepared fixtures must be provided/
    );
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: throws clear error if prepared input lacks recognized raw data', async () => {
  const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dummy-prepared-'));
  const outDir = path.join(os.tmpdir(), 'out-' + Date.now());
  fs.writeFileSync(path.join(dummyDir, 'unrelated.txt'), 'random data');

  try {
    await assert.rejects(
      async () => {
        await processExistingFiles({ inputDir: dummyDir, outputDir: outDir });
      },
      /does not contain expected Tower of Fantasy raw export data.*Extraction fallback is disabled/
    );
  } finally {
    fs.rmSync(dummyDir, { recursive: true, force: true });
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: enforces "outputs outside source" guard', async () => {
  const validPreparedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valid-prepared-'));
  fs.mkdirSync(path.join(validPreparedDir, 'Hotta/Content'), { recursive: true });
  fs.writeFileSync(path.join(validPreparedDir, 'MappingItemId.json'), '{}');

  const outputInsideInput = path.join(validPreparedDir, 'dist_bundle');

  try {
    await assert.rejects(
      async () => {
        await processExistingFiles({ inputDir: validPreparedDir, outputDir: outputInsideInput });
      },
      /Output directory.*cannot reside inside input directory.*Outputs must reside strictly outside source/
    );
  } finally {
    fs.rmSync(validPreparedDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: successfully stages valid prepared fixture outside source', async () => {
  const validPreparedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valid-prep-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valid-out-'));

  try {
    // Setup fixture
    const hottaDir = path.join(validPreparedDir, 'Hotta/Content/Localization/Game/en');
    fs.mkdirSync(hottaDir, { recursive: true });
    fs.writeFileSync(path.join(hottaDir, 'Game.json'), '{"hello": "world"}');
    fs.writeFileSync(path.join(validPreparedDir, 'MappingItemId.json'), '{"1": "Item"}');
    fs.writeFileSync(path.join(validPreparedDir, 'export-version.json'), '{"version": "3.8.0"}');
    addRequiredOowStatTextures(validPreparedDir);

    const result = await processExistingFiles({
      inputDir: validPreparedDir,
      outputDir: outDir,
      copyFiles: true,
      verbose: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.canonicalInput, path.resolve(validPreparedDir));
    assert.equal(result.canonicalOutput, path.resolve(outDir));
    assert.ok(result.stagedFilesCount >= 3);

    // Verify files were copied to output outside input
    assert.ok(fs.existsSync(path.join(outDir, 'MappingItemId.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'export-version.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'Hotta/Content/Localization/Game/en/Game.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'prepared-processing-record.json')));

    const record = JSON.parse(fs.readFileSync(path.join(outDir, 'prepared-processing-record.json'), 'utf8'));
    assert.equal(record.status, 'SUCCESS');
    assert.equal(record.mode, 'prepared_files_only');
  } finally {
    fs.rmSync(validPreparedDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: handles double-nested raw_exports structure', async () => {
  const outerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'double-outer-'));
  const innerDir = path.join(outerDir, 'raw_exports');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'double-out-'));

  try {
    const hottaDir = path.join(innerDir, 'Hotta/Content');
    fs.mkdirSync(hottaDir, { recursive: true });
    fs.writeFileSync(path.join(innerDir, 'full-manifest.json'), '{}');
    fs.writeFileSync(path.join(innerDir, 'MappingItemId.json'), '{}');
    addRequiredOowStatTextures(innerDir);

    const result = await processExistingFiles({
      inputDir: outerDir,
      outputDir: outDir,
      copyFiles: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.tree.isDoubleNested, true);
    assert.ok(fs.existsSync(path.join(outDir, 'MappingItemId.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'full-manifest.json')));
  } finally {
    fs.rmSync(outerDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: performs validation when validate: true is specified', async () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-input-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-out-'));

  try {
    fs.mkdirSync(path.join(inputDir, 'Hotta/Content'), { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'MappingItemId.json'), '{}');
    fs.writeFileSync(path.join(inputDir, 'export-version.json'), '{}');
    addRequiredOowStatTextures(inputDir);

    const result = await processExistingFiles({
      inputDir,
      outputDir: outDir,
      validate: true,
    });

    assert.equal(result.success, true);
    assert.ok(result.validationReport);
    assert.ok(result.validationReport.totalChecks > 0);
    assert.ok(fs.existsSync(path.join(outDir, 'export-validation.json')));

    const record = JSON.parse(fs.readFileSync(path.join(outDir, 'prepared-processing-record.json'), 'utf8'));
    assert.equal(record.validated, true);
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Existing Files Entrypoint: mocked process-runner test must fail upon attempt of extraction in existing-files mode', async () => {
  const mockRunner = new MockProcessRunner({
    defaultStdout: '[MOCK UNREAL EXPORTER] Attempting live game extraction',
  });

  // 1. Direct processExistingFiles rejection when extraction is requested
  await assert.rejects(
    async () => {
      await processExistingFiles({
        inputDir: 'C:\\valid-input',
        outputDir: 'C:\\valid-output',
        attemptExtraction: true,
        processRunner: mockRunner,
      });
    },
    /Extraction is strictly forbidden in existing-files mode/
  );

  // 2. ModeGuardedProcessRunner wrapping MockProcessRunner rejects any extraction invocation in existing-files mode
  const guardedRunner = new ModeGuardedProcessRunner('existing-files', mockRunner);
  await assert.rejects(
    async () => {
      await guardedRunner.run('bin/UnrealExporter.exe', ['config/current-export-run.json']);
    },
    /Extraction execution is strictly forbidden in existing-files mode.*UnrealExporter/
  );

  // 3. Verify mock runner was never actually invoked
  assert.equal(mockRunner.invocations.length, 0);
});
