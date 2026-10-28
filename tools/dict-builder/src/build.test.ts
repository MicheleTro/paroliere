import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDictionary, isExcludedTag, pickDisplayForm, sha256 } from './build.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dict-builder-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** La fonte Morph-it! reale è ISO-8859-1, quindi le fixture sono scritte in latin1. */
function writeSource(lines: string[]): string {
  const path = join(dir, 'source.txt');
  writeFileSync(path, lines.join('\n'), 'latin1');
  return path;
}

describe('isExcludedTag', () => {
  it('esclude nomi propri, locuzioni abbreviate, simboli, punteggiatura, emoticon', () => {
    expect(isExcludedTag('NPR')).toBe(true);
    expect(isExcludedTag('ABL')).toBe(true);
    expect(isExcludedTag('SYM')).toBe(true);
    expect(isExcludedTag('PON')).toBe(true);
    expect(isExcludedTag('SENT')).toBe(true);
    expect(isExcludedTag('SMI')).toBe(true);
    expect(isExcludedTag('NOUN-F')).toBe(false);
    expect(isExcludedTag('VER:ind+pres')).toBe(false);
  });
});

describe('buildDictionary', () => {
  const noOverrides = { remove: new Set<string>(), add: new Set<string>(), display: new Map<string, string>() };

  it('estrae la forma flessa, non il lemma', () => {
    const source = writeSource(['case\tcasa\tNOUN-F+PL']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['case']);
  });

  it('scarta nomi propri e locuzioni abbreviate in base al tag', () => {
    const source = writeSource(['Roma\troma\tNPR', 'ecc\tecc\tABL', 'casa\tcasa\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['casa']);
  });

  it('normalizza minuscolo e rimuove i diacritici (citta -> citta)', () => {
    const source = writeSource(['Città\tcittà\tNOUN-F']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['citta']);
  });

  it('mantiene le parole con vocale accentata finale o interna (fonte latin1)', () => {
    const source = writeSource(['verità\tverità\tNOUN-F', 'amò\tamare\tVER:ind+past', 'perché\tperché\tWH']);
    const { words } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['amo', 'perche', 'verita']);
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
      display: new Map(),
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

describe('forme da mostrare (display)', () => {
  const noOverrides = { remove: new Set<string>(), add: new Set<string>(), display: new Map<string, string>() };

  it('associa la forma accentata alle parole che esistono solo accentate', () => {
    const source = writeSource(['città\tcittà\tNOUN-F', 'verità\tverità\tNOUN-F', 'casa\tcasa\tNOUN-F']);
    const { display } = buildDictionary(source, noOverrides);
    expect([...display]).toEqual([
      ['citta', 'città'],
      ['verita', 'verità'],
    ]);
  });

  it('non associa nulla se la forma senza accento è a sua volta una parola (abbandono/abbandonò)', () => {
    const source = writeSource(['abbandono\tabbandonare\tVER', 'abbandonò\tabbandonare\tVER']);
    const { words, display } = buildDictionary(source, noOverrides);
    expect(words).toEqual(['abbandono']);
    expect(display.size).toBe(0);
  });

  it('ignora la grafia senza accento il cui lemma è accentato (cosi -> così)', () => {
    const source = writeSource(['cosi\tcosì\tADV', 'così\tcosì\tADV']);
    const { display } = buildDictionary(source, noOverrides);
    expect([...display]).toEqual([['cosi', 'così']]);
  });

  it('display.txt forza la forma da mostrare', () => {
    const source = writeSource(['citta\tcitta\tNOUN-F', 'città\tcittà\tNOUN-F']);
    const { display } = buildDictionary(source, { ...noOverrides, display: new Map([['citta', 'città']]) });
    expect([...display]).toEqual([['citta', 'città']]);
  });

  it('pickDisplayForm preferisce meno accenti e "ché" acuto', () => {
    expect(pickDisplayForm(['décolleté', 'decolleté'])).toBe('decolleté');
    expect(pickDisplayForm(['perchè', 'perché'])).toBe('perché');
    expect(pickDisplayForm(['caffé', 'caffè'])).toBe('caffè');
  });
});

describe('sha256', () => {
  it('e deterministico e dipende dal contenuto', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });
});
