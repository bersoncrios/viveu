import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function runAngular(command, target, extraArgs = []) {
  if (!['hml', 'prod'].includes(target) || !['build', 'serve'].includes(command)) {
    throw new Error('Uso: node scripts/angular-env.mjs <build|serve> <hml|prod>');
  }
  const envFile = `.env.${target}.local`;
  const values = {
    ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}),
    ...process.env
  };
  const fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  const firebase = {};
  for (const field of fields) {
    const name = `FIREBASE_${field.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()}`;
    if (!values[name]?.trim()) throw new Error(`Defina ${name} em ${envFile} ou nas variáveis do build.`);
    firebase[field] = values[name].trim();
  }
  const projectId = target === 'prod' ? 'vaultlog-65c3d' : 'vaultlog-hml';
  if (firebase.projectId !== projectId || firebase.authDomain !== `${projectId}.firebaseapp.com` || firebase.storageBucket !== `${projectId}.firebasestorage.app`) {
    throw new Error(`Configuração incompatível com ${target}: esperado projeto ${projectId}.`);
  }
  writeFileSync(`src/environments/firebase.${target}.local.ts`, `// Gerado por scripts/angular-env.mjs; não versionar.\nexport const firebase = ${JSON.stringify(firebase, null, 2)};\n`);
  const configuration = target === 'prod' ? 'production' : command === 'serve' ? 'development' : 'hml';
  const args = [command, `--configuration=${configuration}`, ...(command === 'serve' ? ['--host=0.0.0.0'] : []), ...extraArgs];
  const result = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runAngular(process.argv[2], process.argv[3], process.argv.slice(4));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
