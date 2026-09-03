// Rimuove accenti e punteggiatura per rendere il confronto robusto a
// piccole variazioni di trascrizione (es. "dov'è" vs "dove e").
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Vocabolario controllato: ogni voce della lista comandi delle
// specifiche ("Prossimo, precedente, Cos'è questo, dimmi di più,
// dimmi di meno, Non capisco, troppo semplice, Chi è l'autore, qual è
// lo stile, Dov'è l'uscita/la toilette/il bar/lo shop, ci sono
// ostacoli") mappata a un'azione. Corrispondenza per sottostringa
// dopo normalizzazione, non comprensione del linguaggio naturale
// libero (quella è l'estensione 18-33 con LLM, fuori scope qui).
const VOICE_COMMANDS = [
  { patterns: ['prossimo', 'avanti'], action: 'next' },
  { patterns: ['precedente', 'indietro'], action: 'prev' },
  { patterns: ['cose questo', 'cosa e questo', 'ripeti'], action: 'repeat' },
  { patterns: ['dimmi di piu'], action: 'more' },
  { patterns: ['dimmi di meno'], action: 'less' },
  // Asse diverso da "dimmi di più/meno" (che agisce sulla durata):
  // questi due agiscono sul LIVELLO LINGUISTICO del testo (infantile
  // -> elementare -> medio -> specialistico), non sulla sua lunghezza.
  { patterns: ['non capisco', 'troppo difficile'], action: 'simpler' },
  { patterns: ['troppo semplice'], action: 'harder' },
  { patterns: ['chi e lautore', 'chi e l autore'], action: 'author' },
  { patterns: ['qual e lo stile', 'che stile e'], action: 'style' },
  {
    patterns: [
      'dove e luscita', 'dove e l uscita',
      'dove e la toilette', 'dove sono i bagni',
      'dove e il bar', 'dove e lo shop',
      'ci sono ostacoli', 'dove sono i servizi'
    ],
    action: 'poi'
  },
  { patterns: ['mappa', 'dove mi trovo'], action: 'map' }
];

// Restituisce l'azione riconosciuta (stringa) o null se nessun comando
// del vocabolario controllato corrisponde al testo trascritto.
export function matchVoiceCommand(transcript) {
  const normalized = normalize(transcript);
  const match = VOICE_COMMANDS.find(cmd => cmd.patterns.some(p => normalized.includes(p)));
  return match ? match.action : null;
}