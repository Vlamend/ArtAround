import { getAuthorById, getStyleById } from './api.js';

// I 5 tier di durata dei testi, dal più breve al più lungo (gli stessi di textEntry nel backend).
export const DURATION_ORDER = ['3s', '15s', '40s', '1min', '4min'];

// I 4 livelli linguistici, dal più semplice al più complesso.
// È un asse separato dalla durata: "non capisco" / "troppo semplice"
// si muovono su questa scala, "dimmi di più" / "dimmi di meno" su quella delle durate.
export const LANGUAGE_ORDER = ['infantile', 'elementare', 'medio', 'specialistico'];

// I 5 domini di interesse, gli stessi di User.interestWeights e Content.domains.
// A parità di peso vale l'ordine di questo array.
export const DOMAINS = ['artista', 'stile', 'storia', 'materiali', 'architettura'];

export const DOMAIN_LABELS = {
  artista: "L'autore",
  stile: 'Lo stile',
  storia: 'La storia',
  materiali: 'I materiali',
  architettura: "L'architettura"
};

/*
 * Restituisce l'indice del tier di durata da cui partire per un dato peso di interesse.
 * Più il peso è alto, più il testo iniziale è lungo:
 * peso <= 0 -> 3s, 1-2 -> 15s, 3-4 -> 40s, 5-6 -> 1min, 7-10 -> 4min.
 * I pesi negativi partono comunque dal tier minimo, che è già il più corto possibile.
 */
export function startTierIndexForWeight(weight) {
  if (weight <= 0) return 0; // 3s
  if (weight <= 2) return 1; // 15s
  if (weight <= 4) return 2; // 40s
  if (weight <= 6) return 3; // 1min
  return 4; // 7-10 -> 4min
}

/*
 * Sceglie il testo più adatto al tier richiesto tra quelli disponibili.
 * 1. Se non ci sono testi ritorna null.
 * 2. Cerca il tier esatto e, se non c'è, scende verso i tier più corti.
 * 3. Se nemmeno questi esistono, sale verso i tier più lunghi.
 */
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

/*
 * Sceglie tra i Content quello con la lingua più vicina a quella richiesta.
 * Stesso criterio di pickText, applicato ai livelli linguistici invece che alle durate:
 * prima la lingua esatta, poi quelle più semplici, infine quelle più complesse.
 * Se la lingua richiesta non è valida si parte dal livello più semplice.
 */
function pickNearestLanguage(items, targetLanguage) {
  if (!items || items.length === 0) return null;
  const byLanguage = new Map(items.map(i => [LANGUAGE_ORDER.indexOf(i.language), i]));
  const targetIdx = LANGUAGE_ORDER.indexOf(targetLanguage);
  const start = targetIdx === -1 ? 0 : targetIdx;

  for (let l = start; l >= 0; l--) {
    if (byLanguage.has(l)) return byLanguage.get(l);
  }
  for (let l = start + 1; l < LANGUAGE_ORDER.length; l++) {
    if (byLanguage.has(l)) return byLanguage.get(l);
  }
  return null;
}

/*
 * Sceglie il Content da usare come testo principale della tappa.
 * 1. Si tengono i Content senza domini, perché quelli con un dominio
 * (materiali, storia, ...) servono come approfondimento per "dimmi di più".
 * 2. Se non ce ne sono, si usano tutti i Content disponibili.
 * 3. Dal gruppo scelto si prende quello con la lingua più vicina a quella richiesta.
 * La distinzione base/approfondimento è dedotta dai domini, non c'è un campo apposito nello schema.
 */
export function pickBaseItem(items, targetLanguage) {
  if (!items || items.length === 0) return null;
  const generalItems = items.filter(i => !i.domains || i.domains.length === 0);
  const pool = generalItems.length > 0 ? generalItems : items;
  return pickNearestLanguage(pool, targetLanguage);
}

