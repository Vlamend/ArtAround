import { Schema, model } from 'mongoose';

const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/;
const imgUrlRegex = /^((https?:\/\/.*)|(\/[\w\-\/]+))\.(png|jpg|jpeg|gif|svg)$/i;
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
    },

    /* ---- Rettangolo di delimitazione della sala ----
     * Coordinate 0-100, stesso sistema di Item.coords e
     * pointsOfInterest.coords. Opzionale: se assente, la mappa del
     * Navigator si limita a mostrare i punti (comportamento precedente)
     * senza disegnare i contorni della sala. Non è un vero motore CAD
     * con porte/corridoi, solo un rettangolo indicativo sufficiente a
     * dare un riferimento visivo di dove finisce una sala e ne inizia
     * un'altra.
     * --------------------------------- */
    bounds: {
        x: { type: Number },
        y: { type: Number },
        width: { type: Number },
        height: { type: Number }
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

    /* ---- Planimetrie ----
     * Una per piano, fornita dal museo (come se fosse la vera
     * planimetria dell'edificio). Le coordinate di Item.coords e
     * pointsOfInterest.coords per gli elementi di un dato piano sono
     * percentuali (0-100) RELATIVE A QUESTA IMMAGINE, non a un canvas
     * condiviso tra piani diversi - ogni piano ha il proprio sistema
     * di coordinate locale.
     * Se un piano non ha una planimetria fornita, il Navigator ricade
     * su una rappresentazione astratta calcolata da Museum.rooms[].bounds.
     * --------------------------------- */
    floorPlans: [{
        floor: { type: Number, required: true },
        imageUrl: {
            type: String,
            required: true,
            validate: {
                validator: v => imgUrlRegex.test(v),
                message: 'URL planimetria non valido'
            }
        }
    }],

    // Luoghi rilevanti svincolati dalla visita: entrata, uscita, toilette,
    // bar, shop, ascensori, ostacoli di accessibilità ecc.
    pointsOfInterest: [poiSchema]

}, { timestamps: true });

/* --------------------------------------------------
 Indici
-------------------------------------------------- */

museumSchema.index({ slug: 1 });
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