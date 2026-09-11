import { brotliCompressSync, gzipSync } from 'node:zlib';

export interface DictionaryStats {
  wordCount: number;
  lengthDistribution: Record<number, number>;
  rawBytes: number;
  gzipBytes: number;
  brotliBytes: number;
}

export function computeStats(content: string): DictionaryStats {
  const words = content.split('\n').filter((w) => w.length > 0);
  const lengthDistribution: Record<number, number> = {};
  for (const word of words) {
    lengthDistribution[word.length] = (lengthDistribution[word.length] ?? 0) + 1;
  }
  const rawBuffer = Buffer.from(content, 'utf-8');
  return {
    wordCount: words.length,
    lengthDistribution,
    rawBytes: rawBuffer.byteLength,
    gzipBytes: gzipSync(rawBuffer).byteLength,
    brotliBytes: brotliCompressSync(rawBuffer).byteLength,
  };
}
