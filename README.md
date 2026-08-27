# ArtAround — Stato del progetto

> Documento di lavoro che fotografa cosa è **effettivamente implementato** ad oggi. Non è il README.me finale richiesto dalle specifiche del corso (quello ha un formato e un vincolo di immutabilità diversi, va scritto a parte al momento della consegna).

**Livello target**: 18-24 (progetto base, nessuna estensione 18-27/18-33), progetto individuale.

---

## Stack tecnico

- **Backend**: Node.js + Express + MongoDB (Mongoose), ES Modules.
- **Navigator** (app per il visitatore): React + Vite, SPA.
- **Marketplace/Editor** (app per il curatore): vanilla JavaScript multi-pagina, nessun framework, nessun build step.
- **Deploy target**: 2 container Docker sul server del dipartimento (`node-XX` + `mongo`), come richiesto dalle specifiche. Backend, Navigator (build statica) e Marketplace vivono sullo stesso container Node, serviti su path diversi.

---

## Struttura dati (MongoDB / Mongoose)

### `Item`
Opera museale o contenuto correlato (`type: 'object' | 'related'`).

- Anagrafica: `title`, `year`, `technique`, `dimensions`, `image`.
- Identificatori Wikidata: `wikidataId`, `artistWikidata`, `styleWikidata` — collegano item diversi che parlano dello stesso oggetto/artista/stile.
- Posizione: `museum`, `roomId`, `coords` (0-100, locali al piano della planimetria).
- Contenuto: `texts[]` (coppie `duration` + `content`, `duration` ∈ `3s/15s/40s/1min/4min`), `language` (`infantile/elementare/medio/specialistico`).
- Ambiti di interesse: `domains[]` (`artista/architettura/stile/materiali/storia`) — usati dal sistema di personalizzazione.
- Marketplace: `author`, `license`, `isPublic`, `price`, `tags`.
- **Niente campo `adoptions`** (rimosso — vedi sezione "Decisioni di design").

### `Visit`
Sequenza curata di `Item` con indicazioni logistiche.

- `title`, `description`, `museum`, `entranceInfo`.
- `steps[]`: array ordinato di `{ item, logisticNote }`.
- `author`, `license`, `isPublic`, `price`, `tags`.
- **Niente campo `adoptions`**.

### `Museum`
- Anagrafica, orari, servizi.
- `primaryColor` / `secondaryColor` — tema colore applicato dinamicamente dal Navigator.
- `rooms[]`: sale con `bounds` (rettangolo 0-100, usato come fallback grafico se manca una planimetria reale).
- `floorPlans[]`: planimetrie reali per piano (immagine fornita dal museo).
- `pointsOfInterest[]`: entrata, uscita, bagni, bar, shop, ascensori, ostacoli — con `floor` e `coords`.

### `User`
- `username`, `email`, `password` (hash bcrypt), `role` (`admin`/`user` — `admin` non ancora usato da nessuna funzionalità attiva).
- `preferredLanguageLevel`, `interfaceLanguage`.
- `interestWeights`: punteggio per ciascun ambito (`artista/architettura/stile/materiali/storia`), range -10/+10.
- `visitedVisits[]`: `{ visit, completedAt }` — quali visite l'utente ha completato.
- `purchasedItems[]`: item a pagamento di altri autori di cui l'utente ha acquisito il diritto d'uso.

---

## Autenticazione e permessi

- JWT (5h di validità), password con bcrypt.
- **`authenticateToken`**: blocca la richiesta se il token manca o non è valido.
- **`optionalAuth`**: riconosce l'utente se presente un token valido, ma non blocca la richiesta se assente — usata sulle rotte di lettura pubbliche (`GET /items`, `GET /visits`) per supportare sia la navigazione anonima sia il filtro `?mine=true`.
- **`requireAdmin`**: esiste, non ancora collegata a nessuna rotta (riservata per un futuro CRUD museo lato admin — deciso di rimandarlo).
- Autorizzazione su item/visite: basata su **ownership** (`author === utente loggato`), non su ruoli — qualunque utente autenticato può creare/modificare/eliminare i propri contenuti.

---

## API principali

| Risorsa | Rotte |
|---|---|
| **Auth** | `POST /users/register`, `POST /users/login`, `POST /users/logout`, `GET /users/me`, `PUT /users/me` |
| **Item** | `GET /items` (filtri: museum, type, language, wikidataId, artistWikidata, styleWikidata, mine), `GET /items/:id`, `POST/PUT/DELETE /items/:id`, `POST /items/:id/feedback` (👍/👎), `POST /items/:id/purchase` |
| **Visite** | `GET /visits` (filtri: museum, mine), `GET /visits/:id`, `POST/PUT/DELETE /visits/:id`, `POST /visits/:id/complete` |
| **Musei** | `GET /museums`, `GET /museums/:id`, `GET /museums/slug/:slug` (sola lettura per ora) |
| **Config** | `GET /config` — legge `museum.config.json`, usato dal Navigator per risolvere il proprio museo |

---

## Navigator (app per il visitatore)

