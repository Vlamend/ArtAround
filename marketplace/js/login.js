import { login, getToken } from './api.js';

// Se già autenticato, salta direttamente alla selezione museo
if (getToken()) {
  window.location.href = 'museums';
}

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Accesso in corso…';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    // login() salva già il token internamente (vedi api.js) e
    // restituisce l'utente autenticato, non il token grezzo.
    await login(email, password);
    window.location.href = 'museums';
  } catch (err) {
    errorEl.textContent = err.message || 'Credenziali non valide.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Accedi';
  }
});
