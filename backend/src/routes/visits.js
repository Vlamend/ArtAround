import express from 'express';
import { getVisits, getVisitById, createVisit, updateVisit, deleteVisit, completeVisit, getMyVisits } from '../controllers/visitsController.js';
import { authenticateToken, optionalAuth } from '../middleware/authenticator.js';

const router = express.Router();

router.get('/', optionalAuth, getVisits);
router.get('/mine', authenticateToken, getMyVisits);
router.get('/:id', optionalAuth, getVisitById);
router.post('/', authenticateToken, createVisit);
router.put('/:id', authenticateToken, updateVisit);
router.delete('/:id', authenticateToken, deleteVisit);
router.post('/:id/complete', authenticateToken, completeVisit);

export default router;