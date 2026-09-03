import express from 'express';
import { getItems, getItemById, createItem, updateItem, deleteItem, giveFeedback } from '../controllers/itemsController.js';
import { authenticateToken, optionalAuth } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura: marketplace (lista, filtrabile per artwork/museo/lingua/domini)
// e Navigator (dettaglio di un content da presentare). optionalAuth perché
// l'accessibilità dipende da chi possiede l'artwork collegato — un utente
// non loggato vede solo i content di opere gratuite.
router.get('/', optionalAuth, getItems);
router.get('/:id', getItemById);

// Scrittura: richiede autenticazione. Non più un controllo di ownership
// sul content stesso (non ne ha più): il controller verifica che
// l'utente sia proprietario dell'ARTWORK a cui il content si riferisce
// (license/isPublic/price/owner vivono lì ora, non più qui).
router.post('/', authenticateToken, createItem);
router.put('/:id', authenticateToken, updateItem);
router.delete('/:id', authenticateToken, deleteItem);

// Feedback: viene fatto un feedback su un item, che modifica i pesi di
// interesse dell'utente per le varie categorie (artista, architettura,
// stile, materiali, storia).
router.post('/:id/feedback', authenticateToken, giveFeedback);

// NB: l'acquisto ora avviene su /api/artworks/:id/purchase, non più qui
// — comprare un'opera dà accesso a tutti i suoi content in una volta.

export default router;
