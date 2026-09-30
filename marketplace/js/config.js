/*
 * URL del backend usato da tutte le chiamate del marketplace.
 * Il marketplace è in vanilla JS senza bundler, quindi l'URL si sceglie qui e non con variabili d'ambiente.
 * 1. In sviluppo, con le pagine servite da un altro server locale (es. Live Server
 * su una porta diversa da 3000 e 8000), il backend è su http://localhost:3000.
 * 2. Se le pagine sono servite dal backend stesso o da un dominio, l'URL è relativo ("/api").
 */
const host = window.location.hostname;
const isLocalDevServer =
  (host === 'localhost' || host === '127.0.0.1') &&
  !['3000', '8000'].includes(window.location.port);

export const API_BASE = isLocalDevServer ? 'http://localhost:3000/api' : '/api';
