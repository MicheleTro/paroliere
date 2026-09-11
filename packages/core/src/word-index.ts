export interface WordIndex {
  readonly root: number;
  /** -1 se assente. `letter` è una singola lettera a-z. */
  child(node: number, letter: string): number;
  isWord(node: number): boolean;
  readonly nodeCount: number;
}

const CHAR_A = 'a'.charCodeAt(0);

interface BuilderNode {
  children: Map<number, number>;
  isWord: boolean;
}

/**
 * Costruisce un trie compatto (first-child / next-sibling su typed array) da una
 * lista di parole. La lista non deve necessariamente essere ordinata: l'ordine
 * di attraversamento dei figli è comunque normalizzato per codice di lettera.
 */
export function buildWordIndex(words: readonly string[]): WordIndex {
  const builderNodes: BuilderNode[] = [{ children: new Map(), isWord: false }];

  for (const word of words) {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const code = word.charCodeAt(i) - CHAR_A;
      let next = builderNodes[node]!.children.get(code);
      if (next === undefined) {
        next = builderNodes.length;
        builderNodes.push({ children: new Map(), isWord: false });
        builderNodes[node]!.children.set(code, next);
      }
      node = next;
    }
    builderNodes[node]!.isWord = true;
  }

  const nodeCount = builderNodes.length;
  const letterOf = new Uint8Array(nodeCount);
  const firstChild = new Int32Array(nodeCount).fill(-1);
  const nextSibling = new Int32Array(nodeCount).fill(-1);
  const isWordFlag = new Uint8Array(nodeCount);

  for (let node = 0; node < nodeCount; node++) {
    isWordFlag[node] = builderNodes[node]!.isWord ? 1 : 0;
    const sortedCodes = [...builderNodes[node]!.children.keys()].sort((a, b) => a - b);
    let previousChild = -1;
    for (const code of sortedCodes) {
      const childIndex = builderNodes[node]!.children.get(code)!;
      letterOf[childIndex] = code;
      if (previousChild === -1) {
        firstChild[node] = childIndex;
      } else {
        nextSibling[previousChild] = childIndex;
      }
      previousChild = childIndex;
    }
  }

  return {
    root: 0,
    nodeCount,
    isWord(node: number): boolean {
      return isWordFlag[node] === 1;
    },
    child(node: number, letter: string): number {
      const code = letter.charCodeAt(0) - CHAR_A;
      let candidate = firstChild[node]!;
      while (candidate !== -1) {
        if (letterOf[candidate] === code) return candidate;
        candidate = nextSibling[candidate]!;
      }
      return -1;
    },
  };
}
