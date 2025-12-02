import mongoose from "mongoose";
import bcrypt from"bcryptjs";

const usrRegex = /^[^\s]+$/;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: usrRegex.test.bind(usrRegex),
      message: "Nome utente non valido"
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
    enum: ["admin", "user"],
    default: "user"
  },

  preferredDetailLevel: {
    type: String,
    enum: ["short", "medium", "long"],
    default: "short"
  },

  language: {
    type: String,
    enum: ["it", "en"],
    default: "it"
  },

  visitIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit"
  }]
});

// Middleware Mongoose per hashare la password prima di salvare
UserSchema.pre("save", async function (next) {
  // Se la password NON è stata modificata, non la ri-hashiamo
  if (!this.isModified("password")) {
    return next();
  }
  //Altrimenti, hash della password
  try {
    const sale = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, sale);
    next();
  } catch (err) {
    next(err);
  }
});

// Metodo per confrontare la password inserita con quella hashata nel DB
UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};



export default mongoose.model("User", UserSchema);
