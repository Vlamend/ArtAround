import { login, getToken, setToken } from './api.js';

// Se già autenticato, salta direttamente alla selezione museo
if (getToken()) {
  window.location.href = 'museums.html';
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
    await login(email, password);
    window.location.href = 'museums.html';
  } catch (err) {
    errorEl.textContent = err.message || 'Credenziali non valide.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Accedi';
  }
});
