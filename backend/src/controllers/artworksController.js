import Artwork from "../models/artwork.js";
import Item from "../models/item.js";

// Lista artwork, filtrabile per museo/autore/stile e ordinabile per
// autore o stile (richiesto dal marketplace: "ordinare le opere per
// autore o per stile utilizzato"). Rispetta lo stesso criterio di
// accessibilità commerciale usato per i content: pubbliche e (gratis
// o già possedute), a meno di chiedere esplicitamente le proprie.
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
        } else {
            filter.isPublic = true;
            filter.$or = req.user
                ? [{ price: 0 }, { owner: req.user.id }]
                : [{ price: 0 }];
        }

        let query = Artwork.find(filter)
            .populate('museum', 'name slug')
            .populate('author', 'name')
            .populate('style', 'name');

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
// proprietario commerciale (owner) — nessun campo separato per "chi
// l'ha scritta in origine", non ha uso pratico nel DB oltre a owner.
export async function createArtwork(req, res) {
    try {
        const {
            title, year, technique, dimensions, image,
            museum, coords, roomId, author, style,
            license, isPublic, price
        } = req.body;

        if (!title || !museum) {
            return res.status(400).json({ error: "Titolo e museo sono obbligatori." });
        }

        const newArtwork = new Artwork({
            title, year, technique, dimensions, image,
            museum, coords, roomId, author, style,
            license, isPublic, price,
            owner: req.user.id
        });

        await newArtwork.save();

        res.status(201).json(newArtwork);

    } catch (error) {
        console.error("Errore nella creazione dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Modifica: solo il proprietario ATTUALE (non necessariamente chi ha
// scritto i contenuti in origine — dopo un acquisto sono due persone
// diverse, ed è il proprietario ad avere i diritti commerciali).
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
            'license', 'isPublic', 'price'
        ];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                artwork[field] = req.body[field];
            }
        }
        // 'owner' non è editabile qui: cambia solo tramite purchaseArtwork.

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

        // Coerenza con deleteAuthor/deleteStyle: non si cancella
        // un'opera se ci sono ancora Content che la referenziano,
        // altrimenti restano orfani (uno step di una Visit punterebbe
        // a un content la cui opera non esiste più).
        const inUse = await Item.exists({ artwork: artwork._id });
        if (inUse) {
            return res.status(409).json({ error: "Impossibile eliminare: ci sono content che referenziano questa opera. Eliminali prima." });
        }

        await artwork.deleteOne();

        res.json({ message: "Artwork eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione dell'artwork:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Acquisto di un'opera: chi compra deve essere l'utente autenticato
// (mai un id nel body). Comprare un'opera dà accesso a TUTTE le sue
// varianti linguistiche e a tutti i suoi topic in un colpo solo —
// non esiste più "compro solo la versione elementare".
export async function purchaseArtwork(req, res) {
    try {
        const buyerId = req.user.id;
        const artwork = await Artwork.findById(req.params.id);

        if (!artwork) {
            return res.status(404).json({ error: "Artwork non trovato." });
        }

        if (!artwork.isPublic) {
            return res.status(403).json({ error: "Questa opera non è disponibile nel marketplace." });
        }

        if (artwork.owner.toString() === buyerId) {
            return res.status(400).json({ error: "Possiedi già questa opera." });
        }

        artwork.owner = buyerId;
        await artwork.save();

        res.json(artwork);

    } catch (error) {
        console.error("Errore durante l'acquisto:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
