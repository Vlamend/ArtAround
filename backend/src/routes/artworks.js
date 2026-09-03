import express from 'express';
import { getArtworks, getArtworkById, createArtwork, updateArtwork, deleteArtwork, purchaseArtwork } from '../controllers/artworksController.js';
import { authenticateToken } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: marketplace (lista, filtrabile/ordinabile per
// museo/autore/stile) e Navigator (dettaglio dell'oggetto da presentare,
// con populate di author/style per "chi è l'autore"/"qual è lo stile").
// Il filtro di accessibilità commerciale (pubblica + gratis/posseduta)
// è applicato dentro il controller.
router.get('/', getArtworks);
router.get('/:id', getArtworkById);

// Scrittura: richiede autenticazione. Update/delete richiedono inoltre
// di essere il proprietario attuale (controllato nel controller).
router.post('/', authenticateToken, createArtwork);
router.put('/:id', authenticateToken, updateArtwork);
router.delete('/:id', authenticateToken, deleteArtwork);

// Acquisto: l'unico punto in cui la proprietà commerciale di un'opera
// (e quindi di tutti i suoi content) cambia mano.
router.post('/:id/purchase', authenticateToken, purchaseArtwork);

export default router;
