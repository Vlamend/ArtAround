import Artwork from "../models/artwork.js";
import Item from "../models/item.js";
import User from "../models/user.js";
import { getLicensedArtworkIds, accessibleOrClause, isArtworkUsedInAnyVisit } from "../utils/marketplaceAccess.js";

/* Lista artwork, filtrabile per museo/autore/stile e ordinabile per
 * autore o stile". Quattro modalità di accessibilità:
 * - default: pronte all'uso senza fare nulla di nuovo. Quindi adozione
 *   gratuita, già possedute, già licenziate (sia adottate che acquisite).
 * - mine=true: quelle possedute (non le adottate: l'adozione dà diritto
 *   d'uso, non editoriale, non possono essere gestite ma solo usate nelle visite).
 * - purchasable=true: pubbliche, non possedute e non ancora licenziate,
 *   con un'adozione a pagamento. Il complementare esatto del default,
 *   quelle per cui serve compiere un'azione esplicita.
 * - others=true: tutte le pubbliche non proprie, licenziate o no.
 */
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
        if (req.query.others === 'true' && !req.query.sortBy) {
            query = query.sort({ adoptionPrice: 1 });
        }
        const sortableFields = { author: 'author', style: 'style', title: 'title' };
        if (req.query.sortBy && sortableFields[req.query.sortBy]) {
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
/*
 * Ottiene tutte le informazioni relative a un'opera dal suo ID
 * Se però l'opera non è pubblia ed è di un altro utente allora restituisco errore 401 (Unauthorized)
 */
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
        const ownerId = (artwork.owner?._id ?? artwork.owner)?.toString();
        if (!artwork.isPublic && ownerId !== req.user?.id) {
            return res.status(401).json({ error: "Proprietario non ideneo." });
        }

        res.json(artwork);

    } catch (error) {
        console.error("Errore nel recupero dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
/*
 * Chi crea un'opera ne diventa automaticamente l'owner.
 * Ristretta a 'autore' e 'admin' (RequireRole)
 */
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

//Permette di aggiornare gli un artwork al suo proprietario.
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
        await artwork.save();
        res.json(artwork);
    } catch (error) {
        console.error("Errore nell'aggiornamento dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
//Permette al proprietario di cancellare una sua opera, eliminando anche eventuali content orfani.
export async function deleteArtwork(req, res) {
    try {
        const artwork = await Artwork.findById(req.params.id);
        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }
        if (artwork.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei il proprietario di questa opera." });
        }
        const hasContent = await Item.exists({ artwork: artwork._id });
        if (hasContent) {
            return res.status(409).json({ error: "Impossibile eliminare: ci sono content che referenziano questa opera. Eliminali prima." });
        }
        const usedInVisits = await isArtworkUsedInAnyVisit(artwork._id);
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
//Adozione di un'opera. Non modifica nulla sull'artwork, aggiunge alla lista licenze dell'utente.
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

//Acquisizione di un artwork da parte di un utente. Modifica il suo owner e aggiorna anche la lista delle licenze acquisite.
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