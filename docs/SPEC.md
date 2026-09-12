# Paroliere PWA — Brief di progetto

## 0. Istruzioni per Claude Code

Questo documento descrive requisiti, architettura e piano di lavoro di un gioco di parole in stile Paroliere/Boggle. È già stato validato con il committente (Michele). Non rimettere in discussione le decisioni prese, ma segnala problemi concreti se ne trovi.

Regole di ingaggio:

1. Il repository è vuoto o contiene solo questo file. Come primo atto copia questo documento in `docs/SPEC.md` e crea un `CLAUDE.md` sintetico con: convenzioni (§10), comandi principali, puntatore a `docs/SPEC.md`, passo corrente.
2. Implementa **solo il Passo 1** (§8). I passi successivi (§9) sono descritti perché le scelte di oggi non li ostacolino: non anticiparli.
3. Prima di scrivere codice presenta un piano breve (file da creare, ordine di lavoro) e attendi conferma.
4. Non aggiungere dipendenze oltre a quelle elencate in §10 senza chiedere. `packages/core` non ha dipendenze runtime.
5. Se una scelta non coperta da questo documento cambia il comportamento del gioco, chiedi. Se è un dettaglio implementativo, decidi tu e annotalo nel resoconto finale.
6. A fine passo fermati e produci il resoconto descritto in §8.

## 1. Obiettivo

Web app giocabile da mobile, installabile come PWA e funzionante offline, ispirata al Paroliere: griglia 4x4 di lettere in cui si formano parole italiane collegando caselle adiacenti, a tempo.

L'MVP è single player. Il progetto evolverà per incrementi verso punteggio stile Ruzzle, multiplayer locale a turni, sfide online asincrone e partite online in tempo reale. Per questo la logica di gioco vive in un modulo puro e deterministico, riutilizzabile dal futuro server (§9, Passo 5): TypeScript, per riusare `packages/core` senza reimplementarlo.

## 2. Requisiti funzionali (MVP)

### Griglia
- **RF-01** Griglia 4x4 generata con lettere pesate sulla frequenza dell'italiano (§5.3).
- **RF-02** La Q compare sempre come casella unica "Qu", che conta come 2 lettere.
- **RF-03** Una griglia è accettata solo se contiene almeno `minWords` parole valide (default 50).
- **RF-04** Ogni griglia deriva da un seed: stessa configurazione, stessa griglia. Serve per rigiocare una griglia e, in futuro, per sfidare altri sulla stessa.

### Inserimento parole
- **RF-05** Su touch la parola si compone trascinando il dito su caselle adiacenti (8 direzioni), senza riusare caselle. Durante il gesto la pagina non scorre e non zooma.
- **RF-06** Su desktop lo stesso gesto funziona con il mouse.
- **RF-07** Durante il gesto il percorso è evidenziato e la parola in corso è visibile.
- **RF-08** Al rilascio la parola è validata subito, con feedback distinto per: valida, già trovata, non nel dizionario, troppo corta.
- **RF-09** Lunghezza minima: 3 lettere (default; configurabile dal Passo 3, vedi RF-11).

### Dizionario
- **RF-10** Sono valide le parole italiane comprese le forme flesse (plurali, femminili, coniugazioni). Sono esclusi nomi propri, sigle e abbreviazioni. Gli accenti vengono rimossi (città → citta) e i duplicati risultanti unificati (però e pero → pero). Le forme con apostrofo o trattino sono scartate.

### Partita e punteggio
- **RF-11** Durata 120 secondi con countdown visibile. **Deciso nel Passo 3**: durata (30/60/90/120/150s), lunghezza minima parola e lato griglia (4/5/6) sono configurabili in una schermata dedicata (`ConfigScreen`) prima di iniziare; 120s/3 lettere/4 lati restano i default.
- **RF-12** Punteggio classico: 3–4 lettere = 1 punto, 5 = 2, 6 = 3, 7 = 5, 8 o più = 11.
- **RF-13** Ogni partita è definita da una configurazione (§5.2). Nell'MVP esiste solo la regola di punteggio classica; la regola Ruzzle sarà un'aggiunta, non una modifica.
- **RF-14** A fine partita si vedono parole trovate, punteggio, tutte le parole possibili e percentuale trovata.
- **RF-15** Toccando una parola nel riepilogo, il suo percorso si illumina sulla griglia.

