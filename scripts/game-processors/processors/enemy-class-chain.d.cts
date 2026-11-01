export function traceEnemyClass(rawDir: string, classPath: string, readRaw?: (file: string) => unknown): Array<{
  reference: string; file: string; properties: Record<string, any>;
}>;
