import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

const file = '.env';
if (fs.existsSync(file)) {
  console.log('.env already exists; preserved. See .env.example for available settings.');
  process.exit(0);
}
const secret = () => randomBytes(32).toString('hex');
const owner = secret(), runtime = secret();
let text = fs.readFileSync('.env.example', 'utf8');
const values = {
  POSTGRES_PASSWORD: owner, RUNTIME_DB_PASSWORD: runtime,
  DATABASE_URL: `postgresql://tof_runtime:${runtime}@postgres:5432/tof_hub?schema=public`,
  DATABASE_MIGRATION_URL: `postgresql://tof_owner:${owner}@postgres:5432/tof_hub?schema=public`,
  IP_HASH_SALT: secret(), COOKIE_SECRET: secret(), FEEDBACK_ADMIN_KEY: secret(),
};
for (const [key, value] of Object.entries(values)) text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
fs.writeFileSync(file, text, { mode: 0o600, flag: 'wx' });
for (const dir of ['apps/web/public', 'pipeline/raw', 'ignore/downloads', 'ignore/export', 'backups']) fs.mkdirSync(dir, { recursive: true });
console.log('Created .env with independent random credentials. Values were not printed.');
