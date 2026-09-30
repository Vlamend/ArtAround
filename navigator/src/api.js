// URL del backend: si può cambiare con la variabile d'ambiente VITE_API_BASE
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

// Chiave del localStorage in cui si salva il JWT
const TOKEN_KEY = 'artaround_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/*
 * Funzione base per tutte le chiamate al backend.
 * 1. Aggiunge l'header Authorization se nel localStorage c'è un token.
 * 2. Aggiunge Content-Type JSON solo se la richiesta ha un body.
 * 3. Se la risposta non è ok lancia un Error con il messaggio del server
 * (campo "error"), altrimenti usa "Errore <status>".
 * 4. Restituisce il JSON della risposta, o null se il corpo è vuoto.
 */
async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Errore ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function getMuseums() {
  return request('/museums');
}

export function getMuseumById(id) {
  return request(`/museums/${id}`);
}

export function getVisits(museumId) {
  return request(`/visits?museum=${museumId}`);
}

export function getMyVisits(museumId) {
  return request(`/visits/mine?museum=${museumId}`);
}

export function getVisitById(id) {
  return request(`/visits/${id}`);
}

export function getMe() {
  return request('/users/protected-route');
}

// Registra un nuovo utente e salva il token. Dal Navigator ci si registra sempre come visitatore.
export async function signup(username, email, password) {
  const role = 'visitatore'
  const data = await request('/users/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, role })
  });
  setToken(data.token);
  return data.user;
}

// Effettua il login e salva il token. Il backend vuole { email, password }, non lo username.
export async function login(email, password) {
  const data = await request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  return data.user;
}

export function logout() {
  clearToken();
}

// Aggiorna le preferenze dell'utente (livello linguistico e pesi di interesse), usato dalla pagina Impostazioni.
export function updateMe(payload) {
  return request('/users/protected-route', { method: 'PUT', body: JSON.stringify(payload) });
}

export function getConfig() {
  return request('/config');
}

export function getMuseumBySlug(slug) {
  return request(`/museums/slug/${slug}`);
}

// Dettaglio di un autore/stile con tutte le varianti di durata del testo.
// Servono ai topic 'artista' e 'stile' di "dimmi di più".
export function getAuthorById(id) {
  return request(`/authors/${id}`);
}

export function getStyleById(id) {
  return request(`/styles/${id}`);
}

// Ricerca dei Content in base ai parametri passati (es. { artwork: id }).
// Il Navigator scarica tutti i Content di un'opera con una sola chiamata e poi li filtra lui.
export function getItems(params = {}) {
  const qs = new URLSearchParams(params);
  return request(`/items?${qs.toString()}`);
}

// Registra il feedback dell'utente su un Content (direction: 'up' o 'down').
// Il server aggiorna di conseguenza i pesi di interesse dell'utente.
export function giveFeedback(itemId, direction) {
  return request(`/items/${itemId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ direction })
  });
}

// Segna la visita come completata per l'utente autenticato
export function completeVisit(visitId) {
  return request(`/visits/${visitId}/complete`, { method: 'POST' });
}