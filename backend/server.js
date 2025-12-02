import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import itemsRoutes from "./src/routes/items.js";
import visitsRoutes from "./src/routes/visits.js";
import usersRoutes from "./src/routes/users.js";
import "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

app.use("/api/items", itemsRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/users", usersRoutes);

// CONFIG DEL MUSEO (richiesto dalle specifiche)
app.get("/api/config", async (req, res) => {
  try {
    const config = await import("./config/museum.config.json", {
      assert: { type: "json" }
    });
    res.json(config.default);
  } catch (err) {
    console.error("Errore lettura config:", err);
    res.status(500).json({ error: "Config non trovata" });
  }
});

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
