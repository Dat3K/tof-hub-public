import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { runAdvancedMultype } from '../advanced-multype';

const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Advanced Multype scanner', () => {
  it('extracts module mappings and explains an entity-name guess', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-advanced-multype-'));
    temporaryDirs.push(root);
    const inputDir = path.join(root, 'input');
    const outputDir = path.join(root, 'output');
    const referenceDir = path.join(root, 'references');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(referenceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'GE_ArtifactSSR005_BeAtkUp.json'), JSON.stringify([
      {
        Properties: {
          ModuleExtraModifierInfos: [
            {
              ModuleExtraType: 'ModuleExtraType_CardPassive',
              GameplayModifierInfo: { Attribute: { AttributeName: 'FinalDamageBeExtraUpMult' } },
            },
          ],
        },
      },
    ]));
    fs.writeFileSync(path.join(root, 'export-version.json'), JSON.stringify({ version: '9.9.9', clientName: 'Test client' }));
    fs.writeFileSync(path.join(referenceDir, 'relics.json'), JSON.stringify({
      items: [{ id: 'artifact_ssr_005', name_en: 'Spacetime Rift', name_ru: 'Пространственно-временной разрыв' }],
    }));

    const result = await runAdvancedMultype({ inputDir, outputDir, referenceDir, jobs: 2 });

    assert.deepEqual(
      result.mapping.ModuleExtraType_CardPassive.FinalDamageBeExtraUpMult,
      ['GE_ArtifactSSR005_BeAtkUp.json'],
    );
    const candidate = result.guesses['GE_ArtifactSSR005_BeAtkUp.json'].candidates[0];
    assert.equal(candidate.label, 'Spacetime Rift');
    assert.equal(candidate.entityId, 'artifact_ssr_005');
    assert.equal(candidate.confidence, 0.98);
    assert.equal(fs.existsSync(path.join(outputDir, 'multype_ai_guesses.json')), true);
    const scan = JSON.parse(fs.readFileSync(path.join(outputDir, 'multype-scan.json'), 'utf8'));
    assert.equal(scan.gameVersion, '9.9.9');
    assert.equal(scan.clientName, 'Test client');
  });
});
