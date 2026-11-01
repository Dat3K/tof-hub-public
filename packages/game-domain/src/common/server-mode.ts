export type ServerMode = 'gacha' | 'mmo';

export const SERVER_MODES: readonly ServerMode[] = ['gacha', 'mmo'] as const;

export function isServerMode(value: unknown): value is ServerMode {
  return typeof value === 'string' && SERVER_MODES.includes(value as ServerMode);
}

export function normalizeServerMode(raw: string | null | undefined): ServerMode {
  if (!raw) return 'gacha';
  const norm = raw.trim().toLowerCase();
  return norm === 'mmo' ? 'mmo' : 'gacha';
}
