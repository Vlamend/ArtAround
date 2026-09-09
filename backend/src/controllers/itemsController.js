import Item from "../models/item.js";
import User from "../models/user.js";
import Artwork from "../models/artwork.js";
import { getLicensedArtworkIds, accessibleOrClause, isItemUsedInAnyVisit } from "../utils/marketplaceAccess.js";

const INTEREST_STEP = 1;
const INTEREST_MAX = 10;
const INTEREST_MIN = -10;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Calcola quali Artwork sono accessibili a chi sta chiedendo, e
// restituisce i loro id. Questo è ORA l'unico punto di controllo
// commerciale sui content: essendo license/isPublic/adoptionPrice/
// acquisitionPrice/owner spostati su Artwork, un content è
// raggiungibile se e solo se lo è la sua opera.
async function findAccessibleArtworkIds({ museum, artwork, mine, userId }) {
    const filter = {};
    if (museum) filter.museum = museum;
    if (artwork) filter._id = artwork;

    if (mine === 'true' && userId) {
        // "I miei content": quelli delle opere che possiedo ORA (non
        // necessariamente quelle che ho scritto in origine). Le opere
        // solo ADOTTATE non sono "mie" in questo senso: l'adozione dà
        // diritto d'uso, non diritti editoriali — non compaiono qui.
        filter.owner = userId;
    } else {
        filter.isPublic = true;
        // Gratis per chiunque, oppure già posseduta o già licenziata
        // (adottata o acquisita) da chi sta chiedendo. Un'opera a
        // pagamento senza nessuna di queste condizioni semplicemente
        // non risulta mai tra i risultati: niente più swap linguistico
        // o topic "dimmi di più" che regalano contenuto a pagamento.
        const licensedIds = await getLicensedArtworkIds(userId);
        filter.$or = accessibleOrClause(userId, licensedIds);
    }

    const artworks = await Artwork.find(filter, '_id');
    return artworks.map(a => a._id);
}

