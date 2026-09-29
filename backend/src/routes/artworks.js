import express from 'express';
import { getArtworks, getArtworkById, createArtwork, updateArtwork, deleteArtwork, adoptArtwork, acquireArtwork } from '../controllers/artworksController.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/authenticator.js';

const router = express.Router();

router.get('/', optionalAuth, getArtworks);
router.get('/:id', optionalAuth, getArtworkById);
router.post('/', authenticateToken, requireRole('autore', 'admin'), createArtwork);
router.put('/:id', authenticateToken, updateArtwork);
router.delete('/:id', authenticateToken, deleteArtwork);
router.post('/:id/adopt', authenticateToken, adoptArtwork);
router.post('/:id/acquire', authenticateToken, requireRole('autore', 'admin'), acquireArtwork);

export default router;
