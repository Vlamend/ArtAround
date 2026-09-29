// Nessun bundler qui (vanilla JS): l'URL del backend si configura a
// mano in questo unico file, invece che tramite variabili d'ambiente
// di un build tool come nel Navigator (che usa Vite).
//
// In sviluppo (Live Server o simili su localhost:<altra porta>) il backend
// è su localhost:3000; quando le pagine sono servite dal backend stesso
// (localhost:3000/8000 o il dominio del dipartimento) l'URL è relativo.
const host = window.location.hostname;
const isLocalDevServer =
  (host === 'localhost' || host === '127.0.0.1') &&
  !['3000', '8000'].includes(window.location.port);

export const API_BASE = isLocalDevServer ? 'http://localhost:3000/api' : '/api';
