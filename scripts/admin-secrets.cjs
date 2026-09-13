const { createCredentials, saveCredentials } = require('./admin-credentials.cjs');
const readline = require('node:readline');

async function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('Esegui questo comando in un terminale interattivo.');
  process.stdout.write(prompt);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.removeListener('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause();
      process.stdout.write('\n'); error ? reject(error) : resolve(value);
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') return done(new Error('Annullato.'));
      if (key.name === 'return') return done();
      if (key.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text) && value.length < 256) value += text;
    };
    process.stdin.on('keypress', onKey);
  });
}
(async () => {
  const password = await hiddenInput('Scegli la password admin (almeno 8 caratteri; non verrà mostrata): ');
  if (password.length < 8) throw new Error('Usa almeno 8 caratteri.');
  if (password !== await hiddenInput('Ripeti la password: ')) throw new Error('Le password non coincidono.');
  const target = saveCredentials(createCredentials(password));
  console.log(`Valori creati in ${target}\nCopia le tre variabili nelle impostazioni Vercel, poi esegui un nuovo deploy.\nLa password scelta non è stata salvata. Il file è escluso da Git e dal deploy.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
