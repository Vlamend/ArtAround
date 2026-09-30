import { requireAuth } from './auth-guard.js';
import { listUsers, createAuthorUser } from './api.js';

const statusEl = document.getElementById('status');
const errorEl = document.getElementById('form-error');
const form = document.getElementById('author-form');
const submitBtn = document.getElementById('submit-btn');
const listEl = document.getElementById('author-list');
const listStatusEl = document.getElementById('list-status');

main();

/*
 * Pagina di gestione degli account autore (solo admin).
 * 1. Verifica il login con requireAuth.
 * 2. Se l'utente non è admin nasconde form e lista e mostra un messaggio.
 * 3. Altrimenti attiva il form di creazione e carica l'elenco degli autori.
 */
async function main() {
  const currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  // Come per la config: il server protegge già le route, ma un non-admin non deve nemmeno vedere il form
  if (currentUser.role !== 'admin') {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Solo un admin può gestire gli account autore.';
    form.hidden = true;
    listStatusEl.hidden = true;
    return;
  }

  form.addEventListener('submit', handleSubmit);
  await loadAuthors();
}

// Scarica gli account con ruolo autore e li mostra in un elenco
async function loadAuthors() {
  try {
    const users = await listUsers('autore');
    listEl.replaceChildren();
    listStatusEl.textContent = users.length ? '' : 'Nessun autore presente.';
    listStatusEl.hidden = users.length > 0;

    for (const user of users) {
      const li = document.createElement('li');
      // Si usa textContent perché username ed email li scrivono gli utenti
      li.textContent = `${user.username} — ${user.email}`;
      listEl.appendChild(li);
    }
  } catch (err) {
    listStatusEl.hidden = false;
    listStatusEl.textContent = err.message || 'Impossibile caricare gli autori.';
  }
}

/*
 * Alla conferma del form:
 * 1. Controlla che username ed email siano compilati.
 * 2. Crea l'account autore. Se la password è vuota il server usa quella di default.
 * 3. Mostra l'esito, svuota il form e ricarica l'elenco.
 */
async function handleSubmit(e) {
  e.preventDefault();
  errorEl.hidden = true;
  statusEl.hidden = true;

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !email) {
    errorEl.textContent = 'Username ed email sono obbligatori.';
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creazione…';

  try {
    const payload = { username, email };
    if (password) payload.password = password;

    const { user, usedDefaultPassword } = await createAuthorUser(payload);

    statusEl.hidden = false;
    statusEl.className = 'status-message';
    statusEl.textContent = usedDefaultPassword
      ? `Account "${user.username}" creato con la password di default (12345678).`
      : `Account "${user.username}" creato.`;

    form.reset();
    await loadAuthors();
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile creare l\'account.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crea account autore';
  }
}
