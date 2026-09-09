import Artwork from "../models/artwork.js";
import Item from "../models/item.js";
import User from "../models/user.js";
import { getLicensedArtworkIds, accessibleOrClause, isArtworkContentUsedInAnyVisit } from "../utils/marketplaceAccess.js";

// Lista artwork, filtrabile per museo/autore/stile e ordinabile per
// autore o stile (richiesto dal marketplace: "ordinare le opere per
// autore o per stile utilizzato"). Quattro modalità di accessibilità:
// - default: pronte all'uso SENZA fare nulla di nuovo — adozione
//   gratuita, o già possedute, o già licenziate (adottate/acquisite).
//   Usata dal Navigator (non deve MAI mostrare a pagamento non pagato)
//   e dal pannello "disponibili" del marketplace.
// - mine=true: quelle POSSEDUTE (non le adottate: l'adozione dà diritto
//   d'uso, non editoriale, non compaiono in "gestione") — per "Le tue
//   opere".
// - purchasable=true: pubbliche, non possedute, non ancora licenziate,
//   con un'adozione a pagamento — il complementare esatto del default,
//   quelle per cui serve compiere un'azione esplicita.
// - others=true: TUTTE le pubbliche non proprie, licenziate o no —
//   usata per "sfoglia il museo" (contents.js), dove si vuole vedere
//   anche ciò che si è già adottato/acquisito, non solo ciò che manca.
//   Ordinata di default per adoptionPrice crescente.
export async function getArtworks(req, res) {
    try {
        const filter = {};

        if (req.query.museum) {
            filter.museum = req.query.museum;
        }
        if (req.query.author) {
            filter.author = req.query.author;
        }
        if (req.query.style) {
            filter.style = req.query.style;
        }

        if (req.query.mine === 'true' && req.user) {
            filter.owner = req.user.id;
        } else if (req.query.purchasable === 'true' && req.user) {
            const licensedIds = await getLicensedArtworkIds(req.user.id);
            filter.isPublic = true;
            filter.owner = { $ne: req.user.id };
            filter.adoptionPrice = { $gt: 0 };
            if (licensedIds.length > 0) {
                filter._id = { $nin: licensedIds };
            }
        } else if (req.query.others === 'true' && req.user) {
            filter.isPublic = true;
            filter.owner = { $ne: req.user.id };
        } else {
            filter.isPublic = true;
            const licensedIds = await getLicensedArtworkIds(req.user?.id);
            filter.$or = accessibleOrClause(req.user?.id, licensedIds);
        }

        let query = Artwork.find(filter)
            .populate('museum', 'name slug')
            .populate('author', 'name')
            .populate('style', 'name')
            .populate('owner', 'username');

        // 'others' si ordina per prezzo di adozione crescente per
        // default (richiesto esplicitamente), senza bisogno di
        // ordinamento lato applicazione: adoptionPrice non è un campo
        // popolato, il sort nativo di Mongo basta.
        if (req.query.others === 'true' && !req.query.sortBy) {
            query = query.sort({ adoptionPrice: 1 });
        }

        const sortableFields = { author: 'author', style: 'style', title: 'title' };
        if (req.query.sortBy && sortableFields[req.query.sortBy]) {
            // Il sort per campo popolato non è nativo in Mongoose/Mongo,
            // quindi ordiniamo lato applicazione dopo la populate.
            const artworks = await query;
            const field = req.query.sortBy;
            artworks.sort((a, b) => {
                const av = field === 'title' ? a.title : (a[field]?.name || '');
                const bv = field === 'title' ? b.title : (b[field]?.name || '');
                return av.localeCompare(bv);
            });
            return res.json(artworks);
        }

        const artworks = await query;
        res.json(artworks);

    } catch (error) {
        console.error("Errore nel recupero degli artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function getArtworkById(req, res) {
    try {
        const artwork = await Artwork.findById(req.params.id)
            .populate('museum', 'name slug')
            .populate('author')
            .populate('style')
            .populate('owner', 'username');

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }

        res.json(artwork);

    } catch (error) {
        console.error("Errore nel recupero dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Creazione: chi crea un'opera ne diventa automaticamente il
// proprietario commerciale (owner). Ristretta a 'autore'/'admin' a
// livello di route (requireRole), non qui.
export async function createArtwork(req, res) {
    try {
        const {
            title, year, technique, dimensions, image,
            museum, coords, roomId, author, style,
            license, isPublic, adoptionPrice, acquisitionPrice
        } = req.body;

        if (!title || !museum) {
            return res.status(400).json({ error: "Titolo e museo sono obbligatori." });
        }

        const newArtwork = new Artwork({
            title, year, technique, dimensions, image,
            museum, coords, roomId, author, style,
            license, isPublic, adoptionPrice, acquisitionPrice,
            owner: req.user.id
        });

        await newArtwork.save();

        res.status(201).json(newArtwork);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "Esiste già un'opera con questo titolo in questo museo. Cercala prima di crearne una nuova." });
        }
        console.error("Errore nella creazione dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Modifica: solo il proprietario ATTUALE (non necessariamente chi ha
// creato l'opera in origine — dopo un'acquisizione sono due persone
// diverse, ed è il proprietario ad avere i diritti editoriali). Non
// ristretta per ruolo qui: chi acquisisce deve poter gestire anche se
// non è admin, altrimenti pagare per diventare proprietario non
// darebbe i diritti promessi.
export async function updateArtwork(req, res) {
    try {
        const artwork = await Artwork.findById(req.params.id);

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }

        if (artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario di questa opera." });
        }

        const editableFields = [
            'title', 'year', 'technique', 'dimensions', 'image',
            'coords', 'roomId', 'author', 'style',
            'license', 'isPublic', 'adoptionPrice', 'acquisitionPrice'
        ];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                artwork[field] = req.body[field];
            }
        }
        // 'owner' non è editabile qui: cambia solo tramite acquireArtwork.

        await artwork.save();

        res.json(artwork);

    } catch (error) {
        console.error("Errore nell'aggiornamento dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function deleteArtwork(req, res) {
    try {
        const artwork = await Artwork.findById(req.params.id);

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }

        if (artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario di questa opera." });
        }

        // Due controlli anti-orfani distinti:
        // 1) ci sono ancora Content che la referenziano (coerenza con
        //    deleteAuthor/deleteStyle);
        // 2) uno di quei Content è usato nello step di una Visit di
        //    QUALCUNO — anche solo il primo controllo basterebbe nella
        //    pratica (niente Content, niente step possibili), ma lo
        //    teniamo esplicito per chiarezza del messaggio d'errore.
        const hasContent = await Item.exists({ artwork: artwork._id });
        if (hasContent) {
            return res.status(409).json({ error: "Impossibile eliminare: ci sono content che referenziano questa opera. Eliminali prima." });
        }

        const usedInVisits = await isArtworkContentUsedInAnyVisit(artwork._id);
        if (usedInVisits) {
            return res.status(409).json({ error: "Impossibile eliminare: questa opera è usata in almeno una visita." });
        }

        await artwork.deleteOne();

        res.json({ message: "Artwork eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Adozione: licenzia l'uso NON esclusivo del content di quest'opera
// nelle proprie visite. NON trasferisce alcun diritto editoriale, NON
// tocca 'owner'. Scrive una entry perpetua in user.licenses — non
// revocata da acquisizioni successive fatte da altri (un'adozione,
// una volta ottenuta, resta valida per sempre).
export async function adoptArtwork(req, res) {
    try {
        const userId = req.user.id;
        const artwork = await Artwork.findById(req.params.id);

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }
        if (!artwork.isPublic) {
            return res.status(403).json({ error: "Questa opera non è disponibile nel marketplace." });
        }
        if (artwork.owner.toString() === userId) {
            return res.status(400).json({ error: "Sei già il proprietario: non serve adottarla." });
        }

        const user = await User.findById(userId);
        const alreadyLicensed = user.licenses.some(l => l.artwork.toString() === artwork._id.toString());
        if (alreadyLicensed) {
            return res.status(400).json({ error: "Hai già una licenza per questa opera." });
        }

        user.licenses.push({
            artwork: artwork._id,
            type: 'adoption',
            pricePaid: artwork.adoptionPrice
        });
        await user.save();

        res.json({ message: "Opera adottata.", artwork: artwork._id, pricePaid: artwork.adoptionPrice });

    } catch (error) {
        console.error("Errore durante l'adozione:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Acquisizione: trasferisce i pieni diritti editoriali. A differenza
// dell'adozione, aggiorna 'owner' — e scrive comunque una entry in
// user.licenses, così l'utente ha uno storico di "cosa ho acquisito"
// anche se in futuro rivende e smette di essere owner. Ristretta a
// 'autore'/'admin' a livello di route: un 'visitatore' non deve poter
// ottenere diritti editoriali semplicemente pagando, quando non può
// nemmeno crearne una da zero.
export async function acquireArtwork(req, res) {
    try {
        const userId = req.user.id;
        const artwork = await Artwork.findById(req.params.id);

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }
        if (!artwork.isPublic) {
            return res.status(403).json({ error: "Questa opera non è disponibile nel marketplace." });
        }
        if (artwork.owner.toString() === userId) {
            return res.status(400).json({ error: "Possiedi già questa opera." });
        }

        const user = await User.findById(userId);
        user.licenses.push({
            artwork: artwork._id,
            type: 'acquisition',
            pricePaid: artwork.acquisitionPrice
        });
        await user.save();

        artwork.owner = userId;
        await artwork.save();

        res.json(artwork);

    } catch (error) {
        console.error("Errore durante l'acquisizione:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}