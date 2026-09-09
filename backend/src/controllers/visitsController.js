import Visit from "../models/visit.js";
import User from "../models/user.js";
import Item from "../models/item.js";
import Artwork from "../models/artwork.js";
import { getLicensedArtworkIds } from "../utils/marketplaceAccess.js";

// Verifica che ogni step referenzi un Content la cui opera è
// effettivamente accessibile a chi sta componendo la visita (gratuita,
// già posseduta, o già licenziata tramite adozione/acquisizione).
// Senza questo controllo, il filtro "cosa posso aggiungere" applicato
// nel marketplace è solo estetico: chiamando l'API direttamente si
// potrebbe infilare in una visita il content di un'opera altrui mai
// adottata né acquisita.
// Ritorna null se tutto ok, altrimenti un messaggio d'errore.
async function validateStepsAccessibility(steps, userId) {
    if (!steps || steps.length === 0) return null;

    const itemIds = steps.map(s => s.item);
    const items = await Item.find({ _id: { $in: itemIds } }, 'artwork');
    const artworkIds = [...new Set(items.map(i => i.artwork.toString()))];

    const artworks = await Artwork.find({ _id: { $in: artworkIds } }, 'isPublic adoptionPrice owner');
    const artworkById = new Map(artworks.map(a => [a._id.toString(), a]));

    const licensedIds = new Set(await getLicensedArtworkIds(userId));

    for (const item of items) {
        const artwork = artworkById.get(item.artwork.toString());
        if (!artwork) return "Uno degli step referenzia un'opera inesistente.";

        const accessible = artwork.isPublic && (
            artwork.adoptionPrice === 0 ||
            artwork.owner.toString() === userId ||
            licensedIds.has(artwork._id.toString())
        );
        if (!accessible) {
            return "Uno degli step referenzia il content di un'opera che non hai adottato né acquisito.";
        }
    }

    return null;
}

// Lista visite, filtrabile per museo e visibilità pubblica
// (marketplace: "contenuti esistenti - sia gratuiti sia in vendita -
// per il museo in questione")
export async function getVisits(req, res) {
    try {
        const filter = {};

        if (req.query.museum) {
            filter.museum = req.query.museum;
        }

        // Per default mostra solo le visite pubbliche; un autore che
        // vuole vedere anche le proprie visite private lo farà tramite
        // un'altra route dedicata (fuori scope per ora).
        if (req.query.mine === 'true' && req.user) {
            filter.author = req.user.id;
        } else {
            filter.isPublic = true;
        }

        const visits = await Visit.find(filter)
        .populate('museum', 'name slug')
        .populate('author', 'username');

        res.json(visits);

    } catch (error) {
        console.error("Errore nel recupero delle visite:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio di una singola visita, con gli item della sequenza popolati
// (il Navigator ne ha bisogno per eseguire la visita passo per passo)
export async function getVisitById(req, res) {
    try {
        const visit = await Visit.findById(req.params.id)
            .populate('museum')
            .populate('author', 'username')
            .populate({
                path: 'steps.item',
                populate: {
                    path: 'artwork',
                    populate: [
                        { path: 'author', select: 'name' },
                        { path: 'style', select: 'name' }
                    ]
                }
            });

        if (!visit) {
            return res.status(404).json({ error: "Visita non trovata." });
        }

        res.json(visit);

    } catch (error) {
        console.error("Errore nel recupero della visita:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Creazione di una nuova visita: l'autore è SEMPRE preso dal token,
// mai dal body, per evitare che un utente possa intestare una visita
// a qualcun altro.
export async function createVisit(req, res) {
    try {
        const { title, description, museum, entranceInfo, steps, license, price, tags, pace } = req.body;

        if (!title || !museum || !steps || steps.length === 0) {
            return res.status(400).json({ error: "Titolo, museo e almeno un item nella sequenza sono obbligatori." });
        }

        const accessibilityError = await validateStepsAccessibility(steps, req.user.id);
        if (accessibilityError) {
            return res.status(403).json({ error: accessibilityError });
        }

        const newVisit = new Visit({
            title,
            description,
            museum,
            entranceInfo,
            steps,
            license,
            price,
            tags,
            pace,
            author: req.user.id
        });

        await newVisit.save();

        res.status(201).json(newVisit);

    } catch (error) {
        console.error("Errore nella creazione della visita:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Modifica di una visita esistente: solo l'autore originale può farlo
export async function updateVisit(req, res) {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({ error: "Visita non trovata." });
        }

        if (visit.author.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei l'autore di questa visita." });
        }

        // Campi effettivamente modificabili: non permettiamo di
        // riassegnare autore, adozioni o museo da qui.
        if (req.body.steps !== undefined) {
            const accessibilityError = await validateStepsAccessibility(req.body.steps, req.user.id);
            if (accessibilityError) {
                return res.status(403).json({ error: accessibilityError });
            }
        }

        const editableFields = ['title', 'description', 'entranceInfo', 'steps', 'license', 'price', 'isPublic', 'tags', 'pace'];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                visit[field] = req.body[field];
            }
        }

        await visit.save();

        res.json(visit);

    } catch (error) {
        console.error("Errore nell'aggiornamento della visita:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Cancellazione di una visita: solo l'autore originale può farlo
export async function deleteVisit(req, res) {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({ error: "Visita non trovata." });
        }

        if (visit.author.toString() !== req.user.id) {
            return res.status(403).json({ error: "Non sei l'autore di questa visita." });
        }

        await visit.deleteOne();

        res.json({ message: "Visita eliminata." });

    } catch (error) {
        console.error("Errore nell'eliminazione della visita:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Segna una visita come completata per l'utente autenticato. Usato dal
// Navigator quando l'utente raggiunge l'ultimo step, per adattare
// l'esperienza a chi ha già svolto quella visita (slide "ArtAround:
// fondamenti" - "E' la prima volta, sono già venuto in passato...").
// Idempotente: se è già segnata come completata, non la duplica.
export async function completeVisit(req, res) {
    try {
        const visit = await Visit.findById(req.params.id);
 
        if (!visit) {
            return res.status(404).json({ error: "Visita non trovata." });
        }
 
        const user = await User.findById(req.user.id);
 
        const alreadyCompleted = user.visitedVisits.some(
            v => v.visit.toString() === req.params.id
        );
 
        if (!alreadyCompleted) {
            user.visitedVisits.push({ visit: req.params.id, completedAt: new Date() });
            await user.save();
        }
 
        res.json({ message: "Visita segnata come completata." });
 
    } catch (error) {
        console.error("Errore nel segnare la visita come completata:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}