import { describe, expect, it } from 'vitest';
import { parseDictionary } from './dictionary-format.js';

describe('parseDictionary', () => {
  it('separa parole normalizzate e forme da mostrare', () => {
    const { words, display } = parseDictionary('casa\ncitta:città\r\n\nverita:verità\n');
    expect(words).toEqual(['casa', 'citta', 'verita']);
    expect([...display]).toEqual([
      ['citta', 'città'],
      ['verita', 'verità'],
    ]);
  });
});
