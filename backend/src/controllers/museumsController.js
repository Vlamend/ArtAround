import Museum from "../models/museum.js";

// Lista musei: alimenta il "pannello di scelta multipla" dell'editor
// (slide "Architettura ArtAround editor - marketplace"). Restituisce
// solo i campi essenziali per popolare una lista/griglia di selezione,
// non l'intero documento (rooms/pointsOfInterest non servono qui).
export async function getMuseums(req, res) {
    try {
        const museums = await Museum.find({}, 'slug name description city logo primaryColor secondaryColor');

        res.json(museums);

    } catch (error) {
        console.error("Errore nel recupero dei musei:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}

// Dettaglio completo di un museo: qui invece servono anche rooms e
// pointsOfInterest, usati dal Navigator per la navigazione e per
// rispondere a comandi come "Dov'è la toilette?".
export async function getMuseumById(req, res) {
    try {
        const museum = await Museum.findById(req.params.id);

        if (!museum) {
            return res.status(404).json({ error: "Museo non trovato." });
        }

        res.json(museum);

    } catch (error) {
        console.error("Errore nel recupero del museo:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}