### Progressi
- **RF-16** Storico partite (configurazione, parole, punteggio, data) e record personale salvati in locale.

### PWA
- **RF-17** L'app è installabile e, dopo il primo avvio, funziona interamente offline.
- **RF-18** Il dizionario è versionato e si aggiorna in background quando c'è rete, senza interrompere una partita in corso.

### Sfide asincrone (Passo 5, solo contesto — dettagli in §9)
- **RF-19** Un giocatore autenticato può creare una sfida su una griglia (config + seed) e condividerne un link; chi lo apre può giocare la stessa griglia entro la scadenza della sfida.
- **RF-20** Il punteggio di una sfida è rivalidato dal server ricostruendo griglia e soluzioni dal seed, non fidandosi del client.
- **RF-21** Una classifica per sfida mostra partecipanti, punteggio e parole trovate in ordine di arrivo/punteggio.
- **RF-22** L'identità minima richiesta è un profilo anonimo legato al dispositivo; collegare un'email è opzionale e permette di ritrovare le sfide da un altro dispositivo.
- **RF-23** Lo storico locale (RF-16) si sincronizza col server quando l'utente ha un profilo e c'è rete; resta comunque utilizzabile offline senza profilo.

### Fuori perimetro MVP
Roadmap, in quest'ordine: punteggio Ruzzle (valore delle lettere e caselle bonus), multiplayer a turni sullo stesso dispositivo, sfide online asincrone, online in tempo reale.

## 3. Decisioni già prese

- Web app PWA, nessun backend nell'MVP (Passi 1–4), hosting statico. Il backend arriva dal Passo 5 in poi, solo per le sfide.
- Monorepo pnpm, TypeScript ovunque, incluso il futuro server (§9, Passo 5): riusa `packages/core` invece di reimplementarlo in un altro linguaggio.
- UI: Svelte 5 + Vite, senza SvelteKit, con `vite-plugin-pwa`.
- Validazione interamente locale: all'avvio della partita il solver calcola tutte le parole della griglia e la validazione diventa una lookup.
- Alfabeto: 21 lettere italiane (a b c d e f g h i l m n o p q r s t u v z). Le lettere j, k, w, x, y sono escluse sia dalla griglia sia dal dizionario.
- Il tempo della partita scorre anche se l'app va in background: nell'MVP non esiste pausa.
- Il futuro server rivaliderà le parole ricostruendo la griglia dal seed. Il core deve quindi restare deterministico e privo di side-effect (§5.1); le fixture di §7 restano il contratto di riferimento anche per il server TypeScript.

## 4. Architettura

```
paroliere/
├─ CLAUDE.md
├─ docs/
│  ├─ SPEC.md               ← questo documento
│  └─ DICTIONARY.md         ← fonte, licenza, filtri, statistiche
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ packages/
│  └─ core/                 ← logica di gioco pura          (Passo 1)
├─ tools/
│  ├─ dict-builder/         ← build del dizionario          (Passo 1)
│  └─ cli/                  ← CLI di verifica e benchmark   (Passo 1)
├─ fixtures/                ← casi di test JSON language-neutral (Passo 1)
└─ apps/
   ├─ web/                  ← PWA Svelte                    (Passi 2–4)
   └─ server/                ← API sfide asincrone           (Passo 5)
```

