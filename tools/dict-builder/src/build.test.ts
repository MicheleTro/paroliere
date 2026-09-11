import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDictionary, isExcludedTag, sha256 } from './build.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dict-builder-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeSource(lines: string[]): string {
  const path = join(dir, 'source.txt');
  writeFileSync(path, lines.join('\n'), 'utf-8');
  return path;
}

describe('isExcludedTag', () => {
  it('esclude nomi propri, sigle, abbreviazioni, simboli, punteggiatura', () => {
    expect(isExcludedTag('NPR')).toBe(true);
    expect(isExcludedTag('ABR')).toBe(true);
    expect(isExcludedTag('SYM')).toBe(true);
    expect(isExcludedTag('PUN')).toBe(true);
    expect(isExcludedTag('NOUN-F')).toBe(false);
    expect(isExcludedTag('VER:ind+pres')).toBe(false);
  });
});

describe('buildDictionary', () => {
  const noOverrides = { remove: new Set<string>(), add: new Set<string>() };

  it('estrae la forma flessa, non il lemma', () => {
    const source = writeSource(['case\tcasa\tNOUN-F+PL']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['case']);
  });

  it('scarta nomi propri e sigle in base al tag', () => {
    const source = writeSource(['Roma\troma\tNPR', 'ONU\tonu\tABR', 'casa\tcasa\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['casa']);
  });

  it('normalizza minuscolo e rimuove i diacritici (citta -> citta)', () => {
    const source = writeSource(['Città\tcittà\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['citta']);
  });

  it('scarta apostrofi, trattini, spazi, cifre', () => {
    const source = writeSource([
      "l'amico\tamico\tNOUN-M",
      'porta-voce\tportavoce\tNOUN-M',
      '2024\t2024\tNUM',
    ]);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual([]);
  });

  it('scarta parole con j k w x y', () => {
    const source = writeSource(['jazz\tjazz\tNOUN-M', 'whisky\twhisky\tNOUN-M', 'casa\tcasa\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['casa']);
  });

  it('scarta parole con una q non seguita da u', () => {
    const source = writeSource(['qat\tqat\tNOUN-M', 'quota\tquota\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['quota']);
  });

  it('scarta parole troppo corte o troppo lunghe', () => {
    const source = writeSource([
      'ab\tab\tNOUN-M',
      'casa\tcasa\tNOUN-F',
      `${'a'.repeat(17)}\tlemma\tNOUN-M`,
    ]);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['casa']);
  });

  it('applica remove.txt e add.txt (le aggiunte passano dalle fasi 3-8)', () => {
    const source = writeSource(['casa\tcasa\tNOUN-F', 'cane\tcane\tNOUN-M']);
    const { words } = buildDictionary(source, {
      remove: new Set(['cane']),
      add: new Set(['gatto', "l'amico", 'jazz']),
    });
    expect(words).toEqual(['casa', 'gatto']);
  });

  it('deduplica e ordina per code unit', () => {
    const source = writeSource(['zebra\tzebra\tNOUN-F', 'casa\tcasa\tNOUN-F', 'Casa\tcasa\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['casa', 'zebra']);
  });

  it('stampa il conteggio dopo ogni fase', () => {
    const source = writeSource(['casa\tcasa\tNOUN-F']);
    const { stats } = buildDictionary(source, noOverrides);
    expect(stats.length).toBeGreaterThanOrEqual(9);
    expect(stats.every((s) => typeof s.count === 'number')).toBe(true);
  });
});

describe('sha256', () => {
  it('e deterministico e dipende dal contenuto', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });
});