/*
 * Costruisce la coda dei topic (gli approfondimenti) dell'opera corrente.
 * 1. Ordina i 5 domini per peso di interesse decrescente. I pesi negativi
 * finiscono in fondo alla coda ma non vengono esclusi.
 * 2. Recupera i testi di ogni dominio:
 *    - artista: la bio dell'Author (richiesta al server)
 *    - stile: la descrizione dello Style (richiesta al server)
 *    - gli altri tre: i Content dell'opera taggati con quel dominio,
 *      presi da 'items' che è già stato scaricato dal chiamante.
 * 3. Salta i domini senza testi e, per gli altri, tiene solo i tier
 * per cui esiste un testo, partendo da quello dato dal peso.
 * Ogni voce della coda ha la forma { domain, weight, title, texts, tiers }.
 * Opzioni: excludeItemId è il Content già mostrato come testo base,
 * preferredLanguage è la lingua da preferire quando un dominio ha più Content.
 */
export async function buildTopicQueue(artwork, interestWeights = {}, items = [], options = {}) {
  if (!artwork) return [];
  const { excludeItemId = null, preferredLanguage = null } = options;

  const ordered = DOMAINS
    .map(domain => ({ domain, weight: interestWeights[domain] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);

  const extraDomains = ordered
    .map(o => o.domain)
    .filter(d => d !== 'artista' && d !== 'stile');

  // Content di approfondimento: quelli taggati con almeno uno dei tre
  // domini che vengono dai Content. Si esclude il testo base già mostrato,
  // altrimenti "dimmi di più" lo riproporrebbe con un'etichetta diversa.
  const extraContents = items
    .filter(c => c.domains?.some(d => extraDomains.includes(d)))
    .filter(c => c._id !== excludeItemId);

  // Tra i Content di un dominio preferisce quello nella lingua dell'utente,
  // così un approfondimento non cambia livello linguistico rispetto al testo base.
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
      } catch { /* la richiesta è fallita: il topic viene saltato più sotto */ }
    } else if (domain === 'stile' && artwork.style?._id) {
      try {
        const style = await getStyleById(artwork.style._id);
        title = style.name;
        texts = style.description;
      } catch { /* la richiesta è fallita: il topic viene saltato più sotto */ }
    } else if (domain !== 'artista' && domain !== 'stile') {
      const match = pickContentForDomain(domain);
      texts = match?.texts ?? null;
    }

    if (!texts || texts.length === 0) continue; // nessun testo per questo topic, lo salto

    const start = startTierIndexForWeight(weight);
    const availableTiers = texts
      .map(t => DURATION_ORDER.indexOf(t.duration))
      .filter(t => t >= 0)
      .sort((a, b) => a - b);

    const tiers = availableTiers.filter(t => t >= start);
    // Se nessun tier arriva al tier di partenza (es. c'è solo il 3s ma il peso
    // chiede 4min) si usa il più lungo disponibile, così il topic non sparisce.
    const finalTiers = tiers.length > 0 ? tiers : [Math.max(...availableTiers)];

    queue.push({ domain, weight, title, texts, tiers: finalTiers });
  }

  return queue;
}

/*
 * Costruisce la sequenza di "frame" che l'utente percorre con "dimmi di più" / "dimmi di meno".
 * Il primo frame è il testo base alla durata 'pace' della visita, poi ci sono
 * i frame di ogni topic, uno per ciascun tier, in ordine crescente:
 * [ base, topic0@tierA, topic0@tierB, topic1@tierA, ... ]
 * Basta un solo indice (frameIndex) per sapere cosa mostrare.
 */
export function buildFrames(pace, topicQueue) {
  const frames = [{ type: 'base', tier: Math.max(0, DURATION_ORDER.indexOf(pace)) }];

  topicQueue.forEach((topic, topicIndex) => {
    topic.tiers.forEach(tier => {
      frames.push({ type: 'topic', topicIndex, tier });
    });
  });

  return frames;
}

// Trova l'indice del primo frame di un dominio, oppure -1 se il dominio non è in coda.
// Serve ai pulsanti "Chi è l'autore" e "Qual è lo stile", che saltano direttamente a quel topic.
export function firstFrameIndexForDomain(frames, topicQueue, domain) {
  const topicIndex = topicQueue.findIndex(t => t.domain === domain);
  if (topicIndex === -1) return -1;
  return frames.findIndex(f => f.type === 'topic' && f.topicIndex === topicIndex);
}