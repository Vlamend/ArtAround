import { requireAuth } from './auth-guard.js';
import {
  getMuseumById, getArtworks,
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
const artworkSelect = document.getElementById('artwork');
const newArtworkLink = document.getElementById('new-artwork-link');
const textsListEl = document.getElementById('texts-list');

main();

async function main() {
  const params = new URLSearchParams(window.location.search);
  itemId = params.get('id');
  museumId = params.get('museum');
  const preselectedArtwork = params.get('artwork');

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
    if (preselectedArtwork) artworkSelect.dataset.pendingValue = preselectedArtwork;
  }

  if (!museumId) {
    return; // loadExistingItem può aver fallito e già mostrato l'errore
  }

  await loadArtworks();
  newArtworkLink.href = `artwork-editor?museum=${museumId}`;

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
    const artwork = item.artwork;
    museumId = artwork?.museum?._id ?? artwork?.museum ?? museumId;

    // Solo il PROPRIETARIO dell'artwork può modificare i suoi content
    // (license/isPublic/price/owner vivono lì ora, non più sul
    // content stesso).
    const ownerId = artwork?.owner?._id ?? artwork?.owner;
    if (ownerId !== currentUser.id) {
      statusEl.hidden = false;
      statusEl.className = 'error-message';
      statusEl.textContent = 'Non sei il proprietario dell\'opera a cui appartiene questo contenuto: non puoi modificarlo.';
      form.hidden = true;
      museumId = null;
      return;
    }

    titleEl.textContent = `Modifica — ${artwork?.title ?? 'contenuto'}`;
    submitBtn.textContent = 'Salva modifiche';
    deleteBtn.hidden = false;
    deleteBtn.addEventListener('click', handleDelete);
    document.getElementById('edit-artwork-link').href = `artwork-editor?id=${artwork?._id}`;

    document.getElementById('language').value = item.language ?? 'medio';
    document.getElementById('tags').value = (item.tags ?? []).join(', ');

    for (const checkbox of document.querySelectorAll('.domain-checkbox')) {
      checkbox.checked = (item.domains ?? []).includes(checkbox.value);
    }

    texts = (item.texts ?? []).map(t => ({ duration: t.duration, content: t.content }));

    // L'opera va selezionata DOPO che le option sono state popolate da
    // loadArtworks(): salviamo l'id target e lo applichiamo lì.
    artworkSelect.dataset.pendingValue = artwork?._id ?? '';
  } catch {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Non riesco a caricare questo contenuto.';
    form.hidden = true;
    museumId = null;
  }
}

async function loadArtworks() {
  try {
    const [museum, artworks] = await Promise.all([
      getMuseumById(museumId).catch(() => null),
      getArtworks({ museum: museumId, mine: 'true' }) // solo le opere possedute: sono le uniche su cui si può creare/modificare content
    ]);

    if (museum && (!mode || mode === 'create')) {
      titleEl.textContent = `Nuovo contenuto — ${museum.name}`;
    }

    for (const artwork of artworks) {
      const option = document.createElement('option');
      option.value = artwork._id;
      option.textContent = artwork.title;
      artworkSelect.appendChild(option);
    }

    if (artworkSelect.dataset.pendingValue) {
      artworkSelect.value = artworkSelect.dataset.pendingValue;
    }
  } catch {
    // se le opere non si caricano, il select resta con la sola opzione placeholder
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

  if (!artworkSelect.value) {
    errorEl.textContent = 'Seleziona l\'opera a cui si riferisce questo contenuto.';
    errorEl.hidden = false;
    return;
  }

  const domains = [...document.querySelectorAll('.domain-checkbox:checked')].map(c => c.value);

  const payload = {
    artwork: artworkSelect.value,
    language: document.getElementById('language').value,
    domains,
    tags: document.getElementById('tags').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    texts: validTexts
  };

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'create' ? 'Creazione…' : 'Salvataggio…';

  try {
    if (mode === 'create') {
      await createItem(payload);
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
