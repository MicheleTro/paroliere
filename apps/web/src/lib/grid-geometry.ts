export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * - `start`: il tocco iniziale prende la casella in cui cade, ovunque nella casella (non solo sulla lettera).
 * - `move`: durante il trascinamento una casella si aggancia solo se il punto cade nel cerchio centrato sulla casella,
 *   di diametro pari al 60% del lato (all'incirca la lettera): così si agganciano solo le lettere volute e i
 *   movimenti in diagonale non prendono per sbaglio le caselle vicine (SPEC.md §9).
 */
export type HitMode = 'start' | 'move';

const MOVE_RADIUS = 0.3; // raggio del cerchio di aggancio, in frazione del lato della casella

export function hitTestCell(x: number, y: number, rect: Rect, size: number, mode: HitMode = 'move'): number | null {
  const cellSize = rect.width / size;

  const col = Math.floor((x - rect.left) / cellSize);
  const row = Math.floor((y - rect.top) / cellSize);
  if (row < 0 || row >= size || col < 0 || col >= size) return null;

  if (mode === 'move') {
    const dx = x - (rect.left + cellSize * (col + 0.5));
    const dy = y - (rect.top + cellSize * (row + 0.5));
    if (dx * dx + dy * dy > (cellSize * MOVE_RADIUS) ** 2) return null;
  }

  return row * size + col;
}
