import { API_BASE } from './config.js';

// Chiave del localStorage per il JWT. È diversa da quella del Navigator perché
// le due app non devono condividere la sessione, anche se servite dallo stesso dominio.
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

/*
 * Funzione base per tutte le chiamate al backend (stessa logica del Navigator).
 * 1. Aggiunge l'header Authorization se c'è un token e Content-Type JSON se c'è un body.
 * 2. Se la risposta non è ok lancia un Error con il messaggio del server (campo "error").
 * 3. Restituisce il JSON della risposta, o null se il corpo è vuoto.
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
  // Alcune risposte (es. DELETE) non hanno corpo, quindi si controlla prima che ci sia del testo
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Autenticazione ----

// Effettua il login, salva il token e restituisce l'utente
export async function login(email, password) {
  const data = await request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  return data.user;
}

export function getMe() {
  return request('/users/protected-route');
}

export function logout() {
  clearToken();
}

// ---- Musei (il marketplace li può solo leggere) ----

export function getMuseums() {
  return request('/museums');
}

export function getMuseumById(id) {
  return request(`/museums/${id}`);
}

// ---- Visite ----

// Visite del museo: le pubbliche e, se si è loggati, anche le proprie private
export function getVisits(museumId) {
  return request(`/visits?museum=${encodeURIComponent(museumId)}`);
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

// ---- Item (i Content, cioè i testi di un'opera) ----

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

// ---- Artwork (l'opera fisica del museo) ----
// Contiene posizione, sala, autore e stile, e anche i dati commerciali:
// licenza, visibilità, prezzi di adozione e acquisizione, proprietario.

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

// Adozione: dà il diritto di usare l'opera nelle proprie visite.
// Non dà il diritto di modificarla e non cambia il proprietario.
export function adoptArtwork(id) {
  return request(`/artworks/${id}/adopt`, { method: 'POST' });
}

// Acquisizione: l'utente diventa il nuovo proprietario e può modificare l'opera,
// i suoi Content e i prezzi. Richiede il ruolo autore o admin.
export function acquireArtwork(id) {
  return request(`/artworks/${id}/acquire`, { method: 'POST' });
}

// ---- Author / Style (artisti e stili, riusabili da più opere e musei) ----

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

// ---- Config del Navigator (la può modificare solo un admin) ----

export function getConfig() {
  return request('/config');
}

export function updateConfig(payload) {
  return request('/config', { method: 'PUT', body: JSON.stringify(payload) });
}

// Licenze (adozioni e acquisizioni) dell'utente loggato
export function getLicenses() {
  return request('/users/licenses');
}

// ---- Gestione account (solo admin) ----
// listUsers filtra per ruolo, createAuthorUser crea un account autore

export function listUsers(role) {
  return request(`/users${role ? `?role=${encodeURIComponent(role)}` : ''}`);
}

export function createAuthorUser(payload) {
  return request('/users', { method: 'POST', body: JSON.stringify(payload) });
}