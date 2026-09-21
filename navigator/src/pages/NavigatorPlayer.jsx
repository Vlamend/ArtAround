import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVisitById, getMe, getItems, giveFeedback, completeVisit } from '../api.js';
import { useVoiceCommands } from '../useVoiceCommands.js';
import { matchVoiceCommand } from '../voiceCommands.js';
import { DOMAIN_LABELS, LANGUAGE_ORDER, buildTopicQueue, buildFrames, firstFrameIndexForDomain, pickText, pickBaseItem } from '../topics.js';
import MuseumMap from '../components/MuseumMap.jsx';

export default function NavigatorPlayer() {
  const { visitId } = useParams();
  const [visit, setVisit] = useState(null);
  const [status, setStatus] = useState('loading');
  const [stepIndex, setStepIndex] = useState(0);
  const [showPoi, setShowPoi] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [lastHeard, setLastHeard] = useState(null);

  const [user, setUser] = useState(null);
  // Tutti i Content dell'artwork corrente, scaricati in UNA sola
  // richiesta per tappa (non più una per lingua): da qui si sceglie
  // sia il testo di base sia i topic, senza ulteriori round-trip di
  // rete quando cambia solo la lingua richiesta.
  const [artworkItems, setArtworkItems] = useState([]);
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);

  // Livello linguistico voluto per questa tappa
  const [languageOverride, setLanguageOverride] = useState(null);

  // Coda dei topic per l'opera corrente e sequenza di frame
  const [topicQueue, setTopicQueue] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Caricamento iniziale della visita
  useEffect(() => {
    getVisitById(visitId)
      .then(data => {
        setVisit(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [visitId]);

  // Caricamento del profilo utente per la personalizzazione. Se non
  // c'è un utente autenticato, il livello linguistico target ricade
  // su 'medio' (vedi targetLanguage sotto) — la visita non ha più un
  // livello proprio, si adatta sempre a chi la esegue.
  useEffect(() => {
    getMe()
      .then(data => setUser(data.user))
      .catch(() => setUser(null));
  }, []);
  const currentStep = visit?.steps?.[stepIndex];
  const currentArtwork = currentStep?.artwork;

  // Reset degli stati di feedback e scostamento lingua al cambio tappa
  useEffect(() => {
    setFeedbackGiven(null);
    setLanguageOverride(null);
  }, [stepIndex]);

  const targetLanguage = languageOverride ?? user?.preferredLanguageLevel ?? 'medio';

  // Un'unica richiesta di rete per tappa: tutti i Content dell'artwork
  // corrente, senza filtro di lingua. Da qui in poi la scelta di quale
  // testo mostrare (pickBaseItem, sotto) è puramente sincrona — cambiare
  // lingua con "non capisco"/"troppo semplice" non richiede più
  // ricaricare nulla dalla rete.
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

  // Scelta sincrona del testo di base tra i Content già scaricati:
  // preferisce quelli senza domini taggati (un content taggato
  // 'materiali'/'storia'/ecc. è un approfondimento per il "dimmi di
  // più" a topic, non il testo principale) e la lingua più vicina a
  // quella target — vedi topics.js per il dettaglio del criterio.
  const displayedItem = useMemo(
    () => pickBaseItem(artworkItems, targetLanguage),
    [artworkItems, targetLanguage]
  );

  // Livelli linguistici REALMENTE disponibili per la narrazione di
  // base di quest'opera (stesso pool di pickBaseItem: content senza
  // domini taggati, o tutti se nessuno è senza domini). Serve per
  // "non capisco"/"troppo semplice": senza questo, il passo successivo
  // si calcolerebbe su targetLanguage (il livello RICHIESTO) invece
  // che su displayedItem.language (il livello REALMENTE mostrato) — e
  // se un fallback è già scattato (l'opera non ha quella lingua), i
  // due valori divergono: si può ricalcolare lo stesso identico testo
  // già in mostra, che è esattamente il "si ripete" notato.
  const availableBaseLanguages = useMemo(() => {
    const generalItems = artworkItems.filter(i => !i.domains || i.domains.length === 0);
    const pool = generalItems.length > 0 ? generalItems : artworkItems;
    return new Set(pool.map(i => i.language));
  }, [artworkItems]);

  // Ricostruisce la coda dei topic sugli stessi Content già scaricati
  // per questa tappa — nessuna richiesta di rete propria per i topic
  // "artista"/"stile" a parte, che restano fetch dedicate (Author/Style
  // non sono Content, vivono in collezioni separate).
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
  const frames = useMemo(
    () => buildFrames(visit?.pace ?? '15s', topicQueue),
    [visit?.pace, topicQueue]
  );
  const currentFrame = frames[Math.min(frameIndex, frames.length - 1)];
  const currentTopic = currentFrame?.type === 'topic' ? topicQueue[currentFrame.topicIndex] : null;
  const currentText = useMemo(() => {
    if (currentFrame?.type === 'topic' && currentTopic) {
      return pickText(currentTopic.texts, currentFrame.tier);
    }
    return pickText(displayedItem?.texts, currentFrame?.tier ?? 1);
  }, [currentFrame, currentTopic, displayedItem]);
  const speak = useCallback((text) => {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  }, []);
  // Sincronizzazione vocale: evita letture spurie o anticipate durante
  // i caricamenti di rete. lastSpokenRef evita un secondo effetto
  // secondario del refactor di prima: topicsLoading si accende e si
  // spegne ad ogni cambio di lingua anche quando il testo finale non
  // cambia (es. il fallback ricade sullo stesso content) — senza
  // questo controllo, lo spegnimento di topicsLoading da solo
  // rilancerebbe una seconda lettura dello stesso identico testo.
  const lastSpokenRef = useRef(null);
  useEffect(() => {
    if (itemLoading || topicsLoading) return;
    if (!currentText) return;
    if (lastSpokenRef.current === currentText.content) return;
    lastSpokenRef.current = currentText.content;
    speak(currentText.content);
    return () => window.speechSynthesis?.cancel();
  }, [currentText, speak, itemLoading, topicsLoading]);
  // Registrazione del completamento della visita museale
  useEffect(() => {
    if (!visit || hasMarkedComplete) return;
    if (stepIndex === visit.steps.length - 1) {
      completeVisit(visitId).catch(() => {});
      setHasMarkedComplete(true);
    }
  }, [stepIndex, visit, visitId, hasMarkedComplete]);
  function goNext() {
    if (!visit) return;
    setStepIndex(i => Math.min(i + 1, visit.steps.length - 1));
  }
  function goPrev() {
    setStepIndex(i => Math.max(i - 1, 0));
  }
  function tellMore() {
    setFrameIndex(i => Math.min(i + 1, frames.length - 1));
  }
  function tellLess() {
    setFrameIndex(i => Math.max(i - 1, 0));
  }
  // "Non capisco" / "Troppo semplice": il passo si calcola sul livello
  // REALMENTE mostrato (displayedItem.language), non su targetLanguage
  // — e salta i livelli per cui questa specifica opera non ha nessuna
  // variante, altrimenti impostare un livello "vuoto" farebbe ricadere
  // pickBaseItem di nuovo sullo stesso identico testo già in mostra.
  function makeSimpler() {
    const currentIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (availableBaseLanguages.has(LANGUAGE_ORDER[i])) {
        setLanguageOverride(LANGUAGE_ORDER[i]);
        return;
      }
    }
  }
  function makeHarder() {
    const currentIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
    for (let i = currentIdx + 1; i < LANGUAGE_ORDER.length; i++) {
      if (availableBaseLanguages.has(LANGUAGE_ORDER[i])) {
        setLanguageOverride(LANGUAGE_ORDER[i]);
        return;
      }
    }
  }
  function jumpToStep(i) {
    setStepIndex(i);
    setShowMap(false);
  }
  function jumpToDomain(domain) {
    const idx = firstFrameIndexForDomain(frames, topicQueue, domain);
    if (idx !== -1) setFrameIndex(idx);
  }
  async function handleFeedback(direction) {
    if (!displayedItem?._id) return;
    setFeedbackGiven(direction);
    try {
      await giveFeedback(displayedItem._id, direction);
    } catch {
      setFeedbackGiven(null);
    }
  }
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
  function handleTranscript(transcript) {
    const action = matchVoiceCommand(transcript);
    setLastHeard({ transcript, recognized: !!action });
    runVoiceAction(action);
  }
  const { isSupported: voiceSupported, isListening, error: voiceError, start: startListening } = useVoiceCommands(handleTranscript);

  if (status === 'loading') return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-slate-500 dark:text-slate-400">Caricamento visita…</p></div>;
  if (status === 'error') return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-red-600 dark:text-red-400">Non riesco a caricare la visita.</p></div>;
  if (!visit?.steps?.length) return <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4"><p className="text-sm text-slate-500 dark:text-slate-400">Questa visita non ha ancora contenuti.</p></div>;

  const currentLangIdx = LANGUAGE_ORDER.indexOf(displayedItem?.language ?? targetLanguage);
  const canGoSimpler = [...availableBaseLanguages].some(l => LANGUAGE_ORDER.indexOf(l) < currentLangIdx);
  const canGoHarder = [...availableBaseLanguages].some(l => LANGUAGE_ORDER.indexOf(l) > currentLangIdx);
  const roomName = visit.museum?.rooms?.find(r => r._id === currentArtwork?.roomId)?.name;
  const hasAuthorTopic = topicQueue.some(t => t.domain === 'artista');
  const hasStyleTopic = topicQueue.some(t => t.domain === 'stile');
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-neutral-900 dark:text-white px-4 py-6 md:px-8">
      <Link to="/visits" className="inline-flex items-center mb-6 text-sm font-medium text-slate-700 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded">&larr; Cambia visita</Link>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Tappa {stepIndex + 1} di {visit.steps.length}</span>
        {roomName && <span className="text-sm text-slate-500 dark:text-slate-400">{roomName}</span>}
      </div>
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 md:p-7">
        {/* Visualizzazione immediata e stabile dell'artwork dello step corrente */}
        <h1>{currentArtwork?.title}</h1>
        {currentArtwork?.year && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentArtwork.year}{currentArtwork.technique ? ` ${currentArtwork.technique}` : ''}</p>}
        {itemLoading ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Adattamento testo in corso…</p>
        ) : (
          <>
            {displayedItem && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Livello linguistico: {displayedItem.language}{languageOverride ? ' (regolato manualmente)' : ' (dal tuo profilo)'}.</p>
            )}
            {currentTopic && (
              <p className="mt-2 text-sm font-medium text-violet-700 dark:text-violet-400">{DOMAIN_LABELS[currentTopic.domain] ?? currentTopic.title} — {currentTopic.title}</p>
            )}
            <p className="mt-4 text-base leading-7 text-slate-800 dark:text-slate-200">{currentText?.content ?? 'Nessun testo disponibile per questo livello.'}</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-neutral-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">Ti interessa questo contenuto?</span>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 ${feedbackGiven === 'up' ? 'ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-950' : ''}`}
            onClick={() => handleFeedback('up')}
            aria-label="Interessante"
            disabled={itemLoading}
          >👍</button>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 ${feedbackGiven === 'down' ? 'ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-950' : ''}`}
            onClick={() => handleFeedback('down')}
            aria-label="Non interessante"
            disabled={itemLoading}
          >👎</button>
        </div>
      </div>
      {currentStep?.logisticNote && (
        <p className="mx-auto mt-4 w-full max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{currentStep.logisticNote}</p>
      )}
      <div className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-3">
        {voiceSupported && (
          <div className="flex flex-col gap-2 rounded-lg border items-center border-slate-200 bg-slate-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
            <button
              className={`inline-flex w-fit items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-700'}`}
              onClick={startListening}
              disabled={isListening || itemLoading}
            >
              {isListening ? 'In ascolto…' : '🎤 Parla'}
            </button>
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
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={goPrev} disabled={stepIndex === 0 || itemLoading}>Precedente</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={goNext} disabled={stepIndex === visit.steps.length - 1 || itemLoading}>Prossimo</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={tellLess} disabled={frameIndex === 0 || itemLoading}>Dimmi di meno</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={tellMore} disabled={frameIndex >= frames.length - 1 || topicsLoading || itemLoading}>Dimmi di più</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={makeSimpler} disabled={currentFrame?.type !== 'base' || !canGoSimpler || itemLoading}>Non capisco</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={makeHarder} disabled={currentFrame?.type !== 'base' || !canGoHarder || itemLoading}>Troppo semplice</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={() => speak(currentText?.content)} disabled={itemLoading}>Ripeti</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={() => setShowPoi(v => !v)}>Dove...?</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={() => jumpToDomain('artista')} disabled={!hasAuthorTopic || itemLoading}>Chi è l'autore</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={() => jumpToDomain('stile')} disabled={!hasStyleTopic || itemLoading}>Qual è lo stile</button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700" onClick={() => setShowMap(v => !v)}>Mappa</button>
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
        />
      )}
    </div>
  );
}

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