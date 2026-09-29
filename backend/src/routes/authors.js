import express from 'express';
import { getAuthors, getAuthorById, createAuthor, updateAuthor, deleteAuthor } from '../controllers/authorsController.js';
import { authenticateToken, requireRole } from '../middleware/authenticator.js';

const router = express.Router();

router.get('/', getAuthors);
router.get('/:id', getAuthorById);
router.post('/', authenticateToken, requireRole('autore', 'admin'), createAuthor);
router.put('/:id', authenticateToken, requireRole('autore', 'admin'), updateAuthor);
router.delete('/:id', authenticateToken, requireRole('autore', 'admin'), deleteAuthor);

export default router;
