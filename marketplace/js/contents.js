import { requireAuth } from './auth-guard.js';
import { escapeHtml } from './escape.js';
import { getMuseumById, getVisits, deleteVisit, getArtworks, deleteArtwork, adoptArtwork, acquireArtwork, getLicenses } from './api.js';
import { sortByField, renderPagination } from './list-utils.js';

// Elementi della pagina
const titleEl = document.getElementById('museum-title');
const statusEl = document.getElementById('status');
const visitEl = document.getElementById('visit-list');
const artworkEL = document.getElementById('artwork-list');
const btnA = document.getElementById('btn-a');
const btnB = document.getElementById('btn-b');
const switchContainer = document.getElementById('switch-container');
const checkBoxes = document.getElementById("checkboxes");
const paginationSelect = document.getElementById("per-page-select");
const newBtn = document.getElementById("new-btn");
const mineCheck = document.getElementById("mine-check");
const othersCheck = document.getElementById("others-check");
const sorter = document.getElementById("sort-select");
const paginationInfo = document.getElementById('pagination-info');
const pagination = document.getElementById('pagination');

// Museo mostrato (preso dal parametro ?museum= dell'URL) e utente loggato
let museumId;
let currentUser;

// Lista visibile: 'a' sono le opere, 'b' sono le visite
let whichList = 'a';

// Elementi per pagina
let paginazione = 25;

// Testo cercato e pagina corrente della lista delle visite
let queryVisite = '';
let visiteCorrenti = 1;

// Testo cercato e pagina corrente della lista delle opere
let queryOpere = '';
let opereCorrenti = 1;

// Dati scaricati dal server (visite, opere proprie, opere altrui, licenze dell'utente),
// filtrati e ordinati nel browser senza rifare la richiesta
let cacheVisits = [];
let cacheMineArtworks = [];
let cacheOthersArtworks = [];
let cacheLicenses = [];

// Filtri "le mie" / "altrui" della lista delle opere
let showMine = true;
let showOthers = true;

// Criterio di ordinamento delle opere (vedi sortByField in list-utils.js)
let sortBy = "property";

main();

/*
 * Pagina dei contenuti di un museo: lista delle opere e lista delle visite.
 * 1. Collega i controlli della pagina (cambio lista, filtri, ordinamento, paginazione).
 * 2. Legge il museo dall'URL. Se manca torna alla scelta del museo.
 * 3. Verifica il login con requireAuth. I filtri "mie" / "altrui" sono visibili solo ad autore e admin.
 * 4. Scarica visite e opere nelle cache e disegna la lista.
 */
async function main() {
  btnA.addEventListener('click', () => showList('a'));
  btnB.addEventListener('click', () => showList('b'));
  newBtn.addEventListener('click', () => handleNew());
  paginationSelect.addEventListener('change', (v) => {
    paginazione = parseInt(v.target.value, 10);
    if (whichList === 'a') opereCorrenti = 1; else visiteCorrenti = 1;
    renderCurrentList();
  });
  mineCheck.addEventListener('change', () => {
    showMine = !showMine;
    renderCurrentList();
  });
  othersCheck.addEventListener('change', () => {
    showOthers = !showOthers;
    renderCurrentList();
  });
  sorter.addEventListener("change", (v) => {
    sortBy = v.target.value
    if (whichList === 'a') opereCorrenti = 1; else visiteCorrenti = 1;
    renderCurrentList();
  });
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
  (currentUser.role === 'autore' || currentUser.role === 'admin') ? checkBoxes.style.display = "flex" : checkBoxes.style.display = "none";
  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `${museum.name}`;
  } catch {
    titleEl.textContent = 'Contenuti';
  }

  // Scarica i dati nelle cache
  await Promise.all([loadVisitsData(), loadArtworksData()]);

  // Primo disegno della lista
  renderCurrentList();

  // Collega la ricerca e la selezione degli elementi per pagina
  setupToolbarListeners();
}

