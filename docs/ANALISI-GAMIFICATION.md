# Analisi di implementazione: progressione, Settimana, medaglie

Stato: **analisi, nessun codice scritto**. Riferimenti: `docs/SPEC.md` §11 (decisioni), `docs/prototipo-gamification.html`
(prototipo navigabile), codice di `master` al commit `8cba559`. Scritta il 2026-11-13.

Obiettivo: capire cosa comporta realizzare §11 sul codice esistente, a livello di dati, regole di gioco, API,
schermate e ordine di lavoro, e quali punti vanno decisi prima di cominciare.

---

## 1. Da dove si parte

| Area | Oggi | Dopo §11 |
|---|---|---|
| Fonte di verità del progresso | Il client: IndexedDB è lo storico "primario", il server riceve una copia best-effort (`/users/me/history/sync`) | **Il server**: XP, livello, parole trovate, serie, medaglie, classifiche non possono vivere nel browser |
| Modalità di gioco | Una sola ("Allenamento") con configurazione libera: durata, lunghezza minima, lato, `pointMode` standard/speciale, `positionBonus` | **Gioca** (5×5, 2 min, classica, fissa) + **Settimana** (7 varianti) + **Sfide** 1 contro 1. Niente più `ConfigScreen` |
| Seed | Casuale, scelto dal client (`randomSeed()`); nelle sfide lo sceglie il server | Gioca: da decidere (§5.1). Settimana: deciso dal server, uguale per tutti |
| Punteggio | `classic`, `versus`, con opzioni `speciale` e `positionBonus` | `classic`, `versus` esteso a N giocatori, più tre regole nuove (bonus caselle, combo, parole uniche). `speciale` e `positionBonus` escono di scena |
| Dati utente | `users` sottile, `games`, `game_configs`, `player_word_stats`, `reported_words`, tabelle `duels*` | Profilo con XP/serie/aiuti, collezione parole, medaglie, settimane, tentativi. Lo storico vecchio **non si conserva** (§11.2) |
| Grafica | Schermate "scheda" con pulsanti, tema di base | Mondo a fumetto: Home = scena del ramo con 7 nodi, bradipo, stagioni, giorno/notte, schermate a tutto schermo senza scorrimento |
| Offline | PWA, partita giocabile offline, sync best-effort | Da ridefinire (§5.1): Settimana e Sfide richiedono rete per forza |

Quello che si riusa quasi intatto: `packages/core` (PRNG, generatore, solver, trie, sessione, `computeVersusScores`), il
broker di accesso e la sessione, le tabelle e le route dei duelli, `gradeSubmission`, il caricamento del dizionario
lato server, la guardia sulla versione del dizionario, il worker del dizionario, `GridView`/`PlayScreen` (gesto di
trascinamento), l'amministrazione delle parole segnalate.

Quello che si butta: `ConfigScreen`, `HistoryScreen`, `GameStatsSummary`, `lib/history.ts` (IndexedDB), `player_word_stats`
e `/users/me/word-stats`, `games`, `game_configs`, le opzioni `speciale`/`positionBonus` e i relativi popover
(`ScoringInfoContent`, parte di `InfoPopover`), il vecchio `HomeScreen` a tessere.

---

## 2. Modello logico dei dati

Convenzione: chiave utente = `sub` del portale (`users.id`, varchar 64), come oggi. Migrazione con **azzeramento**:
drop di `games`, `game_configs`, `player_word_stats`; si conservano `users` e `reported_words`; i duelli in corso si
chiudono (le sfide cambiano config, §5.7).

