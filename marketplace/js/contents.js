import { requireAuth } from './auth-guard.js';
import { getMuseumById, getVisits, deleteVisit, getArtworks, deleteArtwork } from './api.js';

const titleEl = document.getElementById('museum-title');
const statusEl = document.getElementById('status');
const visitEl = document.getElementById('visit-list');
const artworkEL = document.getElementById('artwork-list');
const btnA = document.getElementById('btn-a');
const btnB = document.getElementById('btn-b');
const switchContainer = document.getElementById('switch-container');

let museumId;
let currentUser;

main();

async function main() {
  btnA.addEventListener('click', () => showList('a'));
  btnB.addEventListener('click', () => showList('b'));
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
    titleEl.textContent = `${museum.name}`;
  } catch {
    titleEl.textContent = 'Contenuti';
  }

  await Promise.all([loadVisits(), loadArtworks()]);
}

async function loadVisits() {
  statusEl.hidden = false;
  statusEl.className = 'status-message';
  statusEl.textContent = 'Caricamento visite…';
  visitEl.innerHTML = '';

  try {
    const visits = await getVisits(museumId, { includeMine: true });
    visitEl.innerHTML = '';
    const createLi = document.createElement('li');
    createLi.className = 'card primary-card-button';
    createLi.id = 'new-visit-btn';
    createLi.textContent = '+ Crea una nuova visita';
    createLi.addEventListener('click', () => {
      window.location.href = `visit-editor?museum=${museumId}`;
    });
    visitEl.appendChild(createLi);
    if (visits.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'status-message';
      emptyLi.textContent = 'Non hai ancora creato visite per questo museo.';
      visitEl.appendChild(emptyLi);
      return;
    }

    statusEl.hidden = true;
    for (const visit of visits) {
      visitEl.appendChild(renderVisitCard(visit));
    }
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

// Due gruppi in una sola lista: prima le opere POSSEDUTE (qui si
// gestiscono licenza/prezzi/pubblicazione, anche per un'opera senza
// ancora nessun content — altrimenti non ci sarebbe modo di
// raggiungerla per modificarla), poi tutte le altre opere pubbliche
// del museo, ordinate per prezzo di adozione crescente — prima le più
// economiche/gratuite da adottare.
async function loadArtworks() {
  try {
    const [mine, others] = await Promise.all([
      getArtworks({ museum: museumId, mine: 'true' }),
      getArtworks({ museum: museumId, others: 'true' })
    ]);
 
    artworkEL.innerHTML = '';
 
    // Il bottone "+ Crea" va SEMPRE mostrato, quindi lo si crea qui,
    // dopo aver svuotato la lista — mai prima, altrimenti innerHTML=''
    // lo cancella insieme al resto.
    const createLi = document.createElement('li');
    createLi.className = 'card primary-card-button';
    createLi.id = 'new-artwork-btn';
    createLi.textContent = '+ Crea una nuova opera';
    createLi.addEventListener('click', () => {
      window.location.href = `artwork-editor?museum=${museumId}`;
    });
    artworkEL.appendChild(createLi);
 
    if (mine.length === 0 && others.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'status-message';
      emptyLi.textContent = 'Nessuna opera per questo museo.';
      artworkEL.appendChild(emptyLi);
      return;
    }
 
    if (mine.length > 0) {
      artworkEL.appendChild(sectionHeader('Le tue opere'));
      for (const artwork of mine) {
        artworkEL.appendChild(renderArtworkCard(artwork));
      }
    }
 
    if (others.length > 0) {
      artworkEL.appendChild(sectionHeader('Altre opere del museo'));
      for (const artwork of others) {
        artworkEL.appendChild(renderOtherArtworkCard(artwork));
      }
    }
  } catch {
    // se le opere non si caricano, la sezione resta vuota — i
    // contenuti sotto restano comunque consultabili
  }
}
 
function sectionHeader(text) {
  const li = document.createElement('li');
  li.className = 'status-message';
  li.style.fontWeight = 'bold';
  li.textContent = text;
  return li;
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
    await loadArtworks();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare l\'opera.');
  }
}
 
// Opere di altri autori: niente Modifica/Elimina (non sono tue), al
// loro posto Adotta/Acquisisci — sempre visibili qui, anche per opere
// già licenziate (a differenza del pannello "da adottare o acquisire"
// di visit-editor, che le nasconde una volta ottenute): questa lista
// serve a farsi un'idea di tutto il museo, non solo di cosa manca.
function renderOtherArtworkCard(artwork) {
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
 
  const adoptBtn = document.createElement('button');
  adoptBtn.textContent = `Adotta`;
  adoptBtn.addEventListener('click', () => handleAdopt(artwork, adoptBtn));
  actions.appendChild(adoptBtn);
 
  // Acquisire richiede ruolo autore/admin lato server (stessa
  // restrizione di chi può creare opere): il bottone non si mostra
  // nemmeno a un 'visitatore', invece di mostrarlo e farlo fallire.
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
    await loadArtworks(); // l'opera resta nel gruppo "altre", ma ora è licenziata
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
    await loadArtworks(); // l'opera passa dal gruppo "altre" a "le tue"
  } catch (err) {
    window.alert(err.message || 'Impossibile completare l\'acquisizione.');
    button.disabled = false;
    button.textContent = `Acquisisci (${artwork.acquisitionPrice}€)`;
  }
}

function showList(which) {
  const showA = which === 'a';
  visitEl.classList.toggle('visible', showA);
  artworkEL.classList.toggle('visible', !showA);
  btnA.classList.toggle('active', showA);
  btnB.classList.toggle('active', !showA);
  slideBg(showA ? 0 : 1);
}

function slideBg(n) {
  const bgOffset = 50 * n;
  switchContainer.style.setProperty("--bg-offset", `${bgOffset}%`);
}