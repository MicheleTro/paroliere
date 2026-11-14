import { baseWordValue, type GameConfig } from '@paroliere/core';

// Come si presenta una partita al giocatore: un nome ricavato dalle regole attive (es. "Speciale + Posizione") e la
// loro descrizione. Si ricava dai parametri della partita, così vale per Gioca, Sloth's week e le sfide.

type RuleConfig = Pick<GameConfig, 'size' | 'durationMs' | 'minWordLength' | 'pointMode' | 'positionBonus' | 'combo' | 'bonusCells'>;

export function ruleName(config: RuleConfig): string {
  const parts: string[] = [];
  if (config.pointMode === 'speciale') parts.push('Speciale');
  if (config.positionBonus) parts.push('Posizione');
  if (config.combo) parts.push('Combo');
  if (config.bonusCells && config.bonusCells.length > 0) parts.push('Bonus');
  if (config.minWordLength > 3) parts.push(`${config.minWordLength}+ lettere`);
  return parts.length > 0 ? parts.join(' + ') : 'Classica';
}

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes === 0) return `${seconds} secondi`;
  if (seconds === 0) return minutes === 1 ? '1 minuto' : `${minutes} minuti`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ruleDescription(config: RuleConfig, duel = false): string[] {
  const base = baseWordValue('x'.repeat(config.minWordLength));
  const lines = [
    `Griglia ${config.size}×${config.size}, ${duration(config.durationMs)}.`,
    `Parole da ${config.minWordLength} lettere in su: ${config.minWordLength} lettere valgono ${base} ${base === 1 ? 'punto' : 'punti'}, poi +1 per ogni lettera in più, con un extra dalle 6 lettere.`,
  ];
  if (config.pointMode === 'speciale') {
    lines.push('Speciale: ogni lettera ha un valore (il numerino in basso a destra della casella) che si somma al punteggio della parola.');
  }
  if (config.positionBonus) {
    lines.push('Posizione: le lettere sui lati (caselle gialle) valgono il doppio, quelle agli angoli (viola) il triplo.');
  }
  if (config.combo) {
    lines.push('Combo: se trovi una parola entro 5 secondi dalla precedente la combo sale, e ogni parola vale +1 per livello.');
  }
  if (config.bonusCells && config.bonusCells.length > 0) {
    lines.push(`Caselle bonus: ${config.bonusCells.map((m) => `×${m}`).join(' e ')} moltiplicano il valore della parola che ci passa sopra.`);
  }
  if (duel) lines.push('Sfida: una parola trovata solo da te vale doppio.');
  return lines;
}
