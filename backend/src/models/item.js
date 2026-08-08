import { Schema, model } from 'mongoose';

const urlRegex = /^(https?:\/\/)?([\w\-])+\.{1}([a-zA-Z]{2,63})([\/\w\-\.\?=%&=]*)?$/;

/* --------------------------------------------------
 Sotto-schema: singolo testo con durata

  Un item ha più testi per la stessa opera, ognuno
  pensato per essere letto in un tempo diverso.
  Il Navigator sceglie quale leggere in base al
  tempo che l'utente vuole dedicare all'opera.
----------------------------------------------------- */
const textEntrySchema = new Schema({
  duration: {
    type: String,
    enum: ['3s', '15s', '40s', '1min', '4min'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema principale: Item

const itemSchema = new Schema({
  title:      { type: String, required: true, trim: true },
  year:       { type: String, default: 'Sconosciuto' },
  technique:  { type: String, default: 'Sconosciuto' },
  dimensions: { type: String, default: '' },

  /* Immagine di riconoscimento (URL o path relativo /public/...)
   Serve solo per identificare visivamente l'opera, non come contenuto */
  image: {
    type: String,
    default: '',
    validate: {
      validator: v => v === '' || urlRegex.test(v),
      message:   props => `${props.value} non è un URL valido`
    }
  },
  /* ---- Identificatori Wikidata ----
   * Permettono di collegare l'opera, l'autore storico
   * e lo stile al knowledge graph di Wikidata.
   * Utili per recuperare info aggiuntive e per
   * riconoscere opere duplicate nel marketplace.
   * Es: wikidataId: 'Q126599960' (Ritratto Bedoli)
  ------------------------------------ */
  wikidataId:       { type: String, default: '' },  // ID opera
  artistWikidata:   { type: String, default: '' },  // ID autore storico (pittore, scultore...)
  styleWikidata:    { type: String, default: '' },  // ID stile artistico

  /* ---- Museo e posizione ---- */
  museum: {
    type: Schema.Types.ObjectId,
    ref: 'Museum',
    required: true
  },
  // Coordinate sulla mappa del museo (0-100)
  coords: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  // Sala in cui si trova l'opera (riferimento a Museum.rooms._id)
  roomId: {
    type: Schema.Types.ObjectId,
    default: null
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
      message: 'Un item deve avere almeno un testo'
    }
  },

  /* ---- Metadati obbligatori (dalle specifiche) ----
   *
   * language: il livello linguistico di TUTTI i testi
   *   dell'item. Per la stessa opera fisica esistono
   *   item diversi con language diverso. Il Navigator
   *   sceglie l'item con il language più adatto al
   *   profilo dell'utente.
   *
   * author: l'utente del marketplace che ha CREATO
   *   il contenuto (non l'autore storico dell'opera).
   *
   * license: come può essere usato il contenuto.
   * --------------------------------- */
  language: {
    type: String,
    enum: ['infantile', 'elementare', 'medio', 'specialistico'],
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  license: {
    type: String,
    enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'private'],
    default: 'CC-BY'
  },

  /* ---- Tipo di contenuto ----
   * 'object'  → descrive direttamente un'opera esposta
   * 'related' → contenuto correlato: artista, stile,
   *             evento storico, materiali, ecc.
   *             Viene usato come item opzionale nelle
   *             visite, su richiesta del visitatore.
   * --------------------------------- */
  type: {
    type: String,
    enum: ['object', 'related'],
    default: 'object'
  },

  /* ---- Marketplace ---- */
  isPublic:  { type: Boolean, default: true },
  price:     { type: Number,  default: 0, min: 0 },
  adoptions: { type: Number,  default: 0 },  // quante visite lo hanno incluso

  // Tag liberi per la ricerca nel marketplace
  tags: [{ type: String, trim: true }]

}, { timestamps: true });

/* --------------------------------------------------
 * Indici per le query più frequenti
 * -------------------------------------------------- */
itemSchema.index({ museum: 1, language: 1 });// Per trovare gli item di un museo con lo stesso livello linguistico (per il Navigator)
itemSchema.index({ wikidataId: 1 });         // Per trovare rapidamente item in base al loro wikidataId
itemSchema.index({ author: 1 });             // Per trovare rapidamente tutti gli item di un autore
itemSchema.index({ isPublic: 1, price: 1 }); // Per trovare rapidamente item pubblici e ordinati per prezzo
itemSchema.index({ museum: 1, type: 1 });    // Per separare rapidamente item "object" (opere) da item "related" (contenuti opzionali) in un museo

// Middleware pre-save

itemSchema.pre('save', function (next) {
  // Rimuove duplicati nei tag
  if (this.tags) this.tags = [...new Set(this.tags)];
  next();
});

export default model('Item', itemSchema);