import { requireAuth } from './auth-guard.js';
import {
  getMuseumById, getArtworkById, createArtwork, updateArtwork, deleteArtwork,
  getAuthors, createAuthor, getStyles, createStyle,
  getItems, createItem, updateItem, deleteItem
} from './api.js';

const DURATIONS = ['3s', '15s', '40s', '1min', '4min'];
const LANGUAGES = ['infantile', 'elementare', 'medio', 'specialistico'];
const DOMAINS = [
  { value: 'artista', label: 'Artista' },
  { value: 'architettura', label: 'Architettura' },
  { value: 'stile', label: 'Stile' },
  { value: 'materiali', label: 'Materiali' },
  { value: 'storia', label: 'Storia' }
];

let mode; // 'create' | 'edit'
let museumId;
let artworkId;

const titleEl = document.getElementById('page-title');
const statusEl = document.getElementById('status');
const backLink = document.getElementById('back-link');
const form = document.getElementById('artwork-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');
const roomSelect = document.getElementById('room');
const authorSelect = document.getElementById('author-select');
const styleSelect = document.getElementById('style-select');

const contentLockedNote = document.getElementById('content-locked-note');
const contentListEl = document.getElementById('content-list');
const addContentBtn = document.getElementById('add-content-btn');

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
    unlockContentSection();
    await loadContents();
  }

  await Promise.all([loadRooms(), loadAuthors(), loadStyles()]);

  backLink.href = `contents?museum=${museumId}`;
  document.getElementById('create-author-btn').addEventListener('click', handleCreateAuthor);
  document.getElementById('create-style-btn').addEventListener('click', handleCreateStyle);
  form.addEventListener('submit', handleSubmit);
  addContentBtn.addEventListener('click', () => openNewContentCard());
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
      unlockContentSection();
      await loadContents();
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

/* --------------------------------------------------
 * Gestione dei Content di questa opera, inline sulla stessa pagina.
 * Ogni card si salva per conto proprio (createItem/updateItem/deleteItem
 * indipendenti) — mai un salvataggio composito con l'opera: un errore
 * su un content non deve mai compromettere il salvataggio dell'opera,
 * o viceversa.
 * -------------------------------------------------- */

function unlockContentSection() {
  contentLockedNote.hidden = true;
  addContentBtn.hidden = false;
}

async function loadContents() {
  try {
    // mine:'true' bypassa il requisito isPublic — l'owner deve vedere
    // e gestire anche i content di un'opera ancora in bozza.
    const items = await getItems({ artwork: artworkId, mine: 'true' });
    contentListEl.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'status-message';
      li.textContent = 'Nessun content ancora. Aggiungine uno.';
      contentListEl.appendChild(li);
      return;
    }

    for (const item of items) {
      contentListEl.appendChild(renderContentSummary(item));
    }
  } catch {
    // se i content non si caricano, la sezione resta vuota — il resto
    // della pagina (dati dell'opera) resta comunque consultabile
  }
}

