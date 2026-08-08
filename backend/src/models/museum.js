import { Schema, model } from 'mongoose';

const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/;
const imgUrlRegex = /^https?:\/\/.*\.(png|jpg|jpeg|gif|svg)$/i;
const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{7,15}$/;
const capRegex = /^\d{5}$/;
const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* --------------------------------------------------
 Sala del museo

 Viene referenziata dagli Item tramite roomId.
 Rappresenta SOLO le sale espositive (dove si trovano
 gli Item). Per toilette, bar, uscite, ostacoli ecc.
 vedi pointsOfInterest più sotto: non sono sale
 espositive e non ospitano Item.
-------------------------------------------------- */

const roomSchema = new Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    floor: {
        type: Number,
        default: 0
    },

    description: {
        type: String,
        default: ''
    }

});

/* --------------------------------------------------
 Punto di interesse

 Luoghi rilevanti dell'ambiente svincolati dalla
 visita: entrata, uscita, uscite di emergenza,
 ascensori e scale, toilette, bar, shop, ostacoli di
 accessibilità (gradini, porte, poltrone e sedie,
 oggetti in mezzo alla stanza, ecc.). Il Navigator li
 usa per rispondere a comandi come "Dov'è la toilette?"
 indipendentemente dalla sequenza della visita in corso.
-------------------------------------------------- */

const poiSchema = new Schema({

    type: {
        type: String,
        enum: [
            'entrance',
            'exit',
            'emergency_exit',
            'restroom',
            'bar',
            'shop',
            'elevator',
            'stairs',
            'obstacle'
        ],
        required: true
    },

    name: {
        type: String,
        default: ''
    },

    floor: {
        type: Number,
        default: 0
    },

    // Coordinate sulla mappa del museo (0-100), stesso sistema di Item.coords
    coords: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },

    // Sala in cui si trova il punto di interesse (riferimento a Museum.rooms._id),
    // utile ad es. per un ostacolo dentro una specifica sala espositiva
    roomId: {
        type: Schema.Types.ObjectId,
        default: null
    }

}, { _id: false });

/* --------------------------------------------------
 Schema principale: Museum

 Contiene esclusivamente le informazioni proprie
 del museo e la configurazione del Navigator.
-------------------------------------------------- */

const museumSchema = new Schema({

    // Identificatore breve e leggibile usato dal file di configurazione
    // del Navigator per selezionare il museo (vedi specifiche: "Selezione
    // del museo – via file di configurazione"), più comodo di un ObjectId
    // grezzo in un file che il curatore deve poter leggere/modificare.
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: v => slugRegex.test(v),
            message: 'Slug non valido (usare solo lettere minuscole, numeri e trattini)'
        }
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: ''
    },

    address: {
        type: String,
        default: ''
    },

    city: {
        type: String,
        default: ''
    },

    province: {
        type: String,
        default: ''
    },

    region: {
        type: String,
        default: ''
    },

    cap: {
        type: String,
        default: '',
        validate: {
            validator: v => v === '' || capRegex.test(v),
            message: 'CAP non valido'
        }
    },

    phone: {
        type: String,
        default: '',
        validate: {
            validator: v => v === '' || phoneRegex.test(v),
            message: 'Numero di telefono non valido'
        }
    },

    email: {
        type: String,
        default: '',
        validate: {
            validator: v => v === '' || mailRegex.test(v),
            message: 'Email non valida'
        }
    },

    website: {
        type: String,
        default: '',
        validate: {
            validator: v => v === '' || urlRegex.test(v),
            message: 'URL non valido'
        }
    },

    logo: {
        type: String,
        default: '',
        validate: {
            validator: v => v === '' || imgUrlRegex.test(v),
            message: 'Logo non valido'
        }
    },

    primaryColor: {
        type: String,
        default: '#1565C0',
        validate: {
            validator: v => colorRegex.test(v),
            message: 'Colore non valido'
        }
    },

    secondaryColor: {
        type: String,
        default: '#FFFFFF',
        validate: {
            validator: v => colorRegex.test(v),
            message: 'Colore non valido'
        }
    },

    openingHours: {

        monday:    { type: String, default: 'Chiuso' },
        tuesday:   { type: String, default: 'Chiuso' },
        wednesday: { type: String, default: 'Chiuso' },
        thursday:  { type: String, default: 'Chiuso' },
        friday:    { type: String, default: 'Chiuso' },
        saturday:  { type: String, default: 'Chiuso' },
        sunday:    { type: String, default: 'Chiuso' }

    },

    ticketInfo: {
        type: String,
        default: ''
    },

    services: [{
        type: String,
        trim: true
    }],

    rooms: [roomSchema],

    // Luoghi rilevanti svincolati dalla visita: entrata, uscita, toilette,
    // bar, shop, ascensori, ostacoli di accessibilità ecc.
    pointsOfInterest: [poiSchema]

}, { timestamps: true });

//Indici per velocizzare le query più frequenti (ricerca per nome e città)

museumSchema.index({ name: 1 });
museumSchema.index({ city: 1 });

/* --------------------------------------------------
 Middleware
-------------------------------------------------- */

museumSchema.pre('save', function(next){

    if(this.services){
        this.services = [...new Set(this.services)];
    }

    next();

});

export default model('Museum', museumSchema);