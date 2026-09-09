import { API_BASE } from './config.js';

// Chiave diversa da quella usata dal Navigator: le due app, anche se
// servite sullo stesso dominio in futuro, non devono condividere la
// sessione per errore (sono due applicazioni distinte con utenti che
// potrebbero avere ruoli diversi: autore per l'editor, visitatore per
// il Navigator).
const TOKEN_KEY = 'artaround_editor_token';

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
  // Le risposte 204/DELETE possono non avere corpo JSON
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Autenticazione ----

export async function login(email, password) {
  const data = await request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token); // FONDAMENTALE: mancava, la sessione non veniva mai salvata
  return data.user;
}

export function getMe() {
  return request('/users/protected-route');
}

export function logout() {
  clearToken();
}

// ---- Musei (sola lettura per l'editor: pannello di scelta multipla) ----

export function getMuseums() {
  return request('/museums');
}

export function getMuseumById(id) {
  return request(`/museums/${id}`);
}

// ---- Visite ----

// includeMine: se true e l'utente è autenticato, include anche le
// proprie visite private/bozze (vedi backend: ?mine=true).
export function getVisits(museumId, { includeMine = false } = {}) {
  const params = new URLSearchParams({ museum: museumId });
  if (includeMine) params.set('mine', 'true');
  return request(`/visits?${params.toString()}`);
}

export function getVisitById(id) {
  return request(`/visits/${id}`);
}

export function createVisit(payload) {
  return request('/visits', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateVisit(id, payload) {
  return request(`/visits/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteVisit(id) {
  return request(`/visits/${id}`, { method: 'DELETE' });
}

// ---- Item ----

export function getItems(params = {}) {
  const qs = new URLSearchParams(params);
  return request(`/items?${qs.toString()}`);
}

export function getItemById(id) {
  return request(`/items/${id}`);
}

export function createItem(payload) {
  return request('/items', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateItem(id, payload) {
  return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteItem(id) {
  return request(`/items/${id}`, { method: 'DELETE' });
}
// NB: l'adozione/acquisizione sono ora su Artwork (sotto), non più
// per singolo content.

// ---- Artwork (l'oggetto fisico del museo: posizione, sala, autore/stile,
// e ORA anche il controllo commerciale: license/isPublic/adoptionPrice/
// acquisitionPrice/owner) ----

export function getArtworks(params = {}) {
  const qs = new URLSearchParams(params);
  return request(`/artworks?${qs.toString()}`);
}

export function getArtworkById(id) {
  return request(`/artworks/${id}`);
}

export function createArtwork(payload) {
  return request('/artworks', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateArtwork(id, payload) {
  return request(`/artworks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteArtwork(id) {
  return request(`/artworks/${id}`, { method: 'DELETE' });
}

// Adozione: licenzia l'uso non esclusivo del content nelle proprie
// visite. NON dà diritti editoriali, NON cambia il proprietario.
export function adoptArtwork(id) {
  return request(`/artworks/${id}/adopt`, { method: 'POST' });
}

// Acquisizione: trasferisce i pieni diritti editoriali (modificare
// l'opera, i suoi content, i due prezzi). Richiede ruolo autore/admin.
export function acquireArtwork(id) {
  return request(`/artworks/${id}/acquire`, { method: 'POST' });
}

// ---- Author / Style (catalogo riusabile tra opere e musei diversi) ----

export function getAuthors() {
  return request('/authors');
}

export function createAuthor(payload) {
  return request('/authors', { method: 'POST', body: JSON.stringify(payload) });
}

export function getStyles() {
  return request('/styles');
}

export function createStyle(payload) {
  return request('/styles', { method: 'POST', body: JSON.stringify(payload) });
}

// ---- Config del Navigator (solo admin può scriverla) ----

export function getConfig() {
  return request('/config');
}

export function updateConfig(payload) {
  return request('/config', { method: 'PUT', body: JSON.stringify(payload) });
}