Flusso: `dict-builder` produce un file dizionario versionato. La web app lo scarica una volta e lo tiene in cache. Un Web Worker costruisce l'indice e usa `core` per generare e risolvere la griglia. La UI usa `core` per gestire la sessione di gioco. `tools/cli` usa `core` da Node per verifiche e benchmark, così `core` resta privo di accessi al filesystem. Dal Passo 5, `apps/server` usa `core` allo stesso modo di `tools/cli`: da Node, per rigenerare griglia e soluzioni dal seed e rivalidare i risultati di una sfida.

## 5. packages/core

### 5.1 Vincoli
- Nome pacchetto `@paroliere/core`. TypeScript strict, ESM, zero dipendenze runtime.
- Nessun accesso a DOM, filesystem, rete, `Date.now()` o `Math.random()`. Il tempo corrente arriva sempre come parametro.
- Deterministico anche tra linguaggi diversi: nella generazione si usa solo aritmetica intera, niente float.

### 5.2 Tipi principali (indicativi)

```ts
type Tile = 'a' | 'b' | 'c' | /* ... */ | 'z' | 'qu'; // nessuna 'q' da sola

interface GameConfig {
  seed: number;              // uint32
  size: 4 | 5 | 6;            // configurabile dal Passo 3 (ConfigScreen); l'MVP resta pensato per 4
  durationMs: number;        // 120_000
  minWordLength: number;     // 3, contato in lettere (Qu = 2)
  minWords: number;          // 50
  scoring: 'classic';        // estendibile: 'ruzzle'
  generatorVersion: 1;       // incrementare se cambiano pesi o algoritmo
  dictionaryVersion: string; // dal manifest del dizionario
}

interface Grid {
  size: number;
  tiles: Tile[];             // row-major: index = row * size + col
}

interface Solution {
  word: string;              // normalizzata, minuscola
  path: number[];            // indici delle caselle
}
```

`generatorVersion` e `dictionaryVersion` fanno parte della configurazione perché lo stesso seed produce la stessa griglia solo a parità di pesi, algoritmo e dizionario.

### 5.3 Generazione della griglia (generatorVersion 1)

Pesi iniziali, derivati dalla frequenza letterale approssimativa dell'italiano. Sono da ritoccare dopo il benchmark del Passo 1, e ogni modifica incrementa `generatorVersion`. L'ordine della tabella è normativo:

```
e 1179, a 1174, i 1128, o 983, n 688, l 651, r 637, t 562, s 498, c 450,
d 373, p 305, u 301, m 251, v 210, g 164, h 154, f 95, b 92, qu 51, z 49
```

- Estrazione di una casella: `r = rng.nextInt(totalWeight)`, poi si scorre la tabella nell'ordine indicato finché la somma cumulativa dei pesi supera `r`.
- Algoritmo: un solo PRNG inizializzato con il seed. Per tentativi successivi, senza mai reinizializzarlo, si estraggono 16 caselle in ordine di indice, si risolve la griglia e si accetta la prima con almeno `minWords` parole.
- Limite di 1000 tentativi, oltre il quale si lancia un errore esplicito.
- Output: griglia, soluzioni e numero di tentativi.

### 5.4 PRNG

Mulberry32, esposto solo tramite interi. L'implementazione TypeScript è il riferimento; verificala contro l'algoritmo canonico e bloccala con le fixture di §7.

```ts
export function createRng(seed: number) {
  let a = seed >>> 0;
  return {
    nextUint32(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    // Richiede 1 <= n <= 2^20: il prodotto resta intero esatto in un double.
    // Equivalente Python: (u * n) >> 32
    nextInt(n: number): number {
      return Math.floor((this.nextUint32() * n) / 4294967296);
    },
  };
}
```

### 5.5 Indice del dizionario

Interfaccia a nodi, pensata per la ricerca in profondità:

```ts
interface WordIndex {
  readonly root: number;
  child(node: number, letter: string): number; // -1 se assente; letter = una lettera a–z
  isWord(node: number): boolean;
  readonly nodeCount: number;
}
```

