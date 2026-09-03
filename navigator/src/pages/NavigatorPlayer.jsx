import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVisitById, getMe, getItems, giveFeedback, completeVisit } from '../api.js';
import { useVoiceCommands } from '../useVoiceCommands.js';
import { matchVoiceCommand } from '../voiceCommands.js';
import { DOMAIN_LABELS, LANGUAGE_ORDER, buildTopicQueue, buildFrames, firstFrameIndexForDomain, pickText } from '../topics.js';
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
  const [displayedItem, setDisplayedItem] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);

  // Livello linguistico "voluto per questa tappa": parte dal profilo
  // (o dalla lingua scelta dal curatore, se l'utente non ha un
  // profilo), ma "non capisco"/"troppo semplice" possono spostarlo
  // per la tappa corrente senza toccare il profilo permanente
  // dell'utente. null = "usa il default", si azzera ad ogni nuova
  // tappa così il default del profilo torna a valere sulla prossima
  // opera anche se qui lo si era scostato.
  const [languageOverride, setLanguageOverride] = useState(null);

  // Coda dei topic (artista/stile/storia/materiali/architettura,
  // ordinati per interesse dell'utente) per l'opera corrente, e
  // sequenza piatta di frame da attraversare con "dimmi di più/meno".
  const [topicQueue, setTopicQueue] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [topicsLoading, setTopicsLoading] = useState(false);

  useEffect(() => {
    getVisitById(visitId)
      .then(data => {
        setVisit(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [visitId]);

  useEffect(() => {
    getMe()
      .then(data => setUser(data.user))
      .catch(() => setUser(null)); // se fallisce, semplicemente niente personalizzazione
  }, []);

  const currentStep = visit?.steps?.[stepIndex];
  const currentItem = currentStep?.item;

  // Nuova tappa: si riparte dal default di profilo, un eventuale
  // scostamento manuale fatto sulla tappa precedente non si porta dietro.
  useEffect(() => {
    setFeedbackGiven(null);
    setLanguageOverride(null);
  }, [currentItem]);

  const targetLanguage = languageOverride ?? user?.preferredLanguageLevel ?? currentItem?.language ?? null;

  // Adattamento al livello linguistico: se esiste, per la stessa opera
  // (stesso artwork._id), una variante nella lingua target (profilo,
  // oppure lo scostamento manuale corrente), la si mostra al posto di
  // quella scelta dal curatore.
  useEffect(() => {
    if (!currentItem) {
      setDisplayedItem(null);
      return;
    }

    const artworkId = currentItem.artwork?._id;
    if (!targetLanguage || !artworkId || currentItem.language === targetLanguage) {
      setDisplayedItem(currentItem);
      return;
    }

    // Adattamento al profilo linguistico: getItems filtra già lato
    // server le varianti accessibili (gratuite o possedute) — non
    // c'è più bisogno di controllare qui prezzo/proprietario, perché
    // license/isPublic/price/owner vivono sull'Artwork condiviso da
    // tutte le sue varianti linguistiche: non può più capitare che
    // una variante nella lingua richiesta sia "a pagamento e non
    // pagata" mentre quella originale dello step non lo è.
    let cancelled = false;
    getItems({ artwork: artworkId, language: targetLanguage })
      .then(variants => {
        if (cancelled) return;
        setDisplayedItem(variants[0] ?? currentItem);
      })
      .catch(() => {
        if (!cancelled) setDisplayedItem(currentItem);
      });

    return () => { cancelled = true; };
  }, [currentItem, targetLanguage]);

  // Ricostruisce la coda dei topic ogni volta che si cambia opera (o
  // arrivano/cambiano i pesi di interesse dell'utente), e riparte
  // sempre dal testo generale (frame 0).
  useEffect(() => {
    const artwork = displayedItem?.artwork;
    if (!artwork) {
      setTopicQueue([]);
      setFrameIndex(0);
      return;
    }

    let cancelled = false;
    setTopicsLoading(true);
    buildTopicQueue(artwork, user?.interestWeights ?? {}, {
      excludeItemId: displayedItem?._id,
      preferredLanguage: targetLanguage ?? displayedItem?.language
    })
      .then(queue => {
        if (cancelled) return;
        setTopicQueue(queue);
        setFrameIndex(0);
      })
      .finally(() => { if (!cancelled) setTopicsLoading(false); });

    return () => { cancelled = true; };
  }, [displayedItem?.artwork?._id, user?.interestWeights]);

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

  useEffect(() => {
    if (currentText) speak(currentText.content);
    return () => window.speechSynthesis?.cancel();
  }, [currentText, speak]);

  // Segna la visita come completata al raggiungimento dell'ultimo step
  // (adattamento "è la prima volta o sono già venuto?").
  useEffect(() => {
    if (!visit || hasMarkedComplete) return;
    if (stepIndex === visit.steps.length - 1) {
      completeVisit(visitId).catch(() => {}); // non bloccante: se fallisce, non impedisce la visita
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

  // "Dimmi di più": avanza di un frame nella sequenza base -> topic
  // preferito (a un tier proporzionale all'interesse) -> via via più
  // lungo -> topic successivo per interesse, e così via. I topic a
  // interesse negativo restano in coda, non vengono esclusi.
  function tellMore() {
    setFrameIndex(i => Math.min(i + 1, frames.length - 1));
  }

  // "Dimmi di meno": stesso percorso a ritroso.
  function tellLess() {
    setFrameIndex(i => Math.max(i - 1, 0));
  }

  // "Non capisco" / "Troppo semplice": asse diverso da dimmi di
  // più/meno, agiscono sul LIVELLO LINGUISTICO invece che sulla
  // lunghezza. Solo sul testo generale (frame 'base'): le bio di
  // Author/Style non hanno varianti di lingua, e i topic sui domini
  // extra restano fuori scope per ora — si applica dove il curatore
  // ha effettivamente scelto una lingua, cioè sul testo dell'opera.
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

  // Shortcut "Chi è l'autore" / "Qual è lo stile": saltano direttamente
  // all'inizio di quel topic nella sequenza di frame, scavalcando
  // l'ordine per interesse ma restando sulla stessa scala di tier.
  function jumpToDomain(domain) {
    const idx = firstFrameIndexForDomain(frames, topicQueue, domain);
    if (idx !== -1) setFrameIndex(idx);
  }

  async function handleFeedback(direction) {
    if (!displayedItem?._id) return;
    setFeedbackGiven(direction); // ottimistico: aggiorna subito l'interfaccia
    try {
      await giveFeedback(displayedItem._id, direction);
    } catch {
      setFeedbackGiven(null); // rollback se la richiesta fallisce
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

  const artwork = displayedItem?.artwork;
  const roomName = visit.museum?.rooms?.find(r => r._id === artwork?.roomId)?.name;
  const wasSwapped = displayedItem && currentItem && displayedItem._id !== currentItem._id;
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
        <h1>{artwork?.title}</h1>
        {artwork?.year && <p className="item-meta">{artwork.year}{artwork.technique ? ` · ${artwork.technique}` : ''}</p>}
        {wasSwapped && (
          <p className="swap-note">Livello linguistico: {displayedItem.language}{languageOverride ? ' (regolato manualmente)' : ' (dal tuo profilo)'}.</p>
        )}
        {currentTopic && (
          <p className="topic-note">{DOMAIN_LABELS[currentTopic.domain] ?? currentTopic.title} — {currentTopic.title}</p>
        )}
        <p className="item-text">{currentText?.content ?? 'Nessun testo disponibile per questo livello.'}</p>

        <div className="feedback-row">
          <span className="status-message">Ti interessa questo contenuto?</span>
          <button
            className={feedbackGiven === 'up' ? 'feedback-btn feedback-btn-active' : 'feedback-btn'}
            onClick={() => handleFeedback('up')}
            aria-label="Interessante"
          >👍</button>
          <button
            className={feedbackGiven === 'down' ? 'feedback-btn feedback-btn-active' : 'feedback-btn'}
            onClick={() => handleFeedback('down')}
            aria-label="Non interessante"
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
              disabled={isListening}
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
          <button onClick={goPrev} disabled={stepIndex === 0}>Precedente</button>
          <button onClick={goNext} disabled={stepIndex === visit.steps.length - 1}>Prossimo</button>
        </div>
        <div className="controls-row">
          <button onClick={tellLess} disabled={frameIndex === 0}>Dimmi di meno</button>
          <button onClick={tellMore} disabled={frameIndex >= frames.length - 1 || topicsLoading}>Dimmi di più</button>
        </div>
        <div className="controls-row">
          <button onClick={makeSimpler} disabled={currentFrame?.type !== 'base' || LANGUAGE_ORDER.indexOf(targetLanguage) <= 0}>Non capisco</button>
          <button onClick={makeHarder} disabled={currentFrame?.type !== 'base' || LANGUAGE_ORDER.indexOf(targetLanguage) >= LANGUAGE_ORDER.length - 1}>Troppo semplice</button>
        </div>
        <div className="controls-row">
          <button onClick={() => speak(currentText?.content)}>Ripeti</button>
          <button onClick={() => setShowPoi(v => !v)}>Dove...?</button>
        </div>
        <div className="controls-row">
          <button onClick={() => jumpToDomain('artista')} disabled={!hasAuthorTopic}>Chi è l'autore</button>
          <button onClick={() => jumpToDomain('stile')} disabled={!hasStyleTopic}>Qual è lo stile</button>
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