```
users                    (esiste)    id, username, created_at, last_seen_at

profiles                 (nuova)     user_id PK→users
                                     total_xp            bigint   (il livello si DERIVA, non si salva)
                                     streak_days         int      0..9, giorni consecutivi nel ciclo corrente
                                     streak_last_day     date     ultimo giorno (Europe/Rome) con una partita
                                     streak_cycles       int      cicli da 10 giorni completati (medaglia 15)
                                     helps               int      aiuti +10 s disponibili
                                     longest_word        varchar  (parola più lunga di sempre, per il profilo)
                                     onboarded_at        timestamptz null   prima partita guidata fatta
                                     notifications_seen_at timestamptz     per il segnalino "da leggere"
                                     settings            jsonb    suoni, vibrazione, tema, promemoria (§5.8)

found_words              (nuova)     user_id, word, first_found_at, first_play_id
                                     PK(user_id, word)   → "parole trovate" = count(*), l'elenco è la tabella stessa
                                     (un indice su (user_id, length(word)) serve al filtro per lunghezza)

plays                    (nuova, sostituisce `games`)
                                     id uuid PK, user_id, mode enum('gioca','settimana','sfida')
                                     seed, config jsonb (lato, durata, minWordLength, regola, bonus caselle…),
                                     dictionary_version, started_at, finished_at null,
                                     status enum('started','finished','abandoned'),
                                     words jsonb [{word, path, points, atMs}], score int,
                                     xp_awarded int, help_used bool,
                                     ref_id uuid null   (→ weekly_grids.id oppure duels.id)
                                     UNIQUE(user_id, mode, seed)  per Gioca: niente XP due volte con lo stesso seed

weekly_grids             (nuova)     id, week_start date (lunedì, Europe/Rome), day_index 0..6,
                                     variant enum('classica','grande','bonus','lunghe','combo','gigante','uniche'),
                                     seed, config jsonb, bonus_cells jsonb null, dictionary_version,
                                     solutions jsonb  (parole + percorsi, congelati alla creazione),
                                     unlocks_at timestamptz, closed_at timestamptz null
                                     UNIQUE(week_start, day_index)

weekly_entries           (nuova)     grid_id, user_id, play_id, raw_score, final_score null,
                                     help_used, played_on_day date   (per "Puntuale")
                                     UNIQUE(grid_id, user_id)   → un solo tentativo

medals                   (nuova)     user_id, medal_id varchar, earned_at     PK(user_id, medal_id)
                                     (le definizioni delle 15 medaglie stanno nel codice, non in tabella)

duels, duel_starts, duel_results     (esistono) si estendono: `xp_awarded`, vincolo "livello ≥ 5" per chi lancia
reported_words                       (esiste, invariata)
```

Scelte che reggono il resto:

- **Il livello non si salva.** Si salva `total_xp`; `level(total_xp)` è una funzione pura (soglie `round(60·n^1.4)`),
  così ritarare la curva (§11.1 dice "da ritarare") non richiede migrazioni.
- **Le griglie della Settimana si congelano.** `weekly_grids` conserva seed, config, versione del dizionario e
  soluzioni al momento della creazione. Se il dizionario si aggiorna a metà settimana, quella griglia non cambia
  (oggi una nuova versione cambierebbe le parole valide e la guardia bloccherebbe i client).
- **I seed futuri non devono essere indovinabili.** Si derivano con un HMAC di un segreto del server
  (`SESSION_SECRET` o uno dedicato) su `week_start + day_index`, e si creano alla prima richiesta del giorno
  (creazione pigra, come la scadenza dei duelli). Un seed prevedibile permetterebbe di giocare la griglia di domani.
- **Un `plays` per ogni partita iniziata**, non solo per quelle finite: serve a "abbandonare conta come finire" (serie)
  e al tempo deciso dal server (anti-reload, già fatto per i duelli con `duel_starts`).
- **Niente classifiche materializzate.** Con poche decine di giocatori, classifica del giorno e della settimana sono
  query su `weekly_entries`. La sola parte con stato è la **chiusura della settimana** (`closed_at`), vedi §5.4.

Il server è anche l'autorità sul punteggio: il client invia i percorsi (e i tempi, per la Combo), il server rigenera la
griglia dal seed, rivaluta tutto e calcola XP, parole nuove, medaglie, serie. È già il modello dei duelli
(`gradeSubmission`), si generalizza.

---

## 3. `packages/core`: cosa cambia

Il core deve restare puro e deterministico (nessun `Date.now()`, nessun `Math.random()`).

1. **Valore base della parola.** Oggi `baseWordValue` = `len − 2 + max(0, len − 5)`, cioè un bonus dalle 6 lettere in su.
   SPEC §11 e il prototipo dicono `len − 2`. **Va deciso** quale vale (§7, domanda 12); tutte le XP e i confronti
   dipendono da questo.