- Implementazione MVP: trie compatto su typed array (first-child / next-sibling, lettera in `Uint8Array`, flag terminale), costruito da una lista di parole ordinata. Niente oggetti per nodo.
- La casella `qu` si percorre come due passi consecutivi, `q` poi `u`.
- Nel Passo 1 misura nodi, memoria e tempo di costruzione. Se sul laptop superi indicativamente 40 MB o 1,5 secondi, segnalalo: su telefono sarà più lento, e nel Passo 4 potremmo passare a un DAWG binario precompilato. L'interfaccia non deve cambiare.

### 5.6 Solver
- Ricerca in profondità da ogni casella, in ordine di indice.
- Vicini visitati in ordine di indice crescente: NW, N, NE, W, E, SW, S, SE.
- Caselle visitate tracciate con una maschera di bit; potatura sui prefissi tramite `WordIndex`.
- Una parola è valida se il nodo è terminale e la lunghezza in lettere è almeno `minWordLength`.
- Output: una `Solution` per ogni parola distinta, con il primo percorso trovato nell'ordine di visita. Lista finale ordinata per parola, confrontando le code unit (non locale-dependent).

### 5.7 Punteggio
- Interfaccia `ScoringRule { id: string; scoreWord(word: string, path: number[], grid: Grid): number }` e un registro delle regole per id.
- MVP: solo la regola `classic` (RF-12). `path` e `grid` sono già nella firma perché la regola Ruzzle ne avrà bisogno (valore delle lettere e caselle bonus, che in futuro si aggiungeranno a `Grid` come campo opzionale).

### 5.8 Sessione di gioco

API pura con stato immutabile:

- `createSession(config, grid, solutions, startedAt)`
- `submitPath(session, path, now)` restituisce `{ session, result }`. `result.kind` vale uno tra `valid`, `already_found`, `not_in_dictionary`, `too_short`, `invalid_path`, `time_over`; se la parola è valida include anche `word` e `points`.
  - `invalid_path` copre caselle non adiacenti, ripetute o fuori griglia. La UI non dovrebbe produrle, ma il core non si fida.
  - Ordine dei controlli: `time_over`, `invalid_path`, `too_short`, `already_found`, `not_in_dictionary`.
- `remainingMs(session, now)` e `isOver(session, now)`.
- `summarize(session)` restituisce parole trovate, punteggio, numero totale di parole possibili, punteggio massimo, percentuale trovata e parole mancate.

### 5.9 Test

Vitest. Coprire almeno:
- PRNG contro le fixture;
- adiacenza e casi di bordo della griglia;
- casella Qu nel percorso e nel conteggio delle lettere, inclusa la soglia `minWordLength`;
- maschera delle caselle visitate;
- tabella dei punteggi;
- ogni valore di `result.kind`;
- determinismo della generazione;
- solver confrontato con un brute force che enumera tutti i percorsi fino a 5 caselle su griglie casuali, con il dizionario piccolo delle fixture (property test scritto a mano, senza librerie).

## 6. tools/dict-builder

- TypeScript eseguito con `tsx`. Comando: `pnpm build:dict --source <file> [--out dist/dictionary]`.
- **Fonte candidata**: Morph-it!, lessico morfologico dell'italiano con forme flesse. Prima di usarla verifica licenza e condizioni d'uso e riportale in `docs/DICTIONARY.md`. Se la licenza non è compatibile con un progetto pubblicabile, o la fonte non è raggiungibile, fermati e proponi alternative. Il percorso del file sorgente arriva da CLI; il file non va committato.
- **Esclusioni per categoria**: ispeziona i tag grammaticali della fonte ed escludi nomi propri, sigle, abbreviazioni, simboli e punteggiatura. Elenca in `docs/DICTIONARY.md` i tag esclusi e il motivo.
- **Pipeline**, in quest'ordine, stampando il conteggio dopo ogni fase:
  1. prendi la forma flessa, non il lemma;
  2. applica il filtro per tag;
  3. converti in minuscolo;
  4. normalizza in NFD e rimuovi i segni diacritici;
  5. scarta ciò che non corrisponde a `^[a-z]+$` (apostrofi, trattini, spazi, cifre);
  6. scarta le parole con j, k, w, x, y;
  7. scarta le parole con una q non seguita da u;
  8. scarta le parole con meno di 3 o più di 16 lettere;
  9. applica `overrides/remove.txt` e `overrides/add.txt` (le aggiunte passano comunque dalle fasi 3–8);
  10. deduplica e ordina per code unit.
