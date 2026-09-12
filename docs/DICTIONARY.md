# Dizionario italiano — stato e fonte

## Stato: dizionario reale generato

La fonte è **Morph-it! v0.4.8** (23 febbraio 2009), lessico morfologico
dell'italiano con forme flesse, di Marco Baroni e Eros Zanchetta (SSLMIT —
Università di Bologna). File fornito dal committente in `morph-it/` (non
committato, vedi sotto); il sito ufficiale
`https://docs.sslmit.unibo.it/doku.php?id=resources:morph-it` non era
raggiungibile dall'ambiente di sviluppo (HTTP 402 persistente).

### Licenza

Dual license, come dichiarato in `morph-it/readme-morph-it.txt`:

- **Creative Commons Attribution ShareAlike 2.0**
- **GNU Lesser General Public License**

Entrambe compatibili con un progetto pubblicabile: permettono copia,
distribuzione, opere derivate e uso commerciale, a condizione di citare gli
autori originali (Marco Baroni, Eros Zanchetta) e, per la parte CC-BY-SA, di
distribuire eventuali opere derivate con licenza identica.

### Formato

Confermato contro il file reale (`morph-it_048.txt`, 505.074 righe non vuote):
tre colonne separate da tabulazione — `forma_flessa\tlemma\ttag`, es.
`gattini	gattino	NOUN-M:p`. Il tag è `CATEGORIA[-sottocategoria]:feature+feature`.

Tag esclusi dalla pipeline (`isExcludedTag` in
`tools/dict-builder/src/build.ts`), verificati contro il tagset reale:

- `NPR` — nomi propri (es. "Abbado", "A1")
- `ABL` — locuzioni abbreviate (es. "ecc.", "d.C.") — **non** `ABR` come
  ipotizzato inizialmente: il tag reale è diverso, corretto dopo la verifica
- `SYM` — simboli
- `PON` / `SENT` — punteggiatura
- `SMI` — emoticon (non documentate nel readme ma presenti nel file)

In pratica quasi tutte queste righe verrebbero comunque scartate dal filtro
`^[a-z]+$` (contengono punti, parentesi, ecc.), ma escluderle per tag evita
falsi positivi come "etc" (ABL, ma composto solo da lettere).

Trovate 2 righe malformate (su 505.074): due varianti di "seppur(e)" nel
file usano uno spazio invece del tab come separatore — probabile refuso nella
fonte del 2009. La forma "seppur" (valida) viene quindi persa dal parser;
recuperata via `tools/dict-builder/overrides/add.txt`.

### Come rigenerare

```
pnpm build:dict --source morph-it/morph-it_048.txt --out dist/dictionary
```

Il file sorgente e l'output generato **non sono committati** (vedi
`.gitignore`: `morph-it/`, `dist/`), per decisione di convenzione (CLAUDE.md
§10: "Non committare dist/, dizionario sorgente o generato senza decisione
esplicita"). Chi clona il repository deve procurarsi il file Morph-it! e
rilanciare la build.

### Statistiche (run del 2026-09-12)

Conteggi per fase della pipeline:

| Fase | Parole rimanenti |
|---|---|
| forma flessa estratta | 505.072 |
| filtro per tag | 502.078 |
| minuscolo | 502.078 |
| NFD + rimozione diacritici | 502.078 |
| scarto non `[a-z]+` | 477.527 |
| scarto j/k/w/x/y | 475.817 |
| scarto q non seguita da u | 475.817 |
| scarto lunghezza < 3 o > 16 | 463.559 |
| overrides (remove/add) | 463.560 |
| deduplica e ordina | **367.482** |

Dimensioni del dizionario finale (367.482 parole):

- raw: 4.287.999 byte (~4,1 MB)
- gzip: 877.668 byte (~857 KB)
- brotli: 601.289 byte (~587 KB)

Distribuzione per lunghezza (estratto): 3 lettere → 269, 4 → 1.415,
5 → 4.711, 6 → 10.244, 7 → 21.900, 8 → 34.473, 9 → 47.633, 10 → 56.279
(picco), 11 → 54.853, 12 → 47.734, 13 → 35.912, 14 → 25.516, 15 → 16.499,
16 → 10.044.

`manifest.json` generato accanto al file (versione `it-<sha256[:8]>`,
conteggio parole, licenza, timestamp).

### Benchmark (`pnpm cli bench --grids 1000 --dict <dizionario>`)

- Costruzione indice: 462 ms, 634.282 nodi, **+144 MB** di heap.
- Generazione griglie (`minWords` default 50): 1,25 tentativi medi, 5 massimo,
  su 1000 griglie — nessun fallimento.
- Parole per griglia: minimo 50, p50 101, p95 212, massimo 297.
- Tempo medio: generazione (con retry) 0,52 ms, risoluzione 0,40 ms.

**Attenzione (§5.5 della spec):** la soglia indicativa per il trie è
40 MB / 1,5 s. Il tempo di costruzione (462 ms) è ampiamente sotto soglia, ma
la **memoria (144 MB) la supera di oltre 3 volte**. Da segnalare nel
resoconto del Passo 1: non blocca il Passo 1 (l'interfaccia `WordIndex` non
cambia), ma è un forte indizio che la sostituzione con un DAWG binario
precompilato (prevista come opzionale nel Passo 4, §9) sarà necessaria in
pratica, specialmente per l'uso su telefono.

## Nel frattempo

I test, le fixture e le verifiche del Passo 1 continuano a usare
`fixtures/dict-small.txt` (dizionario piccolo indipendente, ~962 parole) per
restare deterministici e non dipendere dal file Morph-it! locale. Il
dizionario reale è usato solo per il build/benchmark manuale documentato qui.
