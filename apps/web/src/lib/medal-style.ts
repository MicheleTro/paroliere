// Come si disegna una medaglia: il segno al centro e il colore, ricavati dall'identificativo e dal gruppo.

const GLYPHS: Record<string, string> = {
  'prima-parola': '1',
  'prima-partita': 'P',
  'cento-parole': '100',
  'mille-parole': '1k',
  'diecimila-parole': '10k',
  settebello: '7+',
  'nove-lettere': '9+',
  raccolto: '30',
  'livello-10': 'L10',
  'prima-settimana': 'S1',
  'settimana-piena': '7/7',
  puntuale: '7·7',
  tuttofare: 'V7',
  'ciclo-completo': '10',
};

export function medalGlyph(id: string, name: string): string {
  return GLYPHS[id] ?? name.slice(0, 3);
}

/** Classe di colore: settimana = blu, serie = corallo, il resto = oro. */
export function medalClass(kind: string): string {
  if (kind === 'settimana') return 'week';
  if (kind === 'serie') return 'serie';
  return '';
}
