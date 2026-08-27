import Visit from "../models/visit.js";
import User from "../models/user.js";

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
            .populate('steps.item');

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
        const { title, description, museum, entranceInfo, steps, license, price, tags } = req.body;

        if (!title || !museum || !steps || steps.length === 0) {
            return res.status(400).json({ error: "Titolo, museo e almeno un item nella sequenza sono obbligatori." });
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
        const editableFields = ['title', 'description', 'entranceInfo', 'steps', 'license', 'price', 'isPublic', 'tags'];
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