export interface ParsedDictionary {
  /** Parole normalizzate (solo a-z), usate per indice e confronto. */
  words: string[];
  /** Solo per la visualizzazione: parola normalizzata -> forma con accento (es. citta -> città). */
  display: Map<string, string>;
}

/**
 * Formato del file dizionario: una parola per riga. Se la parola ha una forma
 * accentata da mostrare, la riga è `normalizzata:accentata` (es. `citta:città`).
 */
export function parseDictionary(text: string): ParsedDictionary {
  const words: string[] = [];
  const display = new Map<string, string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const separator = line.indexOf(':');
    if (separator === -1) {
      words.push(line);
      continue;
    }
    const word = line.slice(0, separator);
    words.push(word);
    display.set(word, line.slice(separator + 1));
  }
  return { words, display };
}
