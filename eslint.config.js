import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'tools/dict-builder/source/**', 'apps/web/public/**'],
  },
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // eslint-plugin-svelte tratta anche i moduli *.svelte.ts (rune fuori dai
    // componenti) come file Svelte: vanno riportati al parser TypeScript puro.
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Le Map costruite dentro una funzione derivata sono valori immutabili una
      // volta ritornati: è Svelte a tracciare il derived, non serve SvelteMap.
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
);
