import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface SourceEntry {
  /** Forma flessa (non il lemma). */
  form: string;
  /** Tag grammaticale grezzo della fonte. */
  tag: string;
}

/**
 * Parser per il formato Morph-it! (tre colonne separate da tab:
 * forma flessa, lemma, tag). Verificato contro morph-it_048.txt reale
 * (vedi docs/DICTIONARY.md).
 */
export function parseSourceLine(line: string): SourceEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const columns = trimmed.split('\t');
  const form = columns[0];
  const tag = columns[2];
  if (!form || !tag) return null;
  return { form, tag };
}

/**
 * Tag da escludere (nomi propri, locuzioni abbreviate, simboli, punteggiatura,
 * emoticon). Verificato contro morph-it_048.txt (readme-morph-it.txt): il tag
 * reale per le abbreviazioni e "ABL" (non "ABR"); "PON"/"SENT" sono
 * punteggiatura, "SMI" sono emoticon (non documentate nel readme ma presenti
 * nel file). In pratica quasi tutte queste righe sarebbero comunque scartate
 * dal filtro [a-z]+, ma escluderle per tag evita falsi positivi come "etc".
 */
const EXCLUDED_TAG_SUBSTRINGS = ['NPR', 'ABL', 'SYM', 'PON', 'SENT', 'SMI'];

export function isExcludedTag(tag: string): boolean {
  const upper = tag.toUpperCase();
  return EXCLUDED_TAG_SUBSTRINGS.some((excluded) => upper.includes(excluded));
}

const VALID_WORD_PATTERN = /^[a-z]+$/;
const FORBIDDEN_LETTERS_PATTERN = /[jkwxy]/;
const LONE_Q_PATTERN = /q(?!u)/;

function stripDiacritics(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface BuildStats {
  phase: string;
  count: number;
}

export interface BuildResult {
  words: string[];
  stats: BuildStats[];
}

export function buildDictionary(
  sourcePath: string,
  overrides: { remove: Set<string>; add: Set<string> },
): BuildResult {
  const stats: BuildStats[] = [];
  const record = (phase: string, count: number): void => {
    stats.push({ phase, count });
  };

  const rawLines = readFileSync(sourcePath, 'utf-8').split('\n');
  const entries = rawLines.map(parseSourceLine).filter((e): e is SourceEntry => e !== null);
  record('forma flessa estratta', entries.length);

  const afterTagFilter = entries.filter((e) => !isExcludedTag(e.tag));
  record('filtro per tag', afterTagFilter.length);

  const lowercased = afterTagFilter.map((e) => e.form.toLowerCase());
  record('minuscolo', lowercased.length);

  const stripped = lowercased.map(stripDiacritics);
  record('normalizzazione NFD e rimozione diacritici', stripped.length);

  const onlyLetters = stripped.filter((w) => VALID_WORD_PATTERN.test(w));
  record('scarto non [a-z]+', onlyLetters.length);

  const withoutForbiddenLetters = onlyLetters.filter((w) => !FORBIDDEN_LETTERS_PATTERN.test(w));
  record('scarto j k w x y', withoutForbiddenLetters.length);

  const withoutLoneQ = withoutForbiddenLetters.filter((w) => !LONE_Q_PATTERN.test(w));
  record('scarto q non seguita da u', withoutLoneQ.length);

  const withValidLength = withoutLoneQ.filter((w) => w.length >= 3 && w.length <= 16);
  record('scarto lunghezza < 3 o > 16', withValidLength.length);

  const withOverridesRemoved = withValidLength.filter((w) => !overrides.remove.has(w));
  const withOverridesAdded = [...withOverridesRemoved, ...overrides.add].filter(
    (w) =>
      VALID_WORD_PATTERN.test(w) &&
      !FORBIDDEN_LETTERS_PATTERN.test(w) &&
      !LONE_Q_PATTERN.test(w) &&
      w.length >= 3 &&
      w.length <= 16,
  );
  record('overrides (remove.txt / add.txt)', withOverridesAdded.length);

  const deduped = [...new Set(withOverridesAdded)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  record('deduplica e ordina', deduped.length);

  return { words: deduped, stats };
}

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
