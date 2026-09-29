import User from '../models/user.js';
import Visit from '../models/visit.js';

//Utility che restituisce gli IDs delle Artwork per cui l'utente ha una licenza (adozione o acquisizione).
export async function getLicensedArtworkIds(userId) {
    if (!userId) return [];
    const user = await User.findById(userId, 'licenses.artwork');
    return (user?.licenses ?? []).map(l => l.artwork.toString());
}
/* 
 * Utility che imposta una serie di clausole per ottenere le opere accessibili.
 * Di base controlla che l'adozione dell'opera sia gratuita,
 * poi se alla funzione viene passato un ID utente si controlla se le opere sono dell'utente fornito
 * e per finire, se fornita la lista di licenze di quell'utente vengono anche date le opere di cui si ha la licenza.
 */
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
//Utility che controlla se l'artwork è utilizzato in delle visite.
export async function isArtworkUsedInAnyVisit(artworkId) {
    return Visit.exists({ 'steps.artwork': artworkId });
}
/* 
 * Utility che controlla se l'utente può accedere ad una opera:
 * 1. Se l'artwork non esiste allora ritorno false.
 * 2. Altrimenti controllo se l'opera è mia. Se si ritorno true.
 * 3. Altrimenti se non è pubblica ritorno false.
 * 4. Altrimenti se la sua adozione è gratutia ritorno true.
 * 5. Infine, se la richiesta ha passato l'ID utente allora controllo se tra le sue licenze ci sia quella per l'opera
 * 6. Se invece non c'è nessun accessso ritorno false.
 */
export async function canUseArtwork(artwork, userId) {
    if (!artwork) return false;
    const ownerId = (artwork.owner?._id ?? artwork.owner)?.toString();
    if (userId && ownerId === userId) return true;
    if (!artwork.isPublic) return false;
    if (artwork.adoptionPrice === 0) return true;
    if (!userId) return false;
    const licensed = await getLicensedArtworkIds(userId);
    return licensed.includes(artwork._id.toString());
}