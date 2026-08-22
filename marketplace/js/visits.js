import { requireAuth } from './auth-guard.js';
import { getMuseumById, getVisits, deleteVisit } from './api.js';

const titleEl = document.getElementById('museum-title');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('visit-list');

let museumId;
let currentUser;

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  museumId = params.get('museum');

  if (!museumId) {
    window.location.href = 'museums';
    return; // valido qui: siamo dentro una funzione, non a livello di modulo
  }

  currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  document.getElementById('new-visit-btn').addEventListener('click', () => {
    window.location.href = `visit-editor?museum=${museumId}`;
  });

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `Visite — ${museum.name}`;
  } catch {
    titleEl.textContent = 'Visite';
  }

  await loadVisits();
}

async function loadVisits() {
  statusEl.hidden = false;
  statusEl.className = 'status-message';
  statusEl.textContent = 'Caricamento visite…';
  listEl.innerHTML = '';

  try {
    // includeMine: mostra anche le proprie visite non ancora pubbliche
    // (bozze), non solo quelle già pubblicate come nel Navigator.
    const visits = await getVisits(museumId, { includeMine: true });

    if (visits.length === 0) {
      statusEl.textContent = 'Nessuna visita per questo museo. Creane una nuova.';
      return;
    }

    statusEl.hidden = true;
    for (const visit of visits) {
      listEl.appendChild(renderVisitCard(visit));
    }
  } catch {
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare le visite. Riprova più tardi.';
  }
}

function renderVisitCard(visit) {
  const id = `${visit._id}`;
  const li = document.createElement('li');
  li.className = 'card';
  li.id = id;

  const isMine = visit.author?._id === currentUser.id;

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${visit.title}</strong>
    ${!visit.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">${visit.steps?.length ?? 0} tappe ${visit.price ? `· ${visit.price}€` : '· gratuita'}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (isMine) {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', () => {
      window.location.href = `visit-editor?id=${id}`;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Elimina';
    deleteBtn.addEventListener('click', () => handleDelete(visit));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  } else {
    const badge = document.createElement('span');
    badge.className = 'status-message';
    badge.textContent = `di ${visit.author?.username ?? 'altro autore'}`;
    actions.appendChild(badge);
  }

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

async function handleDelete(visit) {
  if (!window.confirm(`Eliminare la visita "${visit.title}"? L'operazione non è reversibile.`)) {
    return;
  }
  try {
    await deleteVisit(visit._id);
    await loadVisits();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}