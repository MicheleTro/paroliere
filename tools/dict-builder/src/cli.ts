import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDictionary, sha256 } from './build.js';
import { computeStats } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const overridesDir = join(__dirname, '..', 'overrides');

/** pnpm --filter cambia la cwd nel package: i path relativi vanno risolti dalla cwd originale. */
function resolveFromInvocationCwd(path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

interface Args {
  source: string;
  out: string;
}

function parseArgs(argv: string[]): Args {
  let source: string | undefined;
  let out = 'dist/dictionary';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') source = argv[++i];
    else if (argv[i] === '--out') out = argv[++i]!;
  }
  if (!source) {
    throw new Error('build:dict: --source <file> e obbligatorio');
  }
  return { source: resolveFromInvocationCwd(source), out: resolveFromInvocationCwd(out) };
}

function readWordSet(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, 'utf-8')
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const overrides = {
    remove: readWordSet(join(overridesDir, 'remove.txt')),
    add: readWordSet(join(overridesDir, 'add.txt')),
  };

  const { words, stats } = buildDictionary(args.source, overrides);
  for (const s of stats) {
    console.log(`${s.phase}: ${s.count}`);
  }

  const content = words.join('\n') + '\n';
  const version = 'it-' + sha256(content).slice(0, 8);
  const fileName = `${version}.txt`;

  mkdirSync(args.out, { recursive: true });
  writeFileSync(join(args.out, fileName), content, 'utf-8');

  const manifest = {
    version,
    file: fileName,
    wordCount: words.length,
    sha256: sha256(content),
    source: 'Morph-it! v0.4.8 (Baroni & Zanchetta, SSLMIT Univ. Bologna)',
    sourceLicense: 'CC BY-SA 2.0 / GNU LGPL — vedi docs/DICTIONARY.md',
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  const dictStats = computeStats(content);
  console.log('\nStatistiche:');
  console.log(`  parole totali: ${dictStats.wordCount}`);
  console.log(`  dimensione raw: ${dictStats.rawBytes} byte`);
  console.log(`  dimensione gzip: ${dictStats.gzipBytes} byte`);
  console.log(`  dimensione brotli: ${dictStats.brotliBytes} byte`);
  console.log('  distribuzione per lunghezza:');
  for (const length of Object.keys(dictStats.lengthDistribution).sort((a, b) => Number(a) - Number(b))) {
    console.log(`    ${length}: ${dictStats.lengthDistribution[Number(length)]}`);
  }

  console.log(`\nOutput: ${join(args.out, fileName)}`);
  console.log(`Manifest: ${join(args.out, 'manifest.json')}`);
}

main();
