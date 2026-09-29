import express from 'express';
import { getItems, getItemById, createItem, updateItem, deleteItem, giveFeedback } from '../controllers/itemsController.js';
import { authenticateToken, optionalAuth } from '../middleware/authenticator.js';

const router = express.Router();

router.get('/', optionalAuth, getItems);
router.get('/:id', optionalAuth, getItemById);
router.post('/', authenticateToken, createItem);
router.put('/:id', authenticateToken, updateItem);
router.delete('/:id', authenticateToken, deleteItem);
router.post('/:id/feedback', authenticateToken, giveFeedback);

export default router;