function renderContentSummary(item) {
  const li = document.createElement('li');
  li.className = 'card';

  const domainsLabel = (item.domains ?? []).join(', ') || 'nessun ambito';
  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${item.language}</strong><br>
    <span class="status-message">${domainsLabel} · ${item.texts?.length ?? 0} testi</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Modifica';
  editBtn.addEventListener('click', () => {
    li.replaceWith(renderContentForm(item));
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'danger';
  removeBtn.textContent = 'Elimina';
  removeBtn.addEventListener('click', () => handleDeleteContent(item));

  actions.append(editBtn, removeBtn);
  li.append(info, actions);
  return li;
}

async function handleDeleteContent(item) {
  if (!window.confirm(`Eliminare il content in ${item.language}? Fallisce se è usato in una visita. L'operazione non è reversibile.`)) {
    return;
  }
  try {
    await deleteItem(item._id);
    await loadContents();
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare il content.');
  }
}

function openNewContentCard() {
  // Se la lista mostra solo il messaggio "nessun content ancora", va
  // tolto prima di aggiungere la card vera — altrimenti resterebbe
  // appeso accanto al form.
  const placeholder = contentListEl.querySelector('li.status-message');
  if (placeholder) placeholder.remove();

  contentListEl.appendChild(renderContentForm(null));
}

// item === null significa "nuovo content, non ancora salvato".
function renderContentForm(item) {
  const isNew = !item;

  const li = document.createElement('li');
  li.className = 'card';
  li.style.flexDirection = 'column';
  li.style.alignItems = 'stretch';

  const languageSelect = document.createElement('select');
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    if (lang === (item?.language ?? 'medio')) opt.selected = true;
    languageSelect.appendChild(opt);
  }
  li.appendChild(fieldLabel('Lingua', languageSelect));

  const domainCheckboxes = DOMAINS.map(({ value, label }) => {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'flex-direction: row; align-items: center; gap: 0.5rem;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.style.width = 'auto';
    checkbox.checked = (item?.domains ?? []).includes(value);
    wrapper.append(checkbox, document.createTextNode(' ' + label));
    li.appendChild(wrapper);
    return checkbox;
  });

  // Copia locale, non tocca item.texts finché non si salva davvero —
  // così "Annulla" può scartare le modifiche semplicemente non
  // chiamando mai updateItem.
  let texts = item ? item.texts.map(t => ({ duration: t.duration, content: t.content })) : [{ duration: '15s', content: '' }];
  const textsListEl = document.createElement('div');
  li.appendChild(textsListEl);

  function renderTexts() {
    textsListEl.innerHTML = '';
    texts.forEach((text, index) => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';

      const durationSelect = document.createElement('select');
      for (const d of DURATIONS) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === text.duration) opt.selected = true;
        durationSelect.appendChild(opt);
      }
      durationSelect.addEventListener('change', () => { text.duration = durationSelect.value; });

      const contentArea = document.createElement('textarea');
      contentArea.rows = 2;
      contentArea.placeholder = 'Testo per questa durata…';
      contentArea.value = text.content;
      contentArea.addEventListener('input', () => { text.content = contentArea.value; });

      const removeTextBtn = document.createElement('button');
      removeTextBtn.className = 'danger';
      removeTextBtn.textContent = 'Rimuovi testo';
      removeTextBtn.disabled = texts.length === 1; // almeno un testo è obbligatorio
      removeTextBtn.addEventListener('click', () => {
        texts.splice(index, 1);
        renderTexts();
      });

      row.append(durationSelect, contentArea, removeTextBtn);
      textsListEl.appendChild(row);
    });
  }
  renderTexts();

  const addTextBtn = document.createElement('button');
  addTextBtn.type = 'button';
  addTextBtn.textContent = '+ Aggiungi testo';
  addTextBtn.addEventListener('click', () => {
    texts.push({ duration: '15s', content: '' });
    renderTexts();
  });
  li.appendChild(addTextBtn);

  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.value = (item?.tags ?? []).join(', ');
  li.appendChild(fieldLabel('Tag (separati da virgola)', tagsInput));

  const formError = document.createElement('p');
  formError.className = 'error-message';
  formError.hidden = true;
  li.appendChild(formError);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 0.5rem;';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary';
  saveBtn.textContent = isNew ? 'Crea content' : 'Salva questo content';
  saveBtn.addEventListener('click', async () => {
    formError.hidden = true;

    const validTexts = texts.filter(t => t.content.trim() !== '');
    if (validTexts.length === 0) {
      formError.textContent = 'Aggiungi almeno un testo con contenuto.';
      formError.hidden = false;
      return;
    }

    const payload = {
      artwork: artworkId,
      language: languageSelect.value,
      domains: domainCheckboxes.filter(c => c.checked).map(c => c.value),
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      texts: validTexts
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvataggio…';

    try {
      if (isNew) {
        await createItem(payload);
      } else {
        await updateItem(item._id, payload);
      }
      await loadContents(); // ricarica l'intera lista, più semplice che aggiornare a mano lo stato locale
    } catch (err) {
      formError.textContent = err.message || 'Impossibile salvare il content.';
      formError.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Crea content' : 'Salva questo content';
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Annulla';
  cancelBtn.addEventListener('click', () => {
    if (isNew) {
      li.remove(); // niente da annullare sul server, non è mai stato salvato
      if (contentListEl.children.length === 0) {
        loadContents(); // ripristina il messaggio "nessun content ancora"
      }
    } else {
      li.replaceWith(renderContentSummary(item));
    }
  });

  actions.append(saveBtn, cancelBtn);
  li.appendChild(actions);

  return li;
}

function fieldLabel(text, input) {
  const label = document.createElement('label');
  label.textContent = text + ' ';
  label.appendChild(input);
  return label;
}