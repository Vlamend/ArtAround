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
    enum: ['admin', 'user'],
    default: 'user'
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

  // NB: il possesso non vive più qui come array duplicato (rischio di
  // disallineamento). La fonte di verità è Artwork.owner (non più
  // Item.owner: license/isPublic/price/owner sono stati spostati da
  // Content ad Artwork — un solo proprietario per opera, condiviso da
  // tutte le sue varianti linguistiche). Per sapere cosa possiede un
  // utente si fa Artwork.find({ owner: user._id }).

visitedVisits: [{
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    completedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

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