/*
 * Ridisegna la lista attiva (opere o visite) insieme ai suoi controlli di paginazione.
 * Va chiamata ogni volta che cambia qualcosa: filtri, ordinamento, pagina o dati.
 * Le funzioni di disegno restituiscono il numero totale di elementi, che serve alla paginazione.
 */
function renderCurrentList() {
  if (whichList === 'a') {
    const totale = renderArtworksUI();
    renderPagination({
      container: pagination, infoEl: paginationInfo,
      totalItems: totale, currentPage: opereCorrenti, pageSize: paginazione,
      onPageChange: (page) => { opereCorrenti = page; renderCurrentList(); }
    });
  } else {
    const totale = renderVisitsUI();
    renderPagination({
      container: pagination, infoEl: paginationInfo,
      totalItems: totale, currentPage: visiteCorrenti, pageSize: paginazione,
      onPageChange: (page) => { visiteCorrenti = page; renderCurrentList(); }
    });
  }
}

/*
 * Disegna la pagina corrente della lista delle visite e restituisce il totale delle visite filtrate.
 * 1. Filtra le visite per titolo.
 * 2. Calcola quali visite stanno nella pagina corrente (correggendo la pagina se è oltre l'ultima).
 * 3. Disegna una card per ciascuna, oppure un messaggio se non ce ne sono.
 */
function renderVisitsUI() {
  visitEl.innerHTML = '';

  // 1. Filtro
  const filtrate = cacheVisits.filter(v => v.title.toLowerCase().includes(queryVisite.toLowerCase()));
  // 2. Paginazione
  const totale = filtrate.length;
  const maxPagine = Math.ceil(totale / paginazione) || 1;
  if (visiteCorrenti > maxPagine) visiteCorrenti = maxPagine;

  const inizio = (visiteCorrenti - 1) * paginazione;
  const fine = Math.min(inizio + paginazione, totale);
  const pacchetto = filtrate.slice(inizio, fine);

  if (pacchetto.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'status-message';
    emptyLi.textContent = 'Nessuna visita corrisponde ai criteri.';
    visitEl.appendChild(emptyLi);
    return 0;
  }

  for (const visit of pacchetto) {
    visitEl.appendChild(renderVisitCard(visit));
  }
  return totale;
}

/*
 * Disegna la pagina corrente della lista delle opere e restituisce il totale delle opere filtrate.
 * 1. Filtra per titolo le opere proprie e quelle altrui, secondo i filtri "mie" / "altrui".
 * 2. Unisce i due gruppi, li ordina e taglia la pagina corrente.
 * 3. Disegna la card completa per le proprie opere e quella con adozione/acquisizione per le altrui.
 */
function renderArtworksUI() {
  artworkEL.innerHTML = '';

  // 1. Filtro
  const mieFiltrate = showMine ? cacheMineArtworks.filter(a => a.title.toLowerCase().includes(queryOpere.toLowerCase())) : [];
  const altreFiltrate = showOthers ? cacheOthersArtworks.filter(a => a.title.toLowerCase().includes(queryOpere.toLowerCase())) : [];
  const tutteInsieme = [...mieFiltrate, ...altreFiltrate];
  // 2. Paginazione, calcolata sull'unione dei due gruppi
  const totale = tutteInsieme.length;
  const maxPagine = Math.ceil(totale / paginazione) || 1;
  if (opereCorrenti > maxPagine) opereCorrenti = maxPagine;

  const inizio = (opereCorrenti - 1) * paginazione;
  const fine = Math.min(inizio + paginazione, totale);
  // L'ordinamento va fatto prima di tagliare la pagina, altrimenti ogni pagina sarebbe ordinata solo al suo interno
  const ordinato = sortByField(tutteInsieme, sortBy);
  const pacchetto = ordinato.slice(inizio, fine);

  if (pacchetto.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'status-message';
    emptyLi.textContent = 'Nessuna opera trovata.';
    artworkEL.appendChild(emptyLi);
    return 0;
  }
  // Serve a distinguere le opere proprie da quelle altrui
  const ids = new Set(mieFiltrate.map(item => item._id))
  for (const artwork of pacchetto) {
    ids.has(artwork._id) ?
      artworkEL.appendChild(renderArtworkCard(artwork))
      : artworkEL.appendChild(renderOtherArtworkCard(artwork));
  }
  return totale;
}

