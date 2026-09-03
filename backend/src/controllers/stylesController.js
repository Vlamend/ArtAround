import Style from "../models/style.js";
import Artwork from "../models/artwork.js";

// Lista stili. Usata dal marketplace per il filtro/ordinamento delle
// opere per stile, e per popolare eventuali select nella creazione
// di un artwork.
export async function getStyles(req, res) {
    try {
        const styles = await Style.find().sort({ name: 1 });
        res.json(styles);
    } catch (error) {
        console.error("Errore nel recupero degli stili:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio di uno stile, con descrizione completa. E' la route che il
// Navigator chiama quando l'utente chiede "qual è lo stile" / "dimmi
// di più sullo stile" — nessun acquisto richiesto.
export async function getStyleById(req, res) {
    try {
        const style = await Style.findById(req.params.id);

        if (!style) {
            return res.status(404).json({ error: "Stile non trovato." });
        }

        res.json(style);

    } catch (error) {
        console.error("Errore nel recupero dello stile:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function createStyle(req, res) {
    try {
        const { name, description, period } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Il nome è obbligatorio." });
        }

        const newStyle = new Style({ name, description, period });
        await newStyle.save();

        res.status(201).json(newStyle);

    } catch (error) {
        console.error("Errore nella creazione dello stile:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

export async function updateStyle(req, res) {
    try {
        const style = await Style.findById(req.params.id);

        if (!style) {
            return res.status(404).json({ error: "Stile non trovato." });
        }

        const editableFields = ['name', 'description', 'period'];
        for (const field of editableFields) {
            if (req.body[field] !== undefined) {
                style[field] = req.body[field];
            }
        }

        await style.save();

        res.json(style);

    } catch (error) {
        console.error("Errore nell'aggiornamento dello stile:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Cancellazione bloccata se ci sono ancora artwork che referenziano
// questo stile, per non lasciare riferimenti orfani.
export async function deleteStyle(req, res) {
    try {
        const style = await Style.findById(req.params.id);

        if (!style) {
            return res.status(404).json({ error: "Stile non trovato." });
        }

        const inUse = await Artwork.exists({ style: style._id });
        if (inUse) {
            return res.status(409).json({ error: "Impossibile eliminare: ci sono artwork che referenziano questo stile." });
        }

        await style.deleteOne();

        res.json({ message: "Stile eliminato." });

    } catch (error) {
        console.error("Errore nell'eliminazione dello stile:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
