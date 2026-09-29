import { requireAuth } from './auth-guard.js';
import {
  getMuseumById, getArtworkById, createArtwork, updateArtwork, deleteArtwork,
  getAuthors, createAuthor, getStyles, createStyle
} from './api.js';
import { initContentEditor } from './content-editor.js';

let mode; // 'create' | 'edit'
let museumId;
let artworkId;

const titleEl = document.getElementById('page-title');
const statusEl = document.getElementById('status');
const form = document.getElementById('artwork-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');
const roomSelect = document.getElementById('room');
const authorSelect = document.getElementById('author-select');
const styleSelect = document.getElementById('style-select');
const backLink = document.getElementById('back-link');

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  artworkId = params.get('id');
  museumId = params.get('museum');

  if (!artworkId && !museumId) {
    window.location.href = 'museums';
    return;
  }

  const currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  mode = artworkId ? 'edit' : 'create';

  if (mode === 'edit') {
    await loadExistingArtwork(currentUser);
  } else {
    titleEl.textContent = 'Nuova opera';
    submitBtn.textContent = 'Crea opera';
  }

  if (!museumId) {
    return; // loadExistingArtwork può aver fallito e già mostrato l'errore
  }

  // Sezione Content sbloccata solo se l'opera esiste già (ha un id):
  // finché è in creazione non c'è nulla a cui agganciare un Content.
  if (mode === 'edit') {
    await initContentEditor(artworkId);
  }

  await Promise.all([loadRooms(), loadAuthors(), loadStyles()]);

  backLink.href = `contents?museum=${museumId}`;
  document.getElementById('create-author-btn').addEventListener('click', handleCreateAuthor);
  document.getElementById('create-style-btn').addEventListener('click', handleCreateStyle);
  form.addEventListener('submit', handleSubmit);
}

async function loadExistingArtwork(currentUser) {
  try {
    const artwork = await getArtworkById(artworkId);
    museumId = artwork.museum?._id ?? artwork.museum;
    const ownerId = artwork.owner?._id ?? artwork.owner;
    if (ownerId !== currentUser.id) {
      statusEl.hidden = false;
      statusEl.className = 'error-message';
      statusEl.textContent = 'Non sei il proprietario di questa opera: non puoi modificarla.';
      form.hidden = true;
      museumId = null;
      return;
    }

    titleEl.textContent = `Modifica — ${artwork.title}`;
    submitBtn.textContent = 'Salva modifiche';
    deleteBtn.hidden = false;
    deleteBtn.addEventListener('click', handleDelete);
    document.getElementById('title').value = artwork.title ?? '';
    document.getElementById('year').value = artwork.year ?? '';
    document.getElementById('technique').value = artwork.technique ?? '';
    document.getElementById('dimensions').value = artwork.dimensions ?? '';
    document.getElementById('image').value = artwork.image ?? '';
    document.getElementById('coord-x').value = artwork.coords?.x ?? 0;
    document.getElementById('coord-y').value = artwork.coords?.y ?? 0;
    document.getElementById('license').value = artwork.license ?? 'CC-BY';
    document.getElementById('adoption-price').value = artwork.adoptionPrice ?? 0;
    document.getElementById('acquisition-price').value = artwork.acquisitionPrice ?? 0;
    document.getElementById('is-public').checked = !!artwork.isPublic;
    // Sala/autore/stile vanno selezionati DOPO che le rispettive
    // option sono state popolate (loadRooms/loadAuthors/loadStyles):
    // salviamo l'id target e lo applichiamo lì.
    roomSelect.dataset.pendingValue = artwork.roomId ?? '';
    authorSelect.dataset.pendingValue = artwork.author?._id ?? '';
    styleSelect.dataset.pendingValue = artwork.style?._id ?? '';
  } catch {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare questa opera.';
    form.hidden = true;
    museumId = null;
  }
}

async function loadRooms() {
  try {
    const museum = await getMuseumById(museumId);
    if (mode === 'create') {
      titleEl.textContent = `Nuova opera — ${museum.name}`;
    }

    for (const room of museum.rooms ?? []) {
      const option = document.createElement('option');
      option.value = room._id;
      option.textContent = room.name;
      roomSelect.appendChild(option);
    }

    if (roomSelect.dataset.pendingValue) {
      roomSelect.value = roomSelect.dataset.pendingValue;
    }
  } catch {
    // se le sale non si caricano, il campo resta con la sola opzione "nessuna"
  }
}

async function loadAuthors() {
  try {
    const authors = await getAuthors();
    fillSelect(authorSelect, authors);
  } catch {
    // se gli autori non si caricano, il campo resta con la sola opzione "nessuno"
  }
}

