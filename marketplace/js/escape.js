/*
 * Sostituisce i caratteri speciali dell'HTML (& < > " ') con le loro entità.
 * Va usata su ogni testo scritto dagli utenti (titoli, username, ...) prima di
 * inserirlo in un template per innerHTML: senza, un titolo come <img onerror=...>
 * verrebbe eseguito nel browser di chiunque apra la pagina (attacco XSS).
 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}