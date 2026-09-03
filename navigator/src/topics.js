import { getAuthorById, getStyleById, getItems } from './api.js';

// Stessi 5 tier di durata usati in tutto lo schema (textEntry).
export const DURATION_ORDER = ['3s', '15s', '40s', '1min', '4min'];

// I 4 livelli linguistici, dal più semplice al più complesso — asse
// indipendente dalla durata: "non capisco"/"troppo semplice" si
// muovono su questa scala, "dimmi di più/meno" sull'altra.
export const LANGUAGE_ORDER = ['infantile', 'elementare', 'medio', 'specialistico'];

// Vocabolario dei 5 domini, condiviso con User.interestWeights e
// Content.domains. L'ordine qui è solo lo spareggio a parità di peso.
export const DOMAINS = ['artista', 'stile', 'storia', 'materiali', 'architettura'];

export const DOMAIN_LABELS = {
  artista: "L'autore",
  stile: 'Lo stile',
  storia: 'La storia',
  materiali: 'I materiali',
  architettura: "L'architettura"
};

// Peso -> tier di partenza. Pesi positivi scalano verso testi più
// lunghi quanto più l'interesse è marcato; pesi nulli o negativi
// partono sempre dal tier minimo (non c'è verso ovvio in cui un
// interesse negativo dovrebbe accorciare ulteriormente un testo già
// al minimo consentito dallo schema).
export function startTierIndexForWeight(weight) {
  if (weight <= 0) return 0; // 3s
  if (weight <= 2) return 1; // 15s
  if (weight <= 4) return 2; // 40s
  if (weight <= 6) return 3; // 1min
  return 4; // 7-10 -> 4min
}

// Dato un array di textEntry disponibili e un tier "desiderato",
// sceglie il testo più vicino: prima cerca al tier esatto, poi scende
// verso tier più corti, poi sale verso tier più lunghi. Ritorna null
// se l'array è vuoto.
export function pickText(texts, tierIndex) {
  if (!texts || texts.length === 0) return null;
  const byDuration = new Map(texts.map(t => [DURATION_ORDER.indexOf(t.duration), t]));

  for (let t = tierIndex; t >= 0; t--) {
    if (byDuration.has(t)) return byDuration.get(t);
  }
  for (let t = tierIndex + 1; t < DURATION_ORDER.length; t++) {
    if (byDuration.has(t)) return byDuration.get(t);
  }
  return null;
}

// Costruisce la coda dei topic per l'artwork corrente, ordinata per
// interestWeights decrescente (i pesi negativi restano in coda, non
// vengono esclusi). Ogni voce include solo i tier per cui esiste
// davvero un testo, a partire dal tier iniziale dettato dal peso, così
// "dimmi di più" non produce mai una pressione a vuoto.
//
// artista -> Author.bio, stile -> Style.description, gli altri tre
// domini -> Content taggato su questo artwork (gratuito, non un
// acquisto separato: vedi la scelta di rimuovere il tipo 'related').
export async function buildTopicQueue(artwork, interestWeights = {}, options = {}) {
  if (!artwork) return [];
  const { excludeItemId = null, preferredLanguage = null } = options;

  const ordered = DOMAINS
    .map(domain => ({ domain, weight: interestWeights[domain] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);

  const extraDomains = ordered
    .map(o => o.domain)
    .filter(d => d !== 'artista' && d !== 'stile');

  let extraContents = [];
  if (extraDomains.length > 0) {
    try {
      extraContents = await getItems({ artwork: artwork._id, domains: extraDomains.join(',') });
    } catch {
      extraContents = [];
    }
    // Il testo base (quello già in lettura come step corrente) non è
    // un "approfondimento": va escluso, altrimenti "dimmi di più" può
    // ripresentare esattamente lo stesso content appena letto, solo
    // sotto etichetta diversa. Tra i candidati rimasti, se ce n'è più
    // di uno per lo stesso dominio, si preferisce quello nella lingua
    // dell'utente — altrimenti si salterebbe di registro linguistico
    // in modo silenzioso rispetto al testo base appena mostrato.
    extraContents = extraContents.filter(c => c._id !== excludeItemId);
  }

  function pickContentForDomain(domain) {
    const candidates = extraContents.filter(c => c.domains?.includes(domain));
    if (candidates.length === 0) return null;
    if (preferredLanguage) {
      const sameLanguage = candidates.find(c => c.language === preferredLanguage);
      if (sameLanguage) return sameLanguage;
    }
    return candidates[0];
  }

  const queue = [];

  for (const { domain, weight } of ordered) {
    let title = DOMAIN_LABELS[domain];
    let texts = null;

    if (domain === 'artista' && artwork.author?._id) {
      try {
        const author = await getAuthorById(artwork.author._id);
        title = author.name;
        texts = author.bio;
      } catch { /* nessun contenuto disponibile per questo topic su quest'opera */ }
    } else if (domain === 'stile' && artwork.style?._id) {
      try {
        const style = await getStyleById(artwork.style._id);
        title = style.name;
        texts = style.description;
      } catch { /* nessun contenuto disponibile per questo topic su quest'opera */ }
    } else if (domain !== 'artista' && domain !== 'stile') {
      const match = pickContentForDomain(domain);
      texts = match?.texts ?? null;
    }

    if (!texts || texts.length === 0) continue; // topic non disponibile per quest'opera, si salta

    const start = startTierIndexForWeight(weight);
    const availableTiers = texts
      .map(t => DURATION_ORDER.indexOf(t.duration))
      .filter(t => t >= 0)
      .sort((a, b) => a - b);

    const tiers = availableTiers.filter(t => t >= start);
    // Se nessun tier disponibile è >= al tier di partenza (es. il topic
    // ha solo un 3s ma il peso vorrebbe partire da 4min), si mostra
    // comunque il tier più lungo disponibile, invece di saltare
    // interamente un topic per cui l'utente ha mostrato interesse.
    const finalTiers = tiers.length > 0 ? tiers : [Math.max(...availableTiers)];

    queue.push({ domain, weight, title, texts, tiers: finalTiers });
  }

  return queue;
}

// Sequenza piatta di "frame" da attraversare con dimmi di più/meno:
// [ base@pace, topic0@tier..., topic0@tier_max, topic1@tier..., ... ]
// Un solo indice intero (frameIndex) governa tutta la navigazione.
export function buildFrames(pace, topicQueue) {
  const frames = [{ type: 'base', tier: Math.max(0, DURATION_ORDER.indexOf(pace)) }];

  topicQueue.forEach((topic, topicIndex) => {
    topic.tiers.forEach(tier => {
      frames.push({ type: 'topic', topicIndex, tier });
    });
  });

  return frames;
}

// Trova il primo frame che apre un dato topic (per gli shortcut
// "Chi è l'autore" / "Qual è lo stile", che saltano direttamente al
// topic indicato scavalcando l'ordine per peso).
export function firstFrameIndexForDomain(frames, topicQueue, domain) {
  const topicIndex = topicQueue.findIndex(t => t.domain === domain);
  if (topicIndex === -1) return -1;
  return frames.findIndex(f => f.type === 'topic' && f.topicIndex === topicIndex);
}