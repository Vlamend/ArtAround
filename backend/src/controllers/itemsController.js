import Item from "../models/item.js";
import User from "../models/user.js";
import Artwork from "../models/artwork.js";
import { getLicensedArtworkIds, accessibleOrClause, canUseArtwork, isArtworkUsedInAnyVisit } from "../utils/marketplaceAccess.js";

const INTEREST_STEP = 1;
const INTEREST_MAX = 10;
const INTEREST_MIN = -10;

//Funzione che si assicura che il valore rientri nel range tra min e max.
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Calcola quali Artwork sono accessibili a chi sta chiedendo e restituisce i loro id.
async function findAccessibleArtworkIds({ museum, artwork, mine, userId }) {
    const filter = {};
    if (museum) filter.museum = museum;
    if (artwork) filter._id = artwork;

    if (mine === 'true' && userId) {
        filter.owner = userId;
    } else {
        filter.isPublic = true;
        const licensedIds = await getLicensedArtworkIds(userId);
        filter.$or = accessibleOrClause(userId, licensedIds);
    }
    const artworks = await Artwork.find(filter, '_id');
    return artworks.map(a => a._id);
}
// Lista di items, con vari filtri applicabili. Prima filtro per ID opera, poi per linguaggio e argomento.
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
// Recupera tutti i dati di un item dal suo Id.
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
        if (!(await canUseArtwork(item.artwork, req.user?.id))) {
            return res.status(404).json({ error: "Content non trovato." });
        }
        res.json(item);
    } catch (error) {
        console.error("Errore nel recupero del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
/*
 * Creazione di un nuovo item. Chi lo crea deve essere il
 * l'owner dell'artwork a cui si riferisce.
 */
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

// Modifica di un item: stesso controllo, sull'owner
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
        await item.save();
        res.json(item);
    } catch (error) {
        console.error("Errore nell'aggiornamento del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
/* 
 * Cancellazione di un item, sempre con lo stesso controllo 
 * sull'owner ma in più viene bloccato se è l'ultimo item di un'artwork e viene usato in una visita.
 * In questo modo non rischio di creare problemi alle visite che lo usano
 */
export async function deleteItem(req, res) {
    try {
        const item = await Item.findById(req.params.id).populate('artwork', 'owner');
        if (!item) {
            return res.status(404).json({ error: "Content non trovato." });
        }
        if (item.artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario dell'opera a cui appartiene questo content." });
        }
        const remaining = await Item.countDocuments({ artwork: item.artwork._id });
        if (remaining <= 1 && await isArtworkUsedInAnyVisit(item.artwork._id)) {
            return res.status(409).json({ error: "Impossibile eliminare l'ultimo content di un'opera usata in almeno una visita." });
        }
        await item.deleteOne();
        res.json({ message: "Content eliminato." });
    } catch (error) {
        console.error("Errore nell'eliminazione del content:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
/*
 * Registra il feedback dell'utente su un content, aggiornando il
 * suo punteggio di interesse per l'ambito taggato.
 */
export async function giveFeedback(req, res) {
    try {
        const { direction } = req.body;
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