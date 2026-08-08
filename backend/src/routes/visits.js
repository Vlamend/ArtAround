import express from 'express';
import { getVisits, getVisitById, createVisit, updateVisit, deleteVisit } from '../controllers/visitsController.js';
import { authenticateToken } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: marketplace (lista, eventualmente filtrata per museo)
// e Navigator (dettaglio di una visita da eseguire)
router.get('/', getVisits);
router.get('/:id', getVisitById);

// Scrittura: richiede autenticazione. Il controllo che l'utente sia
// effettivamente l'autore della visita (ownership) è nel controller,
// perché richiede di caricare prima il documento dal DB.
router.post('/', authenticateToken, createVisit);
router.put('/:id', authenticateToken, updateVisit);
router.delete('/:id', authenticateToken, deleteVisit);

export default router;