2. **Regole di punteggio** (`ScoringRule` esistente: `scoreWord(word, path, grid, options)`):
   - `classic`: resta.
   - `versus` esteso: già `computeVersusScores` accetta N partecipanti; per la domenica basta `groupId = userId`.
   - **`bonus-cells`** (mercoledì): due caselle moltiplicatrici ×2 e ×3; il valore della parola si moltiplica per le
     caselle attraversate. Richiede `Grid.bonus?: Record<index, 2|3>` (SPEC §5.7 lo prevedeva) e la scelta
     deterministica delle caselle **dal seed, con uno stream PRNG separato** (così le griglie esistenti e le fixture
     non cambiano). Differisce da `positionBonus` (moltiplicatore per posizione fissa): quello si elimina.
   - **`combo`** (venerdì): il punteggio dipende dal *tempo tra le parole* (≤ 5 s dalla precedente fa salire la combo,
     ogni parola vale +1 per livello). La regola non è più `(word, path, grid)`: serve lo stato della partita. Soluzione:
     `FoundWord` guadagna `atMs`, e la regola combo è una funzione sull'intera sequenza (`scoreSequence`), usata sia dalla
     sessione dal vivo sia dal server.
   - `lunghe` (giovedì): è solo `minWordLength = 4`, nessuna regola nuova.
   - `grande`, `gigante`: solo `size`/`durationMs` (il generatore e il solver supportano già 4/5/6).
3. **`GameConfig`** guadagna `variant` (e `bonusCells` derivate, non salvate nella config). Va mantenuto `generatorVersion: 1`
   per le griglie normali: il bonus delle caselle si estrae *dopo* la griglia con un PRNG derivato, senza toccare l'estrazione
   attuale. Da verificare con le fixture esistenti (devono restare identiche).
4. **Funzioni pure nuove, testate** (qui nasce gran parte del valore dei test): `levelFromXp`, `xpToNextLevel`, curva
   cumulata; `streakAfterPlay(prev, today)` (giorno consecutivo, ciclo da 10, reset); valutazione delle 15 medaglie
   (`evaluateMedals(stato, evento)`); calcolo "parole nuove" della partita; calcolo del punteggio provvisorio e finale
   della domenica.
5. `countsTowardStats` e le statistiche per tipologia spariscono.

Impatto sui test: `scoring.test.ts` e `session.test.ts` vanno riscritti per le nuove regole; le fixture
(`scoring.json`, `session.json`) si rigenerano intenzionalmente (SPEC §7); `generate.json`/`solver.json` devono
restare **invariate**: è il controllo che il generatore non si è mosso.

---

## 4. Server (`apps/server`)

Moduli nuovi, uno per area, sul modello di `challenges/routes.ts`:

```
progress/    profilo, XP/livello, parole trovate, serie, aiuti, medaglie   (logica pura + route)
plays/       avvio e chiusura di una partita (Gioca), valutazione, eventi di fine partita
week/        generazione pigra delle griglie, tentativi, classifiche, chiusura settimana
medals/      definizioni e valutazione
duels        (challenges/) estensione: soglia livello 5, XP, notifiche
```

### 4.1 API (bozza)

| Metodo | Percorso | Scopo |
|---|---|---|
| GET | `/api/me` | profilo: livello, XP e quanto manca, serie, aiuti, numero parole, parola più lunga, sblocchi, `onboarded` |
| POST | `/api/plays` | avvia una partita Gioca (o la prima guidata). Risposta: `playId`, seed, config |
| POST | `/api/plays/:id/finish` | invia `[{path, atMs}]`; risposta: punteggio, XP, **parole nuove**, medaglie, passaggio di livello, aiuto ricevuto, parole mancate |
| GET | `/api/week` | i 7 giorni: variante, stato (bloccato / aperto / da recuperare / giocato), mio punteggio, quanti hanno giocato |
| GET | `/api/week/:day` | dettaglio: regole, classifica del giorno (generale/amici), parole degli altri **solo se hai giocato** |
| POST | `/api/week/:day/start` | `{help?: bool}`: inizia l'unico tentativo, consuma l'aiuto, restituisce seed/soluzioni/tempo |
| POST | `/api/week/:day/finish` | come `plays/:id/finish` |
| GET | `/api/week/ranking` | classifica della settimana, `?scope=generale|amici` |
| GET | `/api/me/words` | collezione, filtro per lunghezza |
| GET | `/api/me/medals` | tutte le 15, con data o stato bloccato |
| PATCH | `/api/me/settings` | suoni, vibrazione, tema, promemoria |
| POST | `/api/me/onboarded` | fine della partita guidata |

