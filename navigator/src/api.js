// Base URL del backend. In sviluppo punta al server locale (npm start
// nella cartella backend, porta 3000 di default); in produzione va
// configurata secondo l'hostname reale del container sul dipartimento.
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
  return res.json();
}

export function getMuseums() {
  return request('/museums');
}

export function getMuseumById(id) {
  return request(`/museums/${id}`);
}

export function getMuseumBySlug(slug) {
  return request(`/museums/slug/${slug}`);
}

export function getVisits(museumId) {
  return request(`/visits?museum=${museumId}`);
}

export function getVisitById(id) {
  return request(`/visits/${id}`);
}

export function getConfig() {
  return request('/config');
}

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

export function getMe() {
  return request('/users/protected-route');
}

export function getRelatedItems({ museum, artistWikidata, styleWikidata }) {
  const params = new URLSearchParams({ type: 'related' });
  if (museum) params.set('museum', museum);
  if (artistWikidata) params.set('artistWikidata', artistWikidata);
  if (styleWikidata) params.set('styleWikidata', styleWikidata);
  return request(`/items?${params.toString()}`);
}