# Paroliere — Specifiche Frontend/UX/Grafica

Documento separato da `docs/SPEC.md`. Copre solo frontend, UX e grafica: agnostico rispetto al backend. Ogni voce che richiederebbe una modifica al backend è segnalata esplicitamente come "Richiede backend" e va validata e implementata a parte, in modo puntuale — non implicita in questo documento.

Fasi previste:
1. **Analisi UX e flussi** (questo documento, in corso).
2. Revisione informazione/navigazione e microinterazioni concordate con il committente.
3. Tema visivo e stile (colori, tipografia, iconografia, animazioni) — a parte, dopo la fase 1-2.

## 1. Metodo

Audit di tutte le schermate esistenti in `apps/web/src/screens`: `HomeScreen`, `ConfigScreen`, `PlayScreen`, `SummaryScreen`, `LoginScreen`, `ChallengesScreen`, `CreateChallengeScreen`, `ChallengeDetailScreen`, `ChallengeMatchSummaryScreen`. Non tocca `packages/core` né gli endpoint server.

## 2. Problemi trasversali

- **Nessun design system**: colori, spaziatura, radius, font-size sono duplicati ad-hoc in ogni `<style>` di ogni schermata. Ogni ritocco visivo richiede modifiche in 9 file diversi.
- **Errori incoerenti**: alcuni flussi usano `<p class="error">`, `App.svelte::finishGame` usa `alert()` nativo per gli errori di invio risultato — blocca l'interazione ed è brutto su mobile.
- **Loading generico**: solo testo "Caricamento...", nessuno skeleton/placeholder.
- **Navigazione senza history/URL**: tutto lo stato di navigazione vive in variabili Svelte in `App.svelte` (nessun routing). Un refresh della pagina torna sempre alla home, perdendo la schermata in cui si era (es. dentro il dettaglio di una sfida) anche se i dati lato server restano corretti.
- **Touch target incoerenti**: il cestino nella lista sfide è 44px (ok), ma "Rimuovi squadra" è un link testuale piccolo.
- **Feedback di gioco minimo**: `WordPopup` e vibrazione funzionano, ma nessuna animazione sulla griglia, nessun avviso quando il tempo sta per scadere.
- **Accessibilità**: nessun `aria-live` sul popup di parola, nessuna gestione del focus tra schermate, form di login senza associazione errore↔campo.
- **Copy da developer**: es. "Il dizionario locale non corrisponde a quello del server: ricarica la pagina e riprova." è un messaggio tecnico, non pensato per l'utente finale.
- **PWA invisibile in UI**: nessun invito a installare l'app, nessuna schermata/stato dedicato all'offline.

## 3. Proposte per schermata

### HomeScreen
- Il pulsante "Esci" è un link testuale minuscolo vicino allo username: rischio di click accidentale, poco visibile. Da spostare in un menu/area dedicata.
- Nessun segnale se l'utente ha sfide che richiedono un'azione (es. "hai 2 match da giocare"): motiverebbe il ritorno all'app. **Richiede backend**: oggi non esiste un conteggio aggregato pronto per la home.
- Solo il record personale è mostrato: si potrebbero aggiungere mini-statistiche (partite giocate, streak) — dati già disponibili in `apps/web/src/lib/history.ts`, quindi frontend-only.

### ConfigScreen / CreateChallengeScreen
- Le due schermate duplicano quasi lo stesso markup per durata/lunghezza minima/lato griglia. Da unificare in un componente condiviso (refactor puramente frontend, basso rischio).
- Nessun riepilogo finale prima di confermare (es. "Partita da 2 minuti, griglia 4×4, minimo 3 lettere"): oggi si vedono solo le card selezionate sparse in sezioni.
- `CreateChallengeScreen` è lunga (7 sezioni in scroll verticale): da valutare un wizard a step o un accordion per ridurre il carico cognitivo, specialmente su mobile.

### PlayScreen
- Nessun avviso visivo quando il tempo sta per scadere (es. ultimi 10s): utile prima ancora che come tema, come segnale di percezione del tempo.
- L'elenco delle parole trovate è una lista semplice che cresce senza limite: su griglie 6×6 con partite lunghe può diventare ingombrante; considerare un contatore più leggibile o una vista compatta.
- Nessuna conferma se l'utente esce a metà partita (perde il progresso): da valutare se serve un guard di navigazione.

### SummaryScreen / ChallengeMatchSummaryScreen
- Buona la funzione "clicca una parola → il percorso si illumina in griglia": da mantenere, ma va reso più scopribile (hint visivo).
- Le colonne "Trovate"/"Mancate" possono diventare lunghissime su griglie 6×6: manca un modo per filtrare/cercare tra le parole mancate.
- `ChallengeMatchSummaryScreen` mostra solo il numero di parole trovate, non il punteggio `versus` per parola: l'utente non vede quanto valeva ciascuna parola nella modalità sfida finché non torna al dettaglio.

