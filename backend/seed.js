import "dotenv/config";
import mongoose from "mongoose";

import User from "./src/models/user.js";
import Museum from "./src/models/museum.js";
import Author from "./src/models/author.js";
import Style from "./src/models/style.js";
import Artwork from "./src/models/artwork.js";
import Item from "./src/models/item.js";
import Visit from "./src/models/visit.js";

/*
 * seed.js — versione estesa (~200 opere + secondo museo)
 *
 * Rispetto alla versione precedente: più sale (8, non più 5, per
 * coprire anche il Settecento), più autori/stili reali della scuola
 * bolognese ed emiliana, testi generati per SOGGETTO (madonna,
 * ritratto, martirio, mitologia...) invece che un unico paragrafo-
 * template ripetuto identico su tutte le opere, e un SECONDO MUSEO
 * (Galleria Estense di Modena, ~24 opere) per poter verificare che
 * l'esclusione tra musei funzioni davvero — opere/sale/visite di un
 * museo non devono mai comparire navigando l'altro — e per poter
 * testare la config admin con più di un museum reale tra cui scegliere.
 *
 * Onestà sui dati: un nucleo di opere è realmente documentato e
 * verificato (Bedoli, Guido Reni, Raffaello, i due Carracci, il busto
 * di Bernini a Modena), così come l'elenco di 27 autori (tutti
 * realmente attivi in Emilia tra Duecento e Settecento, con date
 * storiche corrette). I titoli restanti sono però combinazioni
 * plausibili soggetto+santi/famiglie patrizie realmente esistite
 * (Bentivoglio, Pepoli, Zambeccari, Malvezzi, Ranuzzi, Aldrovandi),
 * non un calco 1:1 del catalogo reale dei due musei: a questa
 * granularità non potevo verificare ogni singolo titolo, e preferisco
 * dirlo chiaramente piuttosto che presentarli come schedatura
 * filologica vera.
 *
 * adoptionPrice è 0 su tutte le opere (contenuto sempre adottabile
 * gratuitamente nelle visite, coerente con la licenza CC-BY educativa
 * già stabilita); acquisitionPrice varia invece per dare un minimo di
 * realismo economico al marketplace, dato che non vincola l'uso nelle
 * visite (vedi nota nella versione precedente del seed).
 */

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

    // ---------- Utenti demo (invariati) ----------
    const usersData = [
        { username: "autore1", email: "autore1@artaround.test", password: "12345678", role: "autore" },
        { username: "autore2", email: "autore2@artaround.test", password: "12345678", role: "autore" },
        { username: "visitatore1", email: "visitatore1@artaround.test", password: "12345678", role: "visitatore" },
        { username: "visitatore2", email: "visitatore2@artaround.test", password: "12345678", role: "visitatore" },
        { username: "admin1", email: "admin1@artaround.test", password: "12345678", role: "admin" }
    ];
    const users = {};
    for (const data of usersData) {
        const user = new User(data);
        await user.save();
        users[data.username] = user;
    }
    console.log("Utenti demo creati.");

    // ---------- Museo: 8 sale (invece di 5) per coprire anche il Settecento ----------
    const museum = await Museum.create({
        slug: "pinacoteca-bologna",
        name: "Pinacoteca Nazionale di Bologna",
        description: "Una delle maggiori raccolte di pittura emiliana dal Duecento al Settecento, nata dalle soppressioni di chiese e conventi bolognesi tra Otto e Novecento.",
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
            { name: "Sala 1 - Duecento e Trecento",              floor: 1, bounds: { x: 5,  y: 10, width: 20, height: 80 } },
            { name: "Sala 2 - Quattrocento",                      floor: 1, bounds: { x: 27, y: 10, width: 20, height: 80 } },
            { name: "Sala 3 - Rinascimento maturo",               floor: 1, bounds: { x: 49, y: 10, width: 20, height: 80 } },
            { name: "Sala 4 - Manierismo",                        floor: 1, bounds: { x: 71, y: 10, width: 24, height: 80 } },
            { name: "Sala 5 - I Carracci e la riforma naturalistica", floor: 2, bounds: { x: 5,  y: 10, width: 22, height: 80 } },
            { name: "Sala 6 - Il classicismo di Reni e Domenichino", floor: 2, bounds: { x: 29, y: 10, width: 22, height: 80 } },
            { name: "Sala 7 - Guercino e il naturalismo luministico", floor: 2, bounds: { x: 53, y: 10, width: 20, height: 80 } },
            { name: "Sala 8 - Il Settecento bolognese",           floor: 2, bounds: { x: 75, y: 10, width: 20, height: 80 } }
        ],
        floorPlans: [
            { floor: 1, imageUrl: "/assets/floorplans/piano1.svg" },
            { floor: 2, imageUrl: "/assets/floorplans/piano2.svg" }
        ]
    });

    const rooms = museum.rooms; // rooms[0..7], nell'ordine sopra

    museum.pointsOfInterest = [
        { type: "entrance",  name: "Ingresso principale", floor: 1, coords: { x: 2,  y: 50 } },
        { type: "exit",      name: "Uscita",              floor: 2, coords: { x: 98, y: 50 } },
        { type: "restroom",  name: "Bagni piano terra",   floor: 1, roomId: rooms[1]._id, coords: { x: 30, y: 90 } },
        { type: "restroom",  name: "Bagni primo piano",   floor: 2, roomId: rooms[5]._id, coords: { x: 30, y: 90 } },
        { type: "bar",       name: "Caffetteria",         floor: 1, coords: { x: 10, y: 95 } },
        { type: "shop",      name: "Bookshop",            floor: 1, coords: { x: 90, y: 95 } },
        { type: "elevator",  name: "Ascensore",           floor: 1, coords: { x: 50, y: 95 } },
        { type: "obstacle",  name: "Gradino sala 4",      floor: 1, roomId: rooms[3]._id, coords: { x: 25, y: 50 } }
    ];
    await museum.save();
    console.log("Museo creato con 8 sale, planimetrie e punti di interesse.");

    // ---------- Stili (8, uno per grande fase storica) ----------
    const stylesData = [
        { key: "gotico", name: "Gotico bolognese", period: "XIII-XIV secolo", description: [
            { duration: "15s", content: "Pittura del Duecento e Trecento bolognese: fondi oro, linearismo elegante, figure allungate ancora debitrici della tradizione bizantina." },
            { duration: "40s", content: "Nel Duecento e nel Trecento la pittura bolognese assimila la lezione bizantina e la rielabora con un linearismo elegante e affettuoso, diverso sia dal rigore senese sia dal naturalismo che di lì a poco esploderà a Firenze. Fondi oro, aureole a rilievo e figure allungate restano a lungo la norma, anche quando singoli maestri, come Vitale da Bologna, iniettano nella tradizione un dinamismo quasi espressionista." }
        ]},
        { key: "rinascimento-bolognese", name: "Rinascimento bolognese", period: "XV secolo", description: [
            { duration: "15s", content: "Pittura del Quattrocento bolognese, a metà strada tra la tradizione tardogotica locale e le novità prospettiche giunte da Firenze e Ferrara." },
            { duration: "40s", content: "Il Quattrocento bolognese assorbe con qualche ritardo le conquiste prospettiche fiorentine, filtrandole attraverso i contatti con la vicina scuola ferrarese. Ne nasce una pittura di transizione, ancora legata a una certa preziosità decorativa tardogotica ma già capace di costruire spazi credibili e figure solidamente modellate, con Francesco Francia come protagonista assoluto del passaggio al secolo successivo." }
        ]},
        { key: "cinquecento-maturo", name: "Rinascimento maturo", period: "primo XVI secolo", description: [
            { duration: "15s", content: "Pittura bolognese del primo Cinquecento, in dialogo diretto con Raffaello e con la grande stagione del classicismo romano e fiorentino." },
            { duration: "40s", content: "Nel primo Cinquecento Bologna guarda a Roma e Firenze: la presenza in città di opere di Raffaello, come l'Estasi di Santa Cecilia commissionata per San Giovanni in Monte, segna profondamente i pittori locali. Francesco Francia negli ultimi anni e Amico Aspertini con la sua vena più eccentrica misurano in modi diversi l'eredità del classicismo raffaellesco." }
        ]},
        { key: "manierismo", name: "Manierismo emiliano", period: "XVI secolo", description: [
            { duration: "15s", content: "Il Manierismo emiliano privilegia l'eleganza formale e l'artificio compositivo rispetto alla resa naturalistica, con Parmigianino e il suo cerchio come riferimento principale." },
            { duration: "40s", content: "Sviluppatosi dopo la piena maturità rinascimentale, il Manierismo predilige la sofisticazione formale: proporzioni allungate, pose complesse, luce artificiale e spazi compressi, in un'elaborazione più intellettuale che naturalistica del soggetto. In Emilia trova in Parmigianino e nel suo cerchio, compreso il cugino Girolamo Mazzola Bedoli, alcuni degli interpreti più raffinati; a Bologna, Prospero Fontana e Bartolomeo Passarotti ne declinano una versione più aggiornata, che farà da terreno di formazione, e poi di reazione, per i Carracci." }
        ]},
        { key: "riforma-carracci", name: "Riforma naturalistica dei Carracci", period: "fine XVI-inizio XVII secolo", description: [
            { duration: "15s", content: "Ludovico, Annibale e Agostino Carracci reagiscono all'artificiosità tardo-manierista con un ritorno allo studio dal vero e a una composizione più chiara e naturale." },
            { duration: "40s", content: "Fondando l'Accademia degli Incamminati, i tre cugini Carracci promuovono un ritorno allo studio dal vero, alla resa naturale degli affetti e a una composizione più chiara e leggibile, in reazione all'artificiosità della tarda maniera cinquecentesca. È la riforma da cui nascerà, nei decenni successivi, gran parte della pittura barocca italiana." }
        ]},
        { key: "classicismo-barocco", name: "Classicismo barocco bolognese", period: "primo XVII secolo", description: [
            { duration: "15s", content: "Guido Reni e Domenichino portano la lezione dei Carracci verso un ideale di bellezza levigata e composta, tra i vertici del classicismo secentesco italiano." },
            { duration: "40s", content: "Formatisi nell'Accademia dei Carracci, Guido Reni e Domenichino sviluppano un classicismo raffinato e levigato, fatto di colori chiari, composizioni equilibrate e un'idealizzazione della figura umana lontana sia dal naturalismo crudo sia dagli eccessi tardo-manieristi. Sarà uno dei modelli di riferimento più influenti per la pittura europea del Seicento." }
        ]},
        { key: "naturalismo-luministico", name: "Naturalismo luministico", period: "XVII secolo", description: [
            { duration: "15s", content: "Guercino ed Elisabetta Sirani lavorano su forti contrasti di luce e ombra e su un naturalismo più diretto rispetto al classicismo di Reni." },
            { duration: "40s", content: "Accanto al classicismo di Reni e Domenichino, una linea più naturalistica e luministica attraversa la pittura bolognese secentesca: Guercino, giunto da Cento, costruisce le sue prime opere su forti contrasti chiaroscurali, mentre Elisabetta Sirani, tra le pittrici professioniste più note d'Europa nel suo tempo, unisce rapidità d'esecuzione e intensità espressiva in una carriera brevissima ma straordinariamente prolifica." }
        ]},
        { key: "settecento", name: "Settecento bolognese", period: "XVIII secolo", description: [
            { duration: "15s", content: "Nel Settecento la pittura bolognese oscilla tra il classicismo elegante di Donato Creti e il naturalismo quasi domestico di Giuseppe Maria Crespi." },
            { duration: "40s", content: "Il Settecento bolognese si muove tra due poli: da un lato il classicismo levigato ed elegante di Donato Creti e Marcantonio Franceschini, erede diretto della tradizione di Reni; dall'altro il naturalismo informale e a tratti irriverente di Giuseppe Maria Crespi, che introduce nella grande pittura temi di vita quotidiana fino ad allora relegati ai margini. Gaetano Gandolfi, più avanti nel secolo, sintetizza le due anime in una maniera brillante e già aperta al gusto neoclassico." }
        ]},
        // Stili usati nel secondo museo (Galleria Estense di Modena).
        { key: "corte-estense", name: "Rinascimento alla corte estense", period: "XVI secolo", description: [
            { duration: "15s", content: "Pittura del Cinquecento ferrarese e parmense legata al mecenatismo della famiglia Este, con Correggio e Dosso Dossi tra i protagonisti." },
            { duration: "40s", content: "Alla corte estense, tra Ferrara e Parma, si sviluppa nel Cinquecento una pittura raffinata e colta, sostenuta dal mecenatismo della famiglia Este. Correggio elabora soluzioni luministiche e spaziali di straordinaria modernità, mentre Dosso Dossi coltiva un gusto più fantastico e coloristico, con soggetti mitologici e allegorici pensati per gli appartamenti privati della corte." }
        ]},
        { key: "scultura-barocca-romana", name: "Barocco scultoreo romano", period: "XVII secolo", description: [
            { duration: "15s", content: "La scultura barocca romana, con Gian Lorenzo Bernini come protagonista assoluto, cerca nel marmo un movimento e un'espressività quasi pittorici." }
        ]}
    ];
    const styles = {};
    for (const s of stylesData) styles[s.key] = await Style.create({ name: s.name, period: s.period, description: s.description });
    console.log(`${stylesData.length} stili creati.`);

    // ---------- Autori (24, tutti realmente attivi a Bologna/Emilia) ----------
    const authorsData = [
        { key: "maestro-sangiacomo", name: "Maestro di San Giacomo", styleKey: "gotico", birthYear: "attivo XIII sec.", deathYear: "", bio: [
            { duration: "15s", content: "Pittore anonimo attivo a Bologna nel pieno Duecento, convenzionalmente identificato dalla pala per cui è oggi noto." }
        ]},
        { key: "vitale-da-bologna", name: "Vitale da Bologna", styleKey: "gotico", birthYear: "1309 ca.", deathYear: "1360 ca.", bio: [
            { duration: "15s", content: "Il maggiore pittore bolognese del Trecento, noto per un linearismo vivace e quasi nervoso che anima le sue figure di un dinamismo insolito per l'epoca." },
            { duration: "40s", content: "Vitale da Bologna è la personalità più forte della pittura trecentesca emiliana. Rispetto alla compostezza della tradizione bizantineggiante, le sue figure si muovono con un dinamismo quasi frenetico, i panneggi si arricciano in pieghe nervose e i volti si caricano di un'espressività diretta e popolare, che gli sarà valsa fama ben oltre i confini di Bologna." }
        ]},
        { key: "simone-crocifissi", name: "Simone dei Crocifissi", styleKey: "gotico", birthYear: "1330 ca.", deathYear: "1399", bio: [
            { duration: "15s", content: "Pittore bolognese specializzato in croci dipinte e pale devozionali, da cui deriva il soprannome con cui è conosciuto." }
        ]},
        { key: "lippo-dalmasio", name: "Lippo di Dalmasio", styleKey: "gotico", birthYear: "1352 ca.", deathYear: "1410 ca.", bio: [
            { duration: "15s", content: "Detto \"Lippo delle Madonne\" per la dolcezza con cui dipinse ripetutamente il tema della Vergine col Bambino." }
        ]},
        { key: "jacopo-di-paolo", name: "Jacopo di Paolo", styleKey: "gotico", birthYear: "1360 ca.", deathYear: "1426 ca.", bio: [
            { duration: "15s", content: "Pittore bolognese attivo tra fine Trecento e primo Quattrocento, tra gli ultimi interpreti della tradizione tardogotica cittadina." }
        ]},
        { key: "francesco-francia", name: "Francesco Francia", styleKey: "rinascimento-bolognese", birthYear: "1447 ca.", deathYear: "1517", bio: [
            { duration: "15s", content: "Orafo e pittore, il protagonista assoluto della pittura bolognese tra Quattrocento e primo Cinquecento." },
            { duration: "40s", content: "Formatosi come orafo prima ancora che come pittore, Francesco Francia diventa nel giro di pochi anni la figura di riferimento della pittura bolognese di fine Quattrocento, capace di fondere la precisione del disegno con una tavolozza luminosa e una compostezza compositiva che guarda già al classicismo del secolo successivo." }
        ]},
        { key: "amico-aspertini", name: "Amico Aspertini", styleKey: "cinquecento-maturo", birthYear: "1474", deathYear: "1552", bio: [
            { duration: "15s", content: "Pittore bolognese dallo stile eccentrico e irregolare, lontano dalla compostezza classica dei contemporanei." }
        ]},
        { key: "raffaello", name: "Raffaello Sanzio", styleKey: "cinquecento-maturo", birthYear: "1483", deathYear: "1520", bio: [
            { duration: "3s",  content: "Pittore e architetto, tra i massimi protagonisti del Rinascimento italiano." },
            { duration: "15s", content: "Attivo tra Urbino, Firenze e Roma, Raffaello realizzò per Bologna una delle sue opere più celebri, commissionata per la cappella di famiglia di Elena Duglioli in San Giovanni in Monte." },
            { duration: "40s", content: "Raffaello Sanzio è una delle figure centrali del Rinascimento maturo, capace di sintetizzare la lezione di Leonardo e Michelangelo in un linguaggio di equilibrio, grazia e chiarezza compositiva che diverrà modello per generazioni di pittori. La sua Estasi di Santa Cecilia, dipinta per Bologna, univa da subito fama internazionale e un legame diretto con la città." }
        ]},
        { key: "parmigianino", name: "Parmigianino", styleKey: "manierismo", birthYear: "1503", deathYear: "1540", bio: [
            { duration: "15s", content: "Francesco Mazzola, detto Parmigianino, tra i creatori dello stile manierista emiliano; cugino e maestro diretto di Girolamo Mazzola Bedoli." }
        ]},
        { key: "bedoli", name: "Girolamo Mazzola Bedoli", styleKey: "manierismo", birthYear: "1500 ca.", deathYear: "1569", bio: [
            { duration: "3s",  content: "Pittore manierista emiliano del Cinquecento." },
            { duration: "15s", content: "Pittore emiliano attivo nel Cinquecento, allievo e collaboratore del Parmigianino, di cui riprese l'eleganza formale e la ricerca cromatica." },
            { duration: "40s", content: "Girolamo Mazzola Bedoli fu tra i protagonisti del manierismo emiliano. Cugino e collaboratore del Parmigianino, ne assimilò l'eleganza formale e la costruzione rarefatta dello spazio, sviluppando uno stile personale fatto di figure allungate, luce fredda e selettiva, e una tavolozza controllata dominata da bianchi e neri. La sua produzione, prevalentemente religiosa, coniuga rigore compositivo e intensità spirituale." }
        ]},
        { key: "prospero-fontana", name: "Prospero Fontana", styleKey: "manierismo", birthYear: "1512", deathYear: "1597", bio: [
            { duration: "15s", content: "Pittore manierista bolognese e maestro di una intera generazione di allievi, tra cui i giovani Carracci." }
        ]},
        { key: "passarotti", name: "Bartolomeo Passarotti", styleKey: "manierismo", birthYear: "1529", deathYear: "1592", bio: [
            { duration: "15s", content: "Pittore bolognese noto soprattutto per una ritrattistica incisiva e per scene di genere insolite per il suo tempo." }
        ]},
        { key: "calvaert", name: "Denys Calvaert", styleKey: "manierismo", birthYear: "1540 ca.", deathYear: "1619", bio: [
            { duration: "15s", content: "Pittore fiammingo trasferitosi a Bologna, dove aprì una bottega che formò, tra gli altri, Guido Reni e Domenichino." }
        ]},
        { key: "ludovico-carracci", name: "Ludovico Carracci", styleKey: "riforma-carracci", birthYear: "1555", deathYear: "1619", bio: [
            { duration: "15s", content: "Pittore bolognese, tra i fondatori dell'Accademia degli Incamminati, promotore di un ritorno al naturalismo dopo la stagione manierista." },
            { duration: "40s", content: "Ludovico Carracci fu, insieme ai cugini Annibale e Agostino, il principale animatore della riforma pittorica bolognese di fine Cinquecento. In reazione all'artificiosità tardo-manierista, i Carracci promossero un ritorno allo studio dal vero, alla resa naturale degli affetti e a una composizione più chiara e leggibile, ponendo le basi per la pittura barocca del secolo successivo." }
        ]},
        { key: "annibale-carracci", name: "Annibale Carracci", styleKey: "riforma-carracci", birthYear: "1560", deathYear: "1609", bio: [
            { duration: "15s", content: "Il più celebre dei tre cugini Carracci, attivo tra Bologna e Roma, dove affrescò la celebre Galleria di Palazzo Farnese." }
        ]},
        { key: "agostino-carracci", name: "Agostino Carracci", styleKey: "riforma-carracci", birthYear: "1557", deathYear: "1602", bio: [
            { duration: "15s", content: "Pittore e incisore, il più colto dei tre Carracci, attivo tra teoria dell'arte e pratica pittorica." }
        ]},
        { key: "guido-reni", name: "Guido Reni", styleKey: "classicismo-barocco", birthYear: "1575", deathYear: "1642", bio: [
            { duration: "3s",  content: "Il maggiore pittore bolognese del Seicento." },
            { duration: "15s", content: "Formatosi presso Denys Calvaert e poi nell'Accademia dei Carracci, Guido Reni sviluppò uno stile classicista raffinato che influenzò profondamente la pittura europea del suo tempo." },
            { duration: "40s", content: "Guido Reni è considerato il vertice del classicismo secentesco bolognese. Dopo la formazione presso Denys Calvaert e l'esperienza decisiva nell'Accademia dei Carracci, sviluppò uno stile fatto di colori chiari e levigati, composizioni equilibrate e figure di una bellezza idealizzata, capace di conciliare intensità spirituale e perfezione formale: un modello di riferimento per generazioni di pittori in tutta Europa." }
        ]},
        { key: "domenichino", name: "Domenichino", styleKey: "classicismo-barocco", birthYear: "1581", deathYear: "1641", bio: [
            { duration: "15s", content: "Domenico Zampieri, detto Domenichino, tra i massimi esponenti del classicismo carraccesco, attivo tra Bologna, Roma e Napoli." }
        ]},
        { key: "tiarini", name: "Alessandro Tiarini", styleKey: "classicismo-barocco", birthYear: "1577", deathYear: "1668", bio: [
            { duration: "15s", content: "Pittore bolognese, allievo dei Carracci, noto per una resa intensa e drammatica dei soggetti sacri." }
        ]},
        { key: "canuti", name: "Domenico Maria Canuti", styleKey: "classicismo-barocco", birthYear: "1620", deathYear: "1684", bio: [
            { duration: "15s", content: "Pittore bolognese specializzato in grandi decorazioni ad affresco, tra cui la celebre Apoteosi di Ercole a Palazzo Pepoli." }
        ]},
        { key: "guercino", name: "Guercino", styleKey: "naturalismo-luministico", birthYear: "1591", deathYear: "1666", bio: [
            { duration: "15s", content: "Giovanni Francesco Barbieri, detto Guercino per uno strabismo di gioventù, pittore di Cento noto per un naturalismo dai forti contrasti di luce." },
            { duration: "40s", content: "Attivo prevalentemente a Cento e poi a Bologna, Guercino costruisce le sue prime opere su un naturalismo intenso e drammatico, con contrasti di luce e ombra ancora debitori della lezione caravaggesca filtrata attraverso l'ambiente emiliano; nella maturità la sua tavolozza si schiarisce, avvicinandosi progressivamente al classicismo di Guido Reni." }
        ]},
        { key: "sirani", name: "Elisabetta Sirani", styleKey: "naturalismo-luministico", birthYear: "1638", deathYear: "1665", bio: [
            { duration: "15s", content: "Pittrice bolognese, tra le artiste professioniste più note d'Europa nel suo tempo, con una carriera brevissima ma straordinariamente prolifica." }
        ]},
        { key: "crespi", name: "Giuseppe Maria Crespi", styleKey: "settecento", birthYear: "1665", deathYear: "1747", bio: [
            { duration: "15s", content: "Pittore bolognese noto per aver introdotto nella grande pittura temi di vita quotidiana, con un naturalismo informale e a tratti irriverente." }
        ]},
        { key: "creti", name: "Donato Creti", styleKey: "settecento", birthYear: "1671", deathYear: "1749", bio: [
            { duration: "15s", content: "Pittore bolognese erede della tradizione classicista di Guido Reni, noto per un'eleganza compositiva raffinata e levigata." }
        ]},
        { key: "franceschini", name: "Marcantonio Franceschini", styleKey: "settecento", birthYear: "1648", deathYear: "1729", bio: [
            { duration: "15s", content: "Pittore bolognese di formazione classicista, attivo in numerose decorazioni religiose e profane tra Sei e Settecento." }
        ]},
        { key: "gandolfi", name: "Gaetano Gandolfi", styleKey: "settecento", birthYear: "1734", deathYear: "1802", bio: [
            { duration: "15s", content: "Pittore bolognese di fine Settecento, con una maniera brillante che guarda già al gusto neoclassico." }
        ]},
        // I tre autori seguenti sono usati nel secondo museo (Galleria Estense di
        // Modena, vedi più sotto), non nella Pinacoteca di Bologna.
        { key: "correggio", name: "Antonio Allegri, detto il Correggio", styleKey: "corte-estense", birthYear: "1489 ca.", deathYear: "1534", bio: [
            { duration: "15s", content: "Pittore parmense tra i massimi del Rinascimento emiliano, noto per gli affreschi illusionistici delle cupole di Parma e per una luce morbida e avvolgente." },
            { duration: "40s", content: "Antonio Allegri, detto il Correggio dal nome del suo paese natale, sviluppa uno stile personalissimo fatto di sfumature morbide, scorci audaci e una luce calda e avvolgente. I suoi affreschi illusionistici nelle cupole di Parma anticipano soluzioni spaziali che saranno riprese dal Barocco un secolo più tardi, mentre le sue opere da cavalletto uniscono grazia formale e intensità emotiva." }
        ]},
        { key: "dossodossi", name: "Dosso Dossi", styleKey: "corte-estense", birthYear: "1489 ca.", deathYear: "1542", bio: [
            { duration: "15s", content: "Pittore ferrarese, per anni artista di corte degli Este, noto per una tavolozza ricca e per soggetti mitologici e fantastici." }
        ]},
        { key: "bernini", name: "Gian Lorenzo Bernini", styleKey: "scultura-barocca-romana", birthYear: "1598", deathYear: "1680", bio: [
            { duration: "15s", content: "Scultore e architetto romano, il protagonista assoluto del Barocco italiano." },
            { duration: "40s", content: "Gian Lorenzo Bernini è la figura dominante della scultura e dell'architettura barocca a Roma nel Seicento. Il suo marmo ha una capacità quasi teatrale di rendere il movimento e l'espressione, trasformando la materia inerte in carne, panneggi e sguardi vividi. Il busto del duca Francesco I d'Este, oggi alla Galleria Estense di Modena, è tra le sue prove più celebri nel genere del ritratto scolpito." }
        ]}
    ];
    const authors = {};
    for (const a of authorsData) authors[a.key] = await Author.create({ name: a.name, bio: a.bio, birthYear: a.birthYear, deathYear: a.deathYear });
    console.log(`${authorsData.length} autori creati.`);

    // ---------- Generazione delle 200 opere ----------

    const MARY_SAINTS  = ["Petronio", "Domenico", "Francesco d'Assisi", "Giovanni Battista", "Agostino", "Nicola da Tolentino", "Giacomo Maggiore", "Michele Arcangelo", "Bernardo", "Antonio da Padova", "Rocco", "Giorgio"];
    const MARY_SAINTS_F = ["Caterina d'Alessandria", "Lucia", "Apollonia", "Chiara", "Agata", "Barbara", "Maria Maddalena"];
    const MARTYR_SAINTS = ["San Sebastiano", "San Lorenzo", "Santa Caterina d'Alessandria", "Sant'Agata", "Sant'Apollonia", "San Bartolomeo", "San Giorgio", "Santa Barbara", "San Vitale", "San Procolo"];
    const NOBLE_NAMES = [
        "del senatore Bentivoglio", "del marchese Pepoli", "della famiglia Zambeccari", "del conte Malvezzi",
        "del senatore Ranuzzi", "di un naturalista della famiglia Aldrovandi", "di gentiluomo bolognese", "di gentildonna bolognese",
        "di magistrato", "di prelato", "di giovane con libro", "di anziano con rosario"
    ];
    const MYTH_TITLES = ["Diana e Atteone", "Venere e Adone", "Apollo e Dafne", "Il ratto di Europa", "Bacco e Arianna", "Ercole e l'idra di Lerna", "Perseo libera Andromeda", "Il giudizio di Paride", "Venere e Amore", "Orfeo ed Euridice"];
    const GENRE_TITLES = ["Scena di vita popolare", "La lezione di musica", "Interno con figure", "Il mercato", "Ritratto di famiglia in un interno", "La filatrice", "Gioco di carte", "Cucina con figure", "Il pittore nel suo studio", "Scena di caccia"];
    const CHURCHES = ["San Domenico", "San Francesco", "San Petronio", "San Giacomo Maggiore", "Santa Maria dei Servi", "San Salvatore", "Corpus Domini", "Santo Stefano", "San Michele in Bosco", "San Procolo", "Santa Maria della Vita", "San Martino Maggiore"];

    const usedTitles = new Set();
    function uniqueTitle(base) {
        if (!usedTitles.has(base)) { usedTitles.add(base); return base; }
        for (const suffix of [" (bottega)", " (copia)", " II", " III", " IV"]) {
            const t = base + suffix;
            if (!usedTitles.has(t)) { usedTitles.add(t); return t; }
        }
        let n = 5, t;
        do { t = `${base} (${n})`; n++; } while (usedTitles.has(t));
        usedTitles.add(t);
        return t;
    }

    let saintCursor = 0;
    function pickSaintPair() {
        const pool = saintCursor % 2 === 0 ? MARY_SAINTS : MARY_SAINTS_F.concat(MARY_SAINTS);
        const s1 = pool[saintCursor % pool.length];
        const s2 = pool[(saintCursor + 5) % pool.length];
        saintCursor++;
        return [s1, s2];
    }
    let martyrCursor = 0;
    function pickMartyr() { return MARTYR_SAINTS[martyrCursor++ % MARTYR_SAINTS.length]; }
    let nobleCursor = 0;
    function pickNoble() { return NOBLE_NAMES[nobleCursor++ % NOBLE_NAMES.length]; }
    let mythCursor = 0;
    function pickMyth() { return MYTH_TITLES[mythCursor++ % MYTH_TITLES.length]; }
    let genreCursor = 0;
    function pickGenre() { return GENRE_TITLES[genreCursor++ % GENRE_TITLES.length]; }
    let churchCursor = 0;
    function pickChurch() { return CHURCHES[churchCursor++ % CHURCHES.length]; }

    function titleFor(subject) {
        switch (subject) {
            case "madonna": {
                const [s1, s2] = pickSaintPair();
                return uniqueTitle(Math.random() < 0.5 ? `Madonna col Bambino tra i santi ${s1} e ${s2}` : `Madonna in trono col Bambino e i santi ${s1} e ${s2}`);
            }
            case "assunta":
                return uniqueTitle("Assunzione della Vergine");
            case "pieta":
                return uniqueTitle(Math.random() < 0.5 ? "Pietà" : "Compianto sul Cristo morto");
            case "annunciazione":
                return uniqueTitle("Annunciazione");
            case "sacraFamiglia": {
                const [s1] = pickSaintPair();
                return uniqueTitle(Math.random() < 0.5 ? "Sacra Famiglia con San Giovannino" : `Sacra conversazione con i santi ${s1}`);
            }
            case "deposizione":
                return uniqueTitle(Math.random() < 0.5 ? "Deposizione dalla croce" : "Fuga in Egitto");
            case "martirio":
                return uniqueTitle(`Martirio di ${pickMartyr()}`);
            case "ritratto":
                return uniqueTitle(`Ritratto ${pickNoble()}`);
            case "mitologia":
                return uniqueTitle(pickMyth());
            case "genere":
                return uniqueTitle(pickGenre());
            default:
                return uniqueTitle("Opera senza titolo");
        }
    }

    // Banco testi per soggetto e livello linguistico. Ogni funzione usa i
    // "fatti" specifici dell'opera (autore, anno, tecnica, stile...) così
    // da produrre paragrafi diversi tra loro anche a parità di soggetto.
    const TEXT_BANK = {
        madonna: {
            elementare: (f) => [
                { duration: "3s",  content: `Maria con in braccio Gesù bambino, dipinta da ${f.authorName}.` },
                { duration: "15s", content: `In questo quadro Maria tiene in braccio il piccolo Gesù. Intorno a loro ci sono dei santi che li accompagnano. I colori sono caldi e la scena trasmette calma e affetto.` },
                { duration: "40s", content: `Guarda come Maria tiene delicatamente in braccio Gesù bambino: è un momento di grande tenerezza, dipinto da ${f.authorName} intorno al ${f.year}. I santi ai lati non parlano, ma la loro presenza racconta che questa immagine serviva per pregare, non solo per essere ammirata. Prova a cercare con lo sguardo i dettagli dei vestiti e delle mani: ogni particolare è stato pensato con cura.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Tema devozionale tra i più diffusi della pittura religiosa: la Vergine in trono o in piedi con il Bambino, affiancata da santi che ne rafforzano il carattere di pala d'altare. Datazione: ${f.year} ca., ${f.technique.toLowerCase()}.` },
                { duration: "40s", content: `L'opera, realizzata da ${f.authorName} (${f.authorSpan}) intorno al ${f.year}, appartiene al filone iconografico della Sacra Conversazione, particolarmente diffuso nella pittura devozionale bolognese. Lo stile ${f.styleName.toLowerCase()} si riconosce nel modellato delle figure e nell'impianto compositivo, coerente con le opere coeve esposte nella ${f.roomName}. Come molti dipinti della collezione, potrebbe provenire da una delle chiese soppresse a Bologna tra fine Settecento e Ottocento, come ${pickChurch()}.` }
            ]
        },
        assunta: {
            elementare: (f) => [
                { duration: "3s",  content: `Maria che sale in cielo, dipinta da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro racconta un momento speciale: Maria viene portata in cielo, circondata da angeli che la accompagnano verso l'alto.` },
                { duration: "40s", content: `In questo dipinto Maria sale verso il cielo, sollevata da una schiera di angeli. ${f.authorName} ha dipinto la scena intorno al ${f.year}, usando colori luminosi per la parte alta del quadro e toni più scuri in basso, dove restano gli apostoli stupiti. Prova a seguire con lo sguardo il movimento verso l'alto: è pensato apposta per guidare i tuoi occhi.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `L'Assunzione della Vergine, tema caro alla pittura controriformata, qui interpretato da ${f.authorName} con un impianto compositivo tipico dello stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `La composizione contrappone la zona terrena, affollata dagli apostoli in pose concitate, a quella celeste, dove la Vergine ascende sorretta da un coro angelico. ${f.authorName} (${f.authorSpan}) realizza l'opera intorno al ${f.year}, con soluzioni luministiche riconducibili allo stile ${f.styleName.toLowerCase()}, in dialogo con le opere coeve della ${f.roomName}.` }
            ]
        },
        pieta: {
            elementare: (f) => [
                { duration: "3s",  content: `Il dolore di Maria davanti a Gesù, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro mostra un momento molto triste: Maria tiene tra le braccia il corpo di Gesù, circondata da persone che condividono il suo dolore.` },
                { duration: "40s", content: `${f.authorName} ha dipinto questa scena molto commovente intorno al ${f.year}: Maria sostiene il corpo di Gesù appena tolto dalla croce, mentre altre persone intorno piangono e si disperano. I colori sono scuri e pesanti, per far sentire tutta la tristezza del momento. Osserva le espressioni dei volti: raccontano il dolore meglio di tante parole.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Il compianto sul corpo di Cristo, tema di forte intensità drammatica, reso da ${f.authorName} con un linguaggio coerente allo stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `Realizzata intorno al ${f.year} da ${f.authorName} (${f.authorSpan}), l'opera concentra la tensione drammatica nella figura della Vergine e del Cristo morto, circondati dalle altre figure del compianto. La tavolozza scura e il forte contrasto chiaroscurale sono coerenti con lo stile ${f.styleName.toLowerCase()}, e trovano confronto diretto con le opere esposte nella ${f.roomName}.` }
            ]
        },
        annunciazione: {
            elementare: (f) => [
                { duration: "3s",  content: `L'angelo porta una notizia importante a Maria.` },
                { duration: "15s", content: `In questo quadro un angelo arriva a portare a Maria una notizia molto importante. Maria lo ascolta con sorpresa e attenzione.` },
                { duration: "40s", content: `${f.authorName} racconta in questo dipinto, intorno al ${f.year}, il momento in cui un angelo arriva davanti a Maria per parlarle. Guarda come sono disposte le due figure: l'angelo sembra appena arrivato in volo, mentre Maria si volta sorpresa. Anche un giglio, simbolo di purezza, compare spesso in questo tipo di scena: prova a cercarlo.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `L'Annunciazione, tra i temi più rappresentati della pittura religiosa occidentale, qui interpretata da ${f.authorName} secondo i modi dello stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `${f.authorName} (${f.authorSpan}) imposta la scena secondo lo schema consolidato dell'iconografia dell'Annunciazione, con l'angelo e la Vergine contrapposti entro uno spazio costruito con cura prospettica. L'opera, datata al ${f.year} ca., riflette le soluzioni compositive tipiche dello stile ${f.styleName.toLowerCase()}, coerenti con il resto della ${f.roomName}.` }
            ]
        },
        sacraFamiglia: {
            elementare: (f) => [
                { duration: "3s",  content: `Gesù bambino con la sua famiglia, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro mostra una scena di famiglia: Gesù bambino insieme a Maria e alle persone che si prendono cura di lui.` },
                { duration: "40s", content: `${f.authorName} dipinge intorno al ${f.year} un momento familiare e affettuoso: Gesù bambino gioca o riposa vicino a Maria, mentre altre figure li osservano con affetto. La scena è pensata per sembrare vicina e vera, come un momento di vita quotidiana, anche se racconta una storia sacra.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Variante intima del tema mariano, con la Sacra Famiglia colta in un momento di quotidianità affettuosa, secondo i modi dello stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `Databile al ${f.year} ca., l'opera di ${f.authorName} (${f.authorSpan}) propone una lettura più intima e domestica del tema mariano, con un impianto compositivo raccolto e una gamma cromatica calda, in linea con lo stile ${f.styleName.toLowerCase()} e con le altre opere della ${f.roomName}.` }
            ]
        },
        deposizione: {
            elementare: (f) => [
                { duration: "3s",  content: `Il corpo di Gesù viene tolto dalla croce.` },
                { duration: "15s", content: `Questo quadro mostra il momento in cui il corpo di Gesù viene tolto dalla croce, sorretto con cura dalle persone intorno a lui.` },
                { duration: "40s", content: `${f.authorName} racconta in questo dipinto, intorno al ${f.year}, un momento molto delicato: alcune persone sorreggono con cura il corpo di Gesù mentre lo calano dalla croce. I gesti sono lenti e attenti, i volti seri. Guarda come i corpi si intrecciano tra loro per sostenere quel peso, sia fisico che emotivo.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `La Deposizione dalla croce, tema di grande impegno compositivo, interpretato da ${f.authorName} con soluzioni tipiche dello stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `L'opera, attribuita a ${f.authorName} (${f.authorSpan}) e databile al ${f.year} ca., organizza le figure in un intreccio piramidale attorno al corpo del Cristo, secondo una soluzione compositiva ricorrente nello stile ${f.styleName.toLowerCase()}. Il confronto con le opere coeve della ${f.roomName} ne mette in luce l'aggiornamento sulle novità stilistiche del periodo.` }
            ]
        },
        martirio: {
            elementare: (f) => [
                { duration: "3s",  content: `${f.title}, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro racconta la storia di un santo che ha affrontato un momento molto difficile per restare fedele a ciò in cui credeva.` },
                { duration: "40s", content: `${f.authorName} dipinge intorno al ${f.year} un momento drammatico della vita del santo raffigurato. Anche se la scena può sembrare forte, il messaggio che l'artista voleva trasmettere era di coraggio e fedeltà. Osserva l'espressione del volto del santo: è composta e serena, nonostante tutto.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Scena agiografica di forte impatto drammatico, tema ricorrente nella pittura controriformata, qui reso da ${f.authorName} secondo i modi dello stile ${f.styleName.toLowerCase()}.` },
                { duration: "40s", content: `Datata al ${f.year} ca., l'opera di ${f.authorName} (${f.authorSpan}) affronta il tema del martirio con un linguaggio coerente allo stile ${f.styleName.toLowerCase()}: il corpo del santo diventa veicolo di intensità emotiva, mentre la composizione guida lo sguardo dello spettatore verso il volto, punto di massima tensione psicologica. Confrontabile con le altre opere della ${f.roomName}.` }
            ]
        },
        ritratto: {
            elementare: (f) => [
                { duration: "3s",  content: `${f.title}, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro mostra il volto di una persona realmente esistita. L'artista ha cercato di renderla il più somigliante possibile.` },
                { duration: "40s", content: `${f.authorName} dipinge questo ritratto intorno al ${f.year}, cercando di catturare non solo l'aspetto ma anche il carattere della persona ritratta. Guarda gli abiti e gli oggetti intorno a lei: spesso servivano a mostrare il suo ruolo sociale o la sua professione, un po' come una fotografia racconterebbe oggi.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Ritratto di rappresentanza tipico della ritrattistica bolognese, in cui abiti e attributi concorrono a definire lo status sociale dell'effigiato.` },
                { duration: "40s", content: `Eseguito da ${f.authorName} (${f.authorSpan}) intorno al ${f.year}, il ritratto segue le convenzioni della ritrattistica di rappresentanza bolognese: posa composta, sfondo neutro, abiti e attributi scelti per comunicare status e ruolo sociale dell'effigiato. Lo stile ${f.styleName.toLowerCase()} emerge soprattutto nella resa del volto e delle mani.` }
            ]
        },
        mitologia: {
            elementare: (f) => [
                { duration: "3s",  content: `${f.title}, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro racconta una storia antica, tramandata dai racconti degli antichi greci e romani, con dèi ed eroi protagonisti.` },
                { duration: "40s", content: `${f.authorName} dipinge intorno al ${f.year} una scena tratta dai racconti mitologici classici. Anche se i personaggi non sono reali, la storia serviva a parlare di temi importanti come il coraggio, l'amore o la giustizia. Guarda i colori vivaci e i gesti dei personaggi: raccontano un momento di grande movimento.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Soggetto mitologico tratto dalla tradizione classica, genere che conosce grande fortuna nelle collezioni private bolognesi tra Sei e Settecento.` },
                { duration: "40s", content: `Realizzata da ${f.authorName} (${f.authorSpan}) intorno al ${f.year}, l'opera attinge al repertorio mitologico classico, molto richiesto dalle collezioni private del tempo come tema alternativo alla pittura religiosa. Lo stile ${f.styleName.toLowerCase()} si riconosce nell'equilibrio compositivo e nella resa idealizzata delle figure.` }
            ]
        },
        genere: {
            elementare: (f) => [
                { duration: "3s",  content: `${f.title}, dipinto da ${f.authorName}.` },
                { duration: "15s", content: `Questo quadro mostra una scena di vita di tutti i giorni, con persone comuni intente nelle loro attività quotidiane.` },
                { duration: "40s", content: `${f.authorName} dipinge intorno al ${f.year} una scena presa dalla vita di ogni giorno: non re, non santi, ma persone comuni. Era una scelta insolita per l'epoca, che preferiva soggetti più solenni. Guarda i dettagli degli oggetti e degli ambienti: raccontano com'era la vita quotidiana in quel periodo.` }
            ],
            medio: (f) => [
                { duration: "3s",  content: `${f.title}, ${f.authorName}, ${f.year}.` },
                { duration: "15s", content: `Scena di genere, filone che introduce nella grande pittura bolognese soggetti tratti dalla vita quotidiana, in contrasto con la tradizione religiosa e mitologica dominante.` },
                { duration: "40s", content: `Databile al ${f.year} ca., l'opera di ${f.authorName} (${f.authorSpan}) si inserisce nel filone della pittura di genere, che porta nella grande pittura soggetti quotidiani fino ad allora relegati ai margini. Lo sguardo informale sulla scena, coerente con lo stile ${f.styleName.toLowerCase()}, anticipa sensibilità più tarde nella pittura europea.` }
            ]
        }
    };

    function makeTexts(subject, level, facts) {
        const bank = TEXT_BANK[subject] || TEXT_BANK.madonna;
        return bank[level](facts);
    }

    const TECH_PRE1500 = ["Tempera su tavola", "Tempera e oro su tavola", "Affresco staccato"];
    const TECH_1500 = ["Olio su tavola", "Olio su tela", "Tempera su tavola"];
    const TECH_1600PLUS = ["Olio su tela", "Olio su tavola", "Olio su rame"];

    // Piano delle sale: autori, soggetti tipici del periodo, range anni, tecniche, quante opere generare
    const ROOM_PLAN = [
        { roomIdx: 0, styleKey: "gotico", authorKeys: ["maestro-sangiacomo", "vitale-da-bologna", "simone-crocifissi", "lippo-dalmasio", "jacopo-di-paolo"], subjects: ["madonna", "pieta", "madonna", "madonna", "pieta"], yearMin: 1260, yearMax: 1420, tech: TECH_PRE1500, count: 25 },
        { roomIdx: 1, styleKey: "rinascimento-bolognese", authorKeys: ["francesco-francia", "jacopo-di-paolo"], subjects: ["madonna", "sacraFamiglia", "annunciazione", "madonna"], yearMin: 1430, yearMax: 1499, tech: TECH_PRE1500, count: 15 },
        { roomIdx: 2, styleKey: "cinquecento-maturo", authorKeys: ["francesco-francia", "amico-aspertini"], subjects: ["sacraFamiglia", "madonna", "annunciazione", "ritratto"], yearMin: 1500, yearMax: 1540, tech: TECH_1500, count: 19 }, // + 1 fissa (Raffaello) = 20
        { roomIdx: 3, styleKey: "manierismo", authorKeys: ["parmigianino", "bedoli", "prospero-fontana", "passarotti", "calvaert"], subjects: ["ritratto", "martirio", "sacraFamiglia", "deposizione", "madonna"], yearMin: 1540, yearMax: 1600, tech: TECH_1500, count: 29 }, // + 1 fissa (Bedoli) = 30
        { roomIdx: 4, styleKey: "riforma-carracci", authorKeys: ["ludovico-carracci", "annibale-carracci", "agostino-carracci"], subjects: ["deposizione", "martirio", "sacraFamiglia", "ritratto"], yearMin: 1583, yearMax: 1609, tech: TECH_1600PLUS, count: 23 }, // + 2 fisse (Carracci) = 25
        { roomIdx: 5, styleKey: "classicismo-barocco", authorKeys: ["domenichino", "tiarini", "canuti"], subjects: ["martirio", "assunta", "ritratto", "madonna"], yearMin: 1605, yearMax: 1640, tech: TECH_1600PLUS, count: 29 }, // + 1 fissa (Reni) = 30
        { roomIdx: 6, styleKey: "naturalismo-luministico", authorKeys: ["guercino", "sirani"], subjects: ["martirio", "sacraFamiglia", "ritratto", "mitologia"], yearMin: 1615, yearMax: 1665, tech: TECH_1600PLUS, count: 20 },
        { roomIdx: 7, styleKey: "settecento", authorKeys: ["crespi", "creti", "franceschini", "gandolfi"], subjects: ["genere", "mitologia", "ritratto", "sacraFamiglia"], yearMin: 1690, yearMax: 1795, tech: TECH_1600PLUS, count: 35 }
    ];

    const authorOwnerCycle = [users.autore1, users.autore1, users.autore2, users.autore2, users.admin1]; // ~40/40/20
    let ownerCursor = 0;
    function nextOwner() { return authorOwnerCycle[ownerCursor++ % authorOwnerCycle.length]; }

    function acquisitionPriceFor(authorKey, year) {
        const famous = new Set(["raffaello", "guido-reni", "annibale-carracci", "ludovico-carracci", "vitale-da-bologna", "guercino", "correggio", "bernini"]);
        const base = famous.has(authorKey) ? 30 : 12;
        return base + Math.round((year % 17));
    }

    // roomOccurrence è chiavato sull'_id della stanza (non su un indice numerico):
    // così il conteggio non si confonde quando, più avanti, genereremo opere
    // anche per le stanze di un secondo museo con gli stessi roomIdx 0,1,2...
    let roomOccurrence = {};
    function nextCoords(room) {
        const b = room.bounds;
        const key = room._id.toString();
        const n = (roomOccurrence[key] = (roomOccurrence[key] || 0) + 1);
        const cols = 5;
        const col = (n - 1) % cols;
        const row = Math.floor((n - 1) / cols);
        return {
            x: b.x + 4 + (b.width - 8) * (col / (cols - 1)),
            y: b.y + 8 + (row * 9) % (b.height - 10)
        };
    }

    // Generalizzata per poter creare opere su musei diversi: museumObj e
    // roomsArr indicano su quale museo/elenco-sale lavorare, pool è
    // l'array in cui accumulare l'opera creata (un pool per museo, per
    // non mischiare le opere di due musei diversi nelle stesse visite).
    // customTexts, se presente, salta la generazione per soggetto e usa
    // testi scritti a mano (serve per pezzi particolari come una scultura,
    // per cui i template pensati per la pittura non sono adatti).
    async function createArtworkWithContent({ title, year, technique, authorKey, styleKey, museumObj, roomsArr, roomIdx, subject, isPublicOverride, pool, customTexts }) {
        const author = authors[authorKey];
        const style = styles[styleKey];
        const owner = nextOwner();
        const room = roomsArr[roomIdx];
        const artwork = await Artwork.create({
            title,
            year,
            technique,
            museum: museumObj._id,
            roomId: room._id,
            coords: nextCoords(room),
            author: author._id,
            style: style._id,
            owner: owner._id,
            license: "CC-BY",
            isPublic: isPublicOverride !== undefined ? isPublicOverride : true,
            adoptionPrice: 0,
            acquisitionPrice: acquisitionPriceFor(authorKey, parseInt(year, 10) || 1500)
        });

        let elementareTexts, medioTexts;
        if (customTexts) {
            elementareTexts = customTexts.elementare;
            medioTexts = customTexts.medio;
        } else {
            const facts = {
                title, year,
                authorName: authorsData.find((a) => a.key === authorKey).name,
                authorSpan: `${authorsData.find((a) => a.key === authorKey).birthYear}${authorsData.find((a) => a.key === authorKey).deathYear ? " - " + authorsData.find((a) => a.key === authorKey).deathYear : ""}`,
                styleName: stylesData.find((s) => s.key === styleKey).name,
                technique,
                roomName: room.name
            };
            elementareTexts = makeTexts(subject, "elementare", facts);
            medioTexts = makeTexts(subject, "medio", facts);
        }

        const elementare = await Item.create({ artwork: artwork._id, texts: elementareTexts, language: "elementare", domains: ["storia"] });
        const medio = await Item.create({ artwork: artwork._id, texts: medioTexts, language: "medio", domains: ["storia", "stile"] });

        const entry = { artwork, elementare, medio, roomIdx, styleKey, authorKey, subject };
        pool.push(entry);
        return entry;
    }

    // --- Opere generate dal piano sale (Pinacoteca di Bologna) ---
    const artworksBologna = [];
    for (const plan of ROOM_PLAN) {
        for (let i = 0; i < plan.count; i++) {
            const authorKey = plan.authorKeys[i % plan.authorKeys.length];
            const subject = plan.subjects[i % plan.subjects.length];
            const year = plan.yearMin + Math.round((plan.yearMax - plan.yearMin) * (i / Math.max(1, plan.count - 1)));
            const technique = plan.tech[i % plan.tech.length];
            const title = titleFor(subject);
            await createArtworkWithContent({ title, year: `${year} ca.`, technique, authorKey, styleKey: plan.styleKey, museumObj: museum, roomsArr: rooms, roomIdx: plan.roomIdx, subject, pool: artworksBologna });
        }
    }

    // --- 5 opere "fisse", realmente documentate (coerenza con le versioni precedenti del seed) ---
    const raffaello = await createArtworkWithContent({
        title: "Estasi di Santa Cecilia", year: "1514-1516", technique: "Olio su tavola trasportato su tela",
        authorKey: "raffaello", styleKey: "cinquecento-maturo", museumObj: museum, roomsArr: rooms, roomIdx: 2, subject: "ritratto", isPublicOverride: false, pool: artworksBologna
    });
    const bedoliArtwork = await createArtworkWithContent({
        title: "Ritratto di frate in veste di San Tommaso d'Aquino", year: "1545 ca.", technique: "Olio su tavola",
        authorKey: "bedoli", styleKey: "manierismo", museumObj: museum, roomsArr: rooms, roomIdx: 3, subject: "ritratto", pool: artworksBologna
    });
    const reniMadonna = await createArtworkWithContent({
        title: "Madonna di San Luca", year: "1611", technique: "Olio su tela",
        authorKey: "guido-reni", styleKey: "classicismo-barocco", museumObj: museum, roomsArr: rooms, roomIdx: 5, subject: "madonna", pool: artworksBologna
    });
    const comunioneGirolamo = await createArtworkWithContent({
        title: "Comunione di San Girolamo", year: "1614", technique: "Olio su tela",
        authorKey: "ludovico-carracci", styleKey: "riforma-carracci", museumObj: museum, roomsArr: rooms, roomIdx: 4, subject: "martirio", pool: artworksBologna
    });
    const strageInnocenti = await createArtworkWithContent({
        title: "Strage degli Innocenti", year: "1611 ca.", technique: "Olio su tela",
        authorKey: "ludovico-carracci", styleKey: "riforma-carracci", museumObj: museum, roomsArr: rooms, roomIdx: 4, subject: "martirio", pool: artworksBologna
    });

    console.log(`${artworksBologna.length} artwork create per la Pinacoteca (con Content elementare + medio ciascuna: ${artworksBologna.length * 2} Item totali).`);
    console.log("Distribuzione proprietà: ~40% autore1, ~40% autore2, ~20% admin1 (i visitatori non possiedono mai opere).");

    // ---------- Content extra sui domini 'materiali'/'storia'/'architettura' ----------
    // Su un sottoinsieme di 12 opere distribuite tra le sale, aggiunge un
    // secondo livello di approfondimento tematico oltre ad artista/stile,
    // per dimostrare più a fondo il meccanismo "dimmi di più" per dominio.
    const extraDomainTargets = [
        { entry: artworksBologna[2],  domain: "materiali", content: `Il supporto è realizzato secondo le tecniche pittoriche tipiche del periodo di ${authorsData.find((a) => a.key === artworksBologna[2].authorKey).name}, con una preparazione a gesso e colla animale che consentiva stesure sottili e sovrapposte.` },
        { entry: artworksBologna[27], domain: "architettura", content: `L'ambientazione architettonica dipinta nello sfondo riflette i canoni prospettici del Quattrocento, con uno spazio costruito secondo una griglia geometrica rigorosa.` },
        { entry: bedoliArtwork, domain: "materiali", content: `Il supporto è una tavola di pioppo, tipica della pittura emiliana del periodo, preparata con gesso e colla animale prima della stesura pittorica a olio. Questa tecnica consentiva velature sottili e sovrapposte, alla base della resa fredda e smaltata tipica del manierismo di Bedoli.` },
        { entry: strageInnocenti, domain: "storia", content: `Il soggetto riprende l'episodio evangelico della strage degli innocenti, tema caro alla pittura controriformata per il suo carico drammatico ed emotivo, qui reso da Ludovico Carracci con un naturalismo dei corpi e degli affetti che segna la rottura con la maniera tardo-cinquecentesca.` },
        { entry: comunioneGirolamo, domain: "storia", content: `L'episodio raffigurato, l'ultima comunione di San Girolamo poco prima della morte, è un soggetto molto diffuso nella pittura controriformata come esempio di devozione esemplare in punto di morte.` },
        { entry: reniMadonna, domain: "storia", content: `Eseguita nel 1611 per la Confraternita dei Poveri Mendicanti, la Madonna di San Luca è considerata uno dei capolavori di Guido Reni e uno dei soggetti più venerati della devozione popolare bolognese.` },
        { entry: raffaello, domain: "storia", content: `Commissionata da Elena Duglioli per la cappella di famiglia in San Giovanni in Monte, l'opera arrivò alla Pinacoteca dopo le soppressioni napoleoniche di inizio Ottocento.` }
    ];
    for (const target of extraDomainTargets) {
        await Item.create({
            artwork: target.entry.artwork._id,
            texts: [{ duration: "40s", content: target.content }],
            language: "medio",
            domains: [target.domain]
        });
    }
    console.log(`${extraDomainTargets.length} Content extra su domini di approfondimento creati.`);

    // ---------- Secondo museo: Galleria Estense di Modena ----------
    // Serve soprattutto a verificare che l'esclusione tra musei funzioni
    // davvero (opere/visite/sale di un museo non devono mai comparire
    // navigando l'altro) e a poter testare la config admin (PUT /api/config
    // valida museumSlug contro Museum reali: ora ce ne sono due tra cui
    // scegliere). Scala volutamente più piccola della Pinacoteca (~24
    // opere): basta a esercitare i confini tra musei senza raddoppiare
    // il tempo di seeding.
    const museum2 = await Museum.create({
        slug: "galleria-estense-modena",
        name: "Galleria Estense di Modena",
        description: "La quadreria di famiglia degli Estensi, trasferita da Ferrara a Modena nel Seicento: capolavori di Correggio e Dosso Dossi, e il celebre busto marmoreo di Bernini.",
        address: "Largo Porta Sant'Agostino, 337",
        city: "Modena",
        province: "MO",
        region: "Emilia-Romagna",
        cap: "41121",
        website: "https://gallerie-estensi.beniculturali.it",
        primaryColor: "#0B3D66",
        secondaryColor: "#C9A227",
        ticketInfo: "Biglietto intero 8€, ridotto 2€. Ingresso gratuito la prima domenica del mese.",
        openingHours: {
            monday: "Chiuso",
            tuesday: "08:30-19:00",
            wednesday: "08:30-19:00",
            thursday: "08:30-19:00",
            friday: "08:30-19:00",
            saturday: "08:30-19:00",
            sunday: "08:30-19:00"
        },
        services: ["bookshop", "audioguide"],
        rooms: [
            { name: "Sala del Correggio",                       floor: 1, bounds: { x: 5,  y: 10, width: 22, height: 80 } },
            { name: "Sala della pittura ferrarese ed emiliana",  floor: 1, bounds: { x: 29, y: 10, width: 22, height: 80 } },
            { name: "Sala della scultura estense",               floor: 1, bounds: { x: 53, y: 10, width: 20, height: 80 } },
            { name: "Sala del Seicento emiliano",                floor: 2, bounds: { x: 5,  y: 10, width: 30, height: 80 } }
        ],
        floorPlans: [
            { floor: 1, imageUrl: "/assets/floorplans/estense-piano1.svg" },
            { floor: 2, imageUrl: "/assets/floorplans/estense-piano2.svg" }
        ]
    });
    const roomsModena = museum2.rooms;

    museum2.pointsOfInterest = [
        { type: "entrance", name: "Ingresso principale", floor: 1, coords: { x: 2,  y: 50 } },
        { type: "exit",     name: "Uscita",              floor: 1, coords: { x: 98, y: 50 } },
        { type: "restroom", name: "Bagni",                floor: 1, roomId: roomsModena[1]._id, coords: { x: 30, y: 90 } },
        { type: "shop",     name: "Bookshop",              floor: 1, coords: { x: 90, y: 95 } },
        { type: "elevator", name: "Ascensore",             floor: 1, coords: { x: 50, y: 95 } }
    ];
    await museum2.save();
    console.log("Secondo museo creato: Galleria Estense di Modena, 4 sale.");

    // --- Opere generate (Modena) ---
    const ROOM_PLAN_MODENA = [
        { roomIdx: 0, styleKey: "corte-estense", authorKeys: ["correggio"], subjects: ["madonna", "sacraFamiglia", "pieta"], yearMin: 1510, yearMax: 1530, tech: TECH_1500, count: 6 },
        { roomIdx: 1, styleKey: "corte-estense", authorKeys: ["dossodossi", "correggio"], subjects: ["mitologia", "ritratto", "madonna"], yearMin: 1515, yearMax: 1540, tech: TECH_1500, count: 6 },
        { roomIdx: 2, styleKey: "riforma-carracci", authorKeys: ["annibale-carracci", "guercino"], subjects: ["ritratto", "martirio"], yearMin: 1595, yearMax: 1625, tech: TECH_1600PLUS, count: 3 }, // + 1 fissa (busto Bernini) = 4
        { roomIdx: 3, styleKey: "naturalismo-luministico", authorKeys: ["guercino", "annibale-carracci"], subjects: ["martirio", "sacraFamiglia", "mitologia"], yearMin: 1615, yearMax: 1650, tech: TECH_1600PLUS, count: 8 }
    ];

    const artworksModena = [];
    for (const plan of ROOM_PLAN_MODENA) {
        for (let i = 0; i < plan.count; i++) {
            const authorKey = plan.authorKeys[i % plan.authorKeys.length];
            const subject = plan.subjects[i % plan.subjects.length];
            const year = plan.yearMin + Math.round((plan.yearMax - plan.yearMin) * (i / Math.max(1, plan.count - 1)));
            const technique = plan.tech[i % plan.tech.length];
            const title = titleFor(subject);
            await createArtworkWithContent({ title, year: `${year} ca.`, technique, authorKey, styleKey: plan.styleKey, museumObj: museum2, roomsArr: roomsModena, roomIdx: plan.roomIdx, subject, pool: artworksModena });
        }
    }

    // Pezzo "fisso" reale: il busto di Francesco I d'Este di Bernini. Testi
    // scritti a mano (customTexts), perché i banchi testuali per soggetto
    // sopra sono pensati per la pittura ("questo quadro...") e userebbero
    // un linguaggio sbagliato per una scultura in marmo.
    const bernBust = await createArtworkWithContent({
        title: "Busto di Francesco I d'Este", year: "1650-1651", technique: "Scultura in marmo",
        authorKey: "bernini", styleKey: "scultura-barocca-romana", museumObj: museum2, roomsArr: roomsModena, roomIdx: 2, subject: "ritratto", pool: artworksModena,
        customTexts: {
            elementare: [
                { duration: "3s",  content: "Un ritratto scolpito nel marmo, non dipinto: è di Gian Lorenzo Bernini." },
                { duration: "15s", content: "Questa non è un dipinto ma una scultura di marmo: rappresenta il duca Francesco I d'Este, scolpito da uno degli artisti più famosi del suo tempo, Gian Lorenzo Bernini." },
                { duration: "40s", content: "Guarda bene: questo volto non è dipinto, è scolpito nel marmo bianco. Bernini è riuscito a far sembrare il marmo quasi vivo, con pieghe morbide negli abiti e uno sguardo intenso. Il duca Francesco I d'Este volle un suo ritratto da uno degli scultori più richiesti d'Europa, anche se non poté mai posare di persona a Roma." }
            ],
            medio: [
                { duration: "3s",  content: "Busto di Francesco I d'Este, Gian Lorenzo Bernini, 1650-1651, marmo." },
                { duration: "15s", content: "Capolavoro della ritrattistica scultorea barocca, il busto ritrae il duca di Modena con un realismo psicologico raro per il genere, tipico della maniera di Bernini." },
                { duration: "40s", content: "Realizzato tra il 1650 e il 1651, il busto di Francesco I d'Este è una delle prove più celebri di Bernini nel genere del ritratto scolpito. Il duca non poté recarsi a Roma per posare di persona, e Bernini lavorò basandosi su un ritratto dipinto inviatogli come riferimento: nonostante questo, riuscì a restituire un'intensità psicologica e un dinamismo dei panneggi che pochi scultori coevi sapevano eguagliare." }
            ]
        }
    });

    console.log(`${artworksModena.length} artwork create per la Galleria Estense (con Content elementare + medio ciascuna).`);

    // Content extra su dominio per un paio di opere di Modena.
    const extraDomainTargetsModena = [
        { entry: bernBust, domain: "materiali", content: "Il marmo bianco proviene dalle cave di Carrara, materiale privilegiato dalla scultura barocca romana per la sua capacità di restituire superfici morbide e quasi traslucide, ideali per rendere carnagioni e panneggi." },
        { entry: artworksModena[0], domain: "storia", content: "Il Correggio è celebre soprattutto per gli affreschi illusionistici delle cupole di Parma, capaci di aprire il soffitto verso un cielo popolato di figure in volo: una soluzione spaziale che influenzerà la decorazione barocca del secolo successivo." }
    ];
    for (const target of extraDomainTargetsModena) {
        await Item.create({
            artwork: target.entry.artwork._id,
            texts: [{ duration: "40s", content: target.content }],
            language: "medio",
            domains: [target.domain]
        });
    }
    console.log(`${extraDomainTargetsModena.length} Content extra su domini di approfondimento creati (Modena).`);

    // ---------- Visite ----------
    // Ogni visita porta anche il proprio museum + entranceInfo (non più
    // fissi su museum._id): con due musei in gioco, una visita deve
    // restare scoped a UN SOLO museo, ed è esattamente questo confine
    // che il seed vuole ora poter verificare.
    function stepsFrom(entries, note) {
        return entries.map((e, idx) => ({
            artwork: e.artwork._id,
            logisticNote: idx === 0 ? note : "Proseguire nella sala successiva seguendo le indicazioni a pavimento."
        }));
    }
    function byRoom(pool, roomIdx, n) { return pool.filter((a) => a.roomIdx === roomIdx).slice(0, n); }
    function byStyle(pool, styleKey, n) { return pool.filter((a) => a.styleKey === styleKey).slice(0, n); }

    const BOLOGNA_ENTRANCE = "Ingresso da via delle Belle Arti 56. Biglietto 6€, ridotto 2€, guardaroba gratuito.";
    const MODENA_ENTRANCE = "Ingresso da Largo Porta Sant'Agostino 337. Biglietto 8€, ridotto 2€.";

    const visitsData = [
        {
            title: "Il Trecento bolognese", description: "Dalla pittura tardogotica ai primi accenni di naturalismo, con Vitale da Bologna protagonista.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: byRoom(artworksBologna, 0, 10), author: users.autore1, pace: "40s", price: 0, isPublic: true, tags: ["trecento", "gotico"]
        },
        {
            title: "Da Francia ai manieristi", description: "Il passaggio dal Quattrocento al Manierismo emiliano, attraverso Francesco Francia e la cerchia del Parmigianino.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [...byRoom(artworksBologna, 1, 5), ...byRoom(artworksBologna, 2, 5), ...byRoom(artworksBologna, 3, 5)], author: users.autore1, pace: "40s", price: 0, isPublic: true, tags: ["rinascimento", "manierismo"]
        },
        {
            title: "I capolavori del Seicento", description: "Il grande secolo bolognese, dai Carracci a Guido Reni fino a Guercino.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [...byRoom(artworksBologna, 4, 5), ...byRoom(artworksBologna, 5, 5), ...byRoom(artworksBologna, 6, 4)], author: users.autore1, pace: "1min", price: 0, isPublic: true, tags: ["seicento", "barocco"]
        },
        {
            title: "L'arte spiegata ai più piccoli", description: "Un percorso pensato per bambini e scolaresche, con testi semplici e opere dai colori vivaci.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [...byRoom(artworksBologna, 0, 3), ...byRoom(artworksBologna, 3, 3), ...byRoom(artworksBologna, 7, 4)], author: users.autore2, pace: "15s", price: 0, isPublic: true, tags: ["famiglie", "bambini"]
        },
        {
            title: "Il secolo dei Carracci", description: "La riforma naturalistica di Ludovico, Annibale e Agostino Carracci, tra Bologna e i suoi committenti.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: byRoom(artworksBologna, 4, 12), author: users.autore2, pace: "40s", price: 0, isPublic: true, tags: ["carracci", "seicento"]
        },
        {
            title: "Bologna nel Settecento", description: "Dal classicismo elegante di Creti al naturalismo domestico di Crespi, fino a Gandolfi.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: byRoom(artworksBologna, 7, 14), author: users.autore2, pace: "40s", price: 0, isPublic: true, tags: ["settecento"]
        },
        {
            title: "Ritratti e volti della collezione", description: "Un percorso trasversale sui ritratti della Pinacoteca, dal Manierismo al Settecento.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: artworksBologna.filter((a) => a.subject === "ritratto").slice(0, 12), author: users.autore2, pace: "40s", price: 0, isPublic: true, tags: ["ritratti"]
        },
        {
            title: "Percorso completo della Pinacoteca", description: "Una visita generale, sala per sala, attraverso l'intera collezione permanente.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [...byRoom(artworksBologna, 0, 3), ...byRoom(artworksBologna, 1, 2), ...byRoom(artworksBologna, 2, 3), ...byRoom(artworksBologna, 3, 3), ...byRoom(artworksBologna, 4, 3), ...byRoom(artworksBologna, 5, 3), ...byRoom(artworksBologna, 6, 3), ...byRoom(artworksBologna, 7, 3)],
            author: users.admin1, pace: "40s", price: 0, isPublic: true, tags: ["panoramica"]
        },
        {
            title: "Un'ora tra i capolavori", description: "I pezzi più celebri della collezione, per chi ha poco tempo a disposizione.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [raffaello, bedoliArtwork, reniMadonna, comunioneGirolamo, strageInnocenti, ...byRoom(artworksBologna, 6, 3)],
            author: users.admin1, pace: "1min", price: 0, isPublic: true, tags: ["highlights"]
        },
        {
            title: "Le mie preferite del Manierismo", description: "Una selezione personale delle opere manieriste che preferisco, per una visita tranquilla.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [bedoliArtwork, ...byRoom(artworksBologna, 3, 6)], author: users.visitatore1, pace: "1min", price: 0, isPublic: false, tags: ["personale"]
        },
        {
            title: "Percorso per il compleanno di mia figlia", description: "Un giro breve e colorato tra le opere più vivaci, pensato per una gita in famiglia.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: byRoom(artworksBologna, 7, 6), author: users.visitatore1, pace: "15s", price: 0, isPublic: false, tags: ["personale", "famiglia"]
        },
        {
            title: "Studio per l'esame di Storia dell'Arte", description: "Le opere del Seicento che mi servono per ripassare prima dell'esame.",
            museum, entranceInfo: BOLOGNA_ENTRANCE,
            entries: [...byRoom(artworksBologna, 4, 4), ...byRoom(artworksBologna, 5, 4)], author: users.visitatore2, pace: "1min", price: 0, isPublic: false, tags: ["personale", "studio"]
        },
        // --- Visite del secondo museo (Galleria Estense di Modena) ---
        {
            title: "Correggio e la corte estense", description: "Il Rinascimento raffinato di Correggio e Dosso Dossi alla corte degli Este.",
            museum: museum2, entranceInfo: MODENA_ENTRANCE,
            entries: [...byRoom(artworksModena, 0, 4), ...byRoom(artworksModena, 1, 4)], author: users.autore1, pace: "40s", price: 0, isPublic: true, tags: ["rinascimento", "estense"]
        },
        {
            title: "Mezz'ora alla Estense", description: "Una selezione rapida tra pittura e scultura, dal Correggio al busto di Bernini.",
            museum: museum2, entranceInfo: MODENA_ENTRANCE,
            entries: [bernBust, ...byRoom(artworksModena, 0, 2), ...byRoom(artworksModena, 3, 2)], author: users.admin1, pace: "15s", price: 0, isPublic: true, tags: ["highlights"]
        },
        {
            title: "La mia visita a Modena", description: "Le opere che voglio rivedere con calma la prossima volta che torno alla Estense.",
            museum: museum2, entranceInfo: MODENA_ENTRANCE,
            entries: [bernBust, ...byRoom(artworksModena, 3, 4)], author: users.visitatore2, pace: "1min", price: 0, isPublic: false, tags: ["personale"]
        }
    ];

    for (const v of visitsData) {
        await Visit.create({
            title: v.title,
            description: v.description,
            museum: v.museum._id,
            entranceInfo: v.entranceInfo,
            pace: v.pace,
            steps: stepsFrom(v.entries, "Dall'ingresso, proseguire verso la prima sala del percorso."),
            author: v.author._id,
            license: "CC-BY", // uso "CC-BY" anche per le visite private: isPublic è ciò che le tiene fuori dal marketplace, non ho trovato nel seed di riferimento un valore enum diverso da CC-BY per la licenza
            isPublic: v.isPublic,
            price: v.price,
            tags: v.tags
        });
    }
    console.log(`${visitsData.length} visite create: 11 pubbliche (autore1, autore2, admin1, su entrambi i musei) + 4 private (visitatore1 x2, visitatore2 x2).`);

    console.log("\n✅ Seed completato!");
    console.log("   Musei:", museum.name, `(${rooms.length} sale)`, "/", museum2.name, `(${roomsModena.length} sale)`);
    console.log("   Utenti: autore1, autore2, visitatore1, visitatore2, admin1 (password: 12345678)");
    console.log("   Autori:", authorsData.length, " / Stili:", stylesData.length);
    console.log("   Opere Pinacoteca:", artworksBologna.length, " / Opere Estense:", artworksModena.length);
    console.log("   Content totali:", (artworksBologna.length + artworksModena.length) * 2 + extraDomainTargets.length + extraDomainTargetsModena.length);
    console.log("   Visite:", visitsData.length);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error("Errore durante il seeding:", err);
    process.exit(1);
});