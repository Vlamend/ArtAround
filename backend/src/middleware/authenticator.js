import jwt from "jsonwebtoken";

/*
 * Controlla che il token JWT sia presente e valido.
 */
export function authenticateToken(req, res, next) {
    if (!process.env.JWT_SECRET){
        return res.status(500).json({ error: "JWT_SECRET non configurato" });
    }
    // Controllo che l'header Authorization sia presente
    const authHeader = req.headers["authorization"];

    // Il token deve arrivare come: "Bearer <token>"
    const token = authHeader?.split(" ")[1];
    // Se il token non è presente, l'utente non è autenticato
    if (!token) {
        return res.status(401).json({ error: "Token mancante. Accesso negato." });
    }
    // Verifico il token
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    }
    // Se il token non è valido, l'utente non è autenticato
    catch(err){
        return res.status(403).json({ error: "Token non valido." });
    }
}

/*
 * Permettere solo agli admin di accedere a una route.
 * Va usato dopo authenticateToken.
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Permessi insufficienti: richiede ruolo admin." });
    }
    next();
}

/*
 * Permette l'accesso solo a chi ha uno dei ruoli indicati.
 * Va usato dopo authenticateToken. Esempio: requireRole('autore', 'admin')
 * per una route che 'visitatore' non può usare (es. creare opere) —
 * admin include sempre le capacità di autore, va elencato esplicitamente
 * ogni volta perché i ruoli non sono gerarchici a livello di codice,
 * solo per convenzione di chi li assegna.
 */
export function requireRole(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: `Permessi insufficienti: richiede uno di questi ruoli: ${allowedRoles.join(', ')}.` });
        }
        next();
    };
}

/*
 * Permette l'accesso sia agli utenti autenticati che a quelli anonimi.
 * Se il token è presente e valido, aggiunge req.user.
 * Se il token non è presente o non valido, prosegue come richiesta anonima.
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
 
    if (!token) {
        return next(); // nessun token: richiesta anonima
    }
 
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        // token presente ma non valido/scaduto: ignoriamo silenziosamente,
        // trattiamo la richiesta come anonima
    }
    next();
}