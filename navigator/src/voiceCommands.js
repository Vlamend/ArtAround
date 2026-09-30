// Utility che normalizza la trascrizione per il confronto: minuscolo, senza accenti e senza punteggiatura.
// Così "Dov'è" e "dove e" diventano confrontabili.
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/*
 * Vocabolario dei comandi vocali: ogni azione ha le frasi che la attivano.
 * Le frasi sono già normalizzate (senza accenti né punteggiatura), perché
 * il confronto avviene dopo normalize(). Il riconoscimento cerca la frase
 * dentro la trascrizione, non interpreta il linguaggio libero.
 */
const VOICE_COMMANDS = [
  { patterns: ['prossimo', 'avanti'], action: 'next' },
  { patterns: ['precedente', 'indietro'], action: 'prev' },
  { patterns: ['cose questo', 'cosa e questo', 'ripeti'], action: 'repeat' },
  { patterns: ['dimmi di piu'], action: 'more' },
  { patterns: ['dimmi di meno'], action: 'less' },
  // Questi due comandi cambiano il livello linguistico del testo,
  // "dimmi di più" / "dimmi di meno" invece ne cambiano la durata.
  { patterns: ['non capisco', 'troppo difficile'], action: 'simpler' },
  { patterns: ['troppo semplice'], action: 'harder' },
  { patterns: ['chi e lautore', 'chi e l autore'], action: 'author' },
  { patterns: ['qual e lo stile', 'che stile e'], action: 'style' },
  {
    patterns: [
      // Dopo la normalizzazione "Dov'è l'uscita" diventa "dove luscita"
      // (senza la "e"), quindi servono le varianti con e senza la "e".
      'dove luscita', 'dove la toilette', 'dove il bar', 'dove lo shop',
      'dove e luscita', 'dove e l uscita',
      'dove e la toilette', 'dove sono i bagni', "dov'e la toilette", "dov'e il bagno",
      'dove e il bar', 'dove e lo shop',
      'ci sono ostacoli', 'dove sono i servizi'
    ],
    action: 'poi'
  },
  { patterns: ['mappa', 'dove mi trovo'], action: 'map' }
];

/*
 * Restituisce l'azione associata alla trascrizione (es. 'next', 'more'),
 * oppure null se nessuna frase del vocabolario è contenuta nel testo.
 * Vale il primo comando della lista che corrisponde.
 */
export function matchVoiceCommand(transcript) {
  const normalized = normalize(transcript);
  const match = VOICE_COMMANDS.find(cmd => cmd.patterns.some(p => normalized.includes(p)));
  return match ? match.action : null;
}