// Scarica le visite del museo (pubbliche e proprie private) e mostra lo stato del caricamento
async function loadVisitsData() {
  statusEl.hidden = false;
  statusEl.className = 'status-message';
  statusEl.textContent = 'Caricamento visite…';
  try {
    cacheVisits = await getVisits(museumId);
    statusEl.hidden = true;
  } catch {
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare le visite. Riprova più tardi.';
  }
}

// Crea la card di una visita. Solo l'autore vede i pulsanti Modifica ed Elimina, gli altri vedono il nome dell'autore.
function renderVisitCard(visit) {
  const li = document.createElement('li');
  li.className = 'card';

  const isMine = visit.author?._id === currentUser.id;
  const info = document.createElement('div');

  info.innerHTML = `
    <strong>${escapeHtml(visit.title)}</strong>
    ${!visit.isPublic ?
      ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">${visit.steps?.length ?? 0} tappe ${visit.price ? `· ${visit.price}€` : '· gratuita'}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (isMine) {
    const editBtn = document.createElement('button');
    editBtn.className = 'primary';
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', () => {
      window.location.href = `visit-editor?id=${visit._id}`;
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

// Elimina una visita dopo la conferma e poi ricarica la lista
async function handleDelete(visit) {
  if (!window.confirm(`Eliminare la visita "${visit.title}"? L'operazione non è reversibile.`)) {
    return;
  }
  try {
    await deleteVisit(visit._id);
    await loadVisitsData();
    renderCurrentList();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}

// Scarica in parallelo le opere proprie, quelle altrui e le licenze dell'utente
async function loadArtworksData() {
  try {
    const [mine, others, userLicenses] = await Promise.all([
      getArtworks({ museum: museumId, mine: 'true' }),
      getArtworks({ museum: museumId, others: 'true' }),
      getLicenses()
    ]);
    cacheMineArtworks = mine;
    cacheOthersArtworks = others;
    cacheLicenses = userLicenses;
  } catch (err) {
    console.error('Errore caricamento opere', err);
  }
}

// Crea la card di un'opera propria, con prezzi, licenza e pulsanti Modifica ed Elimina
function renderArtworkCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${escapeHtml(artwork.title)}</strong>
    ${!artwork.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">adozione: ${artwork.adoptionPrice ? `${artwork.adoptionPrice}€` : 'gratis'} · acquisizione: ${artwork.acquisitionPrice ? `${artwork.acquisitionPrice}€` : 'gratis'} · ${escapeHtml(artwork.license)}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'primary';
  editBtn.textContent = 'Modifica';
  editBtn.addEventListener('click', () => {
    window.location.href = `artwork-editor?id=${artwork._id}`;
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Elimina';
  deleteBtn.addEventListener('click', () => handleDeleteArtwork(artwork));

  actions.append(editBtn, deleteBtn);
  li.append(info, actions);
  return li;
}

// Elimina un'opera dopo la conferma e ricarica la lista. Il server rifiuta se ha ancora Content collegati.
async function handleDeleteArtwork(artwork) {
  if (!window.confirm(`Eliminare "${artwork.title}"? Fallisce se ci sono ancora content collegati.`)) {
    return;
  }
  try {
    await deleteArtwork(artwork._id);
    await loadArtworksData();
    renderCurrentList();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare l\'opera.');
  }
}

/*
 * Crea la card di un'opera di un altro autore.
 * Il pulsante di adozione è disabilitato se l'utente ha già adottato l'opera.
 * Il pulsante di acquisizione compare solo ad autore e admin.
 */
function renderOtherArtworkCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const ownerName = artwork.owner?.username ?? 'altro autore';
  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${escapeHtml(artwork.title)}</strong> <span class="status-message">di ${escapeHtml(ownerName)}</span><br>
    <span class="status-message">adozione: ${artwork.adoptionPrice ? `${artwork.adoptionPrice}€` : 'gratis'} · acquisizione: ${artwork.acquisitionPrice ? `${artwork.acquisitionPrice}€` : 'gratis'} · ${escapeHtml(artwork.license)}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Controlla se tra le licenze dell'utente c'è già un'adozione di quest'opera
  const hasAdopted = cacheLicenses.licenses.some(lic =>
    lic.artwork?._id === artwork._id && lic.type === 'adoption'
  );

  const adoptBtn = document.createElement('button');
  if (hasAdopted) {
    adoptBtn.textContent = `Già Adottata`;
    adoptBtn.disabled = true;
    adoptBtn.className = 'disabled-btn';
  } else {
    adoptBtn.textContent = `Adotta`;
    adoptBtn.addEventListener('click', () => handleAdopt(artwork, adoptBtn));
  }
  actions.appendChild(adoptBtn);

  if (currentUser.role === 'autore' || currentUser.role === 'admin') {
    const acquireBtn = document.createElement('button');
    acquireBtn.className = 'success';
    acquireBtn.textContent = `Acquisisci`;
    acquireBtn.addEventListener('click', () => handleAcquire(artwork, acquireBtn));
    actions.appendChild(acquireBtn);
  }

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

// Adotta l'opera. Durante la richiesta il pulsante è disabilitato e in caso di errore torna com'era.
async function handleAdopt(artwork, button) {
  button.disabled = true;
  button.textContent = 'Adozione in corso…';
  try {
    await adoptArtwork(artwork._id);
    await loadArtworksData(); // l'opera resta tra le altrui, ma ora risulta adottata
    renderCurrentList();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'adozione.');
    button.disabled = false;
    button.textContent = `Adotta (${artwork.adoptionPrice}€)`;
  }
}

