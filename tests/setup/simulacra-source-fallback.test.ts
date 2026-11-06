// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import {afterEach, expect, it} from 'vitest';
import {findTraitRow, loadSimulacraLocalization} from '../../scripts/game-processors/processors/build-simulacra';

const root = path.resolve('ignore/harly-localization-audit/tests');
afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

it('uses source text for missing skills and replaces it by exact translated keys without retaining old values', () => {
  const relative = 'Hotta/Content/Resources/Text/Oversea';
  fs.mkdirSync(path.join(root, relative), {recursive: true});
  fs.writeFileSync(path.join(root, relative, 'WeaponDes.json'), '{}');
  const files: Record<string, any> = {
    [`${relative}/WeaponDes.json`]: [{StringTable: {TableNamespace: 'WeaponDes_Oversea', KeysToEntries: {Skill_des: 'Global source', Skill: 'Global name'}}}],
    'Hotta/Content/Localization/Game/zh-CN/Game.json': {WeaponDes: {Skill: '中文', Skill_des: '中文描述'}},
    'Hotta/Content/Localization/Game/en/Game.json': {WeaponDes: {Skill: 'English name'}},
    'Hotta/Content/Localization/Game/ru/Game.json': {WeaponDes: {Skill: ''}},
  };
  const reader = {findAndRead: ([file]: string[]) => files[file] ? {data: files[file]} : null};
  const first = loadSimulacraLocalization(reader, root);
  expect(first.en.WeaponDes).toEqual({Skill: 'English name', Skill_des: '中文描述'});
  expect(first.ru.WeaponDes).toEqual(first.en.WeaponDes);
  expect(first.en.WeaponDes_Oversea.Skill_des).toBe('Global source');
  files['Hotta/Content/Localization/Game/en/Game.json'].WeaponDes.Skill_des = 'English description';
  files['Hotta/Content/Localization/Game/ru/Game.json'].WeaponDes = {Skill: 'Название', Skill_des: 'Описание'};
  const next = loadSimulacraLocalization(reader, root);
  expect(next.en.WeaponDes).toEqual({Skill: 'English name', Skill_des: 'English description'});
  expect(next.ru.WeaponDes).toEqual({Skill: 'Название', Skill_des: 'Описание'});
  expect(JSON.stringify(next.en.WeaponDes)).not.toContain('中文');
  expect(Object.keys(next.en.WeaponDes)).toHaveLength(2);

});

it('resolves a unique imitation suffix and refuses an ambiguous or unrelated buff', () => {
  const row = {Desc: {Key: 'imitation_Level1_des'}};
  const rows = new Map([['buff_painter_imitationlikelevel1_finaldmgup', row]]);
  expect(findTraitRow(rows, ['buff_painter_imitationlikelevel1'])).toBe(row);
  expect(findTraitRow(rows, ['buff_painter_level1'])).toBeNull();
  rows.set('buff_painter_imitationlikelevel1_other', {Desc: {Key: 'other'}});
  expect(findTraitRow(rows, ['buff_painter_imitationlikelevel1'])).toBeNull();
});
