import jwt from "jsonwebtoken";
/*
 * Controlla che il JWT token sia presente e valido.
 * 1. Controlla che ci sia l'header authorization nella request.
 * 2. Si estrare il token che viene mandato come "Bearer <token>
 * "(basta uno split al carattere " " e prendere il secondo elemento)
 * 3. Se il token non esiste allora ritorno stato 401 (Unauthorized).
 * 4. Altrimenti provo a verificare il token.
 * 5. Se il jwt.verify restituisce errore, l'errore viene catturato dal try-catch
 * sempre con stato 401, altrimenti va avanti la richiesta concludendola.
 */
export function authenticateToken(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: "JWT_SECRET non configurato" });
    }
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Token mancante. Accesso negato." });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    }
    catch (err) {
        return res.status(403).json({ error: "Token non valido." });
    }
}
/*
 * Permettere solo agli admin di accedere a una route.
 * Va usato dopo authenticateToken 
 * (controllo il role solo se effettivamente c'è un utente autenticato).
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Permessi insufficienti: richiede ruolo admin." });
    }
    next();
}
/*
 * Permette l'accesso solo a chi ha uno dei ruoli indicati.
 * Va usato dopo authenticateToken. 
 * Esempio: requireRole('autore', 'admin) blocca solo i visitatori
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
 * Se il token non è presente o non valido, prosegue come richiesta anonima (silenziosamente, nessun errore).
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    if (!token) {
        return next();
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
    }
    next();
}