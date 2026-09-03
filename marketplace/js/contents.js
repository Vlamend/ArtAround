import { requireAuth } from './auth-guard.js';
import { getMuseumById, getVisits, deleteVisit, getArtworks, deleteArtwork } from './api.js';

const titleEl = document.getElementById('museum-title');
const statusEl = document.getElementById('status');
const visitEl = document.getElementById('visit-list');
const artworkEL = document.getElementById('artwork-list');
const btnA = document.getElementById('btn-a');
const btnB = document.getElementById('btn-b');

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
    createLi.className = 'card';
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
    ${!visit.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">${visit.steps?.length ?? 0} tappe ${visit.price ? `· ${visit.price}€` : '· gratuita'}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (isMine) {
    const editBtn = document.createElement('button');
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

// Opere possedute: qui si gestiscono licenza/prezzo/pubblicazione,
// anche per un'opera che non ha ancora nessun content — altrimenti
// non ci sarebbe modo di raggiungerla per modificarla.
async function loadArtworks() {
  try {
    const artworks = await getArtworks({ museum: museumId, mine: 'true' });
    artworkEL.innerHTML = '';

    // Il bottone "+ Crea" va SEMPRE mostrato, quindi lo si crea qui,
    // dopo aver svuotato la lista — mai prima, altrimenti innerHTML=''
    // lo cancella insieme al resto.
    const createLi = document.createElement('li');
    createLi.className = 'card';
    createLi.id = 'new-artwork-btn';
    createLi.textContent = '+ Crea una nuova opera';
    createLi.addEventListener('click', () => {
      window.location.href = `artwork-editor?museum=${museumId}`;
    });
    artworkEL.appendChild(createLi);

    if (artworks.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'status-message';
      emptyLi.textContent = 'Non hai ancora creato opere per questo museo.';
      artworkEL.appendChild(emptyLi);
      return;
    }

    for (const artwork of artworks) {
      artworkEL.appendChild(renderArtworkCard(artwork));
    }
  } catch {
    // se le opere non si caricano, la sezione resta vuota — i
    // contenuti sotto restano comunque consultabili
  }
}

function renderArtworkCard(artwork) {
  const li = document.createElement('li');
  li.className = 'card';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${artwork.title}</strong>
    ${!artwork.isPublic ? ' <span class="status-message">(bozza)</span>' : ''}<br>
    <span class="status-message">${artwork.price ? `${artwork.price}€` : 'gratuita'} · ${artwork.license}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
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

function showList(which) {
  const showA = which === 'a';
  visitEl.classList.toggle('visible', showA);
  artworkEL.classList.toggle('visible', !showA);
  btnA.classList.toggle('active', showA);
  btnB.classList.toggle('active', !showA);
}