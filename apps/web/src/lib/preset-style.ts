import type { PresetInfo } from './week.js';

// Come si disegna una variante della Settimana: il segno sul nodo e il colore. Per ora si ricava dai parametri del
// preset (e dal suo identificativo per i colori); le giornate si potranno cambiare da amministrazione senza toccare il codice.

const COLORS: Record<string, string> = {
  classica: '#fffaf0',
  grande: '#d4f7e8',
  bonus: '#ffe0da',
  lunghe: '#dbe6ff',
  combo: '#fff1c7',
  gigante: '#e7dcff',
  domenica: '#ffd9ec',
  speciale: '#ffeab0',
  posizione: '#d4f7e8',
  misto: '#e7dcff',
};
const FALLBACK = ['#fffaf0', '#d4f7e8', '#ffe0da', '#dbe6ff', '#fff1c7', '#e7dcff', '#ffd9ec'];

export function presetGlyph(
  preset: Pick<PresetInfo, 'size' | 'minWordLength' | 'hasBonusCells' | 'combo' | 'pointMode' | 'positionBonus'>,
): string {
  const special = preset.pointMode === 'speciale';
  if (special && preset.positionBonus && preset.combo) return '👑';
  if (special && preset.positionBonus) return '★▣';
  if (preset.hasBonusCells) return '×3';
  if (preset.combo) return '⚡';
  if (special) return '★';
  if (preset.positionBonus) return '▣';
  if (preset.minWordLength > 3) return `${preset.minWordLength}+`;
  return `${preset.size}×${preset.size}`;
}

export function presetColor(preset: Pick<PresetInfo, 'slug'>): string {
  const known = COLORS[preset.slug];
  if (known) return known;
  let h = 0;
  for (const c of preset.slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length]!;
}
