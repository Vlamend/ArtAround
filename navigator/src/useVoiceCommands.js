import { useCallback, useRef, useState } from 'react';

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/*
 * Hook che gestisce il riconoscimento vocale del browser (tap-to-talk).
 * Quando l'utente parla, chiama onTranscript con il testo riconosciuto.
 * Restituisce { isSupported, isListening, error, start }.
 * Non tutti i browser supportano SpeechRecognition (alcune versioni di
 * Firefox e Safari no): chi usa l'hook deve controllare isSupported prima
 * di mostrare il pulsante del microfono.
 */
export function useVoiceCommands(onTranscript) {
  const [isListening, setIsListening] = useState(false);
  // Codice dell'ultimo errore del riconoscimento (es. 'not-allowed', 'no-speech', 'network')
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const isSupported = !!SpeechRecognitionImpl;

  const start = useCallback(() => {
    if (!isSupported || isListening) return;
    setError(null);

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'it-IT';
    recognition.continuous = false; // si ferma dopo una frase: un comando per volta
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