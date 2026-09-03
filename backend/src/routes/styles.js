import express from 'express';
import { getStyles, getStyleById, createStyle, updateStyle, deleteStyle } from '../controllers/stylesController.js';
import { authenticateToken } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: Navigator ("qual è lo stile") e marketplace
// (ordinamento/filtro opere per stile) — nessun acquisto richiesto.
router.get('/', getStyles);
router.get('/:id', getStyleById);

router.post('/', authenticateToken, createStyle);
router.put('/:id', authenticateToken, updateStyle);
router.delete('/:id', authenticateToken, deleteStyle);

export default router;
