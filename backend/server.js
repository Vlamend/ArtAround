import "dotenv/config"; // Carica le variabili d'ambiente da .env

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import itemsRoutes from "./src/routes/items.js";
import visitsRoutes from "./src/routes/visits.js";
import usersRoutes from "./src/routes/users.js";
import museumsRoutes from "./src/routes/museums.js";
import artworksRoutes from "./src/routes/artworks.js";
import authorsRoutes from "./src/routes/authors.js";
import stylesRoutes from "./src/routes/styles.js";
import { notFound, errorHandler } from "./src/middleware/errorHandlers.js";
import { authenticateToken, requireAdmin } from "./src/middleware/authenticator.js";
import Museum from "./src/models/museum.js";
import "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/items", itemsRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/museums", museumsRoutes);
app.use("/api/artworks", artworksRoutes);
app.use("/api/authors", authorsRoutes);
app.use("/api/styles", stylesRoutes);

// CONFIG DEL MUSEO (richiesto dalle specifiche)
//
// Il percorso è SEMPRE fisso, calcolato qui, mai passato dal client:
// è l'unico file che questo endpoint può leggere/scrivere.
const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "config", "Museum.config.json");

// Lettura: fs.readFile ad ogni richiesta, NON import() dinamico.
// import() su un JSON viene messo in cache dal registro moduli di
// Node al primo utilizzo: le richieste successive, nello stesso
// processo, avrebbero ricevuto sempre lo stesso contenuto anche dopo
// una modifica del file su disco (bug corretto qui, indipendente da
// chi può scrivere la config).
app.get("/api/config", async (req, res) => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("Errore lettura config:", err);
    res.status(500).json({ error: "Config non trovata" });
  }
});

// Scrittura: solo admin. museumSlug viene validato contro i musei
// esistenti — il form del marketplace lo propone già come select
// (non testo libero), ma la validazione qui protegge anche da chi
// chiama questa route direttamente, scavalcando il form.
app.put("/api/config", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, logo, museumSlug } = req.body;

    if (!title || !museumSlug) {
      return res.status(400).json({ error: "Titolo e museo sono obbligatori." });
    }

    const museum = await Museum.findOne({ slug: museumSlug });
    if (!museum) {
      return res.status(400).json({ error: "Il museo indicato non esiste." });
    }

    const newConfig = { museumSlug, title, logo: logo ?? "" };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf-8");

    res.json(newConfig);
  } catch (err) {
    console.error("Errore scrittura config:", err);
    res.status(500).json({ error: "Impossibile salvare la config." });
  }
});

//Tutto ciò che non è stato catturato dalle route precedenti viene gestito da questi middleware
app.use(notFound);
app.use(errorHandler);

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
