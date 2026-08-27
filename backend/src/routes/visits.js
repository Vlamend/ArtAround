import express from 'express';
import { getVisits, getVisitById, createVisit, updateVisit, deleteVisit, completeVisit } from '../controllers/visitsController.js';
import { authenticateToken, optionalAuth } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: marketplace (lista, eventualmente filtrata per museo)
// e Navigator (dettaglio di una visita da eseguire)
router.get('/', optionalAuth, getVisits);
router.get('/:id', getVisitById);

// Scrittura: richiede autenticazione. Il controllo che l'utente sia
// effettivamente l'autore della visita (ownership) è nel controller,
// perché richiede di caricare prima il documento dal DB.
router.post('/', authenticateToken, createVisit);
router.put('/:id', authenticateToken, updateVisit);
router.delete('/:id', authenticateToken, deleteVisit);
//Indica che la visita è stata completata dall'utente. Se non è segnata come completa aggiorna l'array delle completedVisits nel db
router.post('/:id/complete', authenticateToken, completeVisit);
export default router;