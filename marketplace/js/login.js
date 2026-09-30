import { login, getToken } from './api.js';

// Se c'è già un token salta il login e va alla scelta del museo
if (getToken()) {
  window.location.href = 'museums';
}

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

/*
 * Alla conferma del form:
 * 1. Disabilita il pulsante e nasconde l'errore precedente.
 * 2. Chiama login() e, se va a buon fine, va alla scelta del museo.
 * 3. Se fallisce mostra il messaggio d'errore. In ogni caso alla fine riabilita il pulsante.
 */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Accesso in corso…';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    // login() salva già il token (vedi api.js), qui non serve il valore restituito
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
