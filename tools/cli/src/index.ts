import { runBench } from './bench.js';
import { runGrid } from './grid.js';

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'grid':
    runGrid(rest);
    break;
  case 'bench':
    runBench(rest);
    break;
  default:
    console.error('Uso: pnpm cli <grid|bench> [opzioni]');
    process.exit(1);
}
