const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync } = require('node:crypto');

function createCredentials(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('Scegli una password tra 8 e 256 caratteri.');
  const salt = randomBytes(16).toString('hex');
  return {
    ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
    ADMIN_SESSION_SECRET: randomBytes(48).toString('hex'),
    MENU_STORE_PREFIX: 'andrea-menu-production'
  };
}
function saveCredentials(credentials) {
  const directory = path.resolve(__dirname, '../.local');
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `admin-vercel-${Date.now()}-${randomBytes(3).toString('hex')}.env`);
  fs.writeFileSync(target, Object.entries(credentials).map(([key, value]) => `${key}=${value}\n`).join(''), { mode: 0o600, flag: 'wx' });
  return target;
}
module.exports = { createCredentials, saveCredentials };

// The desktop helper passes the password through stdin, never command arguments.
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; if (input.length > 4096) process.exit(1); });
  process.stdin.on('end', () => {
    try {
      const credentials = createCredentials(JSON.parse(input).password);
      input = '';
      const file = saveCredentials(credentials);
      process.stdout.write(JSON.stringify({ credentials, file }));
    } catch { process.stderr.write('Impossibile preparare i valori. Controlla la password e riprova.'); process.exitCode = 1; }
  });
}