- **Output**: `<version>.txt` (una parola per riga, separatore `\n`, UTF-8) e `manifest.json` con `{ version, file, wordCount, sha256, source, sourceLicense, generatedAt }`. `version` vale `"it-"` seguito dai primi 8 caratteri dello sha256 del contenuto, quindi dipende solo dalle parole.
- **Statistiche** stampate a fine build: conteggi per fase, distribuzione per lunghezza, dimensione del file grezzo e compresso con gzip e brotli (tramite `zlib` di Node).

## 7. Fixture cross-linguaggio

In `fixtures/` ci sono file JSON generati da uno script esplicito (`pnpm fixtures`) e verificati dai test: se l'output del core diverge, i test falliscono. Le fixture si rigenerano solo intenzionalmente.

- `dict-small.txt`: lista curata a mano di qualche centinaio di parole italiane comuni, già normalizzate, incluse alcune con "qu". Non dipende dalla fonte con licenza.
- `prng.json`: per i seed 0, 1, 42, 123456789 e 4294967295, i primi 20 valori di `nextUint32` e 20 valori di `nextInt(n)` con n diversi.
- `solver.json`: 10 griglie fisse con caselle esplicite (almeno una con Qu) e le soluzioni attese con il dizionario piccolo.
- `generate.json`: 10 configurazioni con `minWords` basso, adatto al dizionario piccolo, con griglia, tentativi e soluzioni attese.
- `scoring.json` e `session.json`: sequenze di invii e risultati attesi.

Un futuro porting, per esempio in Python, è corretto se riproduce esattamente queste fixture.

## 8. Passo 1 — Core e dizionario

**Perimetro**: monorepo, `packages/core` completo (§5), `tools/dict-builder` (§6), fixture (§7) e `tools/cli`.

### CLI di verifica
- `pnpm cli grid --seed 42 --dict <file>` stampa la griglia 4x4, il numero di tentativi, il numero di parole, le parole raggruppate per lunghezza e il punteggio massimo.
- `pnpm cli bench --grids 1000 --dict <file>` misura:
  - tempo di costruzione dell'indice, memoria heap dopo la costruzione e numero di nodi;
  - tentativi per griglia (media e massimo);
  - parole per griglia (minimo, p50, p95, massimo);
  - tempo medio di generazione e di risoluzione.

### Definizione di finito
- `pnpm install && pnpm typecheck && pnpm lint && pnpm test` passano.
- `pnpm build:dict` produce dizionario e manifest, e `docs/DICTIONARY.md` è compilato.
- `pnpm cli grid --seed 42` eseguito due volte produce un output identico.
- Il benchmark è stato eseguito sul dizionario completo.

### Resoconto finale (in chat)
1. Cosa è stato fatto e con quali comandi verificarlo.
2. Statistiche del dizionario e risultati del benchmark.
3. Valutazione di giocabilità: `minWords = 50` e i pesi attuali producono griglie ragionevoli? Proposte di taratura motivate, senza applicarle.
4. Decisioni implementative prese in autonomia.
5. Dubbi o rischi per i passi successivi.

## 9. Passi successivi (solo contesto, non implementare)

