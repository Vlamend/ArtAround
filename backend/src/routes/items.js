import express from 'express';
import { getItems, getItemById, createItem, updateItem, deleteItem, giveFeedback, purchaseItem } from '../controllers/itemsController.js';
import { authenticateToken, optionalAuth } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: marketplace (lista, filtrabile per museo/tipo/lingua)
// e Navigator (dettaglio di un item da presentare)
router.get('/', optionalAuth, getItems);
router.get('/:id', getItemById);

// Scrittura: richiede autenticazione. L'ownership (solo l'autore può
// modificare/eliminare) è verificata nel controller.
router.post('/', authenticateToken, createItem);
router.put('/:id', authenticateToken, updateItem);
router.delete('/:id', authenticateToken, deleteItem);
// Feedback: Viene fatto un feedback su un item, che modifica i pesi di interesse 
// dell'utente per le varie categorie (artista, architettura, stile, materiali, storia).
router.post('/:id/feedback', authenticateToken, giveFeedback);

// Acquisto di un item da un utente ad un altro.
router.post('/:id/purchase', authenticateToken, purchaseItem);
export default router;