I duelli mantengono le route attuali (`/challenges…`), più il vincolo "chi lancia ha livello ≥ 5" e l'XP all'esito.

### 4.2 Tempo e fuso

Tutti i confini (giorno, settimana, serie, "puntuale") si calcolano in `Europe/Rome` (proposta di §11.5, da confermare)
con date calendario, non con differenze di ore: l'ora legale non deve spostare uno sblocco. Una sola funzione
`romeDay(instant)` usata ovunque, con test su cambio ora e su mezzanotte.

### 4.3 Valutazione di una partita (comune a tutte le modalità)

1. Carica `plays` (stato `started`, dell'utente, mai già chiuso) e la sua config/soluzioni.
2. Rivaluta i percorsi (`gradeSubmission` esteso: caselle bonus, combo con i tempi, validazione di monotonia dei `atMs`
   e del tetto di durata, tempo reale trascorso ≤ durata + margine, come per i duelli).
3. Calcola il punteggio con la regola della modalità; in transazione: aggiorna `plays`, `found_words`
   (`ON CONFLICT DO NOTHING RETURNING` dà le parole nuove), `profiles` (XP, serie, parola più lunga), valuta le medaglie.
4. Risponde con tutto ciò che la schermata di riepilogo deve mostrare (nessuna seconda chiamata).

L'idempotenza (stesso `playId` chiuso due volte) si ottiene dallo stato `started → finished`.

### 4.4 XP

XP della partita = punteggio totale con la regola della modalità (§11.1). Duelli: punteggio Versus (§11.9).
Le medaglie non danno XP. La domenica è un caso a parte (§5.4).

### 4.5 Serie e aiuti

Una partita iniziata (anche abbandonata) conta per il giorno `romeDay(started_at)`. Regola: se `streak_last_day` è ieri →
`+1`; se è oggi → invariato; altrimenti → riparte da 1. Al raggiungimento del 10° giorno: `helps += 1`,
`streak_cycles += 1`, `streak_days = 0` (e medaglia 15). Un giorno senza partite azzera senza premio: si valuta pigramente
alla prima lettura/partita dopo il buco, senza job.

### 4.6 Settimana

- **Creazione pigra**: alla prima richiesta di una settimana si creano le 7 righe di `weekly_grids` (seed HMAC,
  variante per giorno, soluzioni congelate). Costo: 7 generazioni con solver, la più pesante la 6×6; da misurare
  (il benchmark del core dice quanto) e, se serve, generare ogni giorno al suo sblocco.
- **Tentativo unico**: `UNIQUE(grid_id, user_id)` + `plays` in `started` bloccano il secondo avvio. Se si ricarica durante
  la partita, il tempo residuo lo decide il server (come i duelli).
- **Giorni futuri**: il server non restituisce seed né soluzioni di un giorno non ancora sbloccato.
- **Recupero**: i giorni passati restano giocabili fino a domenica 23:59.
- **Aiuto**: `+10 s` alla durata del tentativo, un solo aiuto per griglia, scelto prima di iniziare; `helps -= 1`
  nella stessa transazione dell'avvio. Il tentativo porta `help_used` per il segno in classifica (§7, domanda 3).

### 4.7 Domenica (parole uniche) e chiusura settimana

Il punteggio domenicale dipende dagli altri: ogni nuovo tentativo può rendere comune una parola che era unica.
Quindi `final_score` resta `NULL` finché la settimana non si chiude; la classifica mostra un valore provvisorio calcolato
al volo con `computeVersusScores` su tutte le `words` della griglia.

La **chiusura** (domenica 23:59 → lunedì 00:00) non ha un job: è un'operazione idempotente `closeWeekIfNeeded(week)` che
scatta alla prima richiesta dopo la scadenza, in transazione con lock: fissa `final_score`, imposta `closed_at`,
conferisce le medaglie legate alla chiusura (14 "Primo posto") e il saldo XP della domenica. Idempotente per costruzione
(se `closed_at` c'è, esce). Un `setInterval` in-process sarebbe fragile con i riavvii: meglio la pigrizia, già usata per i duelli.

**Proposta per l'XP della domenica** (risponde alla prima domanda aperta di §11.10): XP immediato pari al **valore base**
delle parole (senza raddoppio); alla chiusura si aggiunge solo il bonus delle parole rimaste uniche. Il saldo è sempre
≥ 0, nessuna correzione al ribasso, nessun XP "ritirato".

### 4.8 Medaglie

15 definizioni in un modulo (`id`, nome, condizione), valutate dopo ogni evento sullo stato letto dalla transazione.
Quelle con dati non ovvi:

| # | Medaglia | Dato necessario |
|---|---|---|
| 12 | Puntuale | `weekly_entries.played_on_day == grid.day` per tutte e 7 |
| 13 | Tuttofare | variante delle griglie giocate (`weekly_entries` ⨝ `weekly_grids`), cumulata su più settimane |
| 14 | Primo posto | solo a settimana chiusa; chi ha il massimo `final_score`; **da decidere** parità e numero minimo di giocatori (§7, domanda 9) |
| 15 | Ciclo completo | `streak_cycles ≥ 1` |
| 5, 3, 4 | Cento / Mille / Diecimila | `count(found_words)` |

Le medaglie 1, 2, 6, 7, 8 si valutano sulla singola partita. L'elenco delle prime 15 è aperto: la tabella `medals` accetta
nuovi `medal_id` senza migrazioni.

### 4.9 Duelli

Già pronti: invito, risposta, annullamento, avvio con tempo del server, risultato, punteggio Versus, scadenza pigra.
Da aggiungere: (a) chi lancia deve essere almeno livello 5; (b) una sfida verso un amico che non ha ancora sbloccato resta
`invited` ma **non compare** nelle sue notifiche finché non arriva a 5 (`GET /notifications` filtra); (c) XP all'esito;
(d) config fissa: la schermata `CreateChallengeScreen` con durate/lunghezze/punteggi sparisce e resta solo la scelta
dell'amico (§7, domanda 7).

---

## 5. Decisioni di architettura che servono prima

### 5.1 Gioca: seed deciso dal client o dal server? (e l'offline)

Oggi il client sceglie il seed e gioca anche senza rete. Due problemi nuovi:

- **XP ripetibile**: con un seed scelto dal client si potrebbe inviare la stessa partita più volte (stesso seed, stesse
  parole) per accumulare XP.
- **"Abbandonare conta come finire"** (serie): per contare un abbandono il server deve sapere che la partita è iniziata.

Opzioni:

| | A. Seed del server (`POST /api/plays`) | B. Seed del client, invio differito |
|---|---|---|
| XP ripetibile | no (un seed, una partita) | no, con `UNIQUE(user_id, mode, seed)` |
| Serie con abbandono | sì, naturale | solo se l'avvio viene comunicato; offline no |
| Offline | no: serve rete per iniziare | sì: coda in IndexedDB, invio quando c'è rete |
| Complessità | bassa | media (coda, idempotenza, partite "tardive" sul giorno giusto) |

**Raccomando A**: è l'unico che rende semplici serie, XP e anti-ripetizione, e la Settimana e le Sfide sono già
online-only. Costo: Gioca non parte senza rete; la promessa "funziona offline" di RF-17 si indebolisce. Se l'offline è
irrinunciabile, B è fattibile ma raddoppia il lavoro sulla coda e sulle date. **Da decidere.**

### 5.2 Rischio barare

Il client conosce tutte le soluzioni (risolve la griglia in locale per validare). Chiunque può quindi inviare il punteggio
massimo. Oggi, tra amici, non importa; con una classifica generale e la medaglia "Primo posto" un po' sì. Mitigazioni a
costo basso: tempi per parola monotoni e plausibili (≥ ~0,5 s tra due parole), tetto sul numero di parole al secondo,
sospetti segnalati nell'amministrazione. Soluzione forte (validare via server parola per parola) taglia l'offline e
aumenta il traffico. **Proposta**: accettare il rischio per ora, registrare i tempi per poterlo rilevare dopo.

### 5.3 Dizionario e Settimana

Le soluzioni di una griglia della Settimana si congelano alla creazione, ma il client valida con il proprio dizionario.
Se la versione differisce, la guardia attuale impedisce di giocare. Per la Settimana va meglio servire **le soluzioni
congelate** (parole+percorsi) e validare su quelle: un client con dizionario vecchio gioca comunque la stessa griglia con
le stesse regole. Per Gioca e Sfide resta la guardia sulla versione.

### 5.4 Chiusura della settimana: pigra, non pianificata

Vedi §4.7. Niente cron: una chiamata idempotente alla prima richiesta dopo la scadenza.

### 5.5 Amici e classifiche "amici"

L'elenco amici sta nel portale: `GET /api/internal/friends?sub=` esiste già. La classifica "amici" filtra per quella lista
(chiamata server-to-server già usata dai duelli). Le richieste di amicizia in arrivo si vedono già dal segnalino della home;
il prototipo le mostra tra le "Notizie". **Accettarle dal gioco** richiederebbe endpoint di *scrittura* nel portale con
identità dichiarata dal servizio: possibile (il token di servizio è fidato) ma allarga la superficie. Proposta: le notizie
rimandano al portale per accettare; si valuta dopo.

### 5.6 Notifiche

Non c'è una tabella di notifiche: si **derivano** dallo stato (inviti, partite da giocare, richieste di amicizia, "nuova
griglia del giorno", "hai aiuti") con `notifications_seen_at` per il "da leggere". Più semplice e senza stati incoerenti.

### 5.7 Impostazioni e promemoria

Suoni e vibrazione sono preferenze del dispositivo (localStorage), il tema anche. Il **promemoria** (§11.8) richiede
notifiche push: Web Push con VAPID, service worker, tabella di sottoscrizioni, un job che le invia al giorno giusto. È
un blocco di lavoro a sé, con limiti su iOS (solo PWA installata). **Proposta**: fuori dalla prima consegna.

### 5.8 Grafica: conflitti tra specifica e prototipo

- Il prototipo definisce un'identità propria (font Lilita One/Nunito, scena a fumetto, bradipo). La decisione precedente era
  "portare la grafica di whoru, cambiare dopo". Va chiarito se la **fase grafica** è il tema whoru o questa.
- §11.8 prevede "tema chiaro o scuro" tra le impostazioni, il prototipo dichiara "un solo aspetto voluto, niente tema scuro
  dell'interfaccia: la scena ha giorno e notte". Una delle due.

---

## 6. Schermate e UX

Dal prototipo, con lo stato di ciascuna nell'app attuale.

| Schermata del prototipo | Nell'app oggi | Lavoro |
|---|---|---|
| **Home / scena del ramo** (7 nodi, bradipo che avanza con l'ora, stagioni, giorno/notte, particelle, HUD con stella-livello e barra XP, serie, campanello, pill della settimana, dock) | `HomeScreen` a tessere | nuova, in SVG; è la parte più grande della grafica |
| Foglio **giorno** (variante, regole, classifica del giorno, "gioca", aiuto +10 s) | non esiste | nuova |
| Foglio **classifica settimana** (generale/amici, podio) | non esiste | nuova |
| Foglio **serie** / **aiuti** | non esiste | nuova |
| Foglio **notizie** (inviti, amicizie, nuova griglia) | segnalino sulle tessere | rifare |
| Foglio **info** (testi esplicativi) | `InfoPopover` | riusare l'idea, nuovi testi |
| **Partita** (timer, griglia a tutto schermo, parola corrente, feedback, fumetto del "coach" in prima partita, combo, caselle bonus, conto alla rovescia 3-2-1) | `PlayScreen` + `GridView` | estendere: bonus visibili, combo, tutorial guidato |
| **Riepilogo** (punteggio = XP, parole nuove, medaglie, livello, parole mancate solo in Gioca, posizione in classifica per la Settimana) | `SummaryScreen` | riscrivere |
| **Profilo** (livello, XP, parole + elenco filtrabile, serie e aiuti, medaglie, parola più lunga) | non esiste | nuova |
| Foglio **medaglie** (15, bloccate/sbloccate) + modale di sblocco | non esiste | nuova |
| Foglio **impostazioni** | non esiste | nuova |
| **Sfide** (lista, nuova con scelta amico, esito) | `Challenges*Screen` | adattare; lucchetto fino al livello 5 |
| Modali di **livello**, **regalo +10 s**, **benvenuto**, **fine guidata** | non esistono | nuove |
| Amministrazione (utenti, parole segnalate) | `Admin*Screen` | verificare cosa mostrano (dipendono da `games`/`player_word_stats`?) |

Navigazione: l'app non usa un router (stato `screen` in `App.svelte`, già 352 righe). Con queste schermate conviene un
router a hash minimale (come fa il prototipo) o stati più strutturati, altrimenti `App.svelte` diventa ingestibile. Il
tasto indietro del telefono oggi non funziona come ci si aspetta.

Vincoli del prototipo da rispettare: schermate che riempiono lo schermo senza scorrimento (tranne i fogli), area di tocco
≥ 44 px, `prefers-reduced-motion` disattiva le animazioni, tema su `color-scheme: light`, `env(safe-area-inset-*)`.

Primo accesso: le sole voci attive sono Gioca, Settimana, Profilo, Impostazioni; Sfide e Amici con lucchetto e livello
richiesto. La prima partita è guidata (coach che indica una parola reale della griglia: `hint` nel prototipo, calcolata dal
solver).

---

## 6b. Decisioni prese (2026-11-13)

1. Gioca: seed deciso dal server, serve la rete per iniziare (opzione A di §5.1).
2. Gioca e Settimana a regole fisse; **solo le sfide** permettono di scegliere opzioni e caratteristiche. Conseguenza:
   `speciale`, `positionBonus`, durata, lato e lunghezza minima restano nel core **per le sfide**; la
   `CreateChallengeScreen` con le opzioni resta.
3. Valore base della parola: quello attuale, con il bonus dalle 6 lettere (cambia SPEC §11 e il prototipo, che usavano `len − 2`).
4. Tema grafico proprio del gioco, non più quello di whoru, ancora da definire.
5. XP: i punti si danno **subito e per intero** a fine partita, in ogni modalità.
6. **Il raddoppio delle parole uniche esiste solo nelle sfide.** Quindi la domenica non è più "Parole uniche" e **cadono**
   il punteggio provvisorio, `final_score`, la chiusura della settimana come evento che cambia i punteggi e il saldo XP
   (§4.7 è superato: la chiusura serve solo a fissare la classifica finale).
7. **Le giornate della Settimana si rivedono e devono essere configurabili e modificabili agevolmente.** Conseguenza di
   progetto: le varianti non stanno nel codice ma in dati.
   - Una **variante** è un insieme di parametri (lato, durata, lunghezza minima, regola di punteggio, caselle bonus sì/no,
     combo sì/no, testi di nome e descrizione).
   - Un **piano settimanale** assegna una variante a ciascun giorno; vale per le settimane **non ancora create**. Quelle già
     create restano congelate (le griglie e le soluzioni sono salvate), quindi cambiare il piano non altera i risultati.
   - Modifica dalla schermata di amministrazione, senza rilascio. Tabelle `week_variants` e `week_plan`; le sette varianti
     del prototipo sono solo i valori iniziali.
   - Effetto sulle medaglie: "Tuttofare" (una griglia per ciascuna variante) va riferita al catalogo, non a "7".
   - Da definire in seguito: quali giornate e con quali regole. Finché non si decide, partono come nel prototipo, con la
     domenica a classica 5×5 e 3 minuti.
8. **Aiuti**: nessun segno "+10 s" in classifica; **utilizzabili anche nelle sfide**, a scelta di chi gioca (il tentativo
   porta `help_used`, visibile nell'esito della sfida).
9. **Medaglia "Primo posto" rimossa** per ora: le medaglie sono 14, senza quelle legate a classifica. Resta una lista
   aperta.
10. Punteggi degli altri sempre visibili nella Settimana, parole nascoste fino a quando non hai giocato quella griglia.
11. Amicizie: si accettano **solo dal portale**; nelle notizie del gioco compare un link.
12. **Promemoria push**: fuori dalla prima consegna (voce nelle impostazioni, disattivata).
13. Fuso **Europe/Rome** e recupero dei giorni passati anche al primo accesso, fino a domenica 23:59.

Tutte le domande di §7 sono ora chiuse (il tema scuro è superato dalla decisione sul tema proprio, da definire).

## 7. Domande da chiudere

Con la mia raccomandazione, in ordine di impatto.

1. **Gioca offline?** (§5.1) A: seed dal server, serve rete — *raccomandato*. B: coda offline.
2. **Abbandono e serie**: conta come finire (già deciso). Richiede la registrazione dell'avvio sul server: segue da (1).
3. **Segno "+10 s"** in classifica (§11.10): sì, un piccolo marcatore — *raccomandato*, la comparabilità è in gioco.
4. **XP della domenica**: base subito + bonus a chiusura (§4.7) — *raccomandato*.
5. **Aiuti nelle sfide**: no — *raccomandato*: la sfida è già asincrona e un aiuto altera il confronto.
6. **Rischio barare** (§5.2): accettato per ora, tempi registrati.
7. **Parametri delle sfide 1 contro 1**: tutti fissi (5×5, 2 min, regola Versus) o ancora scelti dal creatore? §11 non lo dice. *Raccomando fissi*, come Gioca.
8. **Promemoria** (push): fuori dalla prima consegna.
9. **Medaglia "Primo posto"**: quante persone minime in classifica (propongo ≥ 3) e che fare in caso di parità (tutti i primi a pari merito).
10. **Visibilità dei punteggi altrui**: la Settimana mostra "chi l'ha giocata e con quanti punti" sempre, ma le parole solo dopo aver giocato — confermi che il punteggio è visibile anche a chi non ha ancora giocato la griglia?
11. **Accettare le amicizie dal gioco** o solo dal portale (§5.5).
12. **Formula base** di una parola: `len−2` (specifica e prototipo) o con il bonus dalle 6 lettere dell'attuale `baseWordValue`. Cambia XP, punteggi, tarature del livello.
13. **Grafica**: tema whoru o fumetto del prototipo; e tema scuro sì/no (§5.8).
14. **Fuso orario** `Europe/Rome`: confermato?
15. **Utenti che arrivano a metà settimana**: possono giocare i giorni già passati (recupero) — è il comportamento descritto da §11.5; confermo che vale anche per il primissimo accesso.

---

## 8. Piano di lavoro

Le fasi sono ordinate per **rendere giocabile qualcosa presto e testabile** senza dipendere dalla grafica.

0. **Decisioni** (§7) e registrazione nel diario di whoru (nuova voce, decisioni #29+).
1. **Core**: valore base, `bonus-cells`, `combo`/`scoreSequence`, `levelFromXp`, `streakAfterPlay`, medaglie, domenica; fixture
   rigenerate; `generate.json`/`solver.json` invariate come controllo.
2. **Dati**: nuove tabelle e migrazione di azzeramento; modulo `progress` (profilo, XP, parole, serie) con test contro Postgres reale.
3. **Gioca end-to-end**: `POST /api/plays` e chiusura; riepilogo con parole nuove, livello, medaglie; schermata minimale
   nello stile attuale. Rimozione di storico/IndexedDB/statistiche per tipologia.
4. **Settimana**: griglie pigre, tentativo unico, classifiche generale e amici, aiuti, chiusura pigra, domenica.
5. **Medaglie, serie, profilo, impostazioni**.
6. **Sfide**: soglia livello 5, XP, notifiche filtrate, parametri fissi.
7. **Grafica**: scena del ramo, tema, animazioni, tutorial guidato, onboarding, modali; router.
8. **Rifinitura**: PWA e offline come deciso in (1), test su telefono, ritaratura XP/livelli, panoramica sul server
   (indici, tempo di generazione), distribuzione.

Distribuzione: cambio di schema con azzeramento, quindi un solo passaggio coordinato (portale invariato, Paroliere nuovo).
Backup del database condiviso da verificare **prima** (resta tra le cose aperte di whoru).

Test: il valore sta nelle funzioni pure (livelli, serie, medaglie, domenica, giorni/fuso) con test unitari e fixture; i flussi
con server in Postgres reale e uno scenario e2e in Playwright per Gioca, per una Settimana con due utenti e per il duello
(già presente).

## 9. Rischi

- **Dimensione**: è più di un refactor, è un prodotto nuovo sopra lo stesso motore. La grafica da sola (scena SVG animata,
  fogli, modali) è un lavoro grande; conviene tenerla per ultima e non bloccare dati e regole.
- **Combo e anti-barare**: la regola dipende da tempi che il client dichiara.
- **Domenica**: punteggi che possono scendere e classifiche che si muovono fino alla chiusura; da spiegare bene all'utente
  (il testo "Punteggio provvisorio" c'è già nel prototipo).
- **6×6 sul telefono**: il worker deve generare e risolvere la griglia; da misurare su dispositivi lenti (con soluzioni
  congelate sul server il client potrebbe non risolvere affatto).
- **Curva XP e livello 5**: "circa 18 partite" per sbloccare le sfide è una stima; le sfide restano vuote finché gli amici
  non arrivano a 5.
- **Giorni e fuso**: gli errori di data sono la causa classica di bug in serie e settimane; una sola funzione, molti test.
