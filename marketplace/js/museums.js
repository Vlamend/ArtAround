import { requireAuth } from './auth-guard.js';
import { getMuseums } from './api.js';

main();

async function main() {
  const currentUser = await requireAuth();
  if(!currentUser) {
    console.log('Utente non autenticato, redirect al login');
    return; 
  }
  const statusEl = document.getElementById('status');
  const listEl = document.getElementById('museum-list');

  try {
    const museums = await getMuseums();

    if (museums.length === 0) {
      statusEl.textContent = 'Nessun museo disponibile al momento.';
    } else {
      statusEl.hidden = true;
      for (const museum of museums) {
        listEl.appendChild(renderMuseumCard(museum));
      }
    }
  } catch (err) {
    statusEl.textContent = 'Non riesco a contattare il server. Riprova più tardi.';
    statusEl.className = 'error-message';
  }
}

function renderMuseumCard(museum) {
  const id = `${museum._id}`;
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${museum.name}</strong><br>
    <span class="status-message">${museum.city ?? ''}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'primary';
  openBtn.textContent = 'Apri';
  openBtn.addEventListener('click', () => {
    window.location.href = `visits?museum=${id}`;
  });

  actions.appendChild(openBtn);
  li.appendChild(info);
  li.appendChild(actions);
  return li;
}
