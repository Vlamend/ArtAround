import { requireAuth } from './auth-guard.js';
import { getMuseums, getConfig, updateConfig } from './api.js';

const statusEl = document.getElementById('status');
const errorEl = document.getElementById('form-error');
const form = document.getElementById('config-form');
const submitBtn = document.getElementById('submit-btn');
const museumSelect = document.getElementById('museum-slug');

main();

/*
 * Pagina di modifica della config del Navigator (solo admin).
 * 1. Verifica il login con requireAuth.
 * 2. Se l'utente non è admin nasconde il form e mostra un messaggio.
 * 3. Altrimenti carica i musei e la config attuale e attiva il salvataggio.
 */
async function main() {
  const currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  // Il server protegge già la route, ma il form si nasconde anche qui:
  // un non-admin non deve nemmeno vederlo, non solo ricevere un errore dopo averlo compilato.
  if (currentUser.role !== 'admin') {
    statusEl.hidden = false;
    statusEl.className = 'error-message';
    statusEl.textContent = 'Solo un admin può modificare questa configurazione.';
    form.hidden = true;
    return;
  }

  await loadMuseums();
  await loadCurrentConfig();

  form.addEventListener('submit', handleSubmit);
}

// Riempie il menu a tendina con i musei (il valore di ogni opzione è lo slug). Un museo si sceglie, non si scrive a mano.
async function loadMuseums() {
  try {
    const museums = await getMuseums();
    museumSelect.innerHTML = '<option value="">— seleziona un museo —</option>';
    for (const museum of museums) {
      const option = document.createElement('option');
      option.value = museum.slug;
      option.textContent = museum.name;
      museumSelect.appendChild(option);
    }
  } catch {
    museumSelect.innerHTML = '<option value="">— impossibile caricare i musei —</option>';
  }
}

// Precompila il form con la config attuale
async function loadCurrentConfig() {
  try {
    const config = await getConfig();
    document.getElementById('title').value = config.title ?? '';
    document.getElementById('logo').value = config.logo ?? '';
    if (config.museumSlug) {
      museumSelect.value = config.museumSlug;
    }
  } catch {
    // Se la config non si carica il form resta vuoto e se ne può salvare una nuova
  }
}

/*
 * Alla conferma del form:
 * 1. Controlla che museo e titolo siano compilati.
 * 2. Invia la config al server con updateConfig.
 * 3. Mostra l'esito. L'app Navigator legge la nuova config solo al suo prossimo caricamento.
 */
async function handleSubmit(e) {
  e.preventDefault();
  errorEl.hidden = true;

  const payload = {
    museumSlug: museumSelect.value,
    title: document.getElementById('title').value.trim(),
    logo: document.getElementById('logo').value.trim()
  };

  if (!payload.museumSlug || !payload.title) {
    errorEl.textContent = 'Museo e titolo sono obbligatori.';
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvataggio…';

  try {
    await updateConfig(payload);
    statusEl.hidden = false;
    statusEl.className = 'status-message';
    statusEl.textContent = 'Configurazione salvata. Chi ha già l\'app Navigator aperta la vedrà al prossimo caricamento.';
  } catch (err) {
    errorEl.textContent = err.message || 'Impossibile salvare la configurazione.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salva configurazione';
  }
}
