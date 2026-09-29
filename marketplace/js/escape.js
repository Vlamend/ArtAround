// Escape dei caratteri speciali HTML. Da usare su OGNI valore inserito in
// un template passato a innerHTML che possa contenere testo scritto da un
// utente (titoli, username, ecc.): senza, un titolo come <img onerror=...>
// verrebbe eseguito nel browser di chiunque apra la lista.
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}