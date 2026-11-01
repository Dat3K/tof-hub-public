import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  findMissingReferencedAssetPaths,
  findReferencedAssetAliases,
  findReferencedPngFiles,
} from '../media-exporter';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('selective media references', () => {
  it('uses only the prepared export and reports missing referenced assets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-media-'));
    tempRoots.push(root);

    const rawRoot = path.join(root, 'raw');
    const dataRoot = path.join(root, 'game-data');
    fs.mkdirSync(path.join(rawRoot, 'Hotta/Content/Resources/UI/void/boss'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(dataRoot, 'en/oow/seasons'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'en/oow/seasons/s23.json'),
      JSON.stringify({
        image: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/present.webp',
        missing: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/absent.webp',
      }),
    );
    fs.writeFileSync(
      path.join(rawRoot, 'Hotta/Content/Resources/UI/void/boss/present.png'),
      'fixture',
    );

    assert.equal(findReferencedPngFiles(rawRoot, dataRoot).length, 1);
    assert.deepEqual(findMissingReferencedAssetPaths(rawRoot, dataRoot), [
      'Hotta/Content/Resources/UI/void/boss/absent',
    ]);
  });

  it('resolves deterministic OoW curated aliases across raw UI directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-media-alias-'));
    tempRoots.push(root);

    const rawRoot = path.join(root, 'raw');
    const dataRoot = path.join(root, 'game-data');
    fs.mkdirSync(path.join(rawRoot, 'Hotta/Content/Resources/UI/SHTT/guaiwu'), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, 'en/oow/seasons'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'en/oow/seasons/s18.json'),
      JSON.stringify({
        image: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_026.webp',
        elite: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_057.webp',
      }),
    );
    fs.writeFileSync(
      path.join(rawRoot, 'Hotta/Content/Resources/UI/SHTT/guaiwu/bigboss026.png'),
      'boss',
    );
    fs.writeFileSync(
      path.join(rawRoot, 'Hotta/Content/Resources/UI/SHTT/guaiwu/Boss_hum_057_SHTT_DT.png'),
      'elite',
    );

    const aliases = findReferencedAssetAliases(rawRoot, dataRoot);
    assert.deepEqual(
      aliases.map((alias) => alias.relativePath).sort(),
      [
        'Hotta/Content/Resources/UI/void/boss/Boss_hum_026.webp',
        'Hotta/Content/Resources/UI/void/boss/mon_hum_057.webp',
      ],
    );
    assert.equal(findMissingReferencedAssetPaths(rawRoot, dataRoot).length, 0);
  });
});
