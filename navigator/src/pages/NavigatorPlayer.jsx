import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams, Link } from 'react-router-dom';
import { getVisitById, getMe, getItems, giveFeedback, completeVisit } from '../api.js';
import { useVoiceCommands } from '../useVoiceCommands.js';
import { matchVoiceCommand } from '../voiceCommands.js';
import { DOMAIN_LABELS, LANGUAGE_ORDER, buildTopicQueue, buildFrames, firstFrameIndexForDomain, pickText, pickBaseItem } from '../topics.js';
import MuseumMap from '../components/MuseumMap.jsx';

/*
 * Pagina che esegue una visita tappa per tappa.
 * Per ogni tappa (opera) mostra il testo adatto al livello linguistico dell'utente
 * e permette di navigare con i pulsanti o con i comandi vocali:
 * tappa precedente/successiva, testo più lungo/corto, più semplice/difficile,
 * approfondimenti su autore e stile, mappa e punti di interesse.
 */
export default function NavigatorPlayer() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  // Visita caricata dal server, stato del caricamento ('loading' | 'ready' | 'error') e tappa corrente
  const [visit, setVisit] = useState(null);
  const [status, setStatus] = useState('loading');
  const [stepIndex, setStepIndex] = useState(0);
  // Pannelli aperti (punti di interesse e mappa) e ultimo comando vocale sentito
  const [showPoi, setShowPoi] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [lastHeard, setLastHeard] = useState(null);
  // Utente loggato (per livello linguistico e interessi) e tutti i Content dell'opera corrente
  const [user, setUser] = useState(null);
  const [artworkItems, setArtworkItems] = useState([]);
  // Feedback dato alla tappa corrente ('up' | 'down' | null) e se la visita è già stata segnata come completata
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);

  // Livello linguistico scelto a mano per la tappa corrente con "non capisco" / "troppo semplice".
  // Se è null vale il livello del profilo utente.
  const [languageOverride, setLanguageOverride] = useState(null);

  // Coda dei topic dell'opera corrente e posizione nella sequenza di frame
  const [topicQueue, setTopicQueue] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Carica la visita dal server (con le opere popolate)
  useEffect(() => {
    getVisitById(visitId)
      .then(data => {
        setVisit(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [visitId]);

  // Carica il profilo dell'utente per personalizzare i testi
  useEffect(() => {
    getMe()
      .then(data => setUser(data.user))
      .catch(() => setUser(null));
  }, []);
  const currentStep = visit?.steps?.[stepIndex];
  const currentArtwork = currentStep?.artwork;

  // A ogni cambio di tappa si azzerano il feedback dato e il livello linguistico scelto a mano
  useEffect(() => {
    setFeedbackGiven(null);
    setLanguageOverride(null);
  }, [stepIndex]);

  // Livello linguistico richiesto: scelta manuale, altrimenti profilo, altrimenti 'medio'
  const targetLanguage = languageOverride ?? user?.preferredLanguageLevel ?? 'medio';

  // A ogni cambio di opera scarica tutti i suoi Content con una sola richiesta.
  // Il flag cancelled evita di salvare la risposta di una tappa già abbandonata.
  useEffect(() => {
    if (!currentArtwork?._id) {
      setArtworkItems([]);
      return;
    }
    let cancelled = false;
    setItemLoading(true);
    getItems({ artwork: currentArtwork._id })
      .then(items => {
        if (!cancelled) setArtworkItems(items ?? []);
      })
      .catch(err => {
        console.error("❌ Errore nel caricamento dei content dell'opera:", err);
        if (!cancelled) setArtworkItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentArtwork?._id]);

  // Content mostrato come testo principale della tappa (criterio di scelta in pickBaseItem, topics.js)
  const displayedItem = useMemo(
    () => pickBaseItem(artworkItems, targetLanguage),
    [artworkItems, targetLanguage]
  );

  /*
   * Livelli linguistici per cui l'opera ha un testo base (stesso gruppo di Content di pickBaseItem).
   * Serve a "non capisco" e "troppo semplice" per saltare i livelli che non esistono.
   */
  const availableBaseLanguages = useMemo(() => {
    const generalItems = artworkItems.filter(i => !i.domains || i.domains.length === 0);
    const pool = generalItems.length > 0 ? generalItems : artworkItems;
    return new Set(pool.map(i => i.language));
  }, [artworkItems]);

  /*
   * Ricostruisce la coda dei topic ogni volta che cambiano opera, Content, interessi o lingua.
   * I topic sui Content usano quelli già scaricati; solo autore e stile richiedono
   * una richiesta a parte, perché Author e Style sono collezioni separate.
   * Quando la coda è pronta il frame riparte dall'inizio (testo base).
   */
  useEffect(() => {
    if (!currentArtwork?._id) {
      setTopicQueue([]);
      setFrameIndex(0);
      return;
    }
    let cancelled = false;
    setTopicsLoading(true);
    buildTopicQueue(currentArtwork, user?.interestWeights ?? {}, artworkItems, {
      excludeItemId: displayedItem?._id,
      preferredLanguage: targetLanguage
    })
      .then(queue => {
        if (cancelled) return;
        setTopicQueue(queue);
        setFrameIndex(0);
      })
      .finally(() => { if (!cancelled) setTopicsLoading(false); });
    return () => { cancelled = true; };
  }, [currentArtwork?._id, artworkItems, user?.interestWeights, displayedItem?._id, targetLanguage]);
  // Sequenza di frame della tappa, il frame corrente e il topic che sta mostrando (null se è il testo base)
  const frames = useMemo(
    () => buildFrames(visit?.pace ?? '15s', topicQueue),
    [visit?.pace, topicQueue]
  );
  const currentFrame = frames[Math.min(frameIndex, frames.length - 1)];
  const currentTopic = currentFrame?.type === 'topic' ? topicQueue[currentFrame.topicIndex] : null;
  // Testo da mostrare: quello del topic o del Content base, scelto in base al tier del frame
  const currentText = useMemo(() => {
    if (currentFrame?.type === 'topic' && currentTopic) {
      return pickText(currentTopic.texts, currentFrame.tier);
    }
    return pickText(displayedItem?.texts, currentFrame?.tier ?? 1);
  }, [currentFrame, currentTopic, displayedItem]);
  // Legge il testo ad alta voce (in italiano) interrompendo l'eventuale lettura in corso
  const speak = useCallback((text) => {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  }, []);

  // Quando si arriva all'ultima tappa segna la visita come completata (una volta sola)
  useEffect(() => {
    if (!visit || hasMarkedComplete) return;
    if (stepIndex === visit.steps.length - 1) {
      completeVisit(visitId).catch(() => { });
      setHasMarkedComplete(true);
    }
  }, [currentText]);
  // Tappa successiva. Sull'ultima tappa termina la visita e torna alla lista.
  function goNext() {
    window.speechSynthesis.cancel();
    if (!visit) return;
    if (stepIndex === visit.steps.length - 1) {
      navigate('/visits');
    } else {
      setStepIndex(i => Math.min(i + 1, visit.steps.length - 1));
    }
  }
  // Tappa precedente
  function goPrev() {
    window.speechSynthesis.cancel();
    setStepIndex(i => Math.max(i - 1, 0));
  }
  // "Dimmi di più": passa al frame successivo (testo più lungo o topic successivo)
  function tellMore() {
    window.speechSynthesis.cancel();
    setFrameIndex(i => Math.min(i + 1, frames.length - 1));
  }
  // "Dimmi di meno": torna al frame precedente
  function tellLess() {
    window.speechSynthesis.cancel();
    setFrameIndex(i => Math.max(i - 1, 0));
  }
  /*
   * "Non capisco": passa al livello linguistico più semplice per cui l'opera ha un testo.
   * 1. Parte dal livello del testo che si sta mostrando davvero, non da quello richiesto,
   * perché i due possono differire se l'opera non ha la lingua richiesta.
   * 2. Scende finché trova un livello disponibile in availableBaseLanguages.
   * 3. Se non ne trova non fa nulla.
   */
  function makeSimpler() {
    window.speechSynthesis.cancel();
    const currentIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (availableBaseLanguages.has(LANGUAGE_ORDER[i])) {
        setLanguageOverride(LANGUAGE_ORDER[i]);
        return;
      }
    }
  }
  // "Troppo semplice": come makeSimpler ma sale verso i livelli più complessi
  function makeHarder() {
    window.speechSynthesis.cancel();
    const currentIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
    for (let i = currentIdx + 1; i < LANGUAGE_ORDER.length; i++) {
      if (availableBaseLanguages.has(LANGUAGE_ORDER[i])) {
        setLanguageOverride(LANGUAGE_ORDER[i]);
        return;
      }
    }
  }
  // Salta alla tappa indicata (usato dai marker della mappa) e chiude la mappa
  function jumpToStep(i) {
    window.speechSynthesis.cancel();
    setStepIndex(i);
    setShowMap(false);
  }
  // Salta al primo frame del dominio indicato ('artista' o 'stile'), se presente in coda
  function jumpToDomain(domain) {
    window.speechSynthesis.cancel();
    const idx = firstFrameIndexForDomain(frames, topicQueue, domain);
    if (idx !== -1) setFrameIndex(idx);
  }
  // Invia il feedback al server. Se la richiesta fallisce toglie la selezione dal pulsante.
  async function handleFeedback(direction) {
    if (!displayedItem?._id) return;
    setFeedbackGiven(direction);
    try {
      await giveFeedback(displayedItem._id, direction);
    } catch {
      setFeedbackGiven(null);
    }
  }
  // Esegue l'azione associata a un comando vocale (le azioni sono definite in voiceCommands.js)
  function runVoiceAction(action) {
    switch (action) {
      case 'next': goNext(); break;
      case 'prev': goPrev(); break;
      case 'repeat': speak(currentText?.content); break;
      case 'more': tellMore(); break;
      case 'less': tellLess(); break;
      case 'simpler': makeSimpler(); break;
      case 'harder': makeHarder(); break;
      case 'author': jumpToDomain('artista'); break;
      case 'style': jumpToDomain('stile'); break;
      case 'poi': setShowPoi(true); setShowMap(false); break;
      case 'map': setShowMap(v => !v); setShowPoi(false); break;
      default: break;
    }
  }
  // Riceve la trascrizione dal riconoscimento vocale, la mostra all'utente e ne esegue il comando
  function handleTranscript(transcript) {
    const action = matchVoiceCommand(transcript);
    setLastHeard({ transcript, recognized: !!action });
    runVoiceAction(action);
  }
  const { isSupported: voiceSupported, isListening, error: voiceError, start: startListening } = useVoiceCommands(handleTranscript);

  // Schermate alternative in attesa dei dati, in caso di errore o se la visita non ha tappe
  if (status === 'loading') return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-slate-500 dark:text-slate-400">Caricamento visita…</p></div>;
  if (status === 'error') return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-red-600 dark:text-red-400">Non riesco a caricare la visita.</p></div>;
  if (!visit?.steps?.length) return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-slate-500 dark:text-slate-400">Questa visita non ha ancora contenuti.</p></div>;

  // Valori usati dal rendering: abilitazione dei pulsanti di livello, nome della sala e presenza dei topic autore/stile
  const currentLangIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
  const canGoSimpler = [...availableBaseLanguages].some(l => LANGUAGE_ORDER.indexOf(l) < currentLangIdx);
  const canGoHarder = [...availableBaseLanguages].some(l => LANGUAGE_ORDER.indexOf(l) > currentLangIdx);
  const roomName = visit.museum?.rooms?.find(r => r._id === currentArtwork?.roomId)?.name;
  const hasAuthorTopic = topicQueue.some(t => t.domain === 'artista');
  const hasStyleTopic = topicQueue.some(t => t.domain === 'stile');
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-neutral-900 dark:text-white px-4 py-6 md:px-8">
      <Link to="/visits" className="inline-flex items-center mb-6 text-sm font-medium text-slate-700 hover:text-primary dark:text-slate-300 dark:hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">&larr; Cambia visita</Link>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Tappa {stepIndex + 1} di {visit.steps.length}</span>
        {roomName && <span className="text-sm text-slate-500 dark:text-slate-400">{roomName}</span>}
      </div>
      {currentStep?.logisticNote && (
        <p className="mx-auto my-4 w-full max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{currentStep.logisticNote}</p>
      )}
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 md:p-7">
        <div className='flex justify-between'>
          <h1>{currentArtwork?.title}</h1>
          <button onClick={() => speak(currentText?.content)}
            disabled={itemLoading}
            className='cursor-pointer hover:text-primary dark:hover:text-secondary duration-150'>
            <svg
              width="26"
              height="26"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="16" cy="16" r="14" />
              <g transform="translate(3, 4)">
                <path d="M2 10v4h4l5 5V5L6 10H2z" />
                <path d="M15.5 8.5a4 4 0 0 1 0 7" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </g>
            </svg>
          </button>
        </div>
        {currentArtwork?.year && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentArtwork.year}{currentArtwork.technique ? ` ${currentArtwork.technique}` : ''}</p>}
        {itemLoading ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Adattamento testo in corso…</p>
        ) : (
          <>
            {displayedItem && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Livello linguistico: {displayedItem.language}{languageOverride ? ' (regolato manualmente)' : ' (dal tuo profilo)'}.</p>
            )}
            {currentTopic && (
              <p className="mt-2 text-sm font-medium text-primary dark:text-secondary">{DOMAIN_LABELS[currentTopic.domain] ?? currentTopic.title} — {currentTopic.title}</p>
            )}
            <p className="mt-4 text-base leading-7 text-slate-800 dark:text-slate-200">{currentText?.content ?? 'Nessun testo disponibile per questo livello.'}</p>
          </>
        )}
        <div className="flex justify-between border-t mt-6 border-slate-200 dark:border-neutral-700">
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <span className="text-sm text-slate-500 dark:text-slate-400">Ti interessa questo contenuto?</span>
            <button
              className={`cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transform transition-all duration-300 hover:bg-primary/40 hover:-translate-y-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-secondary/40 ${feedbackGiven === 'up'
                ? 'ring-2 ring-primary dark:ring-secondary bg-primary/30 dark:bg-secondary/30'
                : ''
                }`}
              onClick={() => handleFeedback('up')}
              aria-label="Interessante"
              disabled={itemLoading}
            >
              👍
            </button>

            <button
              className={`cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transform transition-all duration-300 hover:bg-primary/40 hover:translate-y-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-secondary/40 ${feedbackGiven === 'down'
                ? 'ring-2 ring-primary dark:ring-secondary bg-primary/30 dark:bg-secondary/30'
                : ''
                }`}
              onClick={() => handleFeedback('down')}
              aria-label="Non interessante"
              disabled={itemLoading}
            >
              👎
            </button>

          </div>
          <button className="enabled:cursor-pointer enabled:hover:text-primary enabled:dark:hover:text-secondary duration-150"
            onClick={startListening}
            disabled={isListening || itemLoading}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="16" cy="16" r="14" />
              <g transform="translate(6, 5)">
                <rect x="6" y="2" width="8" height="12" rx="4" />
                <path d="M2 10a8 10 0 0 0 16 0" />
                <line x1="10" y1="18" x2="10" y2="22" />
              </g>
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-3">
        {voiceSupported && (
          <div className="flex flex-col gap-2 items-center p-3">
            {lastHeard && (
              <p className={`text-sm ${lastHeard.recognized ? 'text-slate-600 dark:text-slate-400' : 'text-amber-700 dark:text-amber-400'}`}>
                Hai detto: «{lastHeard.transcript}»
                {!lastHeard.recognized && ' — comando non riconosciuto'}
              </p>
            )}
            {voiceError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {voiceErrorMessage(voiceError)}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="museum-button" onClick={goPrev} disabled={stepIndex === 0 || itemLoading}>Precedente</button>
          <button className="museum-button" onClick={goNext} disabled={itemLoading}>{stepIndex === visit.steps.length - 1 ? 'Concludi visita' : 'Prossimo'}</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="museum-button" onClick={tellLess} disabled={frameIndex === 0 || itemLoading}>Dimmi di meno</button>
          <button className="museum-button" onClick={tellMore} disabled={frameIndex >= frames.length - 1 || topicsLoading || itemLoading}>Dimmi di più</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="museum-button" onClick={makeSimpler} disabled={currentFrame?.type !== 'base' || !canGoSimpler || itemLoading}>Non capisco</button>
          <button className="museum-button" onClick={makeHarder} disabled={currentFrame?.type !== 'base' || !canGoHarder || itemLoading}>Troppo semplice</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="museum-button" onClick={() => jumpToDomain('artista')} disabled={!hasAuthorTopic || itemLoading}>Chi è l'autore</button>
          <button className="museum-button" onClick={() => jumpToDomain('stile')} disabled={!hasStyleTopic || itemLoading}>Qual è lo stile</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="museum-button" onClick={() => setShowMap(v => !v)}>Mappa</button>
          <button className="museum-button" onClick={() => setShowPoi(v => !v)}>Dove...?</button>
        </div>
      </div>
      {showPoi && (
        <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <h2>Punti di interesse</h2>
          <ul>
            {(visit.museum?.pointsOfInterest ?? []).map((poi, i) => (
              <li key={i}>{poiLabel(poi.type)}{poi.name ? ` — ${poi.name}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {showMap && (
        <MuseumMap
          steps={visit.steps}
          currentIndex={stepIndex}
          rooms={visit.museum?.rooms}
          pointsOfInterest={visit.museum?.pointsOfInterest}
          floorPlans={visit.museum?.floorPlans}
          onSelectStep={jumpToStep}
          closeMap={setShowMap}
        />
      )}
    </div>
  );
}

// Traduce il tipo di punto di interesse nel testo mostrato all'utente
function poiLabel(type) {
  const labels = {
    entrance: 'Entrata',
    exit: 'Uscita',
    emergency_exit: 'Uscita di emergenza',
    restroom: 'Toilette',
    bar: 'Bar',
    shop: 'Shop',
    elevator: 'Ascensore',
    stairs: 'Scale',
    obstacle: 'Attenzione, ostacolo'
  };
  return labels[type] || type;
}
// Traduce il codice di errore del riconoscimento vocale in un messaggio per l'utente
function voiceErrorMessage(code) {
  const messages = {
    'not-allowed': 'Permesso al microfono negato. Controlla le impostazioni del browser.',
    'no-speech': 'Non ho sentito nulla, riprova.',
    'audio-capture': 'Nessun microfono rilevato.',
    'network': 'Errore di rete durante il riconoscimento vocale.',
    'service-not-allowed': 'Il riconoscimento vocale non è consentito in questo contesto (serve HTTPS o localhost).'
  };
  return messages[code] || `Errore microfono: ${code}`;
}