async function loadStyles() {
  try {
    const styles = await getStyles();
    fillSelect(styleSelect, styles);
  } catch {
    // se gli stili non si caricano, il campo resta con la sola opzione "nessuno"
  }
}

function fillSelect(select, entities) {
  // Rimuove le eventuali option create da un caricamento precedente
  // (es. dopo la creazione rapida di un nuovo autore/stile), tenendo
  // solo la prima opzione "— nessuno —".
  while (select.options.length > 1) select.remove(1);

  for (const entity of entities) {
    const option = document.createElement('option');
    option.value = entity._id;
    option.textContent = entity.name;
    select.appendChild(option);
  }

  if (select.dataset.pendingValue) {
    select.value = select.dataset.pendingValue;
  }
}

async function handleCreateAuthor() {
  const name = document.getElementById('new-author-name').value.trim();
  if (!name) {
    window.alert('Il nome dell\'autore è obbligatorio.');
    return;
  }

  const bio = document.getElementById('new-author-bio').value.trim();
  const payload = {
    name,
    birthYear: document.getElementById('new-author-birth').value.trim() || undefined,
    deathYear: document.getElementById('new-author-death').value.trim() || undefined,
    bio: bio ? [{ duration: '15s', content: bio }] : []
  };

  try {
    const author = await createAuthor(payload);
    authorSelect.dataset.pendingValue = author._id;
    await loadAuthors();
    document.getElementById('new-author-name').value = '';
    document.getElementById('new-author-birth').value = '';
    document.getElementById('new-author-death').value = '';
    document.getElementById('new-author-bio').value = '';
  } catch (err) {
    window.alert(err.message || 'Impossibile creare l\'autore.');
  }
}

async function handleCreateStyle() {
  const name = document.getElementById('new-style-name').value.trim();
  if (!name) {
    window.alert('Il nome dello stile è obbligatorio.');
    return;
  }

  const description = document.getElementById('new-style-description').value.trim();
  const payload = {
    name,
    period: document.getElementById('new-style-period').value.trim() || undefined,
    description: description ? [{ duration: '15s', content: description }] : []
  };

  try {
    const style = await createStyle(payload);
    styleSelect.dataset.pendingValue = style._id;
    await loadStyles();
    document.getElementById('new-style-name').value = '';
    document.getElementById('new-style-period').value = '';
    document.getElementById('new-style-description').value = '';
  } catch (err) {
    window.alert(err.message || 'Impossibile creare lo stile.');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  errorEl.hidden = true;
  statusEl.hidden = true;

  const payload = {
    title: document.getElementById('title').value.trim(),
    year: document.getElementById('year').value.trim(),
    technique: document.getElementById('technique').value.trim(),
    dimensions: document.getElementById('dimensions').value.trim(),
    image: document.getElementById('image').value.trim(),
    roomId: roomSelect.value || null,
    coords: {
      x: Number(document.getElementById('coord-x').value) || 0,
      y: Number(document.getElementById('coord-y').value) || 0
    },
    author: authorSelect.value || null,
    style: styleSelect.value || null,
    license: document.getElementById('license').value,
    adoptionPrice: Number(document.getElementById('adoption-price').value) || 0,
    acquisitionPrice: Number(document.getElementById('acquisition-price').value) || 0,
    isPublic: document.getElementById('is-public').checked
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
      const artwork = await createArtwork({ ...payload, museum: museumId });
      // Transizione sul posto invece di un redirect a item-editor:
      // l'opera esiste ora, si sblocca la sezione Content sulla STESSA
      // pagina — niente più passaggio da un'altra schermata per
      // scrivere il primo testo.
      artworkId = artwork._id;
      mode = 'edit';
      titleEl.textContent = `Modifica — ${artwork.title}`;
      deleteBtn.hidden = false;
      deleteBtn.addEventListener('click', handleDelete);
      window.history.replaceState({}, '', `artwork-editor?id=${artworkId}`);
      await initContentEditor(artworkId);
    } else {
      await updateArtwork(artworkId, payload);
      // Niente redirect qui: si resta sulla pagina apposta, perché lo
      // scopo di questa sezione è proprio poter gestire anche i
      // Content senza uscire — un redirect via da qui vanificherebbe
      // il motivo per cui è stata integrata.
      statusEl.hidden = false;
      statusEl.className = 'status-message';
      statusEl.textContent = 'Opera aggiornata.';
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salva modifiche';
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile salvare l\'opera.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'create' ? 'Crea opera' : 'Salva modifiche';
  }
}

async function handleDelete() {
  if (!window.confirm('Eliminare questa opera? Fallisce se ci sono ancora content collegati o se è usata in una visita. L\'operazione non è reversibile.')) {
    return;
  }
  try {
    await deleteArtwork(artworkId);
    window.location.href = `contents?museum=${museumId}`;
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare l\'opera.');
  }
}