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
   * owner: chi ha i pieni diritti editoriali ORA — può modificare
   *   l'opera, i suoi Content, i due prezzi qui sotto, cancellarla.
   *   Cambia SOLO tramite un'acquisizione (mai un'adozione).
   * license/isPublic: come prima — CC0..private, visibile o no nel
   *   marketplace.
   * adoptionPrice: costo per un ALTRO utente per licenziare l'uso non
   *   esclusivo del content di quest'opera nelle proprie visite —
   *   NON dà diritti editoriali, e una volta ottenuta non scade e non
   *   viene mai revocata da una successiva acquisizione da parte di
   *   qualcun altro.
   * acquisitionPrice: costo per diventare il nuovo 'owner' — sostituisce
   *   chi c'era prima, pieni diritti editoriali.
   * Il proprietario attuale non paga né l'uno né l'altro (applicato
   * nel controller, non qui).
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
  isPublic:         { type: Boolean, default: true },
  adoptionPrice:    { type: Number,  default: 0, min: 0 },
  acquisitionPrice: { type: Number,  default: 0, min: 0 }
}, { timestamps: true });

// { museum, title } unique: previene il caso più comune di
// duplicazione (due curatori catalogano indipendentemente la stessa
// opera reale con lo stesso identico titolo). Non copre titoli scritti
// in modo diverso per la stessa opera — mitigazione parziale, a costo
// di una riga di indice, non una soluzione completa al problema.
artworkSchema.index({ museum: 1, title: 1 }, { unique: true });
artworkSchema.index({ author: 1 }); // ordinamento/filtro marketplace per autore
artworkSchema.index({ style: 1 });  // ordinamento/filtro marketplace per stile
artworkSchema.index({ owner: 1 }); // opere possedute ora da un utente
artworkSchema.index({ isPublic: 1, adoptionPrice: 1 });
artworkSchema.index({ isPublic: 1, acquisitionPrice: 1 });

export default model('Artwork', artworkSchema);
