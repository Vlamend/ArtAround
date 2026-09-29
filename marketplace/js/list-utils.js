// Utilità generiche di lista, condivise tra la vista "opere" e la vista
// "visite" della pagina contents: ordinamento e paginazione. Non sanno
// nulla del dominio (opere/visite) — ricevono dati e un callback, non
// toccano lo stato applicativo di chi le chiama.

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

// Disegna i controlli di paginazione dentro `container` (e il testo
// "1-25 di 120" dentro `infoEl`), e richiama onPageChange(nuovaPagina)
// quando l'utente sceglie una pagina diversa — non decide da sola cosa
// succede dopo, quello resta a chi la chiama.
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

// label è sempre ' << ', ' >> ' o un numero di pagina generato qui:
// mai testo scelto dall'utente, quindi niente da proteggere con escapeHtml.
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