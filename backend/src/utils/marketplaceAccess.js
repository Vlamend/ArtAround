import User from '../models/user.js';
import Item from '../models/item.js';
import Visit from '../models/visit.js';

// Id delle Artwork per cui l'utente ha una licenza esplicita (adozione
// o acquisizione) — usato per completare il criterio di accessibilità
// ovunque serva (Content, step di una Visit, lista opere acquistabili).
// Un'unica funzione, così i tre punti che ne hanno bisogno non
// divergono nel tempo l'uno dall'altro.
export async function getLicensedArtworkIds(userId) {
    if (!userId) return [];
    const user = await User.findById(userId, 'licenses.artwork');
    return (user?.licenses ?? []).map(l => l.artwork.toString());
}

// Criterio di accessibilità "posso usarla adesso, senza fare nulla di
// nuovo": adozione gratuita, o sono il proprietario, o ho già una
// licenza. Va combinato con isPublic=true da chi chiama (qui non
// c'entra: un'opera non pubblica non è accessibile a prescindere da
// tutto il resto, quello lo decide il chiamante).
export function accessibleOrClause(userId, licensedArtworkIds) {
    const clauses = [{ adoptionPrice: 0 }];
    if (userId) {
        clauses.push({ owner: userId });
        if (licensedArtworkIds.length > 0) {
            clauses.push({ _id: { $in: licensedArtworkIds } });
        }
    }
    return clauses;
}

// Un content è "in uso" se un qualunque step di una qualunque Visit
// (di chiunque, non solo del proprietario) lo referenzia. Query
// diretta su Visit.steps.item, non una reference salvata da tenere
// sincronizzata: è più lenta di una copia cache, ma non può mai
// disallinearsi da sé stessa, ed è comunque un controllo eseguito solo
// al momento (raro) di una cancellazione, non ad ogni lettura.
export async function isItemUsedInAnyVisit(itemId) {
    return Visit.exists({ 'steps.item': itemId });
}

// Stesso controllo, esteso a TUTTI i Content di una data Artwork —
// usato da deleteArtwork: un'opera non va cancellata se anche solo uno
// dei suoi content è usato in una visita di qualcuno.
export async function isArtworkContentUsedInAnyVisit(artworkId) {
    const items = await Item.find({ artwork: artworkId }, '_id');
    if (items.length === 0) return false;
    return Visit.exists({ 'steps.item': { $in: items.map(i => i._id) } });
}
