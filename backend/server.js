import "dotenv/config"; // Carica le variabili d'ambiente da .env

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import itemsRoutes from "./src/routes/items.js";
import visitsRoutes from "./src/routes/visits.js";
import usersRoutes from "./src/routes/users.js";
import museumsRoutes from "./src/routes/museums.js";
import { notFound, errorHandler } from "./src/middleware/errorHandlers.js";
import "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/items", itemsRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/museums", museumsRoutes);

// CONFIG DEL MUSEO (richiesto dalle specifiche)
app.get("/api/config", async (req, res) => {
  try {
    const config = await import("./config/museum.config.json", {
      with: { type: "json" }
    });
    res.json(config.default);
  } catch (err) {
    console.error("Errore lettura config:", err);
    res.status(500).json({ error: "Config non trovata" });
  }
});

//Tutto ciò che non è stato catturato dalle route precedenti viene gestito da questi middleware
app.use(notFound);
app.use(errorHandler);

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
