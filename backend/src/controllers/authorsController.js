import Author from "../models/author.js";
import Artwork from "../models/artwork.js";

// Lista autori. Usata dal marketplace per il filtro/ordinamento delle
// opere per autore, e per popolare eventuali select nella creazione
// di un artwork.
export async function getAuthors(req, res) {
    try {
        const authors = await Author.find().sort({ name: 1 });
        res.json(authors);
    } catch (error) {
        console.error("Errore nel recupero degli autori:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio di un autore, con testo biografico completo. E' la route
// che il Navigator chiama quando l'utente chiede "chi è l'autore" /
// "dimmi di più sull'autore" — nessun acquisto richiesto, l'info è
// sempre disponibile insieme all'artwork che la referenzia.
export async function getAuthorById(req, res) {
    try {
        const author = await Author.findById(req.params.id);

        if (!author) {
            return res.status(404).json({ error: "Autore non trovato." });
        }

        res.json(author);

    } catch (error) {
        console.error("Errore nel recupero dell'autore:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function createAuthor(req, res) {
    try {
        const { name, bio, birthYear, deathYear, nationality, image } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Il nome è obbligatorio." });
        }

        const newAuthor = new Author({ name, bio, birthYear, deathYear, nationality, image });
        await newAuthor.save();

        res.status(201).json(newAuthor);

    } catch (error) {
        console.error("Errore nella creazione dell'autore:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function updateAuthor(req, res) {
    try {
        const author = await Author.findById(req.params.id);

        if (!author) {
            return res.status(404).json({ error: "Autore non trovato." });
        }

        const editableFields = ['name', 'bio', 'birthYear', 'deathYear', 'nationality', 'image'];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                author[field] = req.body[field];
            }
        }

        await author.save();

        res.json(author);

    } catch (error) {
        console.error("Errore nell'aggiornamento dell'autore:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Cancellazione bloccata se ci sono ancora artwork che referenziano
// questo autore, per non lasciare riferimenti orfani.
export async function deleteAuthor(req, res) {
    try {
        const author = await Author.findById(req.params.id);

        if (!author) {
            return res.status(404).json({ error: "Autore non trovato." });
        }

        const inUse = await Artwork.exists({ author: author._id });
        if (inUse) {
            return res.status(409).json({ error: "Impossibile eliminare: ci sono artwork che referenziano questo autore." });
        }

        await author.deleteOne();

        res.json({ message: "Autore eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione dell'autore:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
