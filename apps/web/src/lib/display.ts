/**
 * Il dizionario e il gioco lavorano su parole senza accenti; qui si tiene la mappa
 * solo per la visualizzazione (citta -> città), caricata dal worker all'avvio.
 */
let displayForms = new Map<string, string>();

export function setDisplayForms(entries: readonly [string, string][]): void {
  displayForms = new Map(entries);
}

export function displayWord(word: string): string {
  return displayForms.get(word) ?? word;
}
