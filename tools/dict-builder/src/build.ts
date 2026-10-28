import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface SourceEntry {
  /** Forma flessa (non il lemma). */
  form: string;
  /** Lemma (seconda colonna). */
  lemma: string;
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
  const lemma = columns[1] ?? '';
  const tag = columns[2];
  if (!form || !tag) return null;
  return { form, lemma, tag };
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
  /** Parole normalizzate (solo a-z), ordinate e senza duplicati. */
  words: string[];
  /** Solo visualizzazione: parola normalizzata -> forma accentata (vedi pickDisplayForm). */
  display: Map<string, string>;
  stats: BuildStats[];
}

/**
 * Sceglie la forma accentata da mostrare per una parola normalizzata, tra le
 * varianti trovate nella fonte (tutte diverse dalla forma normalizzata).
 * Meno accenti prima (decolleté su décolleté); a parità, "-ché" con accento
 * acuto (perché, affinché), altrimenti ordine per code unit (grave prima: città, caffè).
 */
export function pickDisplayForm(variants: readonly string[]): string {
  const accents = (w: string): number => w.length - w.normalize('NFD').replace(/[̀-ͯ]/g, '').length;
  return [...variants].sort((a, b) => {
    const byAccents = accents(a) - accents(b);
    if (byAccents !== 0) return byAccents;
    const aChe = a.endsWith('ché') ? 0 : 1;
    const bChe = b.endsWith('ché') ? 0 : 1;
    if (aChe !== bChe) return aChe - bChe;
    return a < b ? -1 : a > b ? 1 : 0;
  })[0]!;
}

export function buildDictionary(
  sourcePath: string,
  overrides: { remove: Set<string>; add: Set<string>; display: Map<string, string> },
): BuildResult {
  const stats: BuildStats[] = [];
  const record = (phase: string, count: number): void => {
    stats.push({ phase, count });
  };

  // Morph-it! è codificato ISO-8859-1: leggerlo come UTF-8 trasforma ogni lettera accentata in U+FFFD.
  const rawLines = readFileSync(sourcePath, 'latin1').split('\n');
  const entries = rawLines.map(parseSourceLine).filter((e): e is SourceEntry => e !== null);
  record('forma flessa estratta', entries.length);

  const afterTagFilter = entries.filter((e) => !isExcludedTag(e.tag));
  record('filtro per tag', afterTagFilter.length);

  const lowercased = afterTagFilter.map((e) => ({ form: e.form.toLowerCase(), lemma: e.lemma.toLowerCase() }));
  record('minuscolo', lowercased.length);

  // original: forma minuscola con accenti, conservata per la visualizzazione.
  // strayAccentless: forma senza accento il cui lemma è accentato (es. cosi -> così): grafia errata, non una parola a sé.
  const stripped = lowercased.map(({ form, lemma }) => ({
    word: stripDiacritics(form),
    original: form,
    strayAccentless: lemma !== form && stripDiacritics(lemma) === form,
  }));
  record('normalizzazione NFD e rimozione diacritici', stripped.length);

  const onlyLetters = stripped.filter((e) => VALID_WORD_PATTERN.test(e.word));
  record('scarto non [a-z]+', onlyLetters.length);

  const withoutForbiddenLetters = onlyLetters.filter((e) => !FORBIDDEN_LETTERS_PATTERN.test(e.word));
  record('scarto j k w x y', withoutForbiddenLetters.length);

  const withoutLoneQ = withoutForbiddenLetters.filter((e) => !LONE_Q_PATTERN.test(e.word));
  record('scarto q non seguita da u', withoutLoneQ.length);

  const withValidLength = withoutLoneQ.filter((e) => e.word.length >= 3 && e.word.length <= 16);
  record('scarto lunghezza < 3 o > 16', withValidLength.length);

  const withOverridesRemoved = withValidLength.filter((e) => !overrides.remove.has(e.word));
  const withOverridesAdded = [
    ...withOverridesRemoved,
    ...[...overrides.add].map((word) => ({ word, original: word, strayAccentless: false })),
  ].filter(
    (e) =>
      VALID_WORD_PATTERN.test(e.word) &&
      !FORBIDDEN_LETTERS_PATTERN.test(e.word) &&
      !LONE_Q_PATTERN.test(e.word) &&
      e.word.length >= 3 &&
      e.word.length <= 16,
  );
  record('overrides (remove.txt / add.txt)', withOverridesAdded.length);

  // Una parola ha forma da mostrare (overrides/display.txt a parte) solo se la sua variante senza accento non esiste
  // come parola a sé (altrimenti "abbandono" verrebbe mostrata come "abbandonò").
  const unaccented = new Set<string>();
  const accentedVariants = new Map<string, Set<string>>();
  for (const { word, original, strayAccentless } of withOverridesAdded) {
    if (original === word) {
      if (!strayAccentless) unaccented.add(word);
      continue;
    }
    const variants = accentedVariants.get(word) ?? new Set<string>();
    variants.add(original);
    accentedVariants.set(word, variants);
  }
  const display = new Map<string, string>();
  for (const [word, variants] of accentedVariants) {
    if (!unaccented.has(word)) display.set(word, pickDisplayForm([...variants]));
  }
  const wordSet = new Set(withOverridesAdded.map((e) => e.word));
  for (const [word, form] of overrides.display) {
    if (wordSet.has(word)) display.set(word, form);
  }

  const deduped = [...new Set(withOverridesAdded.map((e) => e.word))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  record('deduplica e ordina', deduped.length);

  return { words: deduped, display, stats };
}

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
