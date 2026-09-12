import { describe, expect, it } from 'vitest';
import { hitTestCell, type Rect } from './grid-geometry.js';

describe('hitTestCell', () => {
  const rect: Rect = { left: 0, top: 0, width: 400, height: 400 };
  const size = 4;

  it('returns the cell index at the center of a tile', () => {
    expect(hitTestCell(50, 50, rect, size)).toBe(0);
    expect(hitTestCell(150, 50, rect, size)).toBe(1);
    expect(hitTestCell(50, 150, rect, size)).toBe(4);
  });

  it('returns null outside the hit circle, even inside the cell', () => {
    // cellSize = 100, radius = 30: a corner of the cell is well outside the circle.
    expect(hitTestCell(5, 5, rect, size)).toBeNull();
  });

  it('returns null outside the grid bounds', () => {
    expect(hitTestCell(-10, 50, rect, size)).toBeNull();
    expect(hitTestCell(450, 50, rect, size)).toBeNull();
  });

  it('accounts for a non-zero rect offset', () => {
    const offsetRect: Rect = { left: 20, top: 30, width: 400, height: 400 };
    expect(hitTestCell(70, 80, offsetRect, size)).toBe(0);
  });
});
