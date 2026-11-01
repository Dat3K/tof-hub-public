import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {computeSha256} from './media-converter';

export interface VerifiedFlipbook {
  /** Exact raw PNG; neither filename nor dimensions establish frame semantics. */
  atlasFile: string;
  /** Explicit top-left pixel rectangles in playback order, including repeated frames. */
  frames: Array<{left: number; top: number; width: number; height: number; delayMs: number}>;
  /** GIF/WebP loop metadata (0 = infinite), established by the source resolver. */
  loop: number;
  provenance: Array<{file: string; object: string; fields: string[]}>;
  /** Raw PNG drawn over every frame (scaled to the frame), e.g. an avatar's BaseTex02 layer. */
  overlayFile?: string;
  /** Inscribed circle alpha mask, as the game presents avatar icons. */
  mask?: 'circle';
}

/**
 * Encoding boundary for a future raw-material resolver. Deliberately accepts no inferred
 * grid/FPS defaults. The normal pipeline must not call it for unresolved materials/particles.
 * Uses the sharp runtime already shipped with the portable package; no browser encoder.
 */
export async function renderVerifiedFlipbook(recipe: VerifiedFlipbook, options: {
  sharpModule: string; outputDir: string; name: string;
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.name)) throw new Error('Invalid animation output name');
  if (!recipe.provenance.length || recipe.provenance.some(source => !source.file || !source.object || !source.fields.length)) {
    throw new Error('Animation requires raw frame/timing provenance');
  }
  if (!Number.isInteger(recipe.loop) || recipe.loop < 0 || recipe.loop > 65535) throw new Error('Invalid loop count');
  if (recipe.frames.length < 2 || recipe.frames.length > 256) throw new Error('Animation requires 2..256 verified frames');
  const first = recipe.frames[0];
  const requireRuntime = createRequire(__filename);
  const sharp = requireRuntime(options.sharpModule);
  const metadata = await sharp(recipe.atlasFile).metadata();
  let elapsed = 0;
  let ticks = 0;
  let webpMilliseconds = 0;
  const webpDelays: number[] = [];
  const gifDelays = recipe.frames.map(frame => {
    if (![frame.left, frame.top, frame.width, frame.height].every(Number.isInteger)
      || frame.left < 0 || frame.top < 0 || frame.width <= 0 || frame.height <= 0
      || frame.width !== first.width || frame.height !== first.height
      || frame.left + frame.width > metadata.width || frame.top + frame.height > metadata.height
      || !Number.isFinite(frame.delayMs) || frame.delayMs < 10 || frame.delayMs > 655350) {
      throw new Error('Invalid frame rectangle/delay; frames must have equal canvas dimensions');
    }
    elapsed += frame.delayMs;
    const next = Math.round(elapsed / 10);
    const delay = (next - ticks) * 10;
    ticks = next;
    const nextMillisecond = Math.round(elapsed);
    webpDelays.push(nextMillisecond - webpMilliseconds);
    webpMilliseconds = nextMillisecond;
    return delay;
  });
  const bytes = first.width * first.height * recipe.frames.length * 4;
  if (bytes > 256 * 1024 * 1024) throw new Error('Animation exceeds the 256 MiB RGBA budget');
  // Decode one frame at a time to keep memory bounded by the final page strip.
  const strip = Buffer.alloc(bytes);
  const layers = [
    ...(recipe.overlayFile ? [{input: await sharp(recipe.overlayFile).resize(first.width, first.height, {fit: 'fill'}).png().toBuffer()}] : []),
    ...(recipe.mask === 'circle' ? [{blend: 'dest-in', input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${first.width}" height="${first.height}">`
      + `<ellipse cx="${first.width / 2}" cy="${first.height / 2}" rx="${first.width / 2}" ry="${first.height / 2}" fill="#fff"/></svg>`)}] : []),
  ];
  for (let index = 0; index < recipe.frames.length; index++) {
    const {delayMs: _delay, ...rect} = recipe.frames[index];
    let frame = sharp(recipe.atlasFile).extract(rect).ensureAlpha();
    // composite() applies to the input image, so extract first and layer onto the resulting frame.
    if (layers.length) frame = sharp(await frame.png().toBuffer()).composite(layers);
    const rgba = await frame.ensureAlpha().raw().toBuffer();
    rgba.copy(strip, index * first.width * first.height * 4);
  }
  fs.mkdirSync(options.outputDir, {recursive: true});
  const file = (suffix: string) => path.join(options.outputDir, `${options.name}${suffix}`);
  const input = () => sharp(strip, {raw: {width: first.width, height: first.height * recipe.frames.length,
    channels: 4, pageHeight: first.height}});
  await input().gif({delay: gifDelays, loop: recipe.loop}).toFile(file('.gif'));
  await input().webp({lossless: true, delay: webpDelays, loop: recipe.loop}).toFile(file('.animated.webp'));
  const poster = strip.subarray(0, first.width * first.height * 4);
  const still = () => sharp(poster, {raw: {width: first.width, height: first.height, channels: 4}});
  await still().png().toFile(file('.png'));
  await still().webp({lossless: true}).toFile(file('.webp'));
  const outputs = Object.fromEntries(['.gif', '.animated.webp', '.png', '.webp'].map(suffix =>
    [suffix, {file: file(suffix), sha256: computeSha256(file(suffix))}]));
  return {width: first.width, height: first.height, frameCount: recipe.frames.length,
    sourceDurationMs: elapsed, gifDelaysMs: gifDelays, webpDelaysMs: webpDelays,
    atlasSha256: computeSha256(recipe.atlasFile), provenance: recipe.provenance, outputs};
}

