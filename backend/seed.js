import "dotenv/config";
import mongoose from "mongoose";

import User from "./src/models/user.js";
import Museum from "./src/models/museum.js";
import Item from "./src/models/item.js";
import Visit from "./src/models/visit.js";

// NB: i wikidataId qui sotto sono PLACEHOLDER (tranne quello di Bedoli,
// ripreso dall'esempio del PDF) - da sostituire con ID reali prima
// della consegna finale. Stesso discorso per i testi delle opere:
// sono generici/template, da personalizzare opera per opera.
// Anche i tag "domains" sono assegnazioni plausibili di comodo per il
// seed, da rivedere quando i testi reali saranno pronti.

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connesso al DB per il seeding.");

    await Promise.all([
        User.deleteMany({}),
        Museum.deleteMany({}),
        Item.deleteMany({}),
        Visit.deleteMany({})
    ]);
    console.log("Collection pulite.");

    // ---------- Utenti demo ----------
    const usersData = [
        { username: "autore1", email: "autore1@artaround.test", password: "12345678", role: "user" },
        { username: "autore2", email: "autore2@artaround.test", password: "12345678", role: "user" },
        { username: "visitatore1", email: "visitatore1@artaround.test", password: "12345678", role: "user" },
        { username: "visitatore2", email: "visitatore2@artaround.test", password: "12345678", role: "user" }
    ];

    const users = {};
    for (const data of usersData) {
        const user = new User(data);
        await user.save(); // .save() (non insertMany) per far scattare l'hook pre-save di hashing
        users[data.username] = user;
    }
    console.log("Utenti demo creati.");

    // ---------- Museo ----------
    const museum = await Museum.create({
        slug: "pinacoteca-bologna",
        name: "Pinacoteca Nazionale di Bologna",
        description: "Una delle maggiori raccolte di pittura emiliana dal Duecento al Settecento.",
        address: "Via delle Belle Arti, 56",
        city: "Bologna",
        province: "BO",
        region: "Emilia-Romagna",
        cap: "40126",
        website: "https://pinacotecabologna.beniculturali.it",
        primaryColor: "#8C1C13",
        secondaryColor: "#B08D57",
        ticketInfo: "Biglietto intero 6€, ridotto 2€. Ingresso gratuito la prima domenica del mese.",
        openingHours: {
            monday: "Chiuso",
            tuesday: "09:00-19:00",
            wednesday: "09:00-19:00",
            thursday: "09:00-19:00",
            friday: "09:00-19:00",
            saturday: "09:00-19:00",
            sunday: "09:00-14:00"
        },
        services: ["guardaroba", "bookshop", "audioguide"],
        rooms: [
            { name: "Sala 1 - Duecento e Trecento", floor: 1, bounds: { x: 5, y: 10, width: 25, height: 80 } },
            { name: "Sala 2 - Quattrocento", floor: 1, bounds: { x: 35, y: 10, width: 25, height: 80 } },
            { name: "Sala 3 - Rinascimento maturo", floor: 1, bounds: { x: 65, y: 10, width: 30, height: 80 } },
            { name: "Sala 4 - Manierismo", floor: 2, bounds: { x: 5, y: 10, width: 40, height: 80 } },
            { name: "Sala 5 - Seicento", floor: 2, bounds: { x: 50, y: 10, width: 45, height: 80 } }
        ],
        floorPlans: [
            { floor: 1, imageUrl: "/assets/floorplans/piano1.svg" },
            { floor: 2, imageUrl: "/assets/floorplans/piano2.svg" }
        ]
    });

    const [room1, room2, room3, room4, room5] = museum.rooms;
    museum.pointsOfInterest = [
        { type: "entrance", name: "Ingresso principale", floor: 1, coords: { x: 2, y: 50 } },
        { type: "exit", name: "Uscita", floor: 1, coords: { x: 98, y: 50 } },
        { type: "restroom", name: "Bagni", floor: 1, roomId: room2._id, coords: { x: 47, y: 85 } },
        { type: "bar", name: "Caffetteria", floor: 1, coords: { x: 15, y: 95 } },
        { type: "shop", name: "Bookshop", floor: 1, coords: { x: 85, y: 95 } },
        { type: "elevator", name: "Ascensore", floor: 1, coords: { x: 50, y: 95 } },
        { type: "obstacle", name: "Gradino sala 4", floor: 2, roomId: room4._id, coords: { x: 25, y: 50 } }
    ];
    await museum.save();
    console.log("Museo creato con sale, planimetrie e punti di interesse.");

    // ---------- Opere (10 opere, 2 livelli linguistici ciascuna) ----------
    const rooms = [room1, room2, room2, room3, room3, room4, room4, room5, room5, room1];

    function pointInRoom(room, slot) {
        const b = room.bounds;
        const pad = 5;
        const fraction = slot === 0 ? 0.3 : 0.7;
        return {
            x: b.x + pad + (b.width - pad * 2) * fraction,
            y: b.y + b.height / 2
        };
    }

    const roomOccurrence = new Map();

    // domains: tag plausibili di comodo, da rivedere con i testi reali
    const artworks = [
        { title: "Madonna in trono col Bambino", year: "1290 ca.", technique: "Tempera su tavola", wikidataId: "Q100000001", artistWikidata: "Q100000101", styleWikidata: "Q100000201", domains: ["storia"] },
        { title: "Polittico di San Giacomo", year: "1330 ca.", technique: "Tempera su tavola", wikidataId: "Q100000002", artistWikidata: "Q100000102", styleWikidata: "Q100000201", domains: ["storia"] },
        { title: "Annunciazione", year: "1450 ca.", technique: "Tempera su tavola", wikidataId: "Q100000003", artistWikidata: "Q100000103", styleWikidata: "Q100000202", domains: ["storia"] },
        { title: "Estasi di Santa Cecilia", year: "1514 ca.", technique: "Olio su tavola trasportato su tela", wikidataId: "Q100000004", artistWikidata: "Q100000104", styleWikidata: "Q100000203", domains: ["artista", "stile"] },
        { title: "Ritratto di frate in veste di San Tommaso d'Aquino", year: "1545 ca.", technique: "Olio su tavola", wikidataId: "Q126599960", artistWikidata: "Q1527051", styleWikidata: "Q131808", domains: ["artista", "stile"] },
        { title: "Madonna di San Zaccaria", year: "1560 ca.", technique: "Olio su tela", wikidataId: "Q100000006", artistWikidata: "Q100000106", styleWikidata: "Q131808", domains: ["stile"] },
        { title: "Comunione di San Girolamo", year: "1614", technique: "Olio su tela", wikidataId: "Q100000007", artistWikidata: "Q100000107", styleWikidata: "Q100000204", domains: ["artista"] },
        { title: "Strage degli Innocenti", year: "1611 ca.", technique: "Olio su tela", wikidataId: "Q100000008", artistWikidata: "Q100000107", styleWikidata: "Q100000204", domains: ["storia"] },
        { title: "Pala dei Mendicanti", year: "1595 ca.", technique: "Olio su tela", wikidataId: "Q100000009", artistWikidata: "Q100000109", styleWikidata: "Q100000204", domains: ["materiali"] },
        { title: "Assunzione della Vergine", year: "1580 ca.", technique: "Olio su tela", wikidataId: "Q100000010", artistWikidata: "Q100000110", styleWikidata: "Q100000204", domains: ["stile"] }
    ];

    function makeTexts(level) {
        if (level === "elementare") {
            return [
                { duration: "3s", content: "Un dipinto antico da scoprire." },
                { duration: "15s", content: "Questo quadro racconta una scena importante, dipinta tanto tempo fa con colori che ancora oggi colpiscono lo sguardo." },
                { duration: "40s", content: "Guarda bene i colori e le forme di questo dipinto: l'artista ha voluto raccontare una storia usando pennellate curate e dettagli pensati per catturare l'attenzione. Osserva i personaggi e prova a immaginare cosa stanno pensando." }
            ];
        }
        return [
            { duration: "3s", content: "Opera pittorica di rilievo storico-artistico." },
            { duration: "15s", content: "Il dipinto si inserisce in una precisa temperie stilistica, con soluzioni compositive e cromatiche rappresentative del periodo di realizzazione." },
            { duration: "40s", content: "L'opera testimonia le scelte compositive tipiche del contesto storico-artistico in cui fu realizzata: l'impianto spaziale, la resa della luce e l'equilibrio delle figure rivelano l'aggiornamento dell'autore sulle correnti pittoriche a lui contemporanee, offrendo allo spettatore una lettura stratificata tra soggetto religioso o narrativo e ricerca formale." }
        ];
    }

    const itemsByArtwork = [];

    for (let i = 0; i < artworks.length; i++) {
        const a = artworks[i];
        const room = rooms[i];

        const occurrence = roomOccurrence.get(room._id.toString()) ?? 0;
        roomOccurrence.set(room._id.toString(), occurrence + 1);
        const coords = pointInRoom(room, occurrence);

        const elementareItem = await Item.create({
            title: a.title,
            year: a.year,
            technique: a.technique,
            wikidataId: a.wikidataId,
            artistWikidata: a.artistWikidata,
            styleWikidata: a.styleWikidata,
            museum: museum._id,
            roomId: room._id,
            coords,
            texts: makeTexts("elementare"),
            language: "elementare",
            author: users.autore1._id,
            license: "CC-BY",
            type: "object",
            domains: a.domains
        });

        const medioItem = await Item.create({
            title: a.title,
            year: a.year,
            technique: a.technique,
            wikidataId: a.wikidataId,
            artistWikidata: a.artistWikidata,
            styleWikidata: a.styleWikidata,
            museum: museum._id,
            roomId: room._id,
            coords,
            texts: makeTexts("medio"),
            language: "medio",
            author: users.autore2._id,
            license: "CC-BY",
            type: "object",
            domains: a.domains
        });

        itemsByArtwork.push({ elementare: elementareItem, medio: medioItem });
    }
    console.log(`${artworks.length} opere create, 2 item ciascuna (elementare + medio).`);

    // Due item "related" (contenuto opzionale, su richiesta del visitatore)
    const relatedItems = await Item.insertMany([
        {
            title: "Il Manierismo",
            texts: [
                { duration: "15s", content: "Il Manierismo è una corrente artistica del Cinquecento che privilegia l'eleganza formale e l'artificio compositivo rispetto alla resa naturalistica." }
            ],
            museum: museum._id,
            language: "medio",
            author: users.autore1._id,
            license: "CC-BY",
            type: "related",
            styleWikidata: "Q131808",
            domains: ["stile"]
        },
        {
            title: "Girolamo Mazzola Bedoli",
            texts: [
                { duration: "15s", content: "Pittore emiliano attivo nel Cinquecento, allievo e collaboratore del Parmigianino, di cui riprese l'eleganza formale e la ricerca cromatica." }
            ],
            museum: museum._id,
            language: "medio",
            author: users.autore1._id,
            license: "CC-BY",
            type: "related",
            artistWikidata: "Q1527051",
            domains: ["artista"]
        }
    ]);
    console.log("Item correlati creati.");

    // ---------- Visite (3 visite, almeno 10 opere ciascuna, sullo stesso museo) ----------

    function buildSteps(items) {
        return items.map((item, idx) => ({
            item: item._id,
            logisticNote: idx === 0
                ? "Dall'ingresso, proseguire dritto verso la prima sala."
                : "Proseguire nella sala successiva seguendo le indicazioni a pavimento."
        }));
    }

    const visitClassica = new Visit({
        title: "Percorso classico",
        description: "Un percorso standard attraverso le opere principali della Pinacoteca, con testi di livello medio.",
        museum: museum._id,
        entranceInfo: "Ingresso da via delle Belle Arti 56. Biglietto 6€, guardaroba gratuito.",
        steps: buildSteps(itemsByArtwork.map(a => a.medio)),
        author: users.autore1._id,
        license: "CC-BY",
        isPublic: true,
        price: 0,
        tags: ["classico", "adulti"]
    });
    await visitClassica.save();

    const visitFamiglie = new Visit({
        title: "Visita per famiglie",
        description: "Le stesse opere del percorso classico, raccontate con un linguaggio semplice e accessibile ai più piccoli.",
        museum: museum._id,
        entranceInfo: "Ingresso da via delle Belle Arti 56. Biglietto 6€, ridotto 2€ per bambini.",
        steps: buildSteps(itemsByArtwork.map(a => a.elementare)),
        author: users.autore2._id,
        license: "CC-BY",
        isPublic: true,
        price: 0,
        tags: ["famiglie", "bambini"]
    });
    await visitFamiglie.save();

    const visitApprofondimento = new Visit({
        title: "Approfondimento con curiosità",
        description: "Il percorso classico arricchito da contenuti opzionali su stile e artisti.",
        museum: museum._id,
        entranceInfo: "Ingresso da via delle Belle Arti 56. Biglietto 6€, guardaroba gratuito.",
        steps: [
            ...buildSteps(itemsByArtwork.map(a => a.medio)),
            { item: relatedItems[0]._id, logisticNote: "Contenuto opzionale, disponibile su richiesta." },
            { item: relatedItems[1]._id, logisticNote: "Contenuto opzionale, disponibile su richiesta." }
        ],
        author: users.autore1._id,
        license: "CC-BY",
        isPublic: true,
        price: 2,
        tags: ["approfondimento", "curiosità"]
    });
    await visitApprofondimento.save();

    console.log("3 visite create.");

    console.log("Seeding completato.");
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error("Errore durante il seeding:", err);
    process.exit(1);
});