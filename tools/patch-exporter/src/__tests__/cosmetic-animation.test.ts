import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {publishCosmeticAnimations, renderVerifiedFlipbook, type VerifiedFlipbook} from '../cosmetic-animation';
import {avatarAnimationSource, avatarFlipbookRecipe, chatStickerCatalog, chatStickerSources, emojiFlipbookRecipe, mountImageCandidates} from '../../../../scripts/game-processors/processors/cosmetic-sources';

test('emoji inventory uses exact unlock-tool types, excludes packs and never pairs by icon', () => {
  const items = {still: {StaticToolName: 's'}, motion: {StaticToolName: 'm'}, pack: {StaticToolName: 'None'}};
  const tools = {s: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_EMOJI', ToolValue: '34'},
    m: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_DYNAMIC_EMOJI', ToolValue: 'big17'}};
  const rows = chatStickerSources(items, tools);
  assert.deepEqual(rows.map(row => row.id), ['still', 'motion']);
  assert.equal(rows[0].animation, undefined);
  assert.equal(rows[1].animation?.status, 'unresolved');
  assert.equal(rows[1].emojiId, 'big17');
});

test('chat panel master tables include free rows and verify item -> tool -> row joins', () => {
  const items = {chat_emoji_34: {StaticToolName: 't34', ItemIcon: {AssetPathName: '/Game/Icon/i34.i34'}},
    chat_BigEmoji_17: {StaticToolName: 't17', ItemIcon: {AssetPathName: '/Game/Icon/i34.i34'}},
    wrong: {StaticToolName: 't34'}, orphan: {StaticToolName: 'tOrphan'}};
  const tools = {t34: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_EMOJI', ToolValue: '34'},
    t17: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_DYNAMIC_EMOJI', ToolValue: 'big17'},
    tOrphan: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_EMOJI', ToolValue: '999'}};
  const {stickers, issues, unlockItemsWithoutRow} = chatStickerCatalog({
    emoji: {1: {EmojiTexture: {AssetPathName: '/Game/E/emoji_1.emoji_1'}, IsLock: false, TagId: 'TianShi', ItemId: 'None'},
      34: {EmojiTexture: {AssetPathName: '/Game/E/emoji_34.emoji_34'}, IsLock: true, ItemId: 'chat_emoji_34'},
      35: {EmojiTexture: {AssetPathName: '/Game/E/emoji_35.emoji_35'}, IsLock: true, ItemId: 'wrong'}},
    bigEmoji: {big1: {EmojiBrush: {AssetPathName: '/Game/E/bigemoji_1.bigemoji_1'}, IsLock: false, ItemId: 'None'},
      big17: {EmojiBrush: {AssetPathName: '/Game/E/bigemoji_17.bigemoji_17'}, IsLock: true, ItemId: 'chat_BigEmoji_17'}},
    hugeEmoji: {1: {ImgBrush: {ResourceObject: {ObjectPath: 'Hotta/Content/E/chiji_emoji_1.0'}}, IsLock: false}},
  }, items, tools);
  assert.deepEqual(stickers.map(row => row.id), ['emoji_1', 'chat_emoji_34', 'wrong', 'big1', 'chat_BigEmoji_17', 'huge_emoji_1']);
  // Static rows use their own texture; a dynamic row never borrows a material atlas as its poster.
  assert.equal(stickers[1].image, '/Game/E/emoji_34.emoji_34');
  assert.equal(stickers[3].image, undefined);
  assert.equal(stickers[4].image, '/Game/Icon/i34.i34');
  assert.equal(stickers[4].animation?.references[0].asset, '/Game/E/bigemoji_17.bigemoji_17');
  assert.equal(stickers[5].animation?.references[0].asset, 'Hotta/Content/E/chiji_emoji_1.0');
  assert.deepEqual(issues.map(issue => issue.row), ['35']);
  assert.deepEqual(unlockItemsWithoutRow.map(item => item.id), ['orphan']);
});

test('material references remain unresolved without fabricated GIF/frame metadata', () => {
  assert.equal(avatarAnimationSource({Material: {AssetPathName: 'None'}}), undefined);
  assert.deepEqual(avatarAnimationSource({ParticleAsset: {AssetPathName: '/Game/Effects/P.P'}}), {
    status: 'unresolved', kind: 'material', references: [{field: 'ParticleAsset', asset: '/Game/Effects/P.P'}],
  });
});

test('effect audit follows exact parents/textures, retains raw parameters and reports missing exports without guessing playback', () => {
  const {inspectCosmeticEffects} = createRequire(__filename)('../../../../scripts/game-processors/processors/cosmetic-source-audit.ts');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-effect-audit-'));
  try {
    const dir = path.join(root, 'Hotta/Content/Effects');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'Instance.json'), JSON.stringify([{Name: 'Instance', Type: 'MaterialInstanceConstant', Properties: {
      Parent: {ObjectPath: '/Game/Effects/Parent.Parent'}, TextureParameterValues: [{ParameterInfo: {Name: 'Atlas'},
        ParameterValue: {ObjectPath: '/Game/Effects/Atlas.Atlas'}}], ScalarParameterValues: [{Value: 2.5}],
    }}]));
    fs.writeFileSync(path.join(dir, 'Parent.json'), JSON.stringify([{Name: 'Parent', Type: 'Material', Properties: {
      Cycle: {ObjectPath: '/Game/Effects/Instance.Instance'}, Missing: {ObjectPath: '/Engine/Functions/Absent.Absent'},
      Invalid: {ObjectPath: '/Game/../../outside.Outside'},
    }}]));
    fs.writeFileSync(path.join(dir, 'Atlas.png'), 'fixture image bytes');
    const report = inspectCosmeticEffects(root, [{id: 'avatar', references: [{field: 'Material', asset: '/Game/Effects/Instance.Instance'}]}]);
    assert.equal(report.status, 'evidence-only');
    assert.equal(report.truncated, false);
    assert.equal(report.nodes.length, 4);
    const instance = report.nodes.find((node: {packagePath: string}) => node.packagePath === 'Hotta/Content/Effects/Instance')!;
    assert.equal((instance.files as Array<{sha256: string}>)[0].sha256.length, 64);
    assert.deepEqual((instance.exports as Array<{properties: Record<string, unknown>}>)[0].properties.ScalarParameterValues, [{Value: 2.5}]);
    assert.equal(report.nodes.find((node: {packagePath: string}) => node.packagePath === 'Engine/Content/Functions/Absent')?.missing, true);
    assert.equal(report.issues.length, 1);
    assert.equal(inspectCosmeticEffects(root, [{id: 'avatar', references: [{field: 'Material', asset: '/Game/Effects/Instance.Instance'}]}], 1).truncated, true);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('normalization retains new categories, effect provenance and full mount photo independently of its icon', () => {
  // The script tree has its own typecheck/package boundary; load through the test's tsx runtime.
  const {normalizeCosmeticsDataset} = createRequire(__filename)('../../../../scripts/normalize-game-data/adapters/cosmetics.ts');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-cosmetic-normalize-'));
  try {
    const data = path.join(root, 'info/cosmetics/data');
    fs.mkdirSync(data, {recursive: true});
    fs.writeFileSync(path.join(data, 'chat-stickers.json'), JSON.stringify([{id: 'sticker', animation: {status: 'unresolved', kind: 'dynamic-emoji', references: []}}]));
    fs.writeFileSync(path.join(data, 'badges.json'), JSON.stringify([{id: 'badge', photo: '/badge-full.webp'}]));
    fs.writeFileSync(path.join(data, 'mounts.json'), JSON.stringify([{id: 'mount', icon: '/small.webp', photo: '/full.webp'}]));
    const result = normalizeCosmeticsDataset(root);
    const output = result.materialized.en as {items: Array<Record<string, any>>};
    assert.equal(output.items.find(item => item.id === 'mount')?.photo, '/full.webp');
    assert.equal(output.items.find(item => item.id === 'sticker')?.animation.status, 'unresolved');
    assert.equal(output.items.find(item => item.id === 'badge')?.category, 'badges');
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('mount selection follows exact skin/item relations and excludes parts and other skins', () => {
  const refs = mountImageCandidates('vehicle', {DefaultSkinId: 'skin', NeedItemArray: [{ItemId: 'part1'}, {ItemId: 'part2'}]},
    {skin: {OwnerMountId: 'vehicle', BigImage: '/Game/Art/full.full'}}, {
      part1: {MountId: 'vehicle', ItemType: 'ITEM_TYPE_MOUNT', ItemIcon: '/Game/Art/part.part'},
      otherSkin: {MountId: 'vehicle', ItemType: 'ITEM_TYPE_MOUNT_SKIN', StaticToolName: 'other', ItemIcon: '/Game/Art/other.other'},
      complete: {MountId: 'vehicle', ItemType: 'ITEM_TYPE_MOUNT', ItemIcon: '/Game/Art/item.item'},
    });
  assert.deepEqual(refs.map(ref => ref.asset), ['/Game/Art/full.full', '/Game/Art/item.item']);
});

test('encoder preserves frame order, transparent pixels and timing in real GIF/WebP output', async () => {
  const require = createRequire(__filename);
  const sharpModule = require.resolve('sharp', {paths: [path.dirname(require.resolve('next', {paths: [path.resolve('apps/web')]}))]});
  const sharp = require(sharpModule);
  sharp.cache(false);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-flipbook-'));
  try {
    const atlasFile = path.join(root, 'atlas.png');
    await sharp(Buffer.from([255,0,0,255, 0,0,0,0, 0,255,0,255, 0,0,255,255]), {raw: {width: 4, height: 1, channels: 4}}).png().toFile(atlasFile);
    const recipe: VerifiedFlipbook = {atlasFile, loop: 0, frames: [
      {left: 0, top: 0, width: 2, height: 1, delayMs: 75},
      {left: 2, top: 0, width: 2, height: 1, delayMs: 125},
    ], provenance: [{file: 'fixture.json', object: 'verified', fields: ['Frames', 'Timing']}]};
    const result = await renderVerifiedFlipbook(recipe, {sharpModule, outputDir: root, name: 'fixture'});
    const gif = await sharp(result.outputs['.gif'].file, {animated: true}).metadata();
    const webp = await sharp(result.outputs['.animated.webp'].file, {animated: true}).metadata();
    assert.equal(gif.pages, 2);
    assert.equal(gif.pageHeight, 1);
    assert.deepEqual(gif.delay, [80, 120]);
    assert.deepEqual(webp.delay, [75, 125]);
    const gifPixels = await sharp(result.outputs['.gif'].file, {animated: true}).ensureAlpha().raw().toBuffer();
    assert.equal(gifPixels[7], 0);
    const pixels = await sharp(result.outputs['.animated.webp'].file, {animated: true}).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...pixels], [255,0,0,255, 0,0,0,0, 0,255,0,255, 0,0,255,255]);
    const fractional = await renderVerifiedFlipbook({...recipe, frames: [0, 2, 3].map(left =>
      ({left, top: 0, width: 1, height: 1, delayMs: 1000 / 60}))}, {sharpModule, outputDir: root, name: 'fractional'});
    const fractionalWebp = await sharp(fractional.outputs['.animated.webp'].file, {animated: true}).metadata();
    assert.deepEqual(fractionalWebp.delay, [17, 16, 17]);
    assert.equal(fractional.gifDelaysMs.reduce((sum, delay) => sum + delay, 0), 50);
    await assert.rejects(renderVerifiedFlipbook({...recipe, frames: [{...recipe.frames[0], left: 9}, recipe.frames[1]]}, {sharpModule, outputDir: root, name: 'bad'}), /Invalid frame/);
    await assert.rejects(renderVerifiedFlipbook({...recipe, provenance: []}, {sharpModule, outputDir: root, name: 'bad'}), /provenance/);
  } finally { fs.rmSync(root, {recursive: true, force: true, maxRetries: 5, retryDelay: 100}); }
});

const flipbookMaterial = (scalars: Record<string, number>, size = {x: 3, y: 2}, functions = ['Engine/Content/Functions/Engine_MaterialFunctions02/Texturing/FlipBook.0']) => ({
  chain: [{packagePath: 'Hotta/Content/E/bigemoji_1', type: 'MaterialInstanceConstant', name: 'bigemoji_1'},
    {packagePath: 'Hotta/Content/UI/UI_Main_01', type: 'Material', name: 'UI_Main_01'}],
  scalars: Object.fromEntries(Object.entries(scalars).map(([name, value]) => [name, {value, packagePath: 'Hotta/Content/E/bigemoji_1', field: `ScalarParameterValues[${name}]`}])),
  textures: {UI_Tex_01: {asset: 'Hotta/Content/E/atlas.0', size, packagePath: 'Hotta/Content/E/bigemoji_1', field: 'TextureParameterValues[0]'}},
  baseMaterialFunctions: functions,
});

test('emoji flipbook recipe reads V columns x U rows row-major with one loop per 1/Speed seconds', () => {
  const {recipe} = emojiFlipbookRecipe(flipbookMaterial({U: 2, V: 3, Speed: 0.5}));
  assert.deepEqual(recipe?.frames.map(frame => [frame.left, frame.top]), [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
  assert.equal(Math.round(recipe!.frames.reduce((total, frame) => total + frame.delayMs, 0)), 2000);
  assert.equal(recipe?.loop, 0);
  assert.match(emojiFlipbookRecipe(flipbookMaterial({U: 2, V: 3, Speed: 1}, {x: 4, y: 2})).rejection!, /does not divide/);
  assert.match(emojiFlipbookRecipe(flipbookMaterial({U: 1, V: 1, Speed: 1}, {x: 1, y: 1})).rejection!, /multi-frame/);
  assert.match(emojiFlipbookRecipe(flipbookMaterial({U: 2, V: 3, Speed: 0})).rejection!, /Speed/);
  assert.match(emojiFlipbookRecipe(flipbookMaterial({U: 2, V: 3, Speed: 1}, undefined, [])).rejection!, /FlipBook/);
});

test('staged animations publish atomically to declared URLs, merge held frames and reuse the render cache', async () => {
  const require = createRequire(__filename);
  const sharpModule = require.resolve('sharp', {paths: [path.dirname(require.resolve('next', {paths: [path.resolve('apps/web')]}))]});
  const sharp = require(sharpModule);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-animation-publish-'));
  try {
    const atlas = path.join(root, 'raw/Hotta/Content/E/atlas.png');
    fs.mkdirSync(path.dirname(atlas), {recursive: true});
    // Cells: red, red (a hold), blue.
    const pixels = Buffer.from([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]);
    await sharp(pixels, {raw: {width: 3, height: 1, channels: 4}}).png().toFile(atlas);
    const {recipe} = emojiFlipbookRecipe(flipbookMaterial({U: 1, V: 3, Speed: 2}, {x: 3, y: 1}));
    const data = path.join(root, 'stage/info/cosmetics/data');
    fs.mkdirSync(data, {recursive: true});
    fs.writeFileSync(path.join(data, 'cosmetic-animations.json'), JSON.stringify([{id: 'fixture', timing: 'inferred', ...recipe}]));
    const options = {stageDir: path.join(root, 'stage'), rawDir: path.join(root, 'raw'), publicDir: path.join(root, 'public'),
      cacheDir: path.join(root, 'cache'), sharpModule};
    const first = await publishCosmeticAnimations(options);
    assert.deepEqual([first.rendered, first.cached], [1, 0]);
    const gif = await sharp(path.join(root, 'public/game-assets/animations/cosmetic/fixture.gif')).metadata();
    assert.equal(gif.pages, 2);
    assert.equal(gif.delay.reduce((total: number, delay: number) => total + delay, 0), 500);
    for (const file of ['game-assets/png/cosmetic-animations/fixture.png', 'game-assets/webp/cosmetic-animations/fixture.webp',
      'game-assets/animations/cosmetic/fixture.webp']) assert.ok(fs.existsSync(path.join(root, 'public', file)), file);
    assert.deepEqual(fs.readdirSync(path.join(root, 'public')), ['game-assets'], 'no staging directory remains');
    const second = await publishCosmeticAnimations(options);
    assert.deepEqual([second.rendered, second.cached], [0, 1]);
  } finally { fs.rmSync(root, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}); }
});

test('PNG edge coverage decodes filtered rows and separates art cut off by its own canvas', async () => {
  const {pngEdgeCoverage} = createRequire(__filename)('../../../../scripts/game-processors/processors/png-edges.ts');
  const require = createRequire(__filename);
  const sharp = require(require.resolve('sharp', {paths: [path.dirname(require.resolve('next', {paths: [path.resolve('apps/web')]}))]}));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-png-edges-'));
  try {
    const shape = (top: number) => {
      const pixels = Buffer.alloc(8 * 6 * 4);
      for (let y = top; y < 5; y++) for (let x = 2; x < 6; x++) pixels.set([x * 30, y * 40, 200, 255], (y * 8 + x) * 4);
      return pixels;
    };
    // Adaptive filtering exercises Sub/Up/Average/Paeth predictors on gradients.
    await sharp(shape(1), {raw: {width: 8, height: 6, channels: 4}}).png({adaptiveFiltering: true}).toFile(path.join(root, 'whole.png'));
    await sharp(shape(0), {raw: {width: 8, height: 6, channels: 4}}).png({adaptiveFiltering: true}).toFile(path.join(root, 'cut.png'));
    assert.deepEqual(pngEdgeCoverage(path.join(root, 'whole.png')).edges, {top: 0, bottom: 0, left: 0, right: 0});
    assert.deepEqual(pngEdgeCoverage(path.join(root, 'cut.png')), {width: 8, height: 6, edges: {top: 0.5, bottom: 0, left: 0, right: 0}});
    await sharp(Buffer.alloc(8 * 6 * 3, 255), {raw: {width: 8, height: 6, channels: 3}}).png().toFile(path.join(root, 'rgb.png'));
    assert.equal(pngEdgeCoverage(path.join(root, 'rgb.png')), null, 'opaque RGB has no measurable alpha edge');
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('avatar recipes need an instance-set grid and layer BaseTex02 over every frame inside a circle', async () => {
  const defaults = flipbookMaterial({U: 2, V: 2, Speed: 1}, {x: 2, y: 2});
  for (const name of ['U', 'V']) defaults.scalars[name].field = 'CachedExpressionData.Parameters.ScalarValues[0]';
  assert.match((avatarFlipbookRecipe(defaults) as {rejection?: string}).rejection ?? '', /shader-only/);
  const material = flipbookMaterial({U: 1, V: 2, Speed: 2}, {x: 2, y: 1});
  (material.textures as any).BaseTex02 = {asset: 'Hotta/Content/E/hair.0', packagePath: 'Hotta/Content/E/bigemoji_1', field: 'TextureParameterValues[1]'};
  const {recipe} = avatarFlipbookRecipe(material);
  assert.equal(recipe?.overlay, 'Hotta/Content/E/hair.0');
  assert.equal(recipe?.mask, 'circle');
  const require = createRequire(__filename);
  const sharpModule = require.resolve('sharp', {paths: [path.dirname(require.resolve('next', {paths: [path.resolve('apps/web')]}))]});
  const sharp = require(sharpModule);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-avatar-layer-'));
  try {
    const atlasFile = path.join(root, 'atlas.png'), overlayFile = path.join(root, 'hair.png');
    await sharp({create: {width: 16, height: 8, channels: 4, background: '#ff0000'}}).png().toFile(atlasFile);
    const overlay = Buffer.alloc(8 * 8 * 4);
    overlay.set([0, 0, 255, 255], (4 * 8 + 4) * 4);
    await sharp(overlay, {raw: {width: 8, height: 8, channels: 4}}).png().toFile(overlayFile);
    await renderVerifiedFlipbook({atlasFile, overlayFile, mask: 'circle', loop: 0,
      frames: [{left: 0, top: 0, width: 8, height: 8, delayMs: 100}, {left: 8, top: 0, width: 8, height: 8, delayMs: 100}],
      provenance: [{file: 'fixture', object: 'fixture', fields: ['U', 'V']}]}, {sharpModule, outputDir: root, name: 'avatar'});
    const {data} = await sharp(path.join(root, 'avatar.png')).raw().toBuffer({resolveWithObject: true});
    assert.equal(data[3], 0, 'corner outside the circle is transparent');
    assert.deepEqual([...data.subarray((4 * 8 + 4) * 4, (4 * 8 + 4) * 4 + 4)], [0, 0, 255, 255], 'overlay pixel is drawn over the frame');
    assert.deepEqual([...data.subarray((4 * 8 + 3) * 4, (4 * 8 + 3) * 4 + 3)], [255, 0, 0], 'frame shows through transparent overlay');
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
