export function notFound(req, res) {
    res.status(404).json({ error: `Risorsa non trovata: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Errore interno del server' });
}