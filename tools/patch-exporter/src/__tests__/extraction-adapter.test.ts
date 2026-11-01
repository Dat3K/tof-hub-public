import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runExtractionAdapter } from '../extraction-adapter';
import { MockProcessRunner } from '../process-runner';
import type { GameDiscoveryResult } from '../discovery';

test('Extraction Adapter: orchestrates UnrealExporter with MockProcessRunner without launching game', async () => {
  const tempGameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-game-'));
  const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-out-'));

  try {
    // Setup mock game structure
    const configDir = path.join(tempGameDir, 'Hotta/Config');
    const paksDir = path.join(tempGameDir, 'Hotta/Content/Paks');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(paksDir, { recursive: true });

    fs.writeFileSync(path.join(configDir, 'MappingItemId.json'), '{"1001": "Test Item"}', 'utf8');
    fs.writeFileSync(path.join(configDir, 'MappingItemIdAndName.json'), '{"1001": "Sword"}', 'utf8');
    fs.writeFileSync(path.join(tempGameDir, 'config.xml'), '<config><Version>3.8.0</Version></config>', 'utf8');

    const mockDiscovery: GameDiscoveryResult = {
      gamePath: tempGameDir,
      paksDir,
      configDir,
      mappingFiles: ['MappingItemId.json', 'MappingItemIdAndName.json'],
      sourceType: 'explicit_argument',
      versionInfo: {
        version: '3.8.0',
        appVersion: '3.8.0',
        section: '3.8',
        branch: 'TestPC_KR2New',
        clientName: 'Korea Dev 1',
        clientNameRu: 'Корея Dev 1',
        hash: 'hash123',
        sourceFile: path.join(tempGameDir, 'config.xml'),
        lastUpdate: '18.09.2026',
        lastUpdateIso: new Date().toISOString(),
      },
    };

    const mockRunner = new MockProcessRunner({
      defaultExitCode: 0,
      defaultStdout: '[MOCK UNREAL EXPORTER] Extracted 42 assets successfully',
    });

    const fakeExe = path.join(tempGameDir, 'bin/UnrealExporter.exe');
    fs.mkdirSync(path.dirname(fakeExe), { recursive: true });
    fs.writeFileSync(fakeExe, 'fake-binary', 'utf8');

    const result = await runExtractionAdapter({
      discovery: mockDiscovery,
      outputDir: tempOutputDir,
      mode: 'Text',
      aesKey: '0xTEST_KEY',
      unrealExporterExePath: fakeExe,
      processRunner: mockRunner,
    });

    // 1. Process was intercepted by mock runner, never executed on OS
    assert.equal(mockRunner.invocations.length, 1);
    assert.equal(mockRunner.invocations[0].executable, fakeExe);
    assert.ok(mockRunner.invocations[0].args[0].endsWith('current-export-run.json'));
    if (process.platform === 'win32') {
      assert.equal(mockRunner.invocations[0].options?.stdio, 'inherit');
      assert.equal(mockRunner.invocations[0].options?.windowsHide, false);
    }

    // 2. Mapping files were copied
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'MappingItemId.json')));
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'MappingItemIdAndName.json')));

    // 3. Metadata files were created
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'export-version.json')));
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'config.xml')));

    // 4. Config file was generated
    assert.ok(fs.existsSync(result.configFilePath));
    const generatedConfig = JSON.parse(fs.readFileSync(result.configFilePath, 'utf8'));
    assert.equal(generatedConfig.GamePath, paksDir);
    assert.deepEqual(generatedConfig.AesKeys, ['0xTEST_KEY']);

    // 5. Validation reports generated
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'export-validation.txt')));
    assert.ok(fs.existsSync(path.join(tempOutputDir, 'export-validation.json')));
  } finally {
    fs.rmSync(tempGameDir, { recursive: true, force: true });
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
  }
});

test('Extraction Adapter: rejects an exporter Error even with exit code zero', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-zero-error-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'game/Paks'), { recursive: true });
    const runner = new MockProcessRunner({ defaultExitCode: 0, defaultStdout: 'Error: Неверный дескриптор.\r\n' });
    await assert.rejects(runExtractionAdapter({
      discovery: {
        gamePath: path.join(tempRoot, 'game'), paksDir: path.join(tempRoot, 'game/Paks'),
        configDir: null, mappingFiles: [], sourceType: 'explicit_argument',
        versionInfo: {
          version: '6.3.1', appVersion: '', section: '', branch: 'OBPC_2_5',
          clientName: 'Global Live', clientNameRu: 'Глобал Live', hash: '',
          sourceFile: '', lastUpdate: '', lastUpdateIso: '',
        },
      },
      outputDir: path.join(tempRoot, 'raw'), mode: 'Text', processRunner: runner,
    }), /UnrealExporter failed with exit code 0:.*Неверный дескриптор/);
    assert.equal(fs.existsSync(path.join(tempRoot, 'raw/export-validation.txt')), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Extraction Adapter: throws clear error if UnrealExporter exits with error code', async () => {
  const tempGameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-fail-game-'));
  const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-fail-out-'));

  try {
    const mockDiscovery: GameDiscoveryResult = {
      gamePath: tempGameDir,
      paksDir: tempGameDir,
      configDir: null,
      mappingFiles: [],
      sourceType: 'explicit_argument',
      versionInfo: {
        version: '3.8.0',
        appVersion: '3.8.0',
        section: '3.8',
        branch: 'TestPC_KR2New',
        clientName: 'Korea Dev 1',
        clientNameRu: 'Корея Dev 1',
        hash: '',
        sourceFile: '',
        lastUpdate: '',
        lastUpdateIso: '',
      },
    };

    const mockRunner = new MockProcessRunner({
      defaultExitCode: 2,
      defaultStderr: 'CUE4Parse AES decryption key invalid',
    });

    const fakeExe = path.join(tempGameDir, 'UnrealExporter.exe');

    await assert.rejects(
      async () => {
        await runExtractionAdapter({
          discovery: mockDiscovery,
          outputDir: tempOutputDir,
          mode: 'Text',
          unrealExporterExePath: fakeExe,
          processRunner: mockRunner,
        });
      },
      /UnrealExporter failed with exit code 2.*CUE4Parse AES decryption key invalid/
    );
  } finally {
    fs.rmSync(tempGameDir, { recursive: true, force: true });
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
  }
});
