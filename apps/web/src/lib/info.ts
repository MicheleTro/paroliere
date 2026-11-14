// Testi delle schede "i" (docs/prototipo-gamification.html), adattati alle regole decise.

export const INFO: Record<string, [string, string]> = {
  week: [
    "Sloth's week",
    'Ogni giorno a mezzanotte il bradipo sale di un ramo e si apre una griglia nuova, uguale per tutti. Ogni giornata si apre solo dopo aver giocato la precedente: le griglie perse si recuperano in ordine fino a domenica. Un solo tentativo per griglia. La classifica somma le 7 griglie.',
  ],
  xp: ['XP e livelli', 'Ogni punto che fai diventa XP. Con gli XP sali di livello. Al livello 5 si aprono amici e Sfide.'],
  serie: [
    'Serie',
    'Gioca almeno una partita al giorno. Al decimo giorno ricevi un aiuto da +10 secondi e la serie riparte. Se salti un giorno, riparte da zero.',
  ],
  aiuto: ['Aiuto +10 s', "Dieci secondi in più su una partita, in Sloth's week o in una sfida. Massimo uno per partita. Le regole non cambiano."],
  gioca: ['Gioca', '5×5, un minuto e mezzo, una griglia nuova ogni volta. Alla fine vedi anche le parole che ti sono sfuggite.'],
  parole: ['Parole trovate', 'Tutte le parole diverse che hai trovato almeno una volta, in qualsiasi modalità.'],
  sfide: [
    'Sfide',
    'Sfida un amico sulla stessa griglia. Ognuno gioca quando vuole. Una parola trovata solo da te vale doppio. Si sbloccano al livello 5.',
  ],
};
