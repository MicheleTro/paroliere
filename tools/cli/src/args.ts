import { isAbsolute, resolve } from 'node:path';

/** pnpm --filter cambia la cwd nel package: i path relativi vanno risolti dalla cwd originale. */
export function resolveFromInvocationCwd(path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

export function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      flags.set(key, value ?? '');
      i++;
    }
  }
  return flags;
}

export function requireFlag(flags: Map<string, string>, name: string): string {
  const value = flags.get(name);
  if (value === undefined) throw new Error(`--${name} e obbligatorio`);
  return value;
}
