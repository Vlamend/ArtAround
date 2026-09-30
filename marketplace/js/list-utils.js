// Funzioni di ordinamento e paginazione condivise tra la lista delle opere e quella
// delle visite della pagina contents. Non conoscono il tipo di dati: ricevono
// i dati o una funzione da richiamare e non modificano lo stato di chi le usa.

/*
 * Restituisce una copia ordinata dell'array secondo il criterio scelto:
 * 'property' per username del proprietario, 'title-asc' / 'title-desc' per titolo,
 * 'newest' per ultima modifica. Con qualsiasi altro valore mantiene l'ordine attuale.
 */
export function sortByField(items, sortBy) {
    return [...items].sort((a, b) => {
        switch (sortBy) {
            case 'property':
                return a.owner.username.localeCompare(b.owner.username);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'newest':
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            default:
                return 0;
        }
    });
}

/*
 * Disegna i controlli di paginazione dentro `container` e il testo "1–25 di 120" dentro `infoEl`.
 * 1. Se c'è una sola pagina mostra solo il testo.
 * 2. Altrimenti mostra i pulsanti prima/ultima pagina e al massimo 3 numeri di pagina
 * attorno a quella corrente. Il pulsante della pagina corrente è evidenziato e
 * quelli di prima/ultima sono disabilitati quando non servono.
 * 3. Quando l'utente sceglie una pagina chiama onPageChange(pagina):
 * cosa fare dopo (di solito ridisegnare la lista) lo decide chi la chiama.
 */
export function renderPagination({ container, infoEl, totalItems, currentPage, pageSize, onPageChange }) {
    const maxPages = Math.ceil(totalItems / pageSize) || 1;
    container.innerHTML = '';
    infoEl.textContent = totalItems === 0
        ? '0-0 di 0'
        : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} di ${totalItems}`;

    if (maxPages <= 1) return;

    const firstBtn = paginationButton(' << ');
    container.appendChild(firstBtn);

    let firstPage = 1;
    let lastPage = Math.min(3, maxPages);
    if (maxPages > 3) {
        if (currentPage === 1) {
            firstPage = 1;
            lastPage = 3;
        } else if (currentPage === maxPages) {
            lastPage = maxPages;
            firstPage = maxPages - 2;
        } else {
            firstPage = currentPage - 1;
            lastPage = currentPage + 1;
        }
    }

    for (let i = firstPage; i <= lastPage; i++) {
        const button = paginationButton(String(i));
        if (i === currentPage) button.classList.add('active');
        button.addEventListener('click', () => onPageChange(i));
        container.appendChild(button);
    }

    const lastBtn = paginationButton(' >> ');
    container.appendChild(lastBtn);

    if (currentPage === 1) firstBtn.classList.add('disabled');
    if (currentPage === maxPages) lastBtn.classList.add('disabled');

    firstBtn.addEventListener('click', () => onPageChange(1));
    lastBtn.addEventListener('click', () => onPageChange(maxPages));
}

// Crea un pulsante di paginazione. Il testo è sempre generato qui (frecce o numero di pagina),
// mai scritto dall'utente, quindi non serve escapeHtml.
function paginationButton(label) {
    const a = document.createElement('a');
    a.classList.add('pagination-button');
    a.innerHTML = `
    <svg class="pagination-border" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="17" />
    </svg>
    <span>${label}</span>
  `;
    return a;
}