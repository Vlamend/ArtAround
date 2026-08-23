import { requireAuth } from './auth-guard.js';
import { getMuseumById, getItems, deleteItem } from './api.js';

let museumId;
let currentUser;

const titleEl = document.getElementById('museum-title');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('item-list');
const backLink = document.getElementById('back-link');

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  museumId = params.get('museum');

  if (!museumId) {
    window.location.href = 'museums';
    return;
  }

  currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  backLink.href = `visits?museum=${museumId}`;

  document.getElementById('new-item-btn').addEventListener('click', () => {
    window.location.href = `item-editor?museum=${museumId}`;
  });

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `I tuoi contenuti — ${museum.name}`;
  } catch {
    titleEl.textContent = 'I tuoi contenuti';
  }

  await loadItems();
}

async function loadItems() {
  statusEl.hidden = false;
  statusEl.className = 'status-message';
  statusEl.textContent = 'Caricamento contenuti…';
  listEl.innerHTML = '';

  try {
    // Solo i propri contenuti (bozze incluse): questa pagina è per la
    // gestione, non per la consultazione del marketplace pubblico.
    const items = await getItems({ museum: museumId, mine: 'true' });

    if (items.length === 0) {
      statusEl.textContent = 'Non hai ancora creato contenuti per questo museo.';
      return;
    }

    statusEl.hidden = true;
    for (const item of items) {
      listEl.appendChild(renderItemCard(item));
    }
  } catch {
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare i contenuti. Riprova più tardi.';
  }
}

function renderItemCard(item) {
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${item.title}</strong>
    ${!item.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">${item.type} · ${item.language} · ${item.texts?.length ?? 0} testi</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Modifica';
  editBtn.addEventListener('click', () => {
    window.location.href = `item-editor?id=${item._id}`;
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Elimina';
  deleteBtn.addEventListener('click', () => handleDelete(item));

  actions.append(editBtn, deleteBtn);
  li.append(info, actions);
  return li;
}

async function handleDelete(item) {
  if (!window.confirm(`Eliminare "${item.title}"? L'operazione non è reversibile.`)) {
    return;
  }
  try {
    await deleteItem(item._id);
    await loadItems();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare il contenuto.');
  }
}
