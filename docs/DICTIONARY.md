# Dizionario italiano — stato e fonte

## Stato: sospeso

La fonte candidata indicata dal brief (§6) è **Morph-it!**, lessico morfologico
dell'italiano con forme flesse, pubblicato dal SSLMIT — Università di Bologna
all'indirizzo `https://docs.sslmit.unibo.it/doku.php?id=resources:morph-it`.

Dall'ambiente di sviluppo usato in questo passo quel dominio non è raggiungibile
(ogni richiesta, anche sulla root del sito, restituisce `402 Payment Required`
tramite lo strumento di fetch disponibile). Non è stato quindi possibile:

- scaricare il file sorgente;
- verificare i termini di licenza esatti;
- confermare il formato/tagset reale delle colonne (forma flessa, lemma, tag).

Per decisione del committente (Michele), il lavoro è proseguito senza bloccarsi
su questo punto: `tools/dict-builder` implementa una pipeline generica (§6)
che funziona con qualunque file `--source` in formato "forma flessa\tlemma\ttag"
separato da tabulazioni — l'ipotesi di formato più comune per Morph-it!, non
ancora verificata contro la fonte reale.

## Cosa resta da fare prima di pubblicare un dizionario reale

1. Verificare licenza e condizioni d'uso di Morph-it! (o di una fonte
   alternativa) e riportarle qui.
2. Confermare il formato delle colonne e il tagset usato per
   `isExcludedTag` in `tools/dict-builder/src/build.ts` (attualmente esclude
   tag contenenti `NPR`, `ABR`, `SYM`, `PUN`: ipotesi da validare).
3. Eseguire `pnpm build:dict --source <file>` sul file reale e riportare qui
   le statistiche (conteggi per fase, distribuzione per lunghezza, dimensioni
   raw/gzip/brotli) stampate dalla CLI.
4. Eseguire `pnpm cli bench --dict <dizionario generato>` sul dizionario
   completo e riportare i risultati nel resoconto del Passo 1.

## Nel frattempo

Tutti i test, le fixture e le verifiche di questo passo usano
`fixtures/dict-small.txt`: una lista curata a mano di ~960 parole italiane
comuni (incluse alcune con "qu"), già normalizzata secondo le regole di
§6 (minuscolo, senza accenti, senza apostrofi/trattini, alfabeto delle 21
lettere ammesse), indipendente da qualunque fonte con licenza da verificare.
