import { requireAuth } from './auth-guard.js';
import { listUsers, createAuthorUser } from './api.js';

const statusEl = document.getElementById('status');
const errorEl = document.getElementById('form-error');
const form = document.getElementById('author-form');
const submitBtn = document.getElementById('submit-btn');
const listEl = document.getElementById('author-list');
const listStatusEl = document.getElementById('list-status');

main();

async function main() {
  const currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  // Come per la config: anche se le route sono protette lato server,
  // un non-admin non deve nemmeno vedere il form.
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

async function loadAuthors() {
  try {
    const users = await listUsers('autore');
    listEl.replaceChildren();
    listStatusEl.textContent = users.length ? '' : 'Nessun autore presente.';
    listStatusEl.hidden = users.length > 0;

    for (const user of users) {
      const li = document.createElement('li');
      // textContent: username ed email sono input degli utenti
      li.textContent = `${user.username} — ${user.email}`;
      listEl.appendChild(li);
    }
  } catch (err) {
    listStatusEl.hidden = false;
    listStatusEl.textContent = err.message || 'Impossibile caricare gli autori.';
  }
}

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
