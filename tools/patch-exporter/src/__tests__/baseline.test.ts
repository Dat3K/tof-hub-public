import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractBaselineCharacter,
  createBaselinePayload,
  partitionBaselineIds,
  downloadBaseline,
  bootstrapBaseline,
  freezeBaselineToDeploy,
  prepareBaselineComparison,
  type ChangelogBaselinePayload,
} from '../baseline';

describe('baseline lifecycle module', () => {
  describe('extractBaselineCharacter', () => {
    it('extracts all tracked character fields and deep-clones nested structures', () => {
      const sampleItem = {
        id: 'alysshe',
        avatar_id: 'Alyss',
        weapon_id: 'UnyieldingWing',
        name_en: 'Alyss',
        name_ru: 'Алисс',
        element: 'Frost',
        role: 'DPS',
        rarity: 'SSR',
        base_stats: { attack: 18, hp: 1165, crit: 14 },
        max_stats: { attack: 1540, hp: 76000 },
        advancements: [
          { star: 1, description: 'Advancement 1 effect' },
          { star: 2, description: 'Advancement 2 effect' },
        ],
        traits: [{ points: 1200, name: 'Cold Wing' }],
        weapon: {
          name: 'Unyielding Wing',
          skills: [{ id: 'skill_1', damage: '500%' }],
        },
        untrackedField: 'should be retained or ignored safely',
      };

      const char = extractBaselineCharacter(sampleItem);

      assert.equal(char.id, 'alysshe');
      assert.equal(char.name_en, 'Alyss');
      assert.equal(char.element, 'Frost');
      assert.deepEqual(char.base_stats, { attack: 18, hp: 1165, crit: 14 });
      assert.equal(char.advancements?.length, 2);
      assert.equal(char.traits?.length, 1);
      assert.equal(char.weapon?.skills[0].damage, '500%');

      // Verify deep clone
      sampleItem.base_stats.attack = 999;
      assert.equal(char.base_stats.attack, 18);
    });
  });

  describe('createBaselinePayload & deterministic sorting', () => {
    it('creates deterministic baseline sorted by ID', () => {
      const items = [
        { id: 'nemesis', name: 'Nemesis' },
        { id: 'alyss', name: 'Alyss' },
        { id: 'claudia', name: 'Claudia' },
      ];

      const baseline = createBaselinePayload('gacha', items);

      assert.equal(baseline.schemaVersion, 1);
      assert.equal(baseline.edition, 'gacha');
      assert.equal(baseline.total, 3);
      assert.deepEqual(Object.keys(baseline.characters), ['alyss', 'claudia', 'nemesis']);
    });
  });

  describe('partitionBaselineIds invariants', () => {
    it('correctly partitions common, new, and removed IDs', () => {
      const oldBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-01T00:00:00Z',
        total: 3,
        characters: {
          alyss: { id: 'alyss' },
          claudia: { id: 'claudia' },
          oldHero: { id: 'oldHero' },
        },
      };

      const newBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-18T00:00:00Z',
        total: 3,
        characters: {
          alyss: { id: 'alyss' },
          claudia: { id: 'claudia' },
          brandNewHero: { id: 'brandNewHero' }, // Newly introduced character
        },
      };

      const partition = partitionBaselineIds(oldBaseline, newBaseline);

      // Common IDs are evaluated for diffs
      assert.deepEqual(partition.commonIds, ['alyss', 'claudia']);
      // New IDs are excluded from value-change entries
      assert.deepEqual(partition.newIds, ['brandNewHero']);
      // Removed IDs are tracked in separate category
      assert.deepEqual(partition.removedIds, ['oldHero']);
    });

    it('handles null old baseline gracefully (all fresh IDs are classified as new)', () => {
      const newBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-18T00:00:00Z',
        total: 2,
        characters: {
          alyss: { id: 'alyss' },
          claudia: { id: 'claudia' },
        },
      };

      const partition = partitionBaselineIds(null, newBaseline);
      assert.deepEqual(partition.commonIds, []);
      assert.deepEqual(partition.newIds, ['alyss', 'claudia']);
      assert.deepEqual(partition.removedIds, []);
    });
  });

  describe('downloadBaseline with HTTP revalidation', () => {
    it('fetches fresh baseline and saves cache with ETag/Last-Modified metadata', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-dl-test-'));

      const mockGachaData: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-18T10:00:00Z',
        total: 1,
        characters: {
          alyss: { id: 'alyss', name_en: 'Alyss' },
        },
      };

      const mockMmoData: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'mmo',
        generatedAt: '2026-09-18T10:00:00Z',
        total: 1,
        characters: {
          'alyss-mmo': { id: 'alyss-mmo', name_en: 'Alyss MMO' },
        },
      };

      const requestedHeaders: Record<string, Record<string, string>> = {};

      const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = String(input);
        requestedHeaders[urlStr] = (init?.headers as Record<string, string>) || {};

        if (urlStr.includes('simulacra-mmo.json')) {
          return new Response(JSON.stringify(mockMmoData), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              etag: '"mmo-etag-123"',
              'last-modified': 'Wed, 18 Sep 2026 10:00:00 GMT',
            },
          });
        }

        return new Response(JSON.stringify(mockGachaData), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            etag: '"gacha-etag-456"',
            'last-modified': 'Wed, 18 Sep 2026 10:00:00 GMT',
          },
        });
      };

      const result = await downloadBaseline({
        baseUrl: 'https://test-host.local',
        cacheDir: tempDir,
        fetchFn: mockFetch,
      });

      assert.equal(result.status, 'ok');
      assert.equal(result.source, 'network');
      assert.equal(result.gachaBaseline?.total, 1);
      assert.equal(result.mmoBaseline?.total, 1);
      assert.equal(result.metadata?.gacha?.etag, '"gacha-etag-456"');

      // Check request headers: Cache-Control: no-cache must be present
      const gachaUrl = 'https://test-host.local/game-data/changelog/simulacra.json';
      assert.equal(requestedHeaders[gachaUrl]['Cache-Control'], 'no-cache');

      // Verify cached files written to disk
      assert.ok(fs.existsSync(path.join(tempDir, 'simulacra.json')));
      assert.ok(fs.existsSync(path.join(tempDir, 'simulacra.meta.json')));

      // Now perform SECOND request and simulate HTTP 304 Not Modified
      const revalHeadersSent: Record<string, Record<string, string>> = {};
      const mockFetch304: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        revalHeadersSent[String(input)] = (init?.headers as Record<string, string>) || {};
        return new Response(null, { status: 304 });
      };

      const result304 = await downloadBaseline({
        baseUrl: 'https://test-host.local',
        cacheDir: tempDir,
        fetchFn: mockFetch304,
      });

      assert.equal(result304.status, 'not_modified');
      assert.equal(result304.source, 'cache');
      assert.equal(result304.gachaBaseline?.total, 1);
      assert.equal(revalHeadersSent[gachaUrl]['If-None-Match'], '"gacha-etag-456"');
      assert.equal(revalHeadersSent[gachaUrl]['If-Modified-Since'], 'Wed, 18 Sep 2026 10:00:00 GMT');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('gracefully falls back to local baseline fixtures when remote is unavailable', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-offline-'));
      const fixtureDir = path.join(tempDir, 'fixtures');
      fs.mkdirSync(fixtureDir, { recursive: true });

      fs.writeFileSync(
        path.join(fixtureDir, 'simulacra.json'),
        JSON.stringify({
          schemaVersion: 1,
          edition: 'gacha',
          generatedAt: '2026-09-18T00:00:00Z',
          total: 1,
          characters: { localHero: { id: 'localHero' } },
        })
      );

      const mockFailingFetch: typeof fetch = async () => {
        throw new Error('ENOTFOUND test-host.local');
      };

      const result = await downloadBaseline({
        baseUrl: 'https://unreachable.domain.local',
        cacheDir: path.join(tempDir, 'cache'),
        localBaselineDir: fixtureDir,
        fetchFn: mockFailingFetch,
      });

      assert.equal(result.status, 'ok');
      assert.equal(result.source, 'local_fallback');
      assert.equal(result.gachaBaseline?.characters.localHero.id, 'localHero');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns unavailable status when remote is down and no cache or fixtures exist', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-down-'));

      const mockFailingFetch: typeof fetch = async () => {
        throw new Error('Connection refused');
      };

      const result = await downloadBaseline({
        baseUrl: 'https://offline-server.local',
        cacheDir: path.join(tempDir, 'cache'),
        fetchFn: mockFailingFetch,
      });

      assert.equal(result.status, 'unavailable');
      assert.equal(result.gachaBaseline, null);
      assert.ok(result.error?.includes('Baseline unavailable'));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('bootstrapBaseline (initial site baseline setup)', () => {
    it('bootstraps baseline from unified simulacra dataset with zero synthetic diffs', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-bootstrap-'));
      const inputDir = path.join(tempDir, 'input');
      const outputDir = path.join(tempDir, 'output');
      fs.mkdirSync(inputDir, { recursive: true });

      const sampleUnified = {
        total: 2,
        gacha: [
          {
            id: 'alyss',
            name_en: 'Alyss',
            element: 'Frost',
            base_stats: { attack: 10 },
          },
        ],
        mmo: [
          {
            id: 'alyss-mmo',
            name_en: 'Alyss MMO',
            element: 'Frost',
            base_stats: { attack: 20 },
          },
        ],
      };

      fs.writeFileSync(path.join(inputDir, 'simulacra.json'), JSON.stringify(sampleUnified));

      const bootstrapResult = await bootstrapBaseline({
        inputDir,
        outputDir,
      });

      assert.equal(bootstrapResult.success, true);
      assert.equal(bootstrapResult.gachaTotal, 1);
      assert.equal(bootstrapResult.mmoTotal, 1);

      // Verify output files exist
      const gachaWritten = JSON.parse(fs.readFileSync(bootstrapResult.gachaPath, 'utf8'));
      const mmoWritten = JSON.parse(fs.readFileSync(bootstrapResult.mmoPath, 'utf8'));

      assert.equal(gachaWritten.total, 1);
      assert.equal(gachaWritten.characters.alyss.name_en, 'Alyss');
      assert.equal(mmoWritten.total, 1);
      assert.equal(mmoWritten.characters['alyss-mmo'].name_en, 'Alyss MMO');

      // Verify bootstrap manifest was written
      const manifest = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'baseline-bootstrap-manifest.json'), 'utf8')
      );
      assert.equal(manifest.status, 'BOOTSTRAPPED');
      assert.ok(manifest.note.includes('zero synthetic diff records'));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('freezeBaselineToDeploy', () => {
    it('freezes complete baseline into deploy archive and includes all new characters', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-freeze-'));
      const deployDir = path.join(tempDir, 'deploy');

      const oldGachaBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-01T00:00:00Z',
        total: 1,
        characters: { alyss: { id: 'alyss' } },
      };

      // Fresh export contains existing 'alyss' PLUS brand new 'claudia'
      const freshGachaBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'gacha',
        generatedAt: '2026-09-18T00:00:00Z',
        total: 2,
        characters: {
          alyss: { id: 'alyss' },
          claudia: { id: 'claudia' },
        },
      };

      const freshMmoBaseline: ChangelogBaselinePayload = {
        schemaVersion: 1,
        edition: 'mmo',
        generatedAt: '2026-09-18T00:00:00Z',
        total: 1,
        characters: {
          'alyss-mmo': { id: 'alyss-mmo' },
        },
      };

      const freezeResult = freezeBaselineToDeploy({
        gachaBaseline: freshGachaBaseline,
        mmoBaseline: freshMmoBaseline,
        deployDir,
        oldGachaBaseline,
      });

      assert.equal(freezeResult.success, true);
      assert.equal(freezeResult.gachaCount, 2);
      assert.equal(freezeResult.newIdsCount.gacha, 1);
      assert.equal(freezeResult.allCurrentIdsIncluded, true);

      // Verify deployed baseline file contains BOTH characters
      const deployedGacha = JSON.parse(fs.readFileSync(freezeResult.gachaPath, 'utf8'));
      assert.equal(deployedGacha.total, 2);
      assert.ok(deployedGacha.characters.alyss);
      assert.ok(deployedGacha.characters.claudia);

      // Verify baseline-freeze.json record
      const freezeRecord = JSON.parse(fs.readFileSync(freezeResult.freezeRecordPath, 'utf8'));
      assert.deepEqual(freezeRecord.gacha.newCharacterIds, ['claudia']);
      assert.ok(freezeRecord.rollbackCaveat.includes('CRITICAL ROLLBACK NOTICE'));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