// Lista content, filtrabile per artwork, museo (via artwork) e livello
// linguistico. Il Navigator la usa per scegliere il content più adatto
// al profilo dell'utente (compreso lo swap linguistico e i topic del
// "dimmi di più"), il marketplace per popolare la lista dei contenuti
// gestibili.
export async function getItems(req, res) {
    try {
        const artworkIds = await findAccessibleArtworkIds({
            museum: req.query.museum,
            artwork: req.query.artwork,
            mine: req.query.mine,
            userId: req.user?.id
        });

        const filter = { artwork: { $in: artworkIds } };

        if (req.query.language) {
            filter.language = req.query.language;
        }

        // Filtro per uno o più domini (comma-separated), es.
        // ?domains=architettura,materiali,storia — usato dal Navigator
        // per recuperare, su una data opera, i topic disponibili oltre
        // a 'artista'/'stile' (che passano invece da Author/Style).
        if (req.query.domains) {
            const domainList = req.query.domains.split(',').map(d => d.trim()).filter(Boolean);
            if (domainList.length > 0) {
                filter.domains = { $in: domainList };
            }
        }

        const items = await Item.find(filter)
            .populate({
                path: 'artwork',
                populate: [
                    { path: 'author', select: 'name' },
                    { path: 'style', select: 'name' }
                ]
            });

        res.json(items);

    } catch (error) {
        console.error("Errore nel recupero dei content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio di un singolo content
export async function getItemById(req, res) {
    try {
        const item = await Item.findById(req.params.id)
            .populate({
                path: 'artwork',
                populate: [
                    { path: 'author' },
                    { path: 'style' },
                    { path: 'museum', select: 'name slug' },
                    { path: 'owner', select: 'username' }
                ]
            });

        if (!item) {
            return res.status(404).json({ error: "Content non trovato." });
        }

        res.json(item);

    } catch (error) {
        console.error("Errore nel recupero del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Creazione di un nuovo content: chi lo crea deve essere il
// PROPRIETARIO dell'artwork a cui si riferisce — il controllo
// commerciale vive sull'opera, quindi solo chi la possiede può
// aggiungerle testi (in qualunque lingua/dominio).
export async function createItem(req, res) {
    try {
        const { artwork, texts, language, tags, domains } = req.body;

        if (!artwork || !texts || texts.length === 0 || !language) {
            return res.status(400).json({ error: "Artwork, almeno un testo e il livello linguistico sono obbligatori." });
        }

        const artworkDoc = await Artwork.findById(artwork);
        if (!artworkDoc) {
            return res.status(400).json({ error: "L'artwork indicato non esiste." });
        }
        if (artworkDoc.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario di questa opera: non puoi aggiungerle contenuti." });
        }

        const newItem = new Item({ artwork, texts, language, tags, domains });
        await newItem.save();

        res.status(201).json(newItem);

    } catch (error) {
        console.error("Errore nella creazione del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Modifica di un content esistente: stesso controllo, sul
// proprietario ATTUALE dell'artwork (non su chi ha scritto il testo).
export async function updateItem(req, res) {
    try {
        const item = await Item.findById(req.params.id).populate('artwork', 'owner');

        if (!item) {
            return res.status(404).json({ error: "Content non trovato." });
        }

        if (item.artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario dell'opera a cui appartiene questo content." });
        }

        const editableFields = ['texts', 'language', 'tags', 'domains'];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                item[field] = req.body[field];
            }
        }
        // 'artwork' non è editabile: l'opera a cui un content si
        // riferisce è un fatto strutturale, non modificabile a posteriori.

        await item.save();

        res.json(item);

    } catch (error) {
        console.error("Errore nell'aggiornamento del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Cancellazione di un content: stesso controllo sul proprietario
// dell'artwork.
// Cancellazione di un content: stesso controllo sul proprietario
// dell'artwork. In più: bloccata se il content è usato nello step di
// una Visit — di CHIUNQUE, non solo del proprietario attuale. Senza
// questo, un'acquisizione seguita da una riscrittura dei content
// romperebbe silenziosamente le visite di chi aveva già adottato
// l'opera prima del cambio di proprietario — proprio il caso che
// "un'adozione, una volta ottenuta, resta valida per sempre" promette
// di evitare.
export async function deleteItem(req, res) {
    try {
        const item = await Item.findById(req.params.id).populate('artwork', 'owner');

        if (!item) {
            return res.status(404).json({ error: "Content non trovato." });
        }

        if (item.artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario dell'opera a cui appartiene questo content." });
        }

        const inUse = await isItemUsedInAnyVisit(item._id);
        if (inUse) {
            return res.status(409).json({ error: "Questo content è usato in almeno una visita (tua o di un altro autore che l'ha adottato) e non può essere eliminato." });
        }

        await item.deleteOne();

        res.json({ message: "Content eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Registra il feedback dell'utente su un content, aggiornando il
// suo punteggio di interesse per ciascun ambito taggato sul content.
// Se il content non ha ambiti taggati, il feedback è accettato ma non
// ha alcun effetto (nessun ambito da aggiornare).
export async function giveFeedback(req, res) {
    try {
        const { direction } = req.body; // 'up' | 'down'

        if (direction !== 'up' && direction !== 'down') {
            return res.status(400).json({ error: "direction deve essere 'up' o 'down'." });
        }

        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: "Content non trovato." });
        }

        const user = await User.findById(req.user.id);
        const delta = direction === 'up' ? INTEREST_STEP : -INTEREST_STEP;

        for (const domain of item.domains ?? []) {
            const current = user.interestWeights[domain] ?? 0;
            user.interestWeights[domain] = clamp(current + delta, INTEREST_MIN, INTEREST_MAX);
        }

        await user.save();

        res.json({ interestWeights: user.interestWeights });

    } catch (error) {
        console.error("Errore nella registrazione del feedback:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
