import { Schema, model } from 'mongoose';

const urlRegex = /^(https?:\/\/)?([\w\-])+\.{1}([a-zA-Z]{2,63})([\/\w\-\.\?=%&=]*)?$/;

/* --------------------------------------------------
 Artwork

 L'oggetto fisico esposto nel museo: UN solo record per
 opera reale, indipendentemente da quante lingue/livelli
 di Content lo descrivono. Posizione, sala e museo vivono
 qui una volta sola — prima erano duplicati su ogni Item
 "object", uno per lingua, ciascuno con un proprio autore
 marketplace: bug che ha reso possibile che due varianti
 linguistiche della stessa opera finissero "di fatto"
 scollegate tra loro, di proprietà di due autori diversi
 senza alcun vincolo.
----------------------------------------------------- */
const artworkSchema = new Schema({
  title:      { type: String, required: true, trim: true },
  year:       { type: String, default: 'Sconosciuto' },
  technique:  { type: String, default: 'Sconosciuto' },
  dimensions: { type: String, default: '' },

  // Immagine di riconoscimento (non contenuto, solo per
  // distinguere visivamente l'opera dalle altre)
  image: {
    type: String,
    default: '',
    validate: {
      validator: v => v === '' || urlRegex.test(v),
      message:   props => `${props.value} non è un URL valido`
    }
  },

  museum: {
    type: Schema.Types.ObjectId,
    ref: 'Museum',
    required: true
  },
  coords: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  roomId: {
    type: Schema.Types.ObjectId,
    default: null
  },

  // Riferimenti reali (non più stringhe Wikidata): abilitano
  // sia "chi è l'autore / qual è lo stile" nel Navigator sia
  // l'ordinamento/filtro per autore o stile nel marketplace,
  // con un vero indice invece di un match di stringa.
  // NB: questo è l'artista STORICO (es. Bedoli), un riferimento ad
  // Author. Non va confuso con 'owner' più sotto, che è invece
  // l'utente ArtAround proprietario commerciale dell'opera.
  author: {
    type: Schema.Types.ObjectId,
    ref: 'Author',
    default: null
  },
  style: {
    type: Schema.Types.ObjectId,
    ref: 'Style',
    default: null
  },

  /* ---- Controllo commerciale ----
   * Spostato qui da Content: prima license/isPublic/price/owner
   * vivevano sul singolo Content, quindi due varianti linguistiche
   * della STESSA opera potevano avere due proprietari diversi,
   * due prezzi diversi, due licenze diverse — e chi cercava una
   * variante nella propria lingua (adattamento al profilo) poteva
   * ritrovarsi contenuto a pagamento di un venditore che non aveva
   * mai pagato. Ora il controllo commerciale è UNO per opera,
   * condiviso da tutti i Content che la referenziano: comprare
   * un'opera dà accesso a tutte le sue varianti linguistiche e a
   * tutti i suoi topic, non a una sola lingua alla volta.
   *
   * owner: chi ne detiene ORA i diritti commerciali. Cambia con
   *   purchaseArtwork. Alla creazione coincide con chi crea l'opera.
   * (Niente campo per "chi l'ha scritta in origine": nessuna query o
   * vista lo usa — solo owner conta ai fini pratici del DB.)
   * --------------------------------- */
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  license: {
    type: String,
    enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'private'],
    default: 'CC-BY'
  },
  isPublic: { type: Boolean, default: true },
  price:    { type: Number,  default: 0, min: 0 }
}, { timestamps: true });

artworkSchema.index({ museum: 1 });
artworkSchema.index({ author: 1 }); // ordinamento/filtro marketplace per autore
artworkSchema.index({ style: 1 });  // ordinamento/filtro marketplace per stile
artworkSchema.index({ owner: 1 }); // opere possedute ora da un utente
artworkSchema.index({ isPublic: 1, price: 1 });

export default model('Artwork', artworkSchema);
