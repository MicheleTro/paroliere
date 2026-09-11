import type { Tile } from './tile.js';

export interface GameConfig {
  seed: number;
  size: 4;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  scoring: 'classic';
  generatorVersion: 1;
  dictionaryVersion: string;
}

export interface Grid {
  size: number;
  tiles: Tile[];
}

export interface Solution {
  word: string;
  path: number[];
}
