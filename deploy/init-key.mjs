import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
const file = '/app/.data/import-private.pem';
fs.mkdirSync('/app/.data', { recursive: true });
if (!fs.existsSync(file)) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
  fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  console.log('Created this installation\'s RSA import/signing key.');
} else console.log('Preserved existing import/signing key.');
