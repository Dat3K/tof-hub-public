import type { GameAssetConfig, GameAssetFormat } from './types';

export const DEFAULT_ASSET_BASE_URL = '/game-assets';
export const DEFAULT_ASSET_FORMAT: GameAssetFormat = 'webp';
export const DEFAULT_FALLBACK_PLACEHOLDER = '/game-assets/placeholder.webp';

function getEnvVar(key: string): string | undefined {
  if (typeof globalThis !== 'undefined') {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return proc?.env?.[key];
  }
  return undefined;
}

function isDevEnvironment(): boolean {
  const nodeEnv = getEnvVar('NODE_ENV');
  return nodeEnv !== 'production';
}

let currentConfig: GameAssetConfig = {
  baseUrl: getEnvVar('GAME_ASSET_BASE_URL') || DEFAULT_ASSET_BASE_URL,
  defaultFormat: DEFAULT_ASSET_FORMAT,
  placeholderUrl: DEFAULT_FALLBACK_PLACEHOLDER,
  devDiagnostics: isDevEnvironment(),
};

export function getGameAssetConfig(): Readonly<GameAssetConfig> {
  return currentConfig;
}

export function configureGameAssets(config: Partial<GameAssetConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
  };
}

export function resetGameAssetConfig(): void {
  currentConfig = {
    baseUrl: getEnvVar('GAME_ASSET_BASE_URL') || DEFAULT_ASSET_BASE_URL,
    defaultFormat: DEFAULT_ASSET_FORMAT,
    placeholderUrl: DEFAULT_FALLBACK_PLACEHOLDER,
    devDiagnostics: isDevEnvironment(),
  };
}