// Acquisisce l'opera, con lo stesso comportamento del pulsante di handleAdopt
async function handleAcquire(artwork, button) {
  button.disabled = true;
  button.textContent = 'Acquisizione in corso…';
  try {
    await acquireArtwork(artwork._id);
    await loadArtworksData(); // l'opera passa dalle altrui alle proprie
    renderCurrentList();
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'acquisizione.');
    button.disabled = false;
    button.textContent = `Acquisisci (${artwork.acquisitionPrice}€)`;
  }
}

// Apre l'editor per creare una nuova opera o una nuova visita, a seconda della lista visibile
function handleNew() {
  const page = whichList === 'a' ? 'artwork-editor' : 'visit-editor';
  window.location.href = `${page}?museum=${museumId}`;
}

// Passa dalla lista delle opere ('a') a quella delle visite ('b') e aggiorna lo stato dell'interruttore
function showList(which) {
  const showA = which === 'a';
  whichList = which;
  renderCurrentList();
  if (!showA) {
    checkBoxes.style.display = "none";
  } else {
    (currentUser.role === 'autore' || currentUser.role === 'admin') ? checkBoxes.style.display = "flex" : checkBoxes.style.display = "none";
  }
  visitEl.classList.toggle('invisible', showA);
  artworkEL.classList.toggle('invisible', !showA);
  btnA.classList.toggle('active', showA);
  btnB.classList.toggle('active', !showA);
  slideBg(showA ? 0 : 1);
}

// Sposta lo sfondo dell'interruttore sul pulsante selezionato (0 = opere, 1 = visite)
function slideBg(n) {
  const bgOffset = 50 * n;
  switchContainer.style.setProperty("--bg-offset", `${bgOffset}%`);
}

// Collega la ricerca delle visite e la scelta degli elementi per pagina
function setupToolbarListeners() {
  // Ricerca visite
  document.getElementById('search-visite')?.addEventListener('input', (e) => {
    queryVisite = e.target.value;
    visiteCorrenti = 1; // dopo un filtro si riparte dalla prima pagina
    renderCurrentList();
  });

  // Elementi per pagina
  document.getElementById('select-visite-per-page')?.addEventListener('change', (e) => {
    paginazione = parseInt(e.target.value, 10);
    visiteCorrenti = 1;
    renderCurrentList();
  });
}