import fs from 'node:fs';
import path from 'node:path';

export type NotificationMode = 'off' | 'producer' | 'relay' | 'controller';
export function notificationConfig() {
  // The local launcher owns database settings. Read only Telegram variables from the ignored local env.
  if (process.env.NODE_ENV !== 'production') {
    for (const root of [process.cwd(), path.resolve(process.cwd(), '../..')]) {
      const file = path.join(root, '.env.local');
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = /^(TELEGRAM_[A-Z_]+)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^("|')|("|')$/g, '');
      }
    }
  }
  const mode = process.env.TELEGRAM_MODE ?? 'off';
  if (!['off', 'producer', 'relay', 'controller'].includes(mode)) throw new Error('Invalid TELEGRAM_MODE');
  const owner = process.env.TELEGRAM_OWNER_ID ?? '';
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const relaySecret = process.env.TELEGRAM_RELAY_SECRET ?? '';
  const relayUrl = process.env.TELEGRAM_RELAY_URL ?? '';
  if (mode === 'controller' && (!/^\d{1,20}$/.test(owner) || !token)) throw new Error('Telegram controller requires token and owner ID');
  if (mode === 'relay' && (!relayUrl.startsWith('https://') || relaySecret.length < 32)) throw new Error('Telegram relay requires HTTPS URL and a shared secret of at least 32 characters');
  const importFiles = process.env.TELEGRAM_IMPORT_FILES === 'true';
  if (importFiles && !['off', 'producer', 'controller'].includes(mode)) throw new Error('Import files require a shared-database Telegram controller');
  return { mode: mode as NotificationMode, owner, token, relaySecret, relayUrl,
    importFiles,
    preferenceCachePath: process.env.TELEGRAM_PREFERENCE_CACHE_PATH ?? '',
    environment: process.env.NODE_ENV === 'production' ? 'normal' as const : 'local' as const };
}