### Passo 2 — Griglia giocabile (`apps/web`)
- Svelte 5 + Vite + TypeScript. Il dizionario generato viene copiato in `apps/web/public/dictionary/` in fase di build.
- **Web Worker**: carica il dizionario, costruisce `WordIndex` e, su richiesta `newGame(config)`, restituisce al main thread griglia e soluzioni (dati serializzabili).
- **Input**: Pointer Events sul contenitore della griglia con `setPointerCapture`; CSS `touch-action: none; user-select: none; -webkit-touch-callout: none`.
  - Una casella si aggancia solo quando il puntatore entra nel cerchio centrato nella casella con diametro pari al 60% del lato, così i movimenti in diagonale non prendono caselle sbagliate.
  - Tornare sulla penultima casella del percorso rimuove l'ultima.
  - Al rilascio si chiama `submitPath`.
- **Feedback**: colore del percorso in base all'esito e breve animazione; `navigator.vibrate` dove disponibile (non esiste su iOS Safari).
- Ancora nessun timer.

### Passo 3 — Partita completa (chiuso)
- **Timer** basato su timestamp: si registra `performance.now()` all'avvio e il tempo residuo si calcola ogni volta, aggiornando il display con `requestAnimationFrame` e ricalcolando a `visibilitychange`. Il tempo scorre anche in background.
- **Schermate**:
  - Home: nuova partita e record (il record è per ora solo in memoria, si azzera al reload; la persistenza reale è Passo 4/RF-16).
  - Config (aggiunta rispetto al piano iniziale): durata, lunghezza minima parola, lato griglia — vedi RF-11.
  - Partita: griglia, timer, parola corrente, parole trovate e punti.
  - Riepilogo: punteggio, percentuale trovata, parole trovate e mancate raggruppate per lunghezza, tocco su una parola per vederne il percorso, pulsante "Rigioca questa griglia".
- Il seed di una nuova partita si genera con `crypto.getRandomValues`.
- Ricaricare la pagina durante una partita la abbandona: nell'MVP non c'è ripristino (nessuna persistenza esiste ancora).
- `navigator.vibrate` sul feedback del percorso (previsto dal Passo 2): pattern breve per parola valida, pattern doppio per gli esiti negativi; nessun effetto su dispositivi senza supporto (iOS Safari).
- Test automatici per `apps/web`: `grid-geometry.test.ts` (hit-test del cerchio del 60%) e `format.test.ts` (formattazione del countdown). Il resto della UI (worker, screens) resta verificato solo manualmente: sono wiring sottile su `@paroliere/core`, già coperto dai 71+ test del core.
- Lint sui file `.svelte`: aggiunta la dipendenza dev `eslint-plugin-svelte` + `svelte-eslint-parser` (approvata esplicitamente, vedi §10) e rimosso `**/*.svelte` da `ignores` in `eslint.config.js`. Disattivata solo `svelte/prefer-svelte-reactivity` perché le `Map` costruite dentro funzioni derivate (es. raggruppamento parole per lunghezza in `SummaryScreen`) sono valori immutabili una volta ritornati: è Svelte a tracciare il derived, non serve `SvelteMap`.
- `vitest.config.ts`: aggiunto `apps/**/src/**/*.test.ts` all'`include` e `fileParallelism: false`. Su Windows, con i file in parallelo su thread separati, Vite/Vitest scrivevano in concorrenza sulla stessa cache SSR in temp dir e generavano un "Unhandled Error" sporadico (a volte con perdita silenziosa di un intero file di test dalla collection, sempre con `pnpm test` fallito per l'errore non gestito). Con l'esecuzione seriale il problema non si è più presentato in run ripetuti; costo: la suite passa da ~2,5s a ~9-10s, accettabile per la dimensione attuale.

### Definizione di finito (Passo 3)
- `pnpm typecheck && pnpm lint && pnpm test` passano (verificato con run ripetuti per il flake di Vitest su Windows).
- Le 4 schermate sono navigabili end-to-end: Home → Config → Partita (timer, drag, feedback, vibrazione) → Riepilogo (percorsi, rigioca stesso seed).

