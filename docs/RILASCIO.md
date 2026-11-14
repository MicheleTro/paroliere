# Rilascio della gamification di Paroliere

Lista di controllo per portare in produzione (Coolify) la versione con progressione, Sloth's week, medaglie, stelle e sfide su
`plays` (decisione whoru #29). Il codice è pronto e verificato in locale; **non è ancora committato né pubblicato**.

## Prima del deploy
1. **Backup** del Postgres condiviso e prova di ripristino (decisione #25): la migrazione `0003_gamification` **cancella** le
   vecchie tabelle di storico e statistiche (`games`, `game_configs`, `player_word_stats`, ...). I dati vecchi si perdono: è già deciso.
2. Variabili di Paroliere: `DATABASE_URL`, `SESSION_SECRET` (≥ 32 caratteri), `PORTAL_URL`, `SERVICE_ID`,
   `PORTAL_SERVICE_TOKEN` (stesso valore di `SERVICE_TOKEN_PAROLIERE` sul portale). **`DEV_LOGIN` non va impostata**: in
   produzione è comunque ignorata, ma non deve esserci. `NODE_ENV=production` lo imposta il Dockerfile.
3. Il portale deve essere già aggiornato (amici e API interne, decisione #28): le sfide e la classifica amici lo chiamano.

## Cosa fa il deploy
- `start:prod` applica le migrazioni (`0003_gamification` riunisce lo sviluppo da 0003 a 0013; le prime tre sono già in produzione)
  e avvia il server. Tutte le tabelle e i dati iniziali (11 preset, piano dei 7 giorni, 14 medaglie, aiuto +10 s) nascono lì.
- Le griglie di Sloth's week si creano alla prima richiesta di ogni giorno, con il piano in vigore.

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
