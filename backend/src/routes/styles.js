import express from 'express';
import { getStyles, getStyleById, createStyle, updateStyle, deleteStyle } from '../controllers/stylesController.js';
import { authenticateToken, requireRole } from '../middleware/authenticator.js';

const router = express.Router();

router.get('/', getStyles);
router.get('/:id', getStyleById);
router.post('/', authenticateToken, requireRole('autore', 'admin'), createStyle);
router.put('/:id', authenticateToken, requireRole('autore', 'admin'), updateStyle);
router.delete('/:id', authenticateToken, requireRole('autore', 'admin'), deleteStyle);

export default router;
