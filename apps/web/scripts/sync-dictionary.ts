import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDictionaryDir = join(__dirname, '..', '..', '..', 'dist', 'dictionary');
const publicDictionaryDir = join(__dirname, '..', 'public', 'dictionary');
const manifestPath = join(distDictionaryDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(
    `sync-dictionary: manca ${manifestPath}. Esegui prima "pnpm build:dict --source <file>".`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { file: string };

mkdirSync(publicDictionaryDir, { recursive: true });
copyFileSync(manifestPath, join(publicDictionaryDir, 'manifest.json'));
copyFileSync(join(distDictionaryDir, manifest.file), join(publicDictionaryDir, manifest.file));

console.log(`sync-dictionary: copiato ${manifest.file} in ${publicDictionaryDir}`);
