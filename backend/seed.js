import "dotenv/config";
import mongoose from "mongoose";

import User from "./src/models/user.js";
import Museum from "./src/models/museum.js";
import Author from "./src/models/author.js";
import Style from "./src/models/style.js";
import Artwork from "./src/models/artwork.js";
import Item from "./src/models/item.js";
import Visit from "./src/models/visit.js";

// NB: i testi delle opere sono generici/template, da personalizzare
// opera per opera prima della consegna finale. Stesso discorso per i
// tag "domains": assegnazioni plausibili di comodo per il seed.
// Non usiamo più ID Wikidata (rimossi dallo schema): senza LLM a
// generare i testi del Navigator, e dovendo comunque spezzare i testi
// a mano per durata, non ci servivano a nulla se non come chiave di
// join fragile — sostituiti da veri riferimenti a documenti Author/Style.

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connesso al DB per il seeding.");

    await Promise.all([
        User.deleteMany({}),
        Museum.deleteMany({}),
        Author.deleteMany({}),
        Style.deleteMany({}),
        Artwork.deleteMany({}),
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

    // ---------- Autori (riusabili tra più opere) ----------
    // NB: nomi/bio plausibili di comodo per il seed, tranne Bedoli
    // (contenuto ripreso dall'esempio del PDF del corso). Il punto di
    // questo seed è mostrare il riuso: stesso Author referenziato da
    // più Artwork diversi (Bedoli e "Pittore manierista bolognese"
    // condividono infatti lo stesso Style "Manierismo").
    const authorsData = [
        {
            name: "Maestro di San Giacomo",
            bio: [{ duration: "15s", content: "Pittore attivo a Bologna tra Duecento e Trecento, noto per pale d'altare di ambito gotico." }],
            birthYear: "Sconosciuto", deathYear: "Sconosciuto"
        },
        {
            name: "Anonimo del primo Rinascimento",
            bio: [{ duration: "15s", content: "Pittore non identificato, attivo nella seconda metà del Quattrocento in area emiliana." }]
        },
        {
            name: "Pittore veneto del Cinquecento",
            bio: [{ duration: "15s", content: "Esponente della scuola veneta, attivo nel primo Cinquecento, noto per l'uso ricco del colore." }]
        },
        {
            name: "Girolamo Mazzola Bedoli",
            bio: [
                { duration: "3s", content: "Pittore manierista emiliano del Cinquecento." },
                { duration: "15s", content: "Pittore emiliano attivo nel Cinquecento, allievo e collaboratore del Parmigianino, di cui riprese l'eleganza formale e la ricerca cromatica." },
                { duration: "40s", content: "Girolamo Mazzola Bedoli fu tra i protagonisti del manierismo emiliano. Cugino e collaboratore del Parmigianino, ne assimilò l'eleganza formale e la costruzione rarefatta dello spazio, sviluppando uno stile personale fatto di figure allungate, luce fredda e selettiva, e una tavolozza controllata dominata da bianchi e neri. La sua produzione, prevalentemente religiosa, coniuga rigore compositivo e intensità spirituale." }
            ],
            birthYear: "1500 ca.", deathYear: "1569"
        },
        {
            name: "Pittore manierista bolognese",
            bio: [{ duration: "15s", content: "Attivo a Bologna nella seconda metà del Cinquecento, aderì ai modi eleganti e raffinati del manierismo emiliano." }]
        },
        {
            name: "Ludovico Carracci",
            bio: [
                { duration: "15s", content: "Pittore bolognese, tra i fondatori dell'Accademia degli Incamminati, promotore di un ritorno al naturalismo dopo la stagione manierista." },
                { duration: "40s", content: "Ludovico Carracci fu, insieme ai cugini Annibale e Agostino, il principale animatore della riforma pittorica bolognese di fine Cinquecento. In reazione all'artificiosità tardo-manierista, i Carracci promossero un ritorno allo studio dal vero, alla resa naturale degli affetti e a una composizione più chiara e leggibile, ponendo le basi per la pittura barocca del secolo successivo." }
            ],
            birthYear: "1555", deathYear: "1619"
        },
        {
            name: "Pittore barocco bolognese",
            bio: [{ duration: "15s", content: "Attivo a Bologna nel primo Seicento, nell'orbita della riforma naturalistica avviata dai Carracci." }]
        }
    ];

    const authors = {};
    for (const data of authorsData) {
        authors[data.name] = await Author.create(data);
    }
    console.log(`${authorsData.length} autori creati.`);

    // ---------- Stili (riusabili tra più opere) ----------
    const stylesData = [
        {
            name: "Gotico",
            description: [{ duration: "15s", content: "Stile pittorico diffuso tra XIII e XIV secolo, caratterizzato da figure allungate, fondi dorati e linearismo elegante." }],
            period: "XIII-XIV secolo"
        },
        {
            name: "Rinascimento fiorentino",
            description: [{ duration: "15s", content: "Stile pittorico del Quattrocento fondato sulla prospettiva geometrica e sull'equilibrio compositivo." }],
            period: "XV secolo"
        },
        {
            name: "Rinascimento veneto",
            description: [{ duration: "15s", content: "Variante del Rinascimento che privilegia il colore e la luce sulla linea e sul disegno." }],
            period: "XVI secolo"
        },
        {
            name: "Manierismo",
            description: [
                { duration: "15s", content: "Il Manierismo è una corrente artistica del Cinquecento che privilegia l'eleganza formale e l'artificio compositivo rispetto alla resa naturalistica." },
                { duration: "40s", content: "Sviluppatosi dopo la piena maturità rinascimentale, il Manierismo predilige la sofisticazione formale: proporzioni allungate, pose complesse, luce artificiale e spazi compressi, in una elaborazione più intellettuale che naturalistica del soggetto. In Emilia trova in Parmigianino e nel suo cerchio, compreso Bedoli, alcuni dei suoi interpreti più raffinati." }
            ],
            period: "XVI secolo"
        },
        {
            name: "Barocco bolognese",
            description: [{ duration: "15s", content: "Stile pittorico di primo Seicento nato a Bologna dalla riforma naturalistica dei Carracci, attento allo studio dal vero e all'espressione degli affetti." }],
            period: "XVII secolo"
        }
    ];

    const styles = {};
    for (const data of stylesData) {
        styles[data.name] = await Style.create(data);
    }
    console.log(`${stylesData.length} stili creati.`);

    // ---------- Opere (10 artwork, ciascuna con 2 Content: elementare + medio) ----------
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

    // Riferimenti ad Author/Style REALI (non più stringhe Wikidata):
    // gli stessi documenti sono riusati su più opere dove appropriato,
    // esattamente il caso che con lo schema vecchio produceva ownership
    // fratturata tra autori marketplace diversi.
    const artworksData = [
        { title: "Madonna in trono col Bambino", year: "1290 ca.", technique: "Tempera su tavola", author: "Maestro di San Giacomo", style: "Gotico", domains: ["storia"] },
        { title: "Polittico di San Giacomo", year: "1330 ca.", technique: "Tempera su tavola", author: "Maestro di San Giacomo", style: "Gotico", domains: ["storia"] },
        { title: "Annunciazione", year: "1450 ca.", technique: "Tempera su tavola", author: "Anonimo del primo Rinascimento", style: "Rinascimento fiorentino", domains: ["storia"] },
        { title: "Estasi di Santa Cecilia", year: "1514 ca.", technique: "Olio su tavola trasportato su tela", author: "Pittore veneto del Cinquecento", style: "Rinascimento veneto", domains: ["artista", "stile"] },
        { title: "Ritratto di frate in veste di San Tommaso d'Aquino", year: "1545 ca.", technique: "Olio su tavola", author: "Girolamo Mazzola Bedoli", style: "Manierismo", domains: ["artista", "stile"] },
        { title: "Madonna di San Zaccaria", year: "1560 ca.", technique: "Olio su tela", author: "Pittore manierista bolognese", style: "Manierismo", domains: ["stile"] },
        { title: "Comunione di San Girolamo", year: "1614", technique: "Olio su tela", author: "Ludovico Carracci", style: "Barocco bolognese", domains: ["artista"] },
        { title: "Strage degli Innocenti", year: "1611 ca.", technique: "Olio su tela", author: "Ludovico Carracci", style: "Barocco bolognese", domains: ["storia"] },
        { title: "Pala dei Mendicanti", year: "1595 ca.", technique: "Olio su tela", author: "Pittore barocco bolognese", style: "Barocco bolognese", domains: ["materiali"] },
        { title: "Assunzione della Vergine", year: "1580 ca.", technique: "Olio su tela", author: "Pittore barocco bolognese", style: "Barocco bolognese", domains: ["stile"] }
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

    for (let i = 0; i < artworksData.length; i++) {
        const a = artworksData[i];
        const room = rooms[i];

        const occurrence = roomOccurrence.get(room._id.toString()) ?? 0;
        roomOccurrence.set(room._id.toString(), occurrence + 1);
        const coords = pointInRoom(room, occurrence);

        // Proprietario alternato tra i due autori demo, solo per
        // varietà: il prezzo resta 0 su tutte e 10 perché le visite
        // 'classica' (curata da autore1) e 'famiglie' (curata da
        // autore2) usano ENTRAMBE tutte e 10 le opere — con un solo
        // proprietario per opera, una qualunque a pagamento posseduta
        // da un solo autore farebbe fallire la validazione server-side
        // della visita dell'altro. Per dimostrare un'opera VERAMENTE a
        // pagamento serve un'opera dedicata, fuori da qualunque visita
        // condivisa tra curatori diversi (non creata qui per non
        // complicare il seed demo, ma il meccanismo è pronto: vedi
        // artworksController.purchaseArtwork).
        const owner = i % 2 === 0 ? users.autore1 : users.autore2;

        const artwork = await Artwork.create({
            title: a.title,
            year: a.year,
            technique: a.technique,
            museum: museum._id,
            roomId: room._id,
            coords,
            author: authors[a.author]._id,
            style: styles[a.style]._id,
            owner: owner._id,
            license: "CC-BY",
            isPublic: true,
            price: 0
        });

        const elementareItem = await Item.create({
            artwork: artwork._id,
            texts: makeTexts("elementare"),
            language: "elementare",
            domains: a.domains
        });

        const medioItem = await Item.create({
            artwork: artwork._id,
            texts: makeTexts("medio"),
            language: "medio",
            domains: a.domains
        });

        itemsByArtwork.push({ artwork, elementare: elementareItem, medio: medioItem });
    }
    console.log(`${artworksData.length} artwork create, con Content elementare + medio ciascuna.`);
    console.log("Licenza/proprietà ora vivono su Artwork (non più per singola lingua): comprare un'opera dà accesso a tutte le sue varianti in una volta.");

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
        pace: "40s",
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
        pace: "15s",
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
        description: "Il percorso classico arricchito: durante la visita è possibile chiedere a voce 'chi è l'autore' o 'qual è lo stile' per ogni opera, senza bisogno di acquistare nulla in più.",
        museum: museum._id,
        entranceInfo: "Ingresso da via delle Belle Arti 56. Biglietto 6€, guardaroba gratuito.",
        pace: "1min",
        steps: buildSteps(itemsByArtwork.map(a => a.medio)),
        author: users.autore1._id,
        license: "CC-BY",
        isPublic: true,
        price: 2,
        tags: ["approfondimento", "curiosità"]
    });
    await visitApprofondimento.save();

    console.log("3 visite create (pace: famiglie 15s, classico 40s, approfondimento 1min).");

    // ---------- Content extra sui domini 'architettura'/'materiali'/'storia' ----------
    // Dimostra il "dimmi di più per topic": su queste due opere, oltre
    // ad artista/stile (Author/Style) c'è anche materiale e storia da
    // proporre se l'utente ha interesse alto su quei domini.
    const bedoliArtwork = itemsByArtwork[4].artwork; // Ritratto di frate, Bedoli
    await Item.create({
        artwork: bedoliArtwork._id,
        texts: [
            { duration: "15s", content: "Il dipinto è realizzato a olio su tavola di pioppo, supporto diffuso nella pittura emiliana del Cinquecento." },
            { duration: "40s", content: "Il supporto è una tavola di pioppo, tipica della pittura emiliana del periodo, preparata con gesso e colla animale prima della stesura pittorica a olio. Questa tecnica consentiva velature sottili e sovrapposte, alla base della resa fredda e smaltata tipica del manierismo di Bedoli." }
        ],
        language: "medio",
        domains: ["materiali"]
    });

    const straceArtwork = itemsByArtwork[7].artwork; // Strage degli Innocenti, Carracci
    await Item.create({
        artwork: straceArtwork._id,
        texts: [
            { duration: "15s", content: "Il soggetto racconta l'episodio biblico della strage ordinata da Erode a Betlemme." },
            { duration: "40s", content: "Il soggetto riprende l'episodio evangelico della strage degli innocenti, tema caro alla pittura controriformata per il suo carico drammatico ed emotivo, qui reso da Ludovico Carracci con un naturalismo dei corpi e degli affetti che segna la rottura con la maniera tardo-cinquecentesca." }
        ],
        language: "medio",
        domains: ["storia"]
    });
    console.log("Content extra su domini 'materiali' e 'storia' creati (per dimostrare il dimmi-di-più per topic).");

    console.log("Seeding completato.");
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error("Errore durante il seeding:", err);
    process.exit(1);
});
