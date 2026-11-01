'use strict';
// Locations shared by the site data generators (scripts/generators/build-*.cjs).
// Repository defaults keep `node scripts/generators/build-x.cjs` working in this checkout. The game
// pipeline (tools/patch-exporter) overrides them so the generators read its raw export and
// staging tree and write into its output tree instead of apps/web.
const fs = require('node:fs');
const path = require('node:path');

const env = process.env;
const repoRoot = path.resolve(__dirname, '../..');
// Web sources read as data (e.g. the Comp icon registries); the portable package ships a copy.
const webDir = env.TOF_WEB_DIR ? path.resolve(env.TOF_WEB_DIR) : path.join(repoRoot, 'apps/web');
const pipelineRun = Boolean(env.TOF_PUBLIC_DIR);
// Locale projection lanes share the base run's media tree (and run concurrently). Media is
// locale-independent, so a lane keeps textures the base run already wrote and creates
// missing ones atomically instead of rewriting files another lane may be reading.
const sharedMedia = Boolean(env.TOF_BASE_PUBLIC_DIR);

// Keep the extension: sharp infers the output format from it.
const temporaryPath = (target) => path.join(path.dirname(target), `.${process.pid}.${path.basename(target)}`);

function existingMedia(target) {
  try {
    return fs.statSync(target).size > 0;
  } catch {
    return false;
  }
}

/** Write through a same-directory temporary file; a target created meanwhile by another lane wins. */
async function writeSharedMedia(target, write) {
  if (existingMedia(target)) return;
  const temporary = temporaryPath(target);
  try {
    await write(temporary);
    try {
      fs.renameSync(temporary, target);
    } catch (error) {
      if (!existingMedia(target)) throw error;
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function laneSafeSharp(lib) {
  const patch = (instance) => {
    const toFile = instance.toFile.bind(instance);
    instance.toFile = async (target, callback) => {
      try {
        await writeSharedMedia(target, (temporary) => toFile(temporary));
        const { format, width, height, size } = await lib(target).metadata();
        const info = { format, width, height, size };
        if (callback) callback(null, info);
        return info;
      } catch (error) {
        if (callback) return callback(error);
        throw error;
      }
    };
    return instance;
  };
  return new Proxy(lib, {
    apply: (target, thisArg, args) => patch(Reflect.apply(target, thisArg, args)),
    construct: (target, args) => patch(Reflect.construct(target, args)),
  });
}

module.exports = {
  repoRoot,
  webDir,
  /** Raw game export (`Hotta/Content/...`). */
  rawDir: env.TOF_RAW_GAME_DIR || require('node:path').resolve('pipeline/raw'),
  /** Generator inputs shared with the portable exporter. */
  generatorDataDir: env.TOF_GENERATOR_DATA_DIR ? path.resolve(env.TOF_GENERATOR_DATA_DIR) : path.join(repoRoot, 'scripts/data'),
  /** Legacy-shaped tree: the pipeline points this at its processor staging directory. */
  legacyDir: env.TOF_LEGACY_DIR || require('node:path').resolve('pipeline/staging'),
  /** Web `public/` root that receives `game-data/` and media. */
  publicDir: pipelineRun ? path.resolve(env.TOF_PUBLIC_DIR) : path.join(webDir, 'public'),
  /** Pipeline runs never rewrite apps/web/src test fixtures. */
  writesRepoFixtures: !pipelineRun,
  /** sharp from the portable package, a direct install, or the web app's Next.js dependency. */
  sharp() {
    const lib = env.TOF_SHARP_MODULE
      ? require(env.TOF_SHARP_MODULE)
      : require(require.resolve('sharp', { paths: [require.resolve('next', { paths: [webDir] })] }));
    return sharedMedia ? laneSafeSharp(lib) : lib;
  },
  /** Copy a texture into the public media tree (lane-safe like sharp().toFile). */
  copyMedia(from, to) {
    if (!sharedMedia) return fs.copyFileSync(from, to);
    if (existingMedia(to)) return;
    const temporary = temporaryPath(to);
    try {
      fs.copyFileSync(from, temporary);
      try {
        fs.renameSync(temporary, to);
      } catch (error) {
        if (!existingMedia(to)) throw error;
      }
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  },
};
