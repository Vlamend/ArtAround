import Item from "../models/item.js";
import User from "../models/user.js";

const INTEREST_STEP = 1;
const INTEREST_MAX = 10;
const INTEREST_MIN = -10;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

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
        
        // Usato dal Navigator per trovare varianti linguistiche dello
        // stesso oggetto (stesso wikidataId, language diverso), per
        // adattarsi al preferredLanguageLevel dell'utente senza dover
        // cambiare la visita stessa.
        if (req.query.wikidataId) {
            filter.wikidataId = req.query.wikidataId;
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
        res.status(500).json({ error: "Errore del server." });
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

// Registra il feedback dell'utente su un item, aggiornando il
// suo punteggio di interesse per ciascun ambito taggato sull'item.
// Se l'item non ha ambiti taggati, il feedback è accettato ma non ha
// alcun effetto (nessun ambito da aggiornare).
export async function giveFeedback(req, res) {
    try {
        const { direction } = req.body; // 'up' | 'down'
 
        if (direction !== 'up' && direction !== 'down') {
            return res.status(400).json({ error: "direction deve essere 'up' o 'down'." });
        }
 
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: "Item non trovato." });
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

export async function purchaseItem(req, res) {
    try {
        const { buyerId, sellerId, itemId } = req.body;
        const buyer = await User.findById(buyerId);
        if(!buyer) {
            return res.status(404).json({ error: "Acquirente non trovato." });
        }
        const seller = await User.findById(sellerId);
        if(!seller) {
            return res.status(404).json({ error: "Venditore non trovato." });
        }
        const item = await Item.findById(itemId);
        if(!item) {
            return res.status(404).json({ error: "Item non trovato." });
        }
        // Rimuovo l'item dalla lista del venditore
        seller.ownedItems = seller.ownedItems.filter(ownedItemId => ownedItemId.toString() !== itemId);
        // Aggiungo l'item alla lista dell'acquirente
        buyer.ownedItems.push(itemId);
        await seller.save();
        await buyer.save();
    }catch (error){
        console.error("Errore durante l'acquisto:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}