// Gestione dei Content (i testi) di una singola opera, montata inline
// nella pagina artwork-editor. Isolata in un modulo a sé perché non
// condivide nulla con il form dell'opera se non l'id dell'opera stessa:
// initContentEditor(artworkId) è l'unico punto di contatto.
import { escapeHtml } from './escape.js';
import { getItems, createItem, updateItem, deleteItem } from './api.js';

const DURATIONS = ['3s', '15s', '40s', '1min', '4min'];
const LANGUAGES = ['infantile', 'elementare', 'medio', 'specialistico'];
const DOMAINS = [
    { value: 'artista', label: 'Artista' },
    { value: 'architettura', label: 'Architettura' },
    { value: 'stile', label: 'Stile' },
    { value: 'materiali', label: 'Materiali' },
    { value: 'storia', label: 'Storia' }
];

let artworkId;

const contentLockedNote = document.getElementById('content-locked-note');
const contentListEl = document.getElementById('content-list');
const addContentBtn = document.getElementById('add-content-btn');

// Chiamata una sola volta per caricamento pagina: all'avvio se l'opera
// esiste già (mode 'edit'), oppure subito dopo una creazione riuscita.
export async function initContentEditor(id) {
    artworkId = id;
    contentLockedNote.hidden = true;
    addContentBtn.hidden = false;
    addContentBtn.addEventListener('click', () => openNewContentCard());
    await loadContents();
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
    <strong>${escapeHtml(item.language)}</strong><br>
    <span class="status-message">${escapeHtml(domainsLabel)} · ${item.texts?.length ?? 0} testi</span>
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