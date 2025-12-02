import mongoose from "mongoose";

const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/;
const imgUrlRegex = /^https?:\/\/.*\.(png|jpg|jpeg|gif|svg)$/i;
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{7,15}$/;
const capRegex = /^\d{5}$/;

const MuseoSchema = new mongoose.Schema({
    nomeMuseo: { type: String, required: true, minlength: 2, maxlength: 50 },
    descrizione: { type: String, maxlength: 500 },
    temi: { type: [String], default: [] },
    indirizzo: { type: String, maxlength: 100 },
  citta: { type: String, maxlength: 50 },
  cap: { type: String, validate: {
      validator: v => capRegex.test(v),
      message: props => `${props.value} non è un CAP valido!`
    }
  },
  provincia: { type: String, maxlength: 50 },
  regione: { type: String, maxlength: 50 },
  telefono: { type: String, validate: {
      validator: v => phoneRegex.test(v),
      message: props => `${props.value} non è un numero di telefono valido!`
    } 
  },
  email: {
    type: String,
    validate: {
      validator: v => mailRegex.test(v),
      message: props => `${props.value} non è un indirizzo email valido!`
    },
    maxlength: 100
  },
  sitoWeb: {
    type: String,
    maxlength: 100,
    validate: {
      validator: v => urlRegex.test(v),
      message: props => `${props.value} non è un indirizzo web valido!`
    },
  },
  orariApertura: { type: String, default: "Non specificato" },
  biglietti: String,
  servizi: { type: [String], default: [] },
  logo: {
    type: String,
    validate: {
      validator: v => imgUrlRegex.test(v),
      message: props => `${props.value} non è un URL di immagine valido!`
    }
  },
  colorePrimario: {
    type: String,
    validate: {
      validator: v => hexColorRegex.test(v),
      message: props => `${props.value} non è un colore esadecimale valido!`
    }
  },
  coloreSecondario: {
    type: String,
    validate: {
      validator: v => hexColorRegex.test(v),
      message: props => `${props.value} non è un colore esadecimale valido!`
    }
  }
});

export default mongoose.model("Museum", MuseoSchema);