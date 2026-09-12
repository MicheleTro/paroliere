export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Una casella si aggancia solo se il punto cade nel cerchio centrato sulla
 * casella con diametro pari al 60% del lato (SPEC.md §9), per evitare che i
 * movimenti in diagonale prendano caselle sbagliate.
 */
export function hitTestCell(x: number, y: number, rect: Rect, size: number): number | null {
  const cellSize = rect.width / size;
  const radius = cellSize * 0.3;

  const col = Math.floor((x - rect.left) / cellSize);
  const row = Math.floor((y - rect.top) / cellSize);
  if (row < 0 || row >= size || col < 0 || col >= size) return null;

  const centerX = rect.left + cellSize * (col + 0.5);
  const centerY = rect.top + cellSize * (row + 0.5);
  const dx = x - centerX;
  const dy = y - centerY;
  if (dx * dx + dy * dy > radius * radius) return null;

  return row * size + col;
}
