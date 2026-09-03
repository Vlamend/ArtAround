import express from 'express';
import { getAuthors, getAuthorById, createAuthor, updateAuthor, deleteAuthor } from '../controllers/authorsController.js';
import { authenticateToken } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: Navigator ("chi è l'autore") e marketplace
// (ordinamento/filtro opere per autore) — nessun acquisto richiesto.
router.get('/', getAuthors);
router.get('/:id', getAuthorById);

router.post('/', authenticateToken, createAuthor);
router.put('/:id', authenticateToken, updateAuthor);
router.delete('/:id', authenticateToken, deleteAuthor);

export default router;
