import { requireAuth } from './auth-guard.js';
import {
  getMuseumById, getItems, getArtworks, adoptArtwork, acquireArtwork,
  getVisitById, createVisit, updateVisit, deleteVisit
} from './api.js';

// Stato della pagina, popolato in main()
let mode; // 'create' | 'edit'
let museumId;
let visitId;
let currentUser;
let allItems = [];            // content GIÀ usabili (propri, licenziati, o gratuiti) — getItems li filtra già così lato server
let purchasableArtworks = []; // opere pubbliche non ancora adottate né acquisite
let steps = [];     // { itemId, title, language, type, logisticNote }

const titleEl = document.getElementById('page-title');
const statusEl = document.getElementById('status');
const backLink = document.getElementById('back-link');
const form = document.getElementById('visit-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');
const searchInput = document.getElementById('item-search');
const resultsEl = document.getElementById('item-results');
const purchasableResultsEl = document.getElementById('purchasable-results');
const paceSelect = document.getElementById('pace');
const stepsListEl = document.getElementById('steps-list');
const stepsEmptyEl = document.getElementById('steps-empty');

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  visitId = params.get('id');
  museumId = params.get('museum');

  if (!visitId && !museumId) {
    window.location.href = 'museums';
    return;
  }

  currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  mode = visitId ? 'edit' : 'create';

  if (mode === 'edit') {
    await loadExistingVisit();
  } else {
    await setupCreateMode();
  }

  await Promise.all([loadItems(), loadPurchasableArtworks()]);
  renderResults();
  renderPurchasable();
  renderSteps();

  backLink.href = `contents?museum=${museumId}`;
  form.addEventListener('submit', handleSubmit);
  searchInput.addEventListener('input', () => {
    renderResults();
    renderPurchasable();
  });
}

async function setupCreateMode() {
  titleEl.textContent = 'Nuova visita';
  submitBtn.textContent = 'Crea visita';

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `Nuova visita — ${museum.name}`;
  } catch {
    // se il museo non si carica per il titolo, non è bloccante
  }
}

async function loadExistingVisit() {
  try {
    const visit = await getVisitById(visitId);

    if (visit.author?._id !== currentUser.id) {
      statusEl.hidden = false;
      statusEl.className = 'error-message';
      statusEl.textContent = 'Non sei l\'autore di questa visita: non puoi modificarla.';
      form.hidden = true;
      return;
    }

    museumId = visit.museum?._id;
    titleEl.textContent = `Modifica — ${visit.title}`;
    submitBtn.textContent = 'Salva modifiche';
    deleteBtn.hidden = false;
    deleteBtn.addEventListener('click', handleDelete);

    document.getElementById('title').value = visit.title ?? '';
    document.getElementById('description').value = visit.description ?? '';
    document.getElementById('entrance-info').value = visit.entranceInfo ?? '';
    document.getElementById('license').value = visit.license ?? 'CC-BY';
    document.getElementById('price').value = visit.price ?? 0;
    document.getElementById('is-public').checked = !!visit.isPublic;
    document.getElementById('tags').value = (visit.tags ?? []).join(', ');
    paceSelect.value = visit.pace ?? '15s';

    steps = (visit.steps ?? []).map(s => ({
      itemId: s.item?._id,
      title: s.item?.artwork?.title ?? '(opera non trovata)',
      language: s.item?.language,
      logisticNote: s.logisticNote ?? ''
    }));
  } catch {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare questa visita.';
    form.hidden = true;
  }
}

async function loadItems() {
  try {
    // Contenuti pubblici del museo + le proprie bozze non ancora
    // pubbliche, uniti senza duplicati - il curatore deve poter
    // comporre visite sia con contenuto proprio in lavorazione sia con
    // contenuto già pubblicato di altri autori.
    const [publicItems, ownItems] = await Promise.all([
      getItems({ museum: museumId }),
      getItems({ museum: museumId, mine: 'true' })
    ]);

    const byId = new Map();
    for (const item of [...publicItems, ...ownItems]) {
      byId.set(item._id, item);
    }
    allItems = [...byId.values()];
  } catch {
    allItems = [];
  }
}

function renderResults() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allItems.filter(item => {
    const title = item.artwork?.title ?? '';
    return !query || title.toLowerCase().includes(query);
  });

  resultsEl.innerHTML = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'status-message';
    li.textContent = 'Nessun risultato.';
    resultsEl.appendChild(li);
    return;
  }

  for (const item of filtered.slice(0, 20)) { // limite per non appesantire la lista
    resultsEl.appendChild(renderItemResult(item));
  }
}

