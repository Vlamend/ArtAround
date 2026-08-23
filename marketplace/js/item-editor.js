import { requireAuth } from './auth-guard.js';
import {
  getMuseumById,
  getItemById, createItem, updateItem, deleteItem
} from './api.js';

const DURATIONS = ['3s', '15s', '40s', '1min', '4min'];

let mode; // 'create' | 'edit'
let museumId;
let itemId;
let currentUser;
let texts = []; // { duration, content }

const titleEl = document.getElementById('page-title');
const statusEl = document.getElementById('status');
const backLink = document.getElementById('back-link');
const form = document.getElementById('item-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');
const roomSelect = document.getElementById('room');
const textsListEl = document.getElementById('texts-list');

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  itemId = params.get('id');
  museumId = params.get('museum');

  if (!itemId && !museumId) {
    window.location.href = 'museums';
    return;
  }

  currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  mode = itemId ? 'edit' : 'create';

  if (mode === 'edit') {
    await loadExistingItem();
  } else {
    titleEl.textContent = 'Nuovo contenuto';
    submitBtn.textContent = 'Crea contenuto';
  }

  if (!museumId) {
    return; // loadExistingItem può aver fallito e già mostrato l'errore
  }

  await loadRooms();

  if (texts.length === 0) {
    addTextRow(); // parte sempre con almeno un testo da compilare
  }
  renderTexts();

  backLink.href = `items?museum=${museumId}`;
  document.getElementById('add-text-btn').addEventListener('click', () => {
    addTextRow();
    renderTexts();
  });
  form.addEventListener('submit', handleSubmit);
}

async function loadExistingItem() {
  try {
    const item = await getItemById(itemId);

    if (item.author !== currentUser.id && item.author?._id !== currentUser.id) {
      statusEl.hidden = false;
      statusEl.className = 'error-message';
      statusEl.textContent = 'Non sei l\'autore di questo contenuto: non puoi modificarlo.';
      form.hidden = true;
      museumId = null;
      return;
    }

    museumId = item.museum?._id ?? item.museum;
    titleEl.textContent = `Modifica — ${item.title}`;
    submitBtn.textContent = 'Salva modifiche';
    deleteBtn.hidden = false;
    deleteBtn.addEventListener('click', handleDelete);

    document.getElementById('title').value = item.title ?? '';
    document.getElementById('type').value = item.type ?? 'object';
    document.getElementById('year').value = item.year ?? '';
    document.getElementById('technique').value = item.technique ?? '';
    document.getElementById('dimensions').value = item.dimensions ?? '';
    document.getElementById('image').value = item.image ?? '';
    document.getElementById('coord-x').value = item.coords?.x ?? 0;
    document.getElementById('coord-y').value = item.coords?.y ?? 0;
    document.getElementById('wikidata-id').value = item.wikidataId ?? '';
    document.getElementById('artist-wikidata').value = item.artistWikidata ?? '';
    document.getElementById('style-wikidata').value = item.styleWikidata ?? '';
    document.getElementById('language').value = item.language ?? 'medio';
    document.getElementById('license').value = item.license ?? 'CC-BY';
    document.getElementById('price').value = item.price ?? 0;
    document.getElementById('is-public').checked = !!item.isPublic;
    document.getElementById('tags').value = (item.tags ?? []).join(', ');

    texts = (item.texts ?? []).map(t => ({ duration: t.duration, content: t.content }));

    // La sala va selezionata DOPO che le option sono state popolate da
    // loadRooms(): salviamo l'id target e lo applichiamo lì.
    roomSelect.dataset.pendingValue = item.roomId ?? '';
  } catch {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare questo contenuto.';
    form.hidden = true;
    museumId = null;
  }
}

async function loadRooms() {
  try {
    const museum = await getMuseumById(museumId);
    if (!mode || mode === 'create') {
      titleEl.textContent = `Nuovo contenuto — ${museum.name}`;
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

function addTextRow() {
  texts.push({ duration: '15s', content: '' });
}

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
    durationSelect.addEventListener('change', () => {
      text.duration = durationSelect.value;
    });

    const contentArea = document.createElement('textarea');
    contentArea.rows = 2;
    contentArea.placeholder = 'Testo per questa durata…';
    contentArea.value = text.content;
    contentArea.addEventListener('input', () => {
      text.content = contentArea.value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'danger';
    removeBtn.textContent = 'Rimuovi testo';
    removeBtn.disabled = texts.length === 1; // almeno un testo è obbligatorio
    removeBtn.addEventListener('click', () => {
      texts.splice(index, 1);
      renderTexts();
    });

    row.append(durationSelect, contentArea, removeBtn);
    textsListEl.appendChild(row);
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  errorEl.hidden = true;

  const validTexts = texts.filter(t => t.content.trim() !== '');
  if (validTexts.length === 0) {
    errorEl.textContent = 'Aggiungi almeno un testo con contenuto.';
    errorEl.hidden = false;
    return;
  }

  const payload = {
    title: document.getElementById('title').value.trim(),
    type: document.getElementById('type').value,
    year: document.getElementById('year').value.trim(),
    technique: document.getElementById('technique').value.trim(),
    dimensions: document.getElementById('dimensions').value.trim(),
    image: document.getElementById('image').value.trim(),
    roomId: roomSelect.value || null,
    coords: {
      x: Number(document.getElementById('coord-x').value) || 0,
      y: Number(document.getElementById('coord-y').value) || 0
    },
    wikidataId: document.getElementById('wikidata-id').value.trim(),
    artistWikidata: document.getElementById('artist-wikidata').value.trim(),
    styleWikidata: document.getElementById('style-wikidata').value.trim(),
    language: document.getElementById('language').value,
    license: document.getElementById('license').value,
    price: Number(document.getElementById('price').value) || 0,
    isPublic: document.getElementById('is-public').checked,
    tags: document.getElementById('tags').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    texts: validTexts
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
      await createItem({ ...payload, museum: museumId });
    } else {
      await updateItem(itemId, payload);
    }
    window.location.href = `items?museum=${museumId}`;
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile salvare il contenuto.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'create' ? 'Crea contenuto' : 'Salva modifiche';
  }
}

async function handleDelete() {
  if (!window.confirm('Eliminare questo contenuto? L\'operazione non è reversibile.')) {
    return;
  }
  try {
    await deleteItem(itemId);
    window.location.href = `items?museum=${museumId}`;
  } catch (err) {
    window.alert(err.message || 'Impossibile eliminare il contenuto.');
  }
}
