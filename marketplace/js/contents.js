import { requireAuth } from './auth-guard.js';
import { getMuseumById, getVisits, deleteVisit, getArtworks, deleteArtwork, adoptArtwork, acquireArtwork, getLicenses } from './api.js';

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

let museumId;
let currentUser;

let whichList = 'a';

let paginazione = 25;

let queryVisite = '';
let visiteCorrenti = 1;

let queryOpere = '';
let opereCorrenti = 1;

let cacheVisits = [];
let cacheMineArtworks = [];
let cacheOthersArtworks = [];
let cacheUserLicenses = {};

let showMine = true;
let showOthers = true;

let sortBy = "property";

main();

async function main() {
  btnA.addEventListener('click', () => showList('a'));
  btnB.addEventListener('click', () => showList('b'));
  newBtn.addEventListener('click', () => handleNew());
  paginationSelect.addEventListener('change', (v) => {
    paginazione = parseInt(v.target.value, 10);
    if (whichList === 'a') {
      opereCorrenti = 1;
      const totale = renderArtworksUI();
      renderPagination(totale, opereCorrenti);
    } else {
      visiteCorrenti = 1;
      const totale = renderVisitsUI();
      renderPagination(totale, visiteCorrenti);
    }
  });
  mineCheck.addEventListener('change', () =>{
    showMine = !showMine;
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
  });
  othersCheck.addEventListener('change', () =>{
    showOthers = !showOthers;
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
  });
  sorter.addEventListener("change", (v)  => {
    sortBy = v.target.value
    if (whichList === 'a') {
      opereCorrenti = 1;
      const totale = renderArtworksUI();
      renderPagination(totale, opereCorrenti);
    } else {
      visiteCorrenti = 1;
      const totale = renderVisitsUI();
      renderPagination(totale, visiteCorrenti);
    }
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

  try {
    const museum = await getMuseumById(museumId);
    titleEl.textContent = `${museum.name}`;
  } catch {
    titleEl.textContent = 'Contenuti';
  }

  // Carichiamo i dati nelle cache
  await Promise.all([loadVisitsData(), loadArtworksData()]);
  
  // Eseguiamo il primo disegno della UI
  if (whichList === 'a') {
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
  } else {
    const totale = renderVisitsUI();
    renderPagination(totale, visiteCorrenti);
  }

  // Inizializza i controlli della Toolbar (es. Input di ricerca e tendine)
  setupToolbarListeners();
}

function renderVisitsUI() {
  visitEl.innerHTML = '';

  // 1. Applica il Filtro
  const filtrate = cacheVisits.filter(v => v.title.toLowerCase().includes(queryVisite.toLowerCase()));
  // 2. Calcola Paginazione
  const totale = filtrate.length;
  const maxPagine = Math.ceil(totale / paginazione) || 1;
  if (visiteCorrenti > maxPagine) visiteCorrenti = maxPagine;

  const inizio = (visiteCorrenti - 1) * paginazione;
  const fine = Math.min(inizio + paginazione, totale);
  const pacchetto = filtrate.slice(inizio, fine);

  // 3. Aggiorna l'indicatore testuale (es: "1-25 di 120") se hai aggiunto i tag nell'HTML
  renderPagination(totale, visiteCorrenti);

  if (pacchetto.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'status-message';
    emptyLi.textContent = 'Nessuna visita corrisponde ai criteri.';
    visitEl.appendChild(emptyLi);
    return 0;
  }

  for (const visit of pacchetto) {
    visitEl.appendChild(renderVisitCard(visit)); // Usa la tua funzione costruttrice originale
  }
  return totale;
}

function renderArtworksUI() {
  artworkEL.innerHTML = '';

  // 1. Applica il Filtro sia sulle proprie che sulle altre
  const mieFiltrate = showMine ? cacheMineArtworks.filter(a => a.title.toLowerCase().includes(queryOpere.toLowerCase())) : [];
  const altreFiltrate = showOthers ? cacheOthersArtworks.filter(a => a.title.toLowerCase().includes(queryOpere.toLowerCase())) : [];
  const tutteInsieme = [...mieFiltrate, ...altreFiltrate];
  // 2. Calcola Paginazione sull'unione dei due gruppi
  const totale = tutteInsieme.length;
  const maxPagine = Math.ceil(totale / paginazione) || 1;
  if (opereCorrenti > maxPagine) opereCorrenti = maxPagine;

  const inizio = (opereCorrenti - 1) * paginazione;
  const fine = Math.min(inizio + paginazione, totale);
  const pacchetto = tutteInsieme.slice(inizio, fine);

  if (pacchetto.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'status-message';
    emptyLi.textContent = 'Nessuna opera trovata.';
    artworkEL.appendChild(emptyLi);
    return 0;
  }
  const ids = new Set(mieFiltrate.map(item => item._id))
  const ordinato = sortElements(pacchetto);
  if (ordinato.length > 0) {
    for (const artwork of ordinato){
      ids.has(artwork._id) ? 
      artworkEL.appendChild(renderArtworkCard(artwork))
      : artworkEL.appendChild(renderOtherArtworkCard(artwork));
    }
  }
  return totale;
}

async function loadVisitsData() {
  statusEl.hidden = false;
  statusEl.className = 'status-message';
  statusEl.textContent = 'Caricamento visite…';
  try {
    cacheVisits = await getVisits(museumId, { includeMine: true });
    statusEl.hidden = true;
  } catch {
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare le visite. Riprova più tardi.';
  }
}

function renderVisitCard(visit) {
  const li = document.createElement('li');
  li.className = 'card';

  const isMine = visit.author?._id === currentUser.id;

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${visit.title}</strong>
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

function sortElements(arr){
  return [...arr].sort((a, b) =>{
    switch(sortBy){
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'newest':
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      default:
        return 0;
    }
  })
}

function renderPagination(totalItems, currentPage) {
  const maxPages = Math.ceil(totalItems / paginazione) || 1;
  pagination.innerHTML = '';
  paginationInfo.textContent = totalItems === 0
    ? '0-0 di 0'
    : `${(currentPage - 1) * paginazione + 1}–${Math.min(currentPage * paginazione, totalItems)} di ${totalItems}`;
  if(maxPages > 1){

    const firstBtn = document.createElement('a');
    firstBtn.classList.add("pagination-button");
    firstBtn.innerHTML = `
      <svg class="pagination-border" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r="17"
        />
      </svg>
      <span> << </span>
    `
    pagination.appendChild(firstBtn);
    let firstPage = 1;
    let lastPage = 3;
    if(maxPages > 3){
      if(currentPage === 1){
        firstPage = 1;
        lastPage = 3;
      }else if(currentPage === maxPages){
        lastPage = maxPages;
        firstPage = maxPages -2;
      }else{
        firstPage = currentPage - 1;
        lastPage = currentPage + 1;  
      }
    }
    if(maxPages < 3){
      firstPage = 1;
      lastPage = maxPages;
    }
    for (let i = firstPage; i <= lastPage; i++) {
    const button = document.createElement('a');
    button.innerHTML = `
      <svg class="pagination-border" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r="17"
        />
      </svg>
      <span>${i}</span>
    `;
    button.classList.add("pagination-button");
    if (i === currentPage) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      if (whichList === 'a') {
        opereCorrenti = i;
        const totale = renderArtworksUI();
        renderPagination(totale, opereCorrenti);
      } else {
        visiteCorrenti = i;
        const totale = renderVisitsUI();
        renderPagination(totale, visiteCorrenti);
      }
    });
    pagination.appendChild(button);
    }

    const lastBtn = document.createElement('a');
    lastBtn.classList.add("pagination-button");
    lastBtn.innerHTML = `
      <svg class="pagination-border" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r="17"
        />
      </svg>
      <span> >> </span>
    `
    pagination.appendChild(lastBtn);

    if (whichList === 'a') {
        opereCorrenti === 1 ? firstBtn.classList.add('disabled') : "";
        opereCorrenti === maxPages ? lastBtn.classList.add('disabled') : "";
      } else if(whichList === 'b'){
        visiteCorrenti === 1 ? firstBtn.classList.add('disabled') : "";
        visiteCorrenti === maxPages ? lastBtn.classList.add('disabled') : ""; 
      }

    lastBtn.addEventListener('click', () => {
      if (whichList === 'a') {
        opereCorrenti = maxPages;
        const totale = renderArtworksUI();
        renderPagination(totale, opereCorrenti);
      } else {
        visiteCorrenti = maxPages;
        const totale = renderVisitsUI();
        renderPagination(totale, visiteCorrenti);
      }
    });
    firstBtn.addEventListener('click', () => {
      if (whichList === 'a') {
        opereCorrenti = 1;
        const totale = renderArtworksUI();
        renderPagination(totale, opereCorrenti);
      } else {
        visiteCorrenti = 1;
        const totale = renderVisitsUI();
        renderPagination(totale, visiteCorrenti);
      }
    });
  }
}

async function handleDelete(visit) {
  if (!window.confirm(`Eliminare la visita "${visit.title}"? L'operazione non è reversibile.`)) {
    return;
  }
  try {
    await deleteVisit(visit._id);
    await loadVisitsData();
    const totale = renderVisitsUI();
    renderPagination(totale, visiteCorrenti);
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare la visita.');
  }
}

async function loadArtworksData() {
  try {
    const [mine, others, userLicenses] = await Promise.all([
      getArtworks({ museum: museumId, mine: 'true' }),
      getArtworks({ museum: museumId, others: 'true' }),
      getLicenses()
    ]);
    cacheMineArtworks = mine;
    cacheOthersArtworks = others;
    cacheUserLicenses = userLicenses;
  } catch(err) {
    console.error('Errore caricamento opere', err);
  }
}
 
function renderArtworkCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';
 
  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${artwork.title}</strong>
    ${!artwork.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">adozione: ${artwork.adoptionPrice ? `${artwork.adoptionPrice}€` : 'gratis'} · acquisizione: ${artwork.acquisitionPrice ? `${artwork.acquisitionPrice}€` : 'gratis'} · ${artwork.license}</span>
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
 
async function handleDeleteArtwork(artwork) {
  if (!window.confirm(`Eliminare "${artwork.title}"? Fallisce se ci sono ancora content collegati.`)) {
    return;
  }
  try {
    await deleteArtwork(artwork._id);
    await loadArtworksData();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare l\'opera.');
  }
}

function renderOtherArtworkCard(artwork, userLicensesData = {}) {
  const li = document.createElement('li');
  li.className = 'card';
 
  const ownerName = artwork.owner?.username ?? 'altro autore';
  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${artwork.title}</strong> <span class="status-message">di ${ownerName}</span><br>
    <span class="status-message">adozione: ${artwork.adoptionPrice ? `${artwork.adoptionPrice}€` : 'gratis'} · acquisizione: ${artwork.acquisitionPrice ? `${artwork.acquisitionPrice}€` : 'gratis'} · ${artwork.license}</span>
  `;
 
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Estraiamo in sicurezza l'array delle licenze dall'oggetto restituito dal backend
  const licenses = userLicensesData?.licenses || [];
  
  // Eseguiamo il controllo sull'array reale
  const hasAdopted = licenses.some(lic => 
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
 
async function handleAdopt(artwork, button) {
  button.disabled = true;
  button.textContent = 'Adozione in corso…';
  try {
    await adoptArtwork(artwork._id);
    await loadArtworksData(); // l'opera resta nel gruppo "altre", ma ora è licenziata
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
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
    await loadArtworksData(); // l'opera passa dal gruppo "altre" a "le tue"
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'acquisizione.');
    button.disabled = false;
    button.textContent = `Acquisisci (${artwork.acquisitionPrice}€)`;
  }
}

function handleNew() {
  const page = whichList === 'a' ? 'artwork-editor' : 'visit-editor';
  window.location.href = `${page}?museum=${museumId}`;
}


function showList(which) {
  const showA = which === 'a';
  whichList = which;
  if(!showA) {
    const totale = renderVisitsUI();
    renderPagination(totale, visiteCorrenti);
    checkBoxes.style.display = "none";
  }
  else {
    const totale = renderArtworksUI();
    renderPagination(totale, opereCorrenti);
    checkBoxes.style.display = "flex";
  }
  visitEl.classList.toggle('invisible', showA);
  artworkEL.classList.toggle('invisible', !showA);
  btnA.classList.toggle('active', showA);
  btnB.classList.toggle('active', !showA);
  slideBg(showA ? 0 : 1);
}

function slideBg(n) {
  const bgOffset = 50 * n;
  switchContainer.style.setProperty("--bg-offset", `${bgOffset}%`);
}

function setupToolbarListeners() {
  // Listener per la ricerca visite
  document.getElementById('search-visite')?.addEventListener('input', (e) => {
    queryVisite = e.target.value;
    visiteCorrenti = 1; // Ritorna in prima pagina se l'utente filtra
    const totale = renderVisitsUI();
    renderPagination(totale, visiteCorrenti);
  });

  // Listener scala elementi visite
  document.getElementById('select-visite-per-page')?.addEventListener('change', (e) => {
    paginazione = parseInt(e.target.value, 10);
    visiteCorrenti = 1;
    const totale = renderVisitsUI();
    renderPagination(totale, visiteCorrenti);
  }); 
}
