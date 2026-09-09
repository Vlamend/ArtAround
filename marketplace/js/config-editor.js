import { requireAuth } from './auth-guard.js';
import { getMuseums, getConfig, updateConfig } from './api.js';

const statusEl = document.getElementById('status');
const errorEl = document.getElementById('form-error');
const form = document.getElementById('config-form');
const submitBtn = document.getElementById('submit-btn');
const museumSelect = document.getElementById('museum-slug');

main();

async function main() {
  const currentUser = await requireAuth();
  if (!currentUser) {
    return; // requireAuth ha già gestito il redirect al login
  }

  // Anche se la route è già protetta lato server (requireAdmin — vedi
  // server.js), la pagina si blocca anche qui: un non-admin non deve
  // nemmeno vedere il form, non solo fallire il salvataggio dopo
  // averlo compilato.
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

async function loadCurrentConfig() {
  try {
    const config = await getConfig();
    document.getElementById('title').value = config.title ?? '';
    document.getElementById('logo').value = config.logo ?? '';
    if (config.museumSlug) {
      museumSelect.value = config.museumSlug;
    }
  } catch {
    // se la config attuale non si carica, il form resta vuoto: si può
    // comunque compilarlo e salvarne una nuova da zero
  }
}

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