### Passo 4 — PWA e persistenza (chiuso lato codice, verifica manuale su device reali ancora da fare)
- `vite-plugin-pwa` (strategia `generateSW`, `registerType: 'autoUpdate'`) precache l'app shell: build verificata (`pnpm build` in `apps/web` genera `dist/sw.js` e `dist/workbox-*.js`, 7 entry precached).
- Runtime caching via Workbox: `/dictionary/manifest.json` è `NetworkFirst` (si riverifica una nuova versione a ogni avvio online), i file `/dictionary/*.txt` sono `CacheFirst` (nome già versionato, contenuto immutabile). Una nuova versione del dizionario si scarica quindi al prossimo avvio e viene usata dalla partita successiva (RF-18); l'aggiornamento non può interrompere una partita in corso perché il worker carica il dizionario una sola volta all'avvio, non a metà partita.
- IndexedDB tramite `idb` (`apps/web/src/lib/history.ts`): store `games` con configurazione, parole trovate (parola, punti, percorso), punteggio, punteggio massimo, totale parole e data (`playedAt`), indice su `playedAt`. `App.svelte` salva la partita a fine round e il record personale (`getPersonalBest`) sostituisce il valore in-memory di Home.
- `navigator.storage.persist()` richiesto all'avvio (`App.svelte`), senza bloccare l'app se il permesso viene negato.
- Web app manifest (nome, colori, `display: standalone`) generato da `vite-plugin-pwa`; icona placeholder SVG (`public/icons/icon.svg`, con variante `maskable`) da sostituire con la grafica definitiva. **Non ancora fatto**: test reali su Chrome Android e Safari iOS (fuori portata dall'ambiente di sviluppo corrente: nessun tool di automazione browser disponibile in questa sessione, solo build/typecheck/lint/test verificati).
- **Non fatto, rimandato**: hosting statico con compressione brotli (nessun host ancora scelto: da configurare quando si decide dove pubblicare) e sostituzione del trie con un DAWG binario (le misure del Passo 1 non lo richiedevano).

### Passo 5 — Sfide asincrone (`apps/server`)

Primo passo con backend. Introduce profilo, autenticazione minima, storico centralizzato e sfide; resta fuori tutto ciò che serve solo al multiplayer in tempo reale.

**Stack**: Fastify + TypeScript, Postgres, Drizzle come query builder (tipizzato, niente magic runtime, coerente con lo stile del monorepo). `apps/server` dipende da `@paroliere/core` e dal dizionario generato da `tools/dict-builder`, esattamente come `tools/cli`.

**Perché non Supabase/BaaS**: valutato e scartato per ora — vendor lock-in e un adattamento di `core` per le Edge Function (Deno) non necessario quando un backend Node "sottile" costa poco in più e riusa `core` senza modifiche. Da riconsiderare se il carico operativo di gestire Postgres+hosting diventa un problema.

**Perché non un server Python**: SPEC §1 lasciava aperta questa opzione; si scarta perché richiederebbe reimplementare `core` in un secondo linguaggio (raddoppio di manutenzione) senza un beneficio concreto per le sfide asincrone.

#### Identità e autenticazione
- Al primo avvio (qualsiasi Passo ≥ 5) il client genera un `deviceId` (UUID v4) e lo conserva in IndexedDB, insieme a un `deviceSecret` casuale.
- `POST /auth/device` registra `{deviceId, deviceSecret}` la prima volta e restituisce un JWT di breve durata (access token) da rinnovare con lo stesso endpoint; non serve una vera "registrazione" per iniziare a giocare o creare sfide.
- Collegare un'email è opzionale (RF-22): `POST /auth/link-email {email}` invia un magic link; `GET /auth/verify?token=...` associa l'email al `deviceId` corrente (o crea l'utente se non esiste) e restituisce un JWT sullo stesso utente. Nessuna password da gestire.
- Un utente può avere più `deviceId` collegati alla stessa email: la chiave di dominio è `userId`, `deviceId` è solo il modo per ottenere un token senza email.

#### Entità principali (Postgres)
- `users (id, email nullable, display_name, created_at)`
- `devices (id, user_id, device_id_hash, device_secret_hash, created_at)`
- `game_configs (id, size, duration_ms, min_word_length, min_words, scoring, generator_version, dictionary_version)` — stessa forma di `GameConfig` (§5.2); una sfida referenzia una riga esistente o ne crea una nuova se la combinazione non è mai stata vista.
- `challenges (id, creator_user_id, config_id, seed, title nullable, created_at, expires_at)`
- `challenge_results (id, challenge_id, user_id, score, words jsonb, duration_ms, submitted_at)` — un solo risultato per `(challenge_id, user_id)`, il client può sovrascrivere solo se non ha ancora superato il tempo della sfida.
- `games (id, user_id, config_id, seed, started_at, score, words jsonb, source: 'local' | 'challenge')` — mirror server-side dello storico locale (RF-16), popolato per sync o alla submission di una sfida.

#### API (bozza, REST + JSON)
- `POST /auth/device`, `POST /auth/link-email`, `GET /auth/verify`
- `POST /challenges` `{configId | config, expiresAt, title?}` → genera `seed` con `crypto.randomInt` lato server (il creatore non deve giocarla per primo), crea la riga e risponde con `{id, seed, config, expiresAt}`.
- `GET /challenges/:id` → config, seed, scadenza, classifica (`challenge_results` ordinati per punteggio).
- `POST /challenges/:id/results` `{path: number[][]}` (i percorsi delle parole trovate, non le parole: il server le ricava) → rigenera griglia dal seed+config con `core`, rivalida ogni percorso con lo stesso solver, ricalcola punteggio, salva `challenge_results` e aggiorna `games`. Rifiuta se `now > expiresAt`.
- `GET /users/me/history`, `POST /users/me/history/sync` `{games: [...]}` → upsert per sincronizzare le partite locali (RF-23) create offline senza profilo, quando l'utente in seguito si autentica.

**Nota di sicurezza implicita in RF-20**: il client non deve mai inviare "ho fatto X punti", solo i percorsi grezzi; ogni punteggio pubblicato in una classifica è quindi calcolato server-side.

#### Integrazione col client esistente
- Le sfide sono un `GameConfig` + `seed` che arrivano dal server invece che da `crypto.getRandomValues` (Passo 3): la sessione di gioco (§5.8) resta identica, cambia solo la provenienza del seed e la destinazione del risultato (`submitPath` locale come oggi, poi un'unica `POST /challenges/:id/results` a fine partita).
- Lo storico (IndexedDB, Passo 4) resta la fonte primaria offline; il server è un'estensione, non una sostituzione — l'app deve restare giocabile in single player senza mai autenticarsi.

#### Non ancora deciso (da chiedere quando si arriva a implementare)
- Hosting del server (Fly.io/Railway/altro) e provider email per il magic link.
- Se `challenge_results.words` conviene denormalizzato in `games` o derivato al volo.
- Rate limiting su `POST /challenges` e `POST /challenges/:id/results` per evitare abusi.

## 10. Convenzioni e dipendenze

- Node LTS 20 o superiore, pnpm workspaces.
- TypeScript strict, con `noUncheckedIndexedAccess` attivo.
- Identificatori, nomi di file e messaggi di commit in inglese; documentazione e testi della UI in italiano.
- Script alla radice: `typecheck`, `lint`, `test`, `build:dict`, `fixtures`, `cli`.
- Commit piccoli in stile Conventional Commits. Non fare push.
- Non committare `dist/`, il file sorgente del dizionario né i dizionari generati, salvo decisione esplicita dopo la verifica della licenza.

Dipendenze ammesse:
- **Passo 1 (solo dev)**: `typescript`, `tsx`, `vitest`, `@types/node`, `eslint`, `typescript-eslint`, `prettier`.
- **Passi 2–4**: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-pwa`, `idb`.
- **Passo 3 (dev, aggiunta approvata)**: `eslint-plugin-svelte`, `svelte-eslint-parser` (lint dei file `.svelte`).
