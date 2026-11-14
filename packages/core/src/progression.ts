/**
 * Livelli e XP (SPEC.md §11.1). Il livello non si salva: deriva dall'XP totale, così la curva si può ritarare senza
 * migrazioni. Funzioni pure.
 */

/** XP necessari per salire dal livello `level` al successivo: round(60 · n^1.4). */
export function xpToAdvance(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`xpToAdvance: livello non valido (${level})`);
  return Math.round(60 * Math.pow(level, 1.4));
}

/** XP totali necessari per raggiungere `level` (il livello 1 parte da 0). */
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`xpForLevel: livello non valido (${level})`);
  let total = 0;
  for (let n = 1; n < level; n++) total += xpToAdvance(n);
  return total;
}

export interface LevelProgress {
  level: number;
  /** XP guadagnati dentro il livello corrente. */
  xpInLevel: number;
  /** XP che servono per passare al livello successivo (la dimensione del livello corrente). */
  xpForNext: number;
  /** XP che mancano al livello successivo. */
  xpRemaining: number;
}

/** Livello, e avanzamento dentro di esso, per un totale di XP. Nessun livello massimo. */
export function levelFromXp(totalXp: number): LevelProgress {
  if (!Number.isFinite(totalXp) || totalXp < 0) throw new RangeError(`levelFromXp: XP non valido (${totalXp})`);
  let level = 1;
  let remaining = Math.floor(totalXp);
  for (;;) {
    const need = xpToAdvance(level);
    if (remaining < need) {
      return { level, xpInLevel: remaining, xpForNext: need, xpRemaining: need - remaining };
    }
    remaining -= need;
    level++;
  }
}

/** Livello dal quale si sbloccano amici e sfide (SPEC.md §11.3). */
export const DUELS_UNLOCK_LEVEL = 5;

export function duelsUnlocked(totalXp: number): boolean {
  return levelFromXp(totalXp).level >= DUELS_UNLOCK_LEVEL;
}

/** Stella di fine partita in Gioca: raggiunta una certa soglia di punti, l'XP della partita si moltiplica. */
export interface StarTier {
  id: 'bronzo' | 'argento' | 'oro';
  /** Punti della partita (che sono anche XP) da raggiungere. */
  at: number;
  multiplier: number;
}

export const GIOCA_STARS: readonly StarTier[] = [
  { id: 'bronzo', at: 20, multiplier: 1.2 },
  { id: 'argento', at: 50, multiplier: 1.3 },
  { id: 'oro', at: 80, multiplier: 1.5 },
];

export interface StarBonus {
  star: StarTier['id'];
  multiplier: number;
  /** XP in più rispetto al punteggio. */
  xp: number;
}

/**
 * Bonus di una partita di Gioca: conta la stella più alta raggiunta (i moltiplicatori non si sommano). Il bonus è
 * l'XP in più, arrotondato per difetto; nessuna stella = nessun bonus.
 */
export function starBonus(score: number): StarBonus | null {
  const base = Math.max(0, Math.floor(score));
  let reached: StarTier | undefined;
  for (const tier of GIOCA_STARS) if (base >= tier.at) reached = tier;
  if (!reached) return null;
  return { star: reached.id, multiplier: reached.multiplier, xp: Math.floor(base * reached.multiplier + 1e-9) - base };
}
