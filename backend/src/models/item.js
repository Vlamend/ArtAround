import { Schema, model } from 'mongoose';
import { textEntrySchema } from './textEntry.js';

/* --------------------------------------------------
 Content (ex Item)

 Un testo — con varianti di durata — che descrive un
 Artwork specifico. Puro contenitore di testo: niente più
 license/isPublic/price/author/owner, tutti spostati su
 Artwork. Un content viene interpellato solo per il testo,
 in base a come viene richiesto (lingua, dominio); il
 controllo commerciale e chi può modificarlo dipendono
 interamente dall'Artwork a cui appartiene.
----------------------------------------------------- */
const itemSchema = new Schema({
  artwork: {
    type: Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },

  /* ---- Contenuto testuale ----
   * Array di testi a durate diverse.
   * Ogni item DOVREBBE avere almeno 3s, 15s e 40s.
   * Il Navigator sceglie in base al tempo disponibile
   * e al profilo dell'utente.
  ------------------------------------ */
  texts: {
    type: [textEntrySchema],
    validate: {
      validator: v => v && v.length > 0,
      message: 'Un content deve avere almeno un testo'
    }
  },

  language: {
    type: String,
    enum: ['infantile', 'elementare', 'medio', 'specialistico'],
    required: true
  },

  /* ---- Ambiti di interesse ----
   * Vocabolario fisso, ricalca gli esempi della slide "ArtAround:
   * fondamenti" sotto "interessi specifici". Un content può
   * appartenere a più ambiti. Usato per adattare l'esperienza al
   * profilo utente (vedi User.interestWeights) e per il "dimmi di
   * più" a topic del Navigator.
  ------------------------------------ */
  domains: [{
    type: String,
    enum: ['artista', 'architettura', 'stile', 'materiali', 'storia']
  }],

  // Tag liberi per la ricerca nel marketplace
  tags: [{ type: String, trim: true }]

}, { timestamps: true });

/* --------------------------------------------------
 * Indici per le query più frequenti
 * -------------------------------------------------- */
itemSchema.index({ artwork: 1, language: 1 }); // Per trovare, per un dato Artwork, le varianti nel livello linguistico richiesto (Navigator)
itemSchema.index({ artwork: 1, domains: 1 });  // Per trovare, per un dato Artwork, i content di un certo dominio (topic del Navigator)

// Middleware pre-save
itemSchema.pre('save', function (next) {
  // Rimuove duplicati nei tag
  if (this.tags) this.tags = [...new Set(this.tags)];
  if (this.domains) this.domains = [...new Set(this.domains)];
  next();
});

export default model('Item', itemSchema);
