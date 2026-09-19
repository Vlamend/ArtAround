import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVisitById, getMe, getItems, giveFeedback, completeVisit } from '../api.js';
import { useVoiceCommands } from '../useVoiceCommands.js';
import { matchVoiceCommand } from '../voiceCommands.js';
import { DOMAIN_LABELS, LANGUAGE_ORDER, buildTopicQueue, buildFrames, firstFrameIndexForDomain, pickText, pickBaseItem } from '../topics.js';
import MuseumMap from '../components/MuseumMap.jsx';
import './NavigatorPlayer.css';

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

  // Sincronizzazione vocale: evita letture spurie o anticipate durante i caricamenti di rete
  useEffect(() => {
    if (itemLoading || topicsLoading) return;
    if (currentText) speak(currentText.content);
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

  // 🔍 LOG DI DEBUG IN CONSOLE PER IL TESTING
  useEffect(() => {
    if (itemLoading) {
      console.log(`⏳ [DEBUG] Caricamento dei content per l'opera: "${currentArtwork?.title}"`);
      return;
    }
    console.group("🎨 [DEBUG] Cambio di Stato / Tappa Museale");
    console.log("📌 Titolo Opera  :", currentArtwork?.title);
    console.log("🆔 ID Artwork    :", currentArtwork?._id);
    console.log("🌐 Lingua Target :", targetLanguage);
    console.log("📄 Item Mostrato :", displayedItem ? {
      id: displayedItem._id,
      language: displayedItem.language,
      hasTexts: !!displayedItem.texts
    } : "❌ NESSUNO (In attesa o errore)");
    console.log("💬 Frame Corrente:", currentFrame ? { tipo: currentFrame.type, tier: currentFrame.tier, index: frameIndex } : "Nessuno");
    console.log("📝 Anteprima Testo:", currentText ? `"${currentText.content.substring(0, 50)}..."` : "Nessun testo");
    console.groupEnd();
  }, [displayedItem, currentText, itemLoading, currentArtwork, targetLanguage, currentFrame, frameIndex]);

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

  function makeSimpler() {
    const idx = LANGUAGE_ORDER.indexOf(targetLanguage);
    if (idx > 0) setLanguageOverride(LANGUAGE_ORDER[idx - 1]);
  }

  function makeHarder() {
    const idx = LANGUAGE_ORDER.indexOf(targetLanguage);
    if (idx !== -1 && idx < LANGUAGE_ORDER.length - 1) setLanguageOverride(LANGUAGE_ORDER[idx + 1]);
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

  if (status === 'loading') return <div className="screen"><p className="status-message">Caricamento visita…</p></div>;
  if (status === 'error') return <div className="screen"><p className="error-message">Non riesco a caricare la visita.</p></div>;
  if (!visit?.steps?.length) return <div className="screen"><p className="status-message">Questa visita non ha ancora contenuti.</p></div>;

  const roomName = visit.museum?.rooms?.find(r => r._id === currentArtwork?.roomId)?.name;
  const hasAuthorTopic = topicQueue.some(t => t.domain === 'artista');
  const hasStyleTopic = topicQueue.some(t => t.domain === 'stile');

  return (
    <div className="screen player-screen">
      <Link to="/visits" className="back-link">&larr; Cambia visita</Link>

      <div className="plaque">
        <span className="plaque-step">Tappa {stepIndex + 1} di {visit.steps.length}</span>
        {roomName && <span className="plaque-room">{roomName}</span>}
      </div>

      <div className="item-card">
        {/* Visualizzazione immediata e stabile dell'artwork dello step corrente */}
        <h1>{currentArtwork?.title}</h1>
        {currentArtwork?.year && <p className="item-meta">{currentArtwork.year}{currentArtwork.technique ? ` ${currentArtwork.technique}` : ''}</p>}
        
        {itemLoading ? (
          <p className="item-text status-message">Adattamento testo in corso…</p>
        ) : (
          <>
            {displayedItem && (
              <p className="swap-note">Livello linguistico: {displayedItem.language}{languageOverride ? ' (regolato manualmente)' : ' (dal tuo profilo)'}.</p>
            )}
            {currentTopic && (
              <p className="topic-note">{DOMAIN_LABELS[currentTopic.domain] ?? currentTopic.title} — {currentTopic.title}</p>
            )}
            <p className="item-text">{currentText?.content ?? 'Nessun testo disponibile per questo livello.'}</p>
          </>
        )}

        <div className="feedback-row">
          <span className="status-message">Ti interessa questo contenuto?</span>
          <button
            className={feedbackGiven === 'up' ? 'feedback-btn feedback-btn-active' : 'feedback-btn'}
            onClick={() => handleFeedback('up')}
            aria-label="Interessante"
            disabled={itemLoading}
          >👍</button>
          <button
            className={feedbackGiven === 'down' ? 'feedback-btn feedback-btn-active' : 'feedback-btn'}
            onClick={() => handleFeedback('down')}
            aria-label="Non interessante"
            disabled={itemLoading}
          >👎</button>
        </div>
      </div>

      {currentStep?.logisticNote && (
        <p className="logistic-note">{currentStep.logisticNote}</p>
      )}

      <div className="controls">
        {voiceSupported && (
          <div className="voice-row">
            <button
              className={isListening ? 'mic-button mic-button-listening' : 'mic-button'}
              onClick={startListening}
              disabled={isListening || itemLoading}
            >
              {isListening ? 'In ascolto…' : '\u{1F3A4} Parla'}
            </button>
            {lastHeard && (
              <p className={lastHeard.recognized ? 'voice-feedback' : 'voice-feedback voice-feedback-unrecognized'}>
                Hai detto: «{lastHeard.transcript}»
                {!lastHeard.recognized && ' — comando non riconosciuto'}
              </p>
            )}
            {voiceError && (
              <p className="voice-feedback voice-feedback-unrecognized">
                {voiceErrorMessage(voiceError)}
              </p>
            )}
          </div>
        )}
        <div className="controls-row">
          <button onClick={goPrev} disabled={stepIndex === 0 || itemLoading}>Precedente</button>
          <button onClick={goNext} disabled={stepIndex === visit.steps.length - 1 || itemLoading}>Prossimo</button>
        </div>
        <div className="controls-row">
          <button onClick={tellLess} disabled={frameIndex === 0 || itemLoading}>Dimmi di meno</button>
          <button onClick={tellMore} disabled={frameIndex >= frames.length - 1 || topicsLoading || itemLoading}>Dimmi di più</button>
        </div>
        <div className="controls-row">
          <button onClick={makeSimpler} disabled={currentFrame?.type !== 'base' || LANGUAGE_ORDER.indexOf(targetLanguage) <= 0 || itemLoading}>Non capisco</button>
          <button onClick={makeHarder} disabled={currentFrame?.type !== 'base' || LANGUAGE_ORDER.indexOf(targetLanguage) >= LANGUAGE_ORDER.length - 1 || itemLoading}>Troppo semplice</button>
        </div>
        <div className="controls-row">
          <button onClick={() => speak(currentText?.content)} disabled={itemLoading}>Ripeti</button>
          <button onClick={() => setShowPoi(v => !v)}>Dove...?</button>
        </div>
        <div className="controls-row">
          <button onClick={() => jumpToDomain('artista')} disabled={!hasAuthorTopic || itemLoading}>Chi è l'autore</button>
          <button onClick={() => jumpToDomain('stile')} disabled={!hasStyleTopic || itemLoading}>Qual è lo stile</button>
        </div>
        <div className="controls-row">
          <button onClick={() => setShowMap(v => !v)}>Mappa</button>
        </div>
      </div>

      {showPoi && (
        <div className="poi-panel">
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