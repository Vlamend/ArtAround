import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  Titolo: { type: String, default: "Sconosciuto" },
  Autore: { type: String, default: "Sconosciuto" },
  Anno: { type: String, default: "Sconosciuto" },
  Tecnica: { type: String, default: "Sconosciuto" },
  Dimensioni: { type: String, default: "Sconosciuto" },
  Immagine: String,
  textbase: { type: String, required: true },
  textMedio: { type: String, required: true },
  textAvanzato: { type: String, required: true },
  museumId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Museum",
    required: true
  }
}, { timestamps: true });

export default mongoose.model("Item", ItemSchema);