### LoginScreen
- Nessuna validazione inline (es. lunghezza minima password) prima dell'invio: l'errore arriva solo dopo la risposta del server.
- Nessuna indicazione dei requisiti password prima di sbagliare il primo tentativo.
- "Password dimenticata" assente — lacuna nota, probabilmente fuori perimetro per ora.

### ChallengesScreen (lista)
- Nessun filtro/tab (es. "Da giocare", "In corso", "Storico"): con più sfide attive la lista diventa presto poco leggibile. Alto valore, basso rischio: è un filtro sui dati già presenti lato client.
- Nessun segnale in lista di "è il tuo turno" o "stai aspettando gli altri": oggi bisogna aprire il dettaglio per scoprirlo. **Richiede backend** se vogliamo il badge senza apporlo dopo un fetch per sfida: `GET /challenges` oggi non porta lo stato dei singoli match, solo lo stato della sfida.

### ChallengeDetailScreen
- Manca una classifica aggregata (punteggio totale per partecipante/squadra sulla serie, RF-27 della spec originale): oggi si vede solo match per match. È calcolabile lato client dai punteggi dei match già ricevuti — **frontend-only**, nessun nuovo endpoint necessario.
- Il pulsante "Cancella sfida" in fondo pagina è un outline rosso isolato: da rivedere in fase tema per posizionamento e iconografia, ma la funzione va bene.

## 4. Priorità proposta

1. Classifica aggregata nel dettaglio sfida (RF-27, frontend-only).
2. Filtri/tab nella lista sfide (frontend-only).
3. Unificare Config/CreateChallenge in un componente condiviso.
4. Eliminare gli `alert()` nativi, stato di errore coerente in tutte le schermate.
5. Avviso "tempo quasi scaduto" in PlayScreen.
6. Badge "azione richiesta" in Home/lista sfide (richiede una piccola estensione di backend, da validare a parte).

## 5. Esplicitamente fuori perimetro per ora

- Tema colori, tipografia, iconografia, animazioni: fase successiva "tema e stile", trattata separatamente.
- Passo 4 (PWA su device reali, hosting con brotli): già annotato in `CLAUDE.md` come lavoro a parte, non toccato qui.

## 6. Decisioni

- **Classifica aggregata (RF-27)**: confermata, da implementare nel dettaglio sfida. Frontend-only, calcolata dai punteggi dei match già ricevuti.
- **Badge "è il tuo turno" in lista sfide**: per ora resta 100% frontend. Niente estensione di `GET /challenges`; il segnale resta visibile solo aprendo il dettaglio della sfida. Da riconsiderare più avanti se il bisogno si fa sentire.
- **Navigazione**: si rivede la struttura (non solo micro-migliorie). Proposta concreta nella sezione 7, da validare prima di implementare.

## 7. Proposta di navigazione

Oggi la navigazione è un semplice albero di schermate a schermo intero, guidato da callback passate da `App.svelte` (nessuna history, nessuna barra di navigazione persistente). Con la classifica sfide e più contenuti in arrivo, propongo una struttura a **tab persistenti** in tre sezioni principali, raggiungibili dopo il login:

1. **Gioca** (ex Home): avvio partita singola, record/statistiche personali. Ingresso naturale da app appena apre.
2. **Sfide**: lista sfide (con i filtri/tab "Da giocare" / "In corso" / "Storico" già proposti al §3), creazione, dettaglio con classifica.
3. **Storico**: le partite singole passate (oggi accessibili solo tramite record in Home, senza una vista elenco dedicata) — da verificare se esiste già un modo per consultarle: **non risulta**, oggi lo storico esiste solo come dati (`apps/web/src/lib/history.ts`) usati per calcolare il record, senza una schermata propria.

Le schermate "verticali" (Config, Play, Summary, ChallengeDetail, CreateChallenge, ChallengeMatchSummary) restano schermate a tutta pagina raggiunte *da* un tab, con un pulsante "Indietro" che torna al tab di provenienza — non entrano nella barra dei tab.

Non introdurrei un router client (es. history API/URL) in questa fase: i tab restano stato in-memory come oggi, cambia solo la presenza di una barra di navigazione persistente invece di bottoni ad-hoc per "Sfide"/"Indietro" sparsi nelle schermate. Un router "vero" (con URL condivisibili, refresh che preserva la posizione) è un investimento più grande — lo segnalo come possibile passo successivo, non incluso ora.

### Decisioni

- **Storico**: confermato come terza sezione della barra. Nuova schermata con l'elenco delle partite singole passate (dati già presenti in `apps/web/src/lib/history.ts`, solo la vista è nuova).
- **Visibilità della barra**: solo nelle tre schermate principali (Gioca, Sfide, Storico). Le schermate verticali (Config, Play, Summary, CreateChallenge, ChallengeDetail, ChallengeMatchSummary) restano a tutta pagina senza barra, con "Indietro" verso il tab di provenienza.
