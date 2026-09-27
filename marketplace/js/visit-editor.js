import { requireAuth } from './auth-guard.js';
import {
  getMuseumById,
  getArtworks,
  adoptArtwork,
  acquireArtwork,
  getVisitById,
  createVisit,
  updateVisit,
  deleteVisit
} from './api.js';

// Stato della pagina, popolato in main().
let mode; // 'create' | 'edit'
let museumId;
let visitId;
let currentUser;
let allArtworks = [];
let purchasableArtworks = []; // opere pubbliche non ancora utilizzabili
let steps = []; // { artworkId, title, logisticNote }

let purchasableCurrentPage = 1;
let purchasablePerPage = 25;
let sortBy = 'property';

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
const checkMine = document.getElementById('check-mine');
const checkOthers = document.getElementById('check-others');
const sortSelect = document.getElementById('sort-select');
const perPageSelect = document.getElementById('per-page-select');
const paginationEl = document.getElementById('pagination');
const paginationInfoEl = document.getElementById('pagination-info');

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
  if (!currentUser) return;

  mode = visitId ? 'edit' : 'create';

  if (mode === 'edit') await loadExistingVisit();
  else await setupCreateMode();

  if (sortSelect) sortBy = sortSelect.value || 'property';
  if (perPageSelect) {
    const selectedPageSize = Number.parseInt(perPageSelect.value, 10);
    if (Number.isFinite(selectedPageSize) && selectedPageSize > 0) {
      purchasablePerPage = selectedPageSize;
    }
  }

  await Promise.all([loadArtworks(), loadPurchasableArtworks()]);
  hydrateSteps();
  renderObjects();
  renderSteps();

  backLink.href = `contents?museum=${encodeURIComponent(museumId)}`;
  form.addEventListener('submit', handleSubmit);
  searchInput.addEventListener('input', () => {
    purchasableCurrentPage = 1;
    renderObjects();
  });

  checkMine?.addEventListener('change', resetPurchasablePage);
  checkOthers?.addEventListener('change', resetPurchasablePage);
  sortSelect?.addEventListener('change', () => {
    sortBy = sortSelect.value;
    resetPurchasablePage();
  });
  perPageSelect?.addEventListener('change', () => {
    const value = Number.parseInt(perPageSelect.value, 10);
    if (Number.isFinite(value) && value > 0) purchasablePerPage = value;
    resetPurchasablePage();
  });
}

function resetPurchasablePage() {
  purchasableCurrentPage = 1;
  renderObjects();
}

async function setupCreateMode() {
  titleEl.textContent = 'Nuova visita';
  submitBtn.textContent = 'Crea visita';

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `Nuova visita — ${museum.name}`;
  } catch {
    // Il titolo può restare generico se il museo non è disponibile.
  }
}

async function loadExistingVisit() {
  try {
    const visit = await getVisitById(visitId);

    if (visit.author?._id !== currentUser.id) {
      statusEl.hidden = false;
      statusEl.className = 'error-message';
      statusEl.textContent = 'Non sei l’autore di questa visita: non puoi modificarla.';
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
    document.getElementById('is-public').checked = Boolean(visit.isPublic);
    document.getElementById('tags').value = (visit.tags ?? []).join(', ');
    paceSelect.value = visit.pace ?? '15s';

    steps = (visit.steps ?? []).map(step => {
      const artwork = step.artwork;
      return {
        artworkId: artwork?._id ?? artwork ?? null,
        title: artwork && typeof artwork === 'object' ? artwork.title ?? '' : '',
        logisticNote: step.logisticNote ?? ''
      };
    });
  } catch {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare questa visita.';
    form.hidden = true;
  }
}

function hydrateSteps() {
  for (const step of steps) {
    const artwork = allArtworks.find(candidate => String(candidate._id) === String(step.artworkId));
    if (artwork) step.title ||= artwork.title ?? '';
    step.title ||= '(opera non trovata)';
  }
}

async function loadArtworks() {
  try {
    const [publicArtworks, ownArtworks] = await Promise.all([
      getArtworks({ museum: museumId }),
      getArtworks({ museum: museumId, mine: 'true' })
    ]);
    const byId = new Map();
    for (const artwork of [...publicArtworks, ...ownArtworks]) {
      if (artwork?._id) byId.set(artwork._id, artwork);
    }
    allArtworks = [...byId.values()];
  } catch {
    allArtworks = [];
  }
}

function renderObjects() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const showLicensed = checkMine ? checkMine.checked : true;
  const showPurchasable = checkOthers ? checkOthers.checked : true;
  const objects = [];

  // “Miei” corrisponde alle opere per cui il museo/utente ha già la licenza.
  if (showLicensed) {
    for (const artwork of allArtworks) {
      // Le tappe già inserite non compaiono e non contribuiscono al conteggio/paginazione.
      if (!artwork._id || isArtworkAlreadyInSteps(artwork._id)) continue;
      const title = artwork.title ?? '(opera senza titolo)';
      if (query && !title.toLocaleLowerCase().includes(query)) continue;
      objects.push({ category: 'licensed', value: artwork, title });
    }
  }

  // “Altrui” corrisponde alle opere non ancora utilizzabili, ma acquistabili.
  if (showPurchasable) {
    for (const artwork of purchasableArtworks) {
      const title = artwork.title ?? '(opera senza titolo)';
      if (query && !title.toLocaleLowerCase().includes(query)) continue;
      objects.push({ category: 'purchasable', value: artwork, title });
    }
  }

  const sorted = sortElements(objects);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / purchasablePerPage));
  purchasableCurrentPage = Math.min(purchasableCurrentPage, totalPages);
  const start = (purchasableCurrentPage - 1) * purchasablePerPage;
  const pageObjects = sorted.slice(start, start + purchasablePerPage);

  resultsEl.replaceChildren();
  purchasableResultsEl?.replaceChildren();
  if (purchasableResultsEl && purchasableResultsEl !== resultsEl) {
    purchasableResultsEl.hidden = true;
  }

  if (pageObjects.length === 0) {
    appendMessage(resultsEl, 'Nessun oggetto trovato con i filtri selezionati.');
  } else {
    for (const object of pageObjects) {
      const card = object.category === 'licensed'
        ? renderArtworkResult(object.value)
        : renderPurchasableCard(object.value);
      resultsEl.appendChild(card);
    }
  }

  renderPagination(total, totalPages);
  return total;
}

function isArtworkAlreadyInSteps(artworkId) {
  const targetId = String(artworkId);
  return steps.some(step => step.artworkId && String(step.artworkId) === targetId);
}

function renderArtworkResult(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const title = artwork.title ?? '(opera senza titolo)';
  const info = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  info.appendChild(strong);
  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  const alreadyUsed = isArtworkAlreadyInSteps(artwork._id);
  actionBtn.disabled = alreadyUsed;
  actionBtn.textContent = alreadyUsed ? 'Già nella visita' : '+ Aggiungi';
  actionBtn.addEventListener('click', () => {
    if (!artwork._id || isArtworkAlreadyInSteps(artwork._id)) return;
    steps.push({
      artworkId: artwork._id,
      title,
      logisticNote: ''
    });
    renderSteps();
    renderObjects();
  });

  li.append(info, actionBtn);
  return li;
}

// Le opere acquistabili restano ottenute dall'API esistente e dal suo filtro.
async function loadPurchasableArtworks() {
  try {
    purchasableArtworks = await getArtworks({ museum: museumId, purchasable: 'true' });
    if (!Array.isArray(purchasableArtworks)) purchasableArtworks = [];
  } catch {
    purchasableArtworks = [];
  }
}

function sortElements(objects) {
  return [...objects].sort((a, b) => {
    const titleA = a.title ?? '';
    const titleB = b.title ?? '';
    switch (sortBy) {
      case 'title-asc': return titleA.localeCompare(titleB, 'it');
      case 'title-desc': return titleB.localeCompare(titleA, 'it');
      case 'newest': {
        const dateA = a.value.updatedAt ?? a.value.createdAt ?? 0;
        const dateB = b.value.updatedAt ?? b.value.createdAt ?? 0;
        return new Date(dateB) - new Date(dateA);
      }
      case 'oldest': {
        const dateA = a.value.updatedAt ?? a.value.createdAt ?? 0;
        const dateB = b.value.updatedAt ?? b.value.createdAt ?? 0;
        return new Date(dateA) - new Date(dateB);
      }
      default: return 0;
    }
  });
}

function renderPagination(total, totalPages) {
  if (paginationInfoEl) {
    const start = total === 0 ? 0 : (purchasableCurrentPage - 1) * purchasablePerPage + 1;
    const end = Math.min(purchasableCurrentPage * purchasablePerPage, total);
    paginationInfoEl.textContent = `${start}–${end} di ${total}`;
  }
  if (!paginationEl) return;

  paginationEl.replaceChildren();
  if (totalPages <= 1) return;

  const addPageButton = (label, page, disabled = false, current = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    if (current) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      purchasableCurrentPage = page;
      renderObjects();
    });
    paginationEl.appendChild(button);
  };

  addPageButton('←', Math.max(1, purchasableCurrentPage - 1), purchasableCurrentPage === 1);
  const pages = getPageNumbers(purchasableCurrentPage, totalPages);
  for (const page of pages) {
    if (page === '…') {
      const span = document.createElement('span');
      span.textContent = '…';
      paginationEl.appendChild(span);
    } else {
      addPageButton(String(page), page, false, page === purchasableCurrentPage);
    }
  }
  addPageButton('→', Math.min(totalPages, purchasableCurrentPage + 1), purchasableCurrentPage === totalPages);
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

function renderPurchasableCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = artwork.title ?? '(opera senza titolo)';
  info.appendChild(title);
  const prices = document.createElement('span');
  prices.className = 'status-message';
  prices.textContent = `adozione: ${artwork.adoptionPrice ?? 0}€ · acquisizione: ${artwork.acquisitionPrice ?? 0}€`;
  info.append(document.createElement('br'), prices);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const adoptBtn = document.createElement('button');
  adoptBtn.type = 'button';
  adoptBtn.textContent = `Adotta (${artwork.adoptionPrice ?? 0}€)`;
  adoptBtn.addEventListener('click', () => handleAdopt(artwork, adoptBtn));
  actions.appendChild(adoptBtn);

  if (currentUser.role === 'autore' || currentUser.role === 'admin') {
    const acquireBtn = document.createElement('button');
    acquireBtn.type = 'button';
    acquireBtn.textContent = `Acquisisci (${artwork.acquisitionPrice ?? 0}€)`;
    acquireBtn.addEventListener('click', () => handleAcquire(artwork, acquireBtn));
    actions.appendChild(acquireBtn);
  }

  li.append(info, actions);
  return li;
}

async function handleAdopt(artwork, button) {
  button.disabled = true;
  button.textContent = 'Adozione in corso…';
  try {
    await adoptArtwork(artwork._id);
    await refreshAfterLicenseChange();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l’adozione.');
    button.disabled = false;
    button.textContent = `Adotta (${artwork.adoptionPrice ?? 0}€)`;
  }
}

async function handleAcquire(artwork, button) {
  button.disabled = true;
  button.textContent = 'Acquisizione in corso…';
  try {
    await acquireArtwork(artwork._id);
    await refreshAfterLicenseChange();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l’acquisizione.');
    button.disabled = false;
    button.textContent = `Acquisisci (${artwork.acquisitionPrice ?? 0}€)`;
  }
}

async function refreshAfterLicenseChange() {
  await Promise.all([loadArtworks(), loadPurchasableArtworks()]);
  purchasableCurrentPage = 1;
  renderObjects();
}

function renderSteps() {
  stepsListEl.replaceChildren();
  stepsEmptyEl.hidden = steps.length > 0;
  steps.forEach((step, index) => stepsListEl.appendChild(renderStepRow(step, index)));
}

function renderStepRow(step, index) {
  const li = document.createElement('li');
  li.className = 'card';
  li.style.flexDirection = 'column';
  li.style.alignItems = 'stretch';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  const heading = document.createElement('strong');
  heading.textContent = `${index + 1}. ${step.title}`;
  header.appendChild(heading);

  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.placeholder = 'Indicazione per raggiungere questa tappa…';
  noteInput.value = step.logisticNote;
  noteInput.addEventListener('input', () => { step.logisticNote = noteInput.value; });

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.textContent = '↑';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => moveStep(index, -1));
  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.textContent = '↓';
  downBtn.disabled = index === steps.length - 1;
  downBtn.addEventListener('click', () => moveStep(index, 1));
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'danger';
  removeBtn.textContent = 'Rimuovi';
  removeBtn.addEventListener('click', () => { steps.splice(index, 1); renderSteps(); });
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

async function handleSubmit(event) {
  event.preventDefault();
  errorEl.hidden = true;

  if (steps.length === 0) {
    errorEl.textContent = 'Aggiungi almeno una tappa alla visita.';
    errorEl.hidden = false;
    return;
  }
  if (steps.some(step => !step.artworkId)) {
    errorEl.textContent = 'Una o più tappe non hanno un’opera valida. Rimuovile e aggiungile di nuovo.';
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
    tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()).filter(Boolean),
    steps: steps.map(step => ({ artwork: step.artworkId, logisticNote: step.logisticNote }))
  };

  if (!payload.title) {
    errorEl.textContent = 'Il titolo è obbligatorio.';
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'create' ? 'Creazione…' : 'Salvataggio…';
  try {
    if (mode === 'create') await createVisit({ ...payload, museum: museumId });
    else await updateVisit(visitId, payload);
    window.location.href = `contents?museum=${encodeURIComponent(museumId)}`;
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile salvare la visita.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'create' ? 'Crea visita' : 'Salva modifiche';
  }
}

async function handleDelete() {
  if (!window.confirm('Eliminare questa visita? L’operazione non è reversibile.')) return;
  try {
    await deleteVisit(visitId);
    window.location.href = `contents?museum=${encodeURIComponent(museumId)}`;
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}

function appendMessage(list, message) {
  const li = document.createElement('li');
  li.className = 'status-message';
  li.textContent = message;
  list.appendChild(li);
}
