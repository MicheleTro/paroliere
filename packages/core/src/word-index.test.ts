import { describe, expect, it } from 'vitest';
import { buildWordIndex } from './word-index.js';

describe('buildWordIndex', () => {
  it('riconosce le parole inserite e i loro prefissi come nodi validi', () => {
    const index = buildWordIndex(['casa', 'cane', 'cani']);
    let node = index.root;
    for (const letter of 'casa') {
      node = index.child(node, letter);
      expect(node).not.toBe(-1);
    }
    expect(index.isWord(node)).toBe(true);
  });

  it('non riconosce come parola un prefisso mai inserito come tale', () => {
    const index = buildWordIndex(['casa']);
    let node = index.root;
    node = index.child(node, 'c');
    node = index.child(node, 'a');
    node = index.child(node, 's');
    expect(index.isWord(node)).toBe(false);
  });

  it('restituisce -1 per una lettera assente', () => {
    const index = buildWordIndex(['casa']);
    expect(index.child(index.root, 'z')).toBe(-1);
  });

  it('gestisce la casella qu come due passi q poi u', () => {
    const index = buildWordIndex(['quota']);
    const q = index.child(index.root, 'q');
    expect(q).not.toBe(-1);
    const u = index.child(q, 'u');
    expect(u).not.toBe(-1);
  });

  it('condivide correttamente i prefissi comuni tra piu parole', () => {
    const index = buildWordIndex(['casa', 'caso', 'cassa']);
    const c = index.child(index.root, 'c');
    const a = index.child(c, 'a');
    const s = index.child(a, 's');
    expect(index.child(s, 'a')).not.toBe(-1);
    expect(index.child(s, 'o')).not.toBe(-1);
    expect(index.child(s, 's')).not.toBe(-1);
  });
});
