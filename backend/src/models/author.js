import { Schema, model } from 'mongoose';
import { textEntrySchema } from './textEntry.js';

/* --------------------------------------------------
 Author

 Rappresenta l'artista storico (es. Girolamo Mazzola Bedoli),
 NON un utente/curatore di ArtAround. Riusabile tra più
 Artwork, anche di musei diversi (es. lo stesso pittore ha
 opere in due musei: un solo Author, due Artwork).

 Non usiamo più ID Wikidata: senza LLM a generare i testi,
 e dovendo comunque scrivere/spezzare i testi a mano per
 durata, i dati Wikidata non ci servivano a nulla se non
 come chiave di join — sostituita ora da un vero riferimento.
----------------------------------------------------- */
const authorSchema = new Schema({
  name: { type: String, required: true, trim: true },

  // Testi biografici, stessa logica di durata dei Content
  // (3s/15s/40s/1min/4min) così "dimmi di più" funziona
  // identico su autore/stile e su opera.
  bio: {
    type: [textEntrySchema],
    default: []
  },

  birthYear: { type: String, default: 'Sconosciuto' },
  deathYear: { type: String, default: 'Sconosciuto' },
  nationality: { type: String, default: '' },

  image: { type: String, default: '' }
}, { timestamps: true });

authorSchema.index({ name: 1 });

export default model('Author', authorSchema);
