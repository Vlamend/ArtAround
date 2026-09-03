import { Schema, model } from 'mongoose';

/* --------------------------------------------------
 Sotto-schema: singolo step della visita

  Ogni passo collega un item (l'oggetto da presentare)
  con l'indicazione logistica per raggiungerlo dal
  passo precedente ("proseguire a sinistra della scala
  verso la sala 12" ecc.). L'ordine nell'array 'steps' della
  visita determina la sequenza di visita.
----------------------------------------------------- */
const visitStepSchema = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  // Indicazione logistica per raggiungere QUESTO step dal precedente.
  logisticNote: {
    type: String,
    default: ''
  }
}, { _id: false });

// Schema principale: Visit. Contiene tutti gli step della visita, le info generali e i metadati per il marketplace.
const visitSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  museum: {
    type: Schema.Types.ObjectId,
    ref: 'Museum',
    required: true
  },

  /* ---- Indicazioni logistiche generali della visita ----
   * Info non legate a un singolo item: come raggiungere
   * l'ingresso, prezzo del biglietto, servizi disponibili.
   * Es: "l'entrata del museo è da via Garibaldi 2, il
   * biglietto costa 15€ ed è disponibile un servizio di
   * guardaroba gratuito".
   * --------------------------------- */
  entranceInfo: {
    type: String,
    default: ''
  },

  /* ---- Sequenza della visita ----
   * Array ordinato di step. L'ordine nell'array = ordine di
   * visita reale.
   * --------------------------------- */
  steps: {
    type: [visitStepSchema],
    validate: {
      validator: v => v && v.length > 0,
      message: 'Una visita deve avere almeno un item'
    }
  },

  /* ---- Ritmo della visita ----
   * Durata target del testo GENERALE su ogni opera (il primo
   * testo mostrato ad ogni step, prima di qualunque "dimmi di
   * più"). Il curatore la sceglie in base al tipo di visita:
   * una visita lunga può permettersi 4min per opera, una
   * infarinatura veloce sta su 15s. Deve essere uno dei valori
   * ammessi in textEntry per le durate (3s/15s/40s/1min/4min).
   * --------------------------------- */
  pace: {
    type: String,
    enum: ['3s', '15s', '40s', '1min', '4min'],
    default: '15s'
  },

  /* ---- Autore e marketplace ----
   * L'autore è l'utente del marketplace
   * che ha creato/curato la visita.
   * --------------------------------- */
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // License e visibilità della visita nel marketplace.
  license: {
    type: String,
    enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'private'],
    default: 'CC-BY'
  },
  isPublic:  { type: Boolean, default: true },
  price:     { type: Number,  default: 0, min: 0 },

  // Tag liberi per la ricerca nel marketplace
  tags: [{ type: String, trim: true }]

}, { timestamps: true });

/* --------------------------------------------------
 * Indici per le query più frequenti
 * -------------------------------------------------- */
visitSchema.index({ museum: 1, isPublic: 1 }); // Per trovare rapidamente le visite pubbliche di un museo (marketplace)
visitSchema.index({ author: 1 });              // Per trovare rapidamente tutte le visite create da un autore

visitSchema.pre('save', function (next) {
  // Rimuove duplicati nei tag
  if (this.tags) this.tags = [...new Set(this.tags)];
  next();
});

export default model('Visit', visitSchema);