- **Login** con validazione del token contro il server al caricamento (non solo presenza in `localStorage`).
- **Selezione museo via configurazione**, non da pannello: legge `museum.config.json` → risolve lo slug in un museo reale. Un'istanza deployata del Navigator è vincolata a un solo museo, come da specifiche.
- **Tema dinamico**: colori del museo (`primaryColor`/`secondaryColor`) applicati a runtime via CSS custom properties; le tinte "soft" si calcolano da sole con `color-mix()`.
- **Lista visite** del museo, con badge "Già visitata".
- **Player della visita**:
  - Navigazione sequenziale (Prossimo/Precedente).
  - Livello di dettaglio regolabile (Dimmi di più/meno, tra le 5 durate disponibili).
  - Sintesi vocale nativa (`SpeechSynthesis`).
  - **Riconoscimento vocale** (`SpeechRecognition`) su vocabolario controllato (corrispondenza per pattern, non NLU libera — quella è fuori scope, riservata all'estensione 18-33).
  - **Mappa del museo**: planimetrie reali per piano (immagine + marker sovrapposti in percentuale) con fallback su rettangoli calcolati se un piano non ha planimetria; tab di cambio piano; tap-to-jump su una tappa.
  - Pannello punti di interesse.
  - "Chi è l'autore" / "Qual è lo stile": cerca contenuti `related` collegati via Wikidata ID.
  - **Adattamento al profilo**: se esiste una variante dello stesso oggetto (stesso `wikidataId`) nel `preferredLanguageLevel` dell'utente, la mostra al posto di quella scelta dal curatore per lo step.
  - **Feedback di interesse** (👍/👎) sul contenuto mostrato, aggiorna `interestWeights` lato server.
  - Segna automaticamente la visita come completata all'ultimo step.
- **Impostazioni**: livello linguistico preferito + slider per i 5 ambiti di interesse.

---

## Marketplace/Editor (app per il curatore)

- **Login**, **selezione museo da pannello** (multi-scelta, coerente con le specifiche — diverso dal Navigator).
- **Gestione visite**: lista (pubbliche + proprie bozze), creazione/modifica con ricerca item, riordino step (su/giù), nota logistica per step, campi di pubblicazione (licenza/prezzo/pubblica sì-no/tag).
- **Gestione item**: lista dei propri contenuti, creazione/modifica con anagrafica completa, ID Wikidata, sala/coordinate, editor dinamico dei `texts[]` (aggiungi/rimuovi righe durata+contenuto).
- **Compravendita tra curatori**: nella ricerca item dentro l'editor visita, gli item a pagamento di altri autori non ancora posseduti mostrano "Acquista (X€)" invece di "+ Aggiungi"; dopo l'acquisto sbloccano immediatamente nella stessa sessione.

---

## Decisioni di design esplicite (per non doverle ridiscutere)

- **Compravendita solo per item, non per visite.** Il ragionamento: la slide sulle vendite è interamente nella sezione "editor/marketplace", che descrive solo workflow del curatore — i visitatori non toccano quell'app. Le visite restano liberamente eseguibili nel Navigator una volta loggati.
- **Enforcement dell'acquisto solo lato UI**, non ri-verificato server-side al salvataggio della visita — scelta consapevole per semplicità, accettando il rischio teorico di bypass via chiamata diretta all'API.
- **Nessun contatore `adoptions`** (né su `Item` né su `Visit`) — rimosso perché ridondante con `User.visitedVisits` (per le visite) e perché non serviva a nessun meccanismo implementato (per gli item). Se in futuro servisse un conteggio aggregato, è calcolabile a query time senza mantenere un contatore duplicato.
- **`museum.config.json`** è un file di *deploy* statico, non gestito da alcuna UI — resta editato a mano quando si prepara un'istanza del Navigator per un museo specifico.

---

## Gap noti / rimandati consapevolmente

- **CRUD Museum per admin** — `requireAdmin` esiste, non collegato a nessuna rotta. Rimandato.
- **Nessuna vista "opere acquistate da altri autori"** nel marketplace — l'unico modo per accorgersi di possedere un item comprato è vederne il pulsante cambiato in "+ Aggiungi" durante la ricerca.
- **Stile grafico del marketplace ancora provvisorio** (palette blu generica) — rifinitura rimandata a un giro finale dedicato, per scelta esplicita.
- **`VisitList`/`NavigatorPlayer` nel Navigator chiamano `getMe()` indipendentemente** — ridondante, ottimizzabile spostando lo stato utente in `App.jsx`.
- **Contenuti del seed sono placeholder**: `wikidataId` quasi tutti inventati (eccetto quello di Bedoli, dall'esempio del PDF), testi generici/template — da personalizzare opera per opera prima della consegna.
- **`domains` (ambiti di interesse) impostabili solo via seed script** — nessun campo nell'editor item del marketplace per taggarli.
- Nessun gateway di pagamento reale (non richiesto dalle specifiche: "gestione delle vendite" è soddisfatta da un record gestito, non da un'elaborazione di pagamento vera).

---

## Account demo (da seed.js)

| Username | Email | Password |
|---|---|---|
| autore1 | autore1@artaround.test | 12345678 |
| autore2 | autore2@artaround.test | 12345678 |
| visitatore1 | visitatore1@artaround.test | 12345678 |
| visitatore2 | visitatore2@artaround.test | 12345678 |

Museo demo: Pinacoteca Nazionale di Bologna, 5 sale su 2 piani, 10 opere (2 livelli linguistici ciascuna), 2 contenuti correlati, 3 visite.