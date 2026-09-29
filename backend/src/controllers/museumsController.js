import Museum from "../models/museum.js";

//Ottiene i musei (il minimo indispensabile)
export async function getMuseums(req, res) {
    try {
        const museums = await Museum.find({}, 'slug name description city logo primaryColor secondaryColor');
        res.json(museums);
    } catch (error) {
        console.error("Errore nel recupero dei musei:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}
//Ottiene dettagliatamente i dati del museo.
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
//Ottiene dallo slug (nome identificativo del museo) i dati sul museo.
export async function getMuseumBySlug(req, res) {
    try {
        const museum = await Museum.findOne({ slug: req.params.slug });
        if (!museum) {
            return res.status(404).json({ error: "Museo non trovato." });
        }
        res.json(museum);
    } catch (error) {
        console.error("Errore nel recupero del museo:", error);
        res.status(500).json({ error: "Errore del server." });
    }
}