function renderItemResult(item) {
  const li = document.createElement('li');
  li.className = 'card';

  const artwork = item.artwork ?? {};
  const title = artwork.title ?? '(opera non trovata)';
  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${title}</strong><br>
    <span class="status-message">${item.language}</span>
  `;

  // Nessun controllo di accesso qui: getItems() restituisce SOLO
  // content già usabili (propri, licenziati, o gratuiti) — il server
  // ha già fatto il filtro, coerente con l'unico criterio di
  // accessibilità condiviso da Navigator e marketplace.
  const actionBtn = document.createElement('button');
  actionBtn.textContent = '+ Aggiungi';
  actionBtn.addEventListener('click', () => {
    steps.push({
      itemId: item._id,
      title,
      language: item.language,
      logisticNote: ''
    });
    renderSteps();
  });

  li.appendChild(info);
  li.appendChild(actionBtn);
  return li;
}

// Opere pubbliche non ancora usabili da questo utente (non possedute,
// non licenziate, adozione a pagamento) — il complementare esatto di
// allItems, calcolato lato server con lo stesso criterio.
async function loadPurchasableArtworks() {
  try {
    purchasableArtworks = await getArtworks({ museum: museumId, purchasable: 'true' });
  } catch {
    purchasableArtworks = [];
  }
}

function renderPurchasable() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = purchasableArtworks.filter(a => !query || a.title.toLowerCase().includes(query));

  purchasableResultsEl.innerHTML = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'status-message';
    li.textContent = 'Nessuna opera da adottare o acquisire.';
    purchasableResultsEl.appendChild(li);
    return;
  }

  for (const artwork of filtered.slice(0, 20)) { // stesso limite della lista sopra, per non appesantire
    purchasableResultsEl.appendChild(renderPurchasableCard(artwork));
  }
}

function renderPurchasableCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${artwork.title}</strong><br>
    <span class="status-message">adozione: ${artwork.adoptionPrice}€ · acquisizione: ${artwork.acquisitionPrice}€</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const adoptBtn = document.createElement('button');
  adoptBtn.textContent = `Adotta (${artwork.adoptionPrice}€)`;
  adoptBtn.addEventListener('click', () => handleAdopt(artwork, adoptBtn));
  actions.appendChild(adoptBtn);

  // Acquisire richiede ruolo autore/admin lato server (stessa
  // restrizione di chi può creare opere): il bottone non si mostra
  // nemmeno a un 'visitatore', invece di mostrarlo e farlo fallire.
  if (currentUser.role === 'autore' || currentUser.role === 'admin') {
    const acquireBtn = document.createElement('button');
    acquireBtn.textContent = `Acquisisci (${artwork.acquisitionPrice}€)`;
    acquireBtn.addEventListener('click', () => handleAcquire(artwork, acquireBtn));
    actions.appendChild(acquireBtn);
  }

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

async function handleAdopt(artwork, button) {
  button.disabled = true;
  button.textContent = 'Adozione in corso…';
  try {
    await adoptArtwork(artwork._id);
    await refreshAfterLicenseChange();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'adozione.');
    button.disabled = false;
    button.textContent = `Adotta (${artwork.adoptionPrice}€)`;
  }
}

async function handleAcquire(artwork, button) {
  button.disabled = true;
  button.textContent = 'Acquisizione in corso…';
  try {
    await acquireArtwork(artwork._id);
    await refreshAfterLicenseChange();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'acquisizione.');
    button.disabled = false;
    button.textContent = `Acquisisci (${artwork.acquisitionPrice}€)`;
  }
}

// Dopo un'adozione o un'acquisizione, l'opera passa dal pannello
// "da adottare/acquisire" a quello "disponibili" — ricarico entrambi
// invece di aggiornare a mano lo stato locale, più semplice e meno
// soggetto a disallinearsi dal server.
async function refreshAfterLicenseChange() {
  await Promise.all([loadItems(), loadPurchasableArtworks()]);
  renderResults();
  renderPurchasable();
}

function renderSteps() {
  stepsListEl.innerHTML = '';
  stepsEmptyEl.hidden = steps.length > 0;

  steps.forEach((step, index) => {
    stepsListEl.appendChild(renderStepRow(step, index));
  });
}

function renderStepRow(step, index) {
  const li = document.createElement('li');
  li.className = 'card';
  li.style.flexDirection = 'column';
  li.style.alignItems = 'stretch';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.innerHTML = `<strong>${index + 1}. ${step.title}</strong> <span class="status-message">${step.language}</span>`;

  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.placeholder = 'Indicazione per raggiungere questa tappa…';
  noteInput.value = step.logisticNote;
  noteInput.addEventListener('input', () => {
    step.logisticNote = noteInput.value;
  });

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const upBtn = document.createElement('button');
  upBtn.textContent = '↑';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => moveStep(index, -1));

  const downBtn = document.createElement('button');
  downBtn.textContent = '↓';
  downBtn.disabled = index === steps.length - 1;
  downBtn.addEventListener('click', () => moveStep(index, 1));

  const removeBtn = document.createElement('button');
  removeBtn.className = 'danger';
  removeBtn.textContent = 'Rimuovi';
  removeBtn.addEventListener('click', () => {
    steps.splice(index, 1);
    renderSteps();
  });

  actions.append(upBtn, downBtn, removeBtn);

  li.append(header, noteInput, actions);
  return li;
}

function moveStep(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return;
  [steps[index], steps[target]] = [steps[target], steps[index]];
  renderSteps();
}

async function handleSubmit(e) {
  e.preventDefault();
  errorEl.hidden = true;

  if (steps.length === 0) {
    errorEl.textContent = 'Aggiungi almeno una tappa alla visita.';
    errorEl.hidden = false;
    return;
  }

  const payload = {
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    entranceInfo: document.getElementById('entrance-info').value.trim(),
    license: document.getElementById('license').value,
    price: Number(document.getElementById('price').value) || 0,
    isPublic: document.getElementById('is-public').checked,
    pace: paceSelect.value,
    tags: document.getElementById('tags').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    steps: steps.map(s => ({ item: s.itemId, logisticNote: s.logisticNote }))
  };

  if (!payload.title) {
    errorEl.textContent = 'Il titolo è obbligatorio.';
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'create' ? 'Creazione…' : 'Salvataggio…';

  try {
    if (mode === 'create') {
      await createVisit({ ...payload, museum: museumId });
    } else {
      await updateVisit(visitId, payload);
    }
    window.location.href = `visits?museum=${museumId}`;
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile salvare la visita.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'create' ? 'Crea visita' : 'Salva modifiche';
  }
}

async function handleDelete() {
  if (!window.confirm('Eliminare questa visita? L\'operazione non è reversibile.')) {
    return;
  }
  try {
    await deleteVisit(visitId);
    window.location.href = `visits?museum=${museumId}`;
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}
