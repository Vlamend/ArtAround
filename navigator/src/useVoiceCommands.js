import { useCallback, useRef, useState } from 'react';

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// Non tutti i browser supportano SpeechRecognition (in particolare
// alcune versioni di Firefox e Safari): il chiamante deve controllare
// isSupported e nascondere/disabilitare il pulsante microfono di
// conseguenza, non dare per scontato che sia sempre disponibile.
export function useVoiceCommands(onTranscript) {
  const [isListening, setIsListening] = useState(false);
  // Motivo dell'ultimo errore (es. 'not-allowed', 'no-speech',
  // 'network'...), non più fallimento silenzioso.
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const isSupported = !!SpeechRecognitionImpl;

  const start = useCallback(() => {
    if (!isSupported || isListening) return;
    setError(null);

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'it-IT';
    recognition.continuous = false; // un comando per volta (tap-to-talk)
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setIsListening(false);
      setError(event.error || 'unknown');
      console.error('SpeechRecognition error:', event.error);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setError(err.name || 'start-failed');
      console.error('SpeechRecognition start() failed:', err);
    }
  }, [isSupported, isListening, onTranscript]);

  return { isSupported, isListening, error, start };
}