import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';

// Processors retain their established English projection API. A locale pass supplies
// a namespaced Game.json (target keys over English fallback) through this boundary.
// No source files are changed, and concurrent in-process normalization is isolated.
const localizationSource = new AsyncLocalStorage<{ file: string; locale?: string }>();

export function hasGameLocalizationSource(): boolean {
  return Boolean(localizationSource.getStore() || process.env.TOF_GAME_LOCALIZATION_FILE);
}

export function withGameLocalizationSource<T>(file: string, work: () => T, locale?: string): T {
  return localizationSource.run({ file, locale }, work);
}

export function gameLocalizationLocale(): string | undefined {
  return localizationSource.getStore()?.locale || process.env.TOF_GAME_LOCALE;
}

const CJK_CULTURES = new Set(['zh-CN', 'zh-Hans', 'zh-Hans-SG', 'ja']);

/**
 * True while projecting a Chinese or Japanese culture. The English slot of such a pass legitimately holds
 * CJK text, so the processors' "untranslated Chinese in the English name" guards must stand down.
 */
export function projectsCjkCulture(): boolean {
  return CJK_CULTURES.has(gameLocalizationLocale() ?? '');
}

export function gameSourcePath(file: fs.PathOrFileDescriptor): fs.PathOrFileDescriptor {
  const source = localizationSource.getStore()?.file || process.env.TOF_GAME_LOCALIZATION_FILE;
  if (!source || typeof file !== 'string') return file;
  return /(?:^|[/\\])(?:Localization[/\\]Game[/\\]|Game[/\\])?en[/\\]Game\.json$/i.test(file) ? source : file;
}

/** Explicit source reader; generated catalogs and all other raw tables are untouched. */
export const readGameSourceFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) =>
  (fs.readFileSync as (...args: unknown[]) => unknown)(gameSourcePath(file), ...args)
) as typeof fs.readFileSync;
