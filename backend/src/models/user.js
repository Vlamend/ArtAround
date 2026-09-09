import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const usrRegex = /^[^\s]+$/;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: usrRegex.test.bind(usrRegex),
      message: 'Nome utente non valido'
    }
  },

  password: { type: String, required: true },

  email: {
    type: String,
    required: true,
    unique: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },

  role: {
    type: String,
    enum: ['admin', 'autore', 'visitatore'],
    default: 'visitatore'
  },

  /* ---- Preferenze del profilo utente ----
   *
   * preferredLanguageLevel: usa lo stesso enum di Item.language,
   *   non un valore arbitrario. E' quello che il Navigator confronta
   *   direttamente con Item.language per scegliere l'item più
   *   adatto al profilo dell'utente (vedi specifiche ArtAround:
   *   "Il Navigator sceglie l'item con il language più adatto al
   *   profilo dell'utente")
   *
   * interfaceLanguage: lingua dell'interfaccia (menu, comandi
   *   vocali, eventuale traduzione dei contenuti). Rinominato
   *   rispetto a 'language' per non confondersi con
   *   Item.language, che indica il livello linguistico del
   *   contenuto e non la lingua
   * --------------------------------- */
  preferredLanguageLevel: {
    type: String,
    enum: ['infantile', 'elementare', 'medio', 'specialistico'],
    default: 'medio'
  },

  interfaceLanguage: {
    type: String,
    enum: ['it', 'en'],
    default: 'it'
  },

  interestWeights: {
    artista:       { type: Number, default: 0 },
    architettura:  { type: Number, default: 0 },
    stile:         { type: Number, default: 0 },
    materiali:     { type: Number, default: 0 },
    storia:        { type: Number, default: 0 }
  },

  /* ---- Licenze acquisite ----
   * Un'entry per ogni adozione o acquisizione ESPLICITA fatta da
   * questo utente — non per il semplice uso di content gratuito con
   * licenza CC, che resta libero e non genera nessuna entry (nessuna
   * azione esplicita da tracciare, coerente con come funzionano le
   * licenze CC nel mondo reale).
   *
   * A differenza del vecchio 'ownedItems' che avevamo rimosso: qui non
   * c'è nessun secondo posto che dice la stessa cosa. 'owner' su
   * Artwork resta l'UNICA fonte di verità per "chi è il proprietario
   * adesso" (un'acquisizione aggiorna quello, non solo questo array).
   * Questo array invece è l'UNICA fonte di verità per "quali licenze
   * ha ottenuto questo utente nel tempo" — un fatto che non vive da
   * nessun'altra parte, quindi non c'è nulla da sincronizzare.
   *
   * pricePaid è congelato al momento della transazione: se in seguito
   * l'opera cambia proprietario o i prezzi cambiano, questa entry non
   * si aggiorna né si invalida — un'adozione, una volta ottenuta,
   * resta valida per sempre.
   * --------------------------------- */
  licenses: [{
    artwork:   { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', required: true },
    type:      { type: String, enum: ['adoption', 'acquisition'], required: true },
    pricePaid: { type: Number, required: true, min: 0 },
    date:      { type: Date, default: Date.now }
  }],

visitedVisits: [{
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    completedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Query "al contrario" rispetto a come l'array è pensato: non "cosa
// possiede questo utente" ma "chi ha licenziato quest'opera" — usata
// lato venditore per "gestione delle adozioni/vendite".
UserSchema.index({ 'licenses.artwork': 1 });

// Middleware Mongoose per hashare la password prima di salvare
UserSchema.pre('save', async function (next) {
  // Se la password NON è stata modificata, non la ri-hashiamo
  if (!this.isModified('password')) {
    return next();
  }
  // Altrimenti, hash della password
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Metodo per confrontare la password inserita con quella hashata nel DB
UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', UserSchema);