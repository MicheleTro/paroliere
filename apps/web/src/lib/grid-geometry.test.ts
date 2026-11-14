import { describe, expect, it } from 'vitest';
import { hitTestCell, type Rect } from './grid-geometry.js';

describe('hitTestCell', () => {
  const rect: Rect = { left: 0, top: 0, width: 400, height: 400 };
  const size = 4; // casella di 100

  it('returns the cell index at the center of a tile', () => {
    expect(hitTestCell(50, 50, rect, size)).toBe(0);
    expect(hitTestCell(150, 50, rect, size)).toBe(1);
    expect(hitTestCell(50, 150, rect, size)).toBe(4);
  });

  it('il tocco iniziale vale su tutta la casella, non solo sulla lettera', () => {
    expect(hitTestCell(3, 3, rect, size, 'start')).toBe(0);
    expect(hitTestCell(97, 97, rect, size, 'start')).toBe(0);
    expect(hitTestCell(103, 3, rect, size, 'start')).toBe(1);
  });

  it('durante il trascinamento serve toccare la lettera: cerchio del 60% della casella', () => {
    // raggio 30 su una casella di 100
    expect(hitTestCell(50 + 25, 50, rect, size, 'move')).toBe(0);
    expect(hitTestCell(50, 50 + 25, rect, size, 'move')).toBe(0);
    expect(hitTestCell(50 + 35, 50, rect, size, 'move')).toBeNull();
    expect(hitTestCell(50 + 20, 50 + 20, rect, size, 'move')).toBe(0);
    expect(hitTestCell(50 + 23, 50 + 23, rect, size, 'move')).toBeNull();
    expect(hitTestCell(5, 5, rect, size, 'move')).toBeNull();
  });

  it('un movimento in diagonale a cavallo di un angolo non prende le caselle vicine', () => {
    // punto sull'angolo tra le caselle 0, 1, 4 e 5
    expect(hitTestCell(100, 100, rect, size, 'move')).toBeNull();
    expect(hitTestCell(97, 97, rect, size, 'move')).toBeNull();
  });

  it('returns null outside the grid bounds', () => {
    expect(hitTestCell(-10, 50, rect, size)).toBeNull();
    expect(hitTestCell(450, 50, rect, size, 'start')).toBeNull();
  });

  it('accounts for a non-zero rect offset', () => {
    const offsetRect: Rect = { left: 20, top: 30, width: 400, height: 400 };
    expect(hitTestCell(70, 80, offsetRect, size)).toBe(0);
    expect(hitTestCell(23, 33, offsetRect, size, 'start')).toBe(0);
  });
});
