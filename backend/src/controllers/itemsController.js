import Item from "../models/item.js";

// Lista item, filtrabile per museo, tipo (object/related) e livello
// linguistico. Il Navigator la usa per scegliere l'item più adatto al
// profilo dell'utente, il marketplace per popolare la lista dei
// contenuti disponibili.
export async function getItems(req, res) {
    try {
        const filter = {};

        if (req.query.museum) {
            filter.museum = req.query.museum;
        }

        if (req.query.type) {
            filter.type = req.query.type;
        }

        if (req.query.language) {
            filter.language = req.query.language;
        }

        if (req.query.artistWikidata) {
            filter.artistWikidata = req.query.artistWikidata;
        }
 
        if (req.query.styleWikidata) {
            filter.styleWikidata = req.query.styleWikidata;
        }
        
        // Per default mostra solo gli item pubblici; un autore che vuole
        // vedere anche i propri item privati lo farà da un'altra route
        // dedicata (fuori scope per ora, stesso discorso fatto per Visit).
        if (req.query.mine === 'true' && req.user) {
            filter.author = req.user.id;
        } else {
            filter.isPublic = true;
        }

        const items = await Item.find(filter).populate('museum', 'name slug');

        res.json(items);

    } catch (error) {
        console.error("Errore nel recupero degli item:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio di un singolo item
export async function getItemById(req, res) {
    try {
        const item = await Item.findById(req.params.id).populate('museum');

        if (!item) {
            return res.status(404).json({ error: "Item non trovato." });
        }

        res.json(item);

    } catch (error) {
        console.error("Errore nel recupero dell'item:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Creazione di un nuovo item: l'autore è SEMPRE preso dal token, mai
// dal body, per evitare che un utente possa intestare un item a
// qualcun altro (stessa logica applicata a createVisit).
export async function createItem(req, res) {
    try {
        const {
            title, year, technique, dimensions, image,
            wikidataId, artistWikidata, styleWikidata,
            museum, coords, roomId,
            texts, language, license, type,
            price, tags
        } = req.body;

        if (!title || !museum || !texts || texts.length === 0 || !language) {
            return res.status(400).json({ error: "Titolo, museo, almeno un testo e il livello linguistico sono obbligatori." });
        }

        const newItem = new Item({
            title, year, technique, dimensions, image,
            wikidataId, artistWikidata, styleWikidata,
            museum, coords, roomId,
            texts, language, license, type,
            price, tags,
            author: req.user.id
        });

        await newItem.save();

        res.status(201).json(newItem);

    } catch (error) {
        console.error("Errore nella creazione dell'item:", error);
        res.status(500).json({ error: 
            "Errore del server." });
    }
}

// Modifica di un item esistente: solo l'autore originale può farlo
export async function updateItem(req, res) {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ error: "Item non trovato." });
        }

        if (item.author.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei l'autore di questo item." });
        }

        // Campi effettivamente modificabili: non permettiamo di
        // riassegnare autore, museo o adozioni da qui.
        const editableFields = [
            'title', 'year', 'technique', 'dimensions', 'image',
            'wikidataId', 'artistWikidata', 'styleWikidata',
            'coords', 'roomId',
            'texts', 'language', 'license', 'type',
            'isPublic', 'price', 'tags'
        ];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                item[field] = req.body[field];
            }
        }

        await item.save();

        res.json(item);

    } catch (error) {
        console.error("Errore nell'aggiornamento dell'item:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Cancellazione di un item: solo l'autore originale può farlo
export async function deleteItem(req, res) {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ error: "Item non trovato." });
        }

        if (item.author.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei l'autore di questo item." });
        }

        await item.deleteOne();

        res.json({ message: "Item eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione dell'item:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}