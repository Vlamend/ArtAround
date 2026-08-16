import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVisitById, getRelatedItems } from '../api.js';
import { useVoiceCommands } from '../useVoiceCommands.js';
import { matchVoiceCommand } from '../voiceCommands.js';
import MuseumMap from '../components/MuseumMap.jsx';
import './NavigatorPlayer.css';

// Ordine dal più breve al più lungo, per "dimmi di più" / "dimmi di meno"
const DURATION_ORDER = ['3s', '15s', '40s', '1min', '4min'];

export default function NavigatorPlayer() {
  const { visitId } = useParams();
  const [visit, setVisit] = useState(null);
  const [status, setStatus] = useState('loading');
  const [stepIndex, setStepIndex] = useState(0);
  const [durationLevel, setDurationLevel] = useState(1); // indice in DURATION_ORDER, parte da '15s'
  const [showPoi, setShowPoi] = useState(false);
  const [showMap, setShowMap] = useState(false);
  // { kind: 'author'|'style', status: 'loading'|'ready'|'empty'|'error', item }
  const [relatedPanel, setRelatedPanel] = useState(null);
  // { transcript, recognized } - feedback dell'ultimo comando vocale
  const [lastHeard, setLastHeard] = useState(null);

  useEffect(() => {
    getVisitById(visitId)
      .then(data => {
        setVisit(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [visitId]);

  const currentStep = visit?.steps?.[stepIndex];
  const currentItem = currentStep?.item;

  // Testo disponibile più vicino al livello di dettaglio richiesto
  const currentText = useMemo(() => {
    if (!currentItem?.texts?.length) return null;
    const wanted = DURATION_ORDER[durationLevel];
    const exact = currentItem.texts.find(t => t.duration === wanted);
    if (exact) return exact;
    // fallback: il testo disponibile più vicino nell'ordine di durata
    return currentItem.texts[0];
  }, [currentItem, durationLevel]);

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

  function goNext() {
    if (!visit) return;
    setDurationLevel(1);
    setStepIndex(i => Math.min(i + 1, visit.steps.length - 1));
  }

  function goPrev() {
    setDurationLevel(1);
    setStepIndex(i => Math.max(i - 1, 0));
  }

  function tellMore() {
    setDurationLevel(l => Math.min(l + 1, DURATION_ORDER.length - 1));
  }

  function tellLess() {
    setDurationLevel(l => Math.max(l - 1, 0));
  }

  function jumpToStep(i) {
    setDurationLevel(1);
    setStepIndex(i);
    setShowMap(false);
  }

  async function showRelated(kind) {
    const wikidataKey = kind === 'author' ? currentItem?.artistWikidata : currentItem?.styleWikidata;

    setShowPoi(false);
    setShowMap(false);
    setRelatedPanel({ kind, status: 'loading', item: null });

    if (!wikidataKey) {
      setRelatedPanel({ kind, status: 'empty', item: null });
      return;
    }

    try {
      const results = await getRelatedItems({
        museum: visit.museum?._id,
        artistWikidata: kind === 'author' ? wikidataKey : undefined,
        styleWikidata: kind === 'style' ? wikidataKey : undefined
      });

      const found = results[0] ?? null;
      setRelatedPanel({ kind, status: found ? 'ready' : 'empty', item: found });
      if (found?.texts?.[0]?.content) speak(found.texts[0].content);
    } catch {
      setRelatedPanel({ kind, status: 'error', item: null });
    }
  }

  // Esegue l'azione corrispondente al comando vocale riconosciuto,
  // riusando esattamente le stesse funzioni già collegate ai bottoni
  // equivalenti (nessuna logica duplicata tra i due canali di input).
  function runVoiceAction(action) {
    switch (action) {
      case 'next': goNext(); break;
      case 'prev': goPrev(); break;
      case 'repeat': speak(currentText?.content); break;
      case 'more': tellMore(); break;
      case 'less': tellLess(); break;
      case 'author': showRelated('author'); break;
      case 'style': showRelated('style'); break;
      case 'poi': setShowPoi(true); setShowMap(false); break;
      case 'map': setShowMap(v => !v); setShowPoi(false); break;
      default: break; // non riconosciuto: gestito solo tramite lastHeard nell'interfaccia
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

  const roomName = visit.museum?.rooms?.find(r => r._id === currentItem?.roomId)?.name;

  return (
    <div className="screen player-screen">
      <Link to="/visits" className="back-link">&larr; Cambia visita</Link>

      {/* Elemento firma: targhetta stile bronzo museale */}
      <div className="plaque">
        <span className="plaque-step">Tappa {stepIndex + 1} di {visit.steps.length}</span>
        {roomName && <span className="plaque-room">{roomName}</span>}
      </div>

      <div className="item-card">
        <h1>{currentItem?.title}</h1>
        {currentItem?.year && <p className="item-meta">{currentItem.year}{currentItem.technique ? ` · ${currentItem.technique}` : ''}</p>}
        <p className="item-text">{currentText?.content ?? 'Nessun testo disponibile per questo livello.'}</p>
      </div>

      {currentStep?.logisticNote && (
        <p className="logistic-note">{currentStep.logisticNote}</p>
      )}

      {/* Comandi equivalenti al vocabolario vocale controllato */}
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
          <button onClick={tellLess} disabled={durationLevel === 0}>Dimmi di meno</button>
          <button onClick={tellMore} disabled={durationLevel === DURATION_ORDER.length - 1}>Dimmi di più</button>
        </div>
        <div className="controls-row">
          <button onClick={() => speak(currentText?.content)}>Ripeti</button>
          <button onClick={() => setShowPoi(v => !v)}>Dove...?</button>
        </div>
        <div className="controls-row">
          <button onClick={() => showRelated('author')} disabled={!currentItem?.artistWikidata}>Chi è l'autore</button>
          <button onClick={() => showRelated('style')} disabled={!currentItem?.styleWikidata}>Qual è lo stile</button>
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

      {relatedPanel && (
        <div className="related-panel">
          <div className="related-panel-header">
            <h2>{relatedPanel.kind === 'author' ? 'Autore' : 'Stile'}</h2>
            <button className="related-panel-close" onClick={() => setRelatedPanel(null)} aria-label="Chiudi">×</button>
          </div>

          {relatedPanel.status === 'loading' && <p className="status-message">Ricerca in corso…</p>}
          {relatedPanel.status === 'error' && <p className="error-message">Non riesco a recuperare questa informazione ora.</p>}
          {relatedPanel.status === 'empty' && (
            <p className="status-message">
              {relatedPanel.kind === 'author'
                ? "Nessuna informazione aggiuntiva sull'autore è disponibile per quest'opera."
                : 'Nessuna informazione aggiuntiva sullo stile è disponibile per quest\'opera.'}
            </p>
          )}
          {relatedPanel.status === 'ready' && relatedPanel.item && (
            <>
              <h3>{relatedPanel.item.title}</h3>
              <p className="item-text">{relatedPanel.item.texts?.[0]?.content}</p>
            </>
          )}
        </div>
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