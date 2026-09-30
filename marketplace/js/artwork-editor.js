import { requireAuth } from './auth-guard.js';
import {
  getMuseumById, getArtworkById, createArtwork, updateArtwork, deleteArtwork,
  getAuthors, createAuthor, getStyles, createStyle
} from './api.js';
import { initContentEditor } from './content-editor.js';

// Stato della pagina: 'create' (nuova opera) o 'edit' (opera esistente), museo e opera in uso
let mode;
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

/*
 * Pagina di creazione e modifica di un'opera.
 * 1. Legge dall'URL l'id dell'opera (modifica) o del museo (creazione). Se mancano entrambi torna alla scelta del museo.
 * 2. Verifica il login con requireAuth.
 * 3. In modifica carica l'opera; in creazione prepara i titoli della pagina.
 * 4. Carica sale, autori e stili nei menu a tendina e attiva i pulsanti della pagina.
 * La sezione Content si attiva solo se l'opera esiste già.
 */
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
    return; // in caso di errore loadExistingArtwork ha già mostrato il messaggio e azzerato museumId
  }

  // Un Content si collega a un'opera esistente: in creazione la sezione resta bloccata
  if (mode === 'edit') {
    await initContentEditor(artworkId);
  }

  await Promise.all([loadRooms(), loadAuthors(), loadStyles()]);

  backLink.href = `contents?museum=${museumId}`;
  document.getElementById('create-author-btn').addEventListener('click', handleCreateAuthor);
  document.getElementById('create-style-btn').addEventListener('click', handleCreateStyle);
  form.addEventListener('submit', handleSubmit);
}

/*
 * Carica l'opera da modificare e ne precompila il form.
 * Se l'utente non è il proprietario o l'opera non si carica, nasconde il form
 * e mostra un messaggio (museumId viene azzerato per fermare main).
 */
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
    // Sala, autore e stile si possono selezionare solo dopo che le loro option sono state caricate
    // (loadRooms, loadAuthors, loadStyles): qui si salva il valore da selezionare e lo si applica lì.
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

// Riempie il menu delle sale con quelle del museo e imposta il titolo della pagina in creazione
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
    // Se le sale non si caricano resta solo l'opzione "nessuna"
  }
}

// Riempie il menu degli autori
async function loadAuthors() {
  try {
    const authors = await getAuthors();
    fillSelect(authorSelect, authors);
  } catch {
    // Se gli autori non si caricano resta solo l'opzione "nessuno"
  }
}

// Riempie il menu degli stili
async function loadStyles() {
  try {
    const styles = await getStyles();
    fillSelect(styleSelect, styles);
  } catch {
    // Se gli stili non si caricano resta solo l'opzione "nessuno"
  }
}

/*
 * Riempie un menu a tendina con le entità indicate (autori o stili).
 * 1. Toglie le option di un caricamento precedente, tenendo solo la prima ("— nessuno —").
 * 2. Aggiunge un'option per ogni entità.
 * 3. Se c'è un valore da selezionare salvato in pendingValue lo seleziona.
 */
function fillSelect(select, entities) {
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

/*
 * Crea al volo un nuovo autore dai campi sotto il menu.
 * 1. Il nome è obbligatorio, gli altri campi sono facoltativi.
 * 2. Dopo la creazione ricarica il menu selezionando il nuovo autore e svuota i campi.
 */
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

// Crea al volo un nuovo stile, con lo stesso procedimento di handleCreateAuthor
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

/*
 * Alla conferma del form:
 * 1. Raccoglie i campi in un payload e controlla che il titolo sia compilato.
 * 2. In creazione crea l'opera, passa in modalità modifica sulla stessa pagina
 * (cambiando l'URL senza ricaricarla) e attiva la sezione Content.
 * 3. In modifica aggiorna l'opera e resta sulla pagina, per poter continuare a gestire i Content.
 * 4. Se il server rifiuta mostra il suo messaggio d'errore.
 */
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
      // L'opera ora esiste: si passa in modalità modifica senza cambiare pagina e si attiva la sezione Content
      artworkId = artwork._id;
      mode = 'edit';
      titleEl.textContent = `Modifica — ${artwork.title}`;
      deleteBtn.hidden = false;
      deleteBtn.addEventListener('click', handleDelete);
      window.history.replaceState({}, '', `artwork-editor?id=${artworkId}`);
      await initContentEditor(artworkId);
    } else {
      await updateArtwork(artworkId, payload);
      // Si resta sulla pagina perché anche i Content si gestiscono da qui
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

// Elimina l'opera dopo la conferma e torna alla lista dei contenuti. Il server rifiuta se ha Content collegati o è usata in una visita.
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