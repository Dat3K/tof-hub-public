type Json = any;
export function mergeLocaleProjection(base: Json, translated: Json, locale: string, options?: { preserve?: boolean }): Json;
export function localeView(value: Json, locale: string): Json;
export function projectedLocales(gameData: string): string[];
export function buildWithLocaleViews<T>(gameData: string, build: (read: (relative: string) => { bytes: Buffer | null; value: Json }) => T): T;
