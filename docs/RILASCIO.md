# Rilascio della gamification di Paroliere

Lista di controllo per portare in produzione (Coolify) la versione con progressione, Sloth's week, medaglie, stelle e sfide su
`plays` (decisione whoru #29). Il codice è pronto e verificato in locale; **non è ancora committato né pubblicato**.

## Prima del deploy
1. **Backup** del database `paroliere` e prova di ripristino (decisione #25): la migrazione `0003_gamification` cambia il modello dei dati.
   **Nessun dato si perde** (decisione del 2026-11-17, sostituisce la precedente): storico, statistiche e sfide si convertono
   nelle tabelle nuove e le vecchie tabelle restano come archivio, rinominate `legacy_*` (`legacy_games`, `legacy_game_configs`,
   `legacy_player_word_stats`, `legacy_duel_results`, `legacy_duel_starts`). Il backup resta comunque obbligatorio.
2. Variabili di Paroliere: `DATABASE_URL`, `SESSION_SECRET` (≥ 32 caratteri), `PORTAL_URL`, `SERVICE_ID`,
   `PORTAL_SERVICE_TOKEN` (stesso valore di `SERVICE_TOKEN_PAROLIERE` sul portale). **`DEV_LOGIN` non va impostata**: in
   produzione è comunque ignorata, ma non deve esserci. `NODE_ENV=production` lo imposta il Dockerfile.
3. Il portale deve essere già aggiornato (amici e API interne, decisione #28): le sfide e la classifica amici lo chiamano.

## Cosa fa il deploy
- `start:prod` applica le migrazioni (`0003_gamification` riunisce lo sviluppo da 0003 a 0013; le prime tre sono già in produzione)
  e avvia il server. Tutte le tabelle e i dati iniziali (11 preset, piano dei 7 giorni, 14 medaglie, aiuto +10 s) nascono lì.
- Le griglie di Sloth's week si creano alla prima richiesta di ogni giorno, con il piano in vigore.

## Cosa diventano i dati vecchi
- Ogni partita dello storico è una partita di Gioca (`plays`, con le sue parole in `play_words`); gli XP sono il suo punteggio
  (senza il bonus stella, che allora non c'era): chi giocava già riparte dal livello che i suoi punti gli danno.
- La collezione (`found_words`) raccoglie tutte le parole trovate, con la partita della prima volta; record (parola più lunga,
  più parole in una partita) e partite giocate vanno nel profilo, tenendo anche il meglio delle vecchie statistiche.
- Le sfide restano tutte: la configurazione passa dentro la sfida; ogni risultato inviato diventa una partita di sfida. Le vecchie
  sfide avevano solo i percorsi: le parole le ricalcola il server al primo avvio (`src/plays/legacy.ts`), una volta sola. Il
  punteggio delle concluse resta quello ufficiale di allora; quelle aperte si chiudono come le nuove.
- Serie e medaglie partono da zero: le medaglie che i numeri già meritano arrivano alla prima partita conclusa.
- Prova: `pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/prova-conversione.ts` (database temporaneo fermo
  alla 0002 con dati nel formato di allora, poi migrazioni e controlli).
- Le tabelle `legacy_*` non sono nello schema di Drizzle: `db:generate` non le tocca (confronta con le istantanee), `drizzle-kit push`
  invece proporrebbe di cancellarle. Si potranno togliere con una migrazione apposita, quando non serviranno più.

## Dopo il deploy: cosa provare
- Accesso dal portale, benvenuto e prima partita guidata (nuovo utente).
- Gioca: punteggio, barra con le tre stelle, bonus XP nel riepilogo.
- Sloth's week: lunedì aperto, i giorni dopo si aprono giocando in ordine; classifica; parole degli altri dopo aver giocato.
- Profilo: parole, medaglie, serie; impostazioni (suono, vibrazione, cielo, stagione).
- Livello 5 (915 XP): si sbloccano amici e sfide; sfida 1 contro 1 con un amico vero del portale.
- Amministrazione: preset, piano settimanale, utenti.
- Su telefono vero: tocco sulla griglia (primo tocco su tutta la casella, poi cerchio del 60%), aspetto, PWA e uso offline.

## Da sapere
- Gioca richiede la rete (il seed lo decide il server); la partita libera non funziona più offline.
- Il promemoria della serie (notifiche push) non c'è: l'impostazione è salvata ma segnata "in arrivo".
- La curva XP e le soglie delle stelle (20/50/80) sono da tarare sui dati reali.
- Medaglie e oggetti si modificano oggi solo da database (la schermata admin copre preset e piano).
- Prove automatiche: `pnpm test`; `apps/server/scripts/prova-partite.ts`, `prova-settimana.ts`, `prova-griglie.ts`,
  `verifica-migrazioni.ts` (database temporaneo, si cancella da solo); e2e con `E2E_URL=http://localhost:PORT pnpm exec playwright test`.
