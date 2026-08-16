import jwt from "jsonwebtoken";

/**
 * Middleware principale:
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

/**
 * Middleware per permettere solo agli admin di accedere a una route.
 * Va usato dopo authenticateToken.
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Permessi insufficienti: richiede ruolo admin." });
    }
    next();
}
