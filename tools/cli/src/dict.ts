import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { buildWordIndex, parseDictionary } from '../../../packages/core/src/index.js';
import { resolveFromInvocationCwd } from './args.js';

export function loadDictionary(path: string) {
  const content = readFileSync(resolveFromInvocationCwd(path), 'utf-8');
  const { words } = parseDictionary(content);
  const dictionaryVersion = 'it-' + createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 8);
  const index = buildWordIndex(words);
  return { index, dictionaryVersion, wordCount: words.length };
}