/** Bump when encoder output for the same recipe changes; part of the render cache key. */
export const COSMETIC_ANIMATION_ENCODER_VERSION = 1;

export interface StagedCosmeticAnimation extends Omit<VerifiedFlipbook, 'atlasFile' | 'overlayFile'> {
  id: string;
  /** Raw package reference of the atlas texture (e.g. `Hotta/Content/.../17.0`). */
  atlas: string;
  /** Raw package reference of a layer drawn over every frame. */
  overlay?: string;
  timing: 'verified' | 'inferred';
}

/**
 * Renders the processor's staged recipes (`info/cosmetics/data/cosmetic-animations.json`) to the URLs
 * the cosmetics catalog already declares. Every output is rendered into a staging directory, checked
 * (page count, delays, poster size) and only then moved into `public`; any failure aborts the release.
 */
export async function publishCosmeticAnimations(options: {
  stageDir: string; rawDir: string; publicDir: string; cacheDir: string; sharpModule?: string;
}) {
  const recipesFile = path.join(options.stageDir, 'info/cosmetics/data/cosmetic-animations.json');
  const recipes: StagedCosmeticAnimation[] = fs.existsSync(recipesFile) ? JSON.parse(fs.readFileSync(recipesFile, 'utf8')) : [];
  if (!recipes.length) return {rendered: 0, cached: 0, outputs: []};
  if (!options.sharpModule) throw new Error('Cosmetic animations need the packaged sharp module');
  const sharp = createRequire(__filename)(options.sharpModule);
  // libvips' file cache keeps outputs open on Windows, which blocks the atomic cache-directory rename.
  sharp.cache(false);
  const targets = (id: string) => ({
    '.png': path.join(options.publicDir, 'game-assets/png/cosmetic-animations', `${id}.png`),
    '.webp': path.join(options.publicDir, 'game-assets/webp/cosmetic-animations', `${id}.webp`),
    '.gif': path.join(options.publicDir, 'game-assets/animations/cosmetic', `${id}.gif`),
    '.animated.webp': path.join(options.publicDir, 'game-assets/animations/cosmetic', `${id}.webp`),
  });
  fs.mkdirSync(options.publicDir, {recursive: true});
  const staging = fs.mkdtempSync(path.join(options.publicDir, '.cosmetic-animations-'));
  const outputs: Array<{id: string; key: string; frameCount: number; timing: string; files: Record<string, string>}> = [];
  let cached = 0;
  try {
    for (const recipe of recipes) {
      const rawPng = (reference: string) => path.join(options.rawDir, `${reference.replace(/\.\d+$/, '')}.png`);
      const atlasFile = rawPng(recipe.atlas);
      const overlayFile = recipe.overlay ? rawPng(recipe.overlay) : undefined;
      for (const [label, file] of [['atlas', atlasFile], ['overlay', overlayFile]] as const) {
        if (file && !fs.existsSync(file)) throw new Error(`Animation ${recipe.id}: ${label} ${file} was not exported`);
      }
      const key = computeSha256Text(JSON.stringify([COSMETIC_ANIMATION_ENCODER_VERSION, computeSha256(atlasFile),
        overlayFile ? computeSha256(overlayFile) : null, recipe.mask ?? null, recipe.frames, recipe.loop]));
      const cacheEntry = path.join(options.cacheDir, key);
      if (fs.existsSync(path.join(cacheEntry, 'complete.json'))) {
        cached++;
      } else {
        const temp = `${cacheEntry}.tmp-${process.pid}`;
        fs.rmSync(temp, {recursive: true, force: true});
        const result = await renderVerifiedFlipbook({...recipe, atlasFile, overlayFile}, {sharpModule: options.sharpModule, outputDir: temp, name: 'out'});
        const animated = await sharp(result.outputs['.gif'].file).metadata();
        const animatedWebp = await sharp(result.outputs['.animated.webp'].file).metadata();
        // Both encoders merge consecutive identical frames (atlases repeat cells as holds) into one longer page.
        const total = (delays: number[] = []) => delays.reduce((sum, delay) => sum + delay, 0);
        const matches = (encoded: {pages?: number; delay?: number[]}, delays: number[]) =>
          encoded.pages! >= 2 && encoded.pages! <= recipe.frames.length && total(encoded.delay) === total(delays);
        if (!matches(animated, result.gifDelaysMs) || !matches(animatedWebp, result.webpDelaysMs)) {
          throw new Error(`Animation ${recipe.id}: encoded pages/delays do not match the recipe`);
        }
        fs.writeFileSync(path.join(temp, 'complete.json'), JSON.stringify(result, null, 2));
        fs.rmSync(cacheEntry, {recursive: true, force: true});
        fs.renameSync(temp, cacheEntry);
      }
      const files: Record<string, string> = {};
      for (const [suffix, target] of Object.entries(targets(recipe.id))) {
        const staged = path.join(staging, path.relative(options.publicDir, target));
        fs.mkdirSync(path.dirname(staged), {recursive: true});
        fs.copyFileSync(path.join(cacheEntry, `out${suffix}`), staged);
        files[suffix] = path.relative(options.publicDir, target).split(path.sep).join('/');
      }
      outputs.push({id: recipe.id, key, frameCount: recipe.frames.length, timing: recipe.timing, files});
    }
    for (const output of outputs) for (const relative of Object.values(output.files)) {
      const target = path.join(options.publicDir, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.renameSync(path.join(staging, relative), target);
    }
  } finally {
    fs.rmSync(staging, {recursive: true, force: true});
  }
  return {rendered: recipes.length - cached, cached, outputs};
}

function computeSha256Text(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
