const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

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

export function getVisitById(id) {
  return request(`/visits/${id}`);
}

export function getMe() {
  return request('/users/protected-route');
}

// authController.login si aspetta { email, password }, non { username, password }
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

// Aggiorna le preferenze dell'utente (livello linguistico, lingua
// interfaccia, punteggi di interesse) - usato dalla pagina Impostazioni.
export function updateMe(payload) {
  return request('/users/protected-route', { method: 'PUT', body: JSON.stringify(payload) });
}

export function getConfig() {
  return request('/config');
}

export function getMuseumBySlug(slug) {
  return request(`/museums/slug/${slug}`);
}

// Cerca item "related" (autore, stile, ecc.) collegati tramite lo
// stesso identificatore Wikidata dell'item corrente. Usata per
// "Chi è l'autore" / "Qual è lo stile" nel player.
export function getRelatedItems({ museum, artistWikidata, styleWikidata }) {
  const params = new URLSearchParams({ type: 'related' });
  if (museum) params.set('museum', museum);
  if (artistWikidata) params.set('artistWikidata', artistWikidata);
  if (styleWikidata) params.set('styleWikidata', styleWikidata);
  return request(`/items?${params.toString()}`);
}

// Ricerca item generica, usata anche per trovare varianti linguistiche
// dello stesso oggetto (stesso wikidataId, language diverso) da
// proporre in base a preferredLanguageLevel dell'utente.
export function getItems(params = {}) {
  const qs = new URLSearchParams(params);
  return request(`/items?${qs.toString()}`);
}

// Registra il feedback 👍/👎 dell'utente su un item, aggiornando i suoi
// punteggi di interesse per ambito.
export function giveFeedback(itemId, direction) {
  return request(`/items/${itemId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ direction })
  });
}

// Segna la visita come completata per l'utente autenticato.
export function completeVisit(visitId) {
  return request(`/visits/${visitId}/complete`, { method: 'POST' });
}