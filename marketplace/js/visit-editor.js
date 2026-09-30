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

// Stato della pagina, riempito in main()
let mode; // 'create' (nuova visita) o 'edit' (visita esistente)
let museumId;
let visitId;
let currentUser;
// Opere che l'utente può già usare (proprie, gratuite o adottate) e opere da adottare o acquisire prima di poterle usare
let allArtworks = [];
let purchasableArtworks = [];
// Tappe della visita nell'ordine attuale, ognuna nella forma { artworkId, title, logisticNote }
let steps = [];

// Paginazione e ordinamento dell'elenco delle opere aggiungibili
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

/*
 * Pagina di creazione e modifica di una visita.
 * 1. Legge dall'URL l'id della visita (modifica) o del museo (creazione). Se mancano entrambi torna alla scelta del museo.
 * 2. Verifica il login con requireAuth.
 * 3. In modifica carica la visita, in creazione prepara il titolo della pagina.
 * 4. Legge ordinamento ed elementi per pagina dai controlli, scarica le opere e disegna elenco e tappe.
 * 5. Collega i pulsanti della pagina (salvataggio, ricerca, filtri, ordinamento, paginazione).
 */
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

// Riporta l'elenco delle opere alla prima pagina e lo ridisegna (dopo un cambio di filtro, ordinamento o dimensione pagina)
function resetPurchasablePage() {
  purchasableCurrentPage = 1;
  renderObjects();
}

// Prepara la pagina per una nuova visita, mettendo il nome del museo nel titolo
async function setupCreateMode() {
  titleEl.textContent = 'Nuova visita';
  submitBtn.textContent = 'Crea visita';

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `Nuova visita — ${museum.name}`;
  } catch {
    // Se il museo non si carica il titolo resta generico
  }
}

/*
 * Carica la visita da modificare e ne precompila il form e l'elenco delle tappe.
 * Se l'utente non è l'autore della visita o la visita non si carica,
 * nasconde il form e mostra un messaggio.
 */
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

// Completa il titolo delle tappe della visita cercando l'opera tra quelle scaricate, se il server non l'ha fornito
function hydrateSteps() {
  for (const step of steps) {
    const artwork = allArtworks.find(candidate => String(candidate._id) === String(step.artworkId));
    if (artwork) step.title ||= artwork.title ?? '';
    step.title ||= '(opera non trovata)';
  }
}

// Scarica le opere utilizzabili: quelle pubbliche e quelle proprie, unite senza duplicati
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

/*
 * Disegna la pagina corrente dell'elenco delle opere che si possono aggiungere alla visita.
 * 1. Unisce le opere già utilizzabili e quelle da adottare o acquisire,
 * secondo le caselle dei filtri, tenendo solo quelle il cui titolo contiene il testo cercato.
 * 2. Le ordina e taglia la pagina corrente.
 * 3. Disegna una card per ciascuna e aggiorna la paginazione.
 * Le opere già presenti tra le tappe non vengono mostrate.
 */
function renderObjects() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const showLicensed = checkMine ? checkMine.checked : true;
  const showPurchasable = checkOthers ? checkOthers.checked : true;
  const objects = [];

  // Opere già utilizzabili dall'utente (filtro "miei")
  if (showLicensed) {
    for (const artwork of allArtworks) {
      // Le opere già tra le tappe si saltano, quindi non compaiono e non contano nella paginazione
      if (!artwork._id || isArtworkAlreadyInSteps(artwork._id)) continue;
      const title = artwork.title ?? '(opera senza titolo)';
      if (query && !title.toLocaleLowerCase().includes(query)) continue;
      objects.push({ category: 'licensed', value: artwork, title });
    }
  }

  // Opere non ancora utilizzabili, che l'utente può adottare o acquisire (filtro "altrui")
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

// Controlla se l'opera è già una tappa della visita (gli id si confrontano come stringhe)
function isArtworkAlreadyInSteps(artworkId) {
  const targetId = String(artworkId);
  return steps.some(step => step.artworkId && String(step.artworkId) === targetId);
}

// Crea la card di un'opera utilizzabile, con il pulsante che la aggiunge come nuova tappa
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

// Scarica le opere da adottare o acquisire, usando il filtro purchasable del server
async function loadPurchasableArtworks() {
  try {
    purchasableArtworks = await getArtworks({ museum: museumId, purchasable: 'true' });
    if (!Array.isArray(purchasableArtworks)) purchasableArtworks = [];
  } catch {
    purchasableArtworks = [];
  }
}

// Restituisce una copia ordinata dell'elenco secondo sortBy: titolo crescente o decrescente, più recenti o più vecchie
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

/*
 * Disegna il testo "x–y di z" e i pulsanti della paginazione (frecce e numeri di pagina).
 * Se c'è una sola pagina mostra solo il testo. Un clic su un pulsante cambia pagina e ridisegna l'elenco.
 */
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

// Restituisce i numeri di pagina da mostrare, con "…" al posto di quelli omessi.
// Fino a 7 pagine le mostra tutte, oltre ne mostra alcune attorno a quella corrente più la prima e l'ultima.
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

// Crea la card di un'opera non ancora utilizzabile, con i prezzi e i pulsanti di adozione e acquisizione
// (quello di acquisizione compare solo ad autore e admin)
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

// Adotta l'opera e aggiorna l'elenco. In caso di errore mostra un messaggio e il pulsante torna com'era.
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

// Acquisisce l'opera, con lo stesso comportamento di handleAdopt
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

// Dopo un'adozione o un'acquisizione riscarica le opere e ridisegna l'elenco dalla prima pagina
async function refreshAfterLicenseChange() {
  await Promise.all([loadArtworks(), loadPurchasableArtworks()]);
  purchasableCurrentPage = 1;
  renderObjects();
}

// Ridisegna l'elenco delle tappe (o il messaggio "nessuna tappa" se è vuoto)
function renderSteps() {
  stepsListEl.replaceChildren();
  stepsEmptyEl.hidden = steps.length > 0;
  steps.forEach((step, index) => stepsListEl.appendChild(renderStepRow(step, index)));
}

// Crea la riga di una tappa, con il campo per l'indicazione logistica e i pulsanti per spostarla o rimuoverla
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

// Sposta una tappa di una posizione (delta -1 verso l'alto, +1 verso il basso) e ridisegna l'elenco
function moveStep(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return;
  [steps[index], steps[target]] = [steps[target], steps[index]];
  renderSteps();
}

/*
 * Alla conferma del form:
 * 1. Controlla che ci sia almeno una tappa, che ogni tappa abbia un'opera valida e che il titolo sia compilato.
 * 2. Crea o aggiorna la visita sul server.
 * 3. Se va a buon fine torna alla lista dei contenuti, altrimenti mostra il messaggio d'errore.
 */
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

// Elimina la visita dopo la conferma e torna alla lista dei contenuti
async function handleDelete() {
  if (!window.confirm('Eliminare questa visita? L’operazione non è reversibile.')) return;
  try {
    await deleteVisit(visitId);
    window.location.href = `contents?museum=${encodeURIComponent(museumId)}`;
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}

// Aggiunge alla lista un elemento con un messaggio di stato
function appendMessage(list, message) {
  const li = document.createElement('li');
  li.className = 'status-message';
  li.textContent = message;
  list.appendChild(li);
}
