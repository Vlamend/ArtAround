import express from 'express';
import { getArtworks, getArtworkById, createArtwork, updateArtwork, deleteArtwork, adoptArtwork, acquireArtwork } from '../controllers/artworksController.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/authenticator.js';

const router = express.Router();

// Lettura pubblica: marketplace (lista, filtrabile/ordinabile per
// museo/autore/stile) e Navigator (dettaglio dell'oggetto da presentare,
// con populate di author/style per "chi è l'autore"/"qual è lo stile").
// Il filtro di accessibilità commerciale (pubblica + gratis/posseduta/
// licenziata) è applicato dentro il controller.
router.get('/', optionalAuth, getArtworks);
router.get('/:id', getArtworkById);

// Creazione: solo chi ha ruolo 'autore' o 'admin' può introdurre una
// nuova opera nel catalogo — un 'visitatore' può navigare/adottare ma
// non catalogare. Update/delete restano invece basati sul PROPRIETARIO
// attuale (controllato nel controller, non qui): chi acquisisce
// un'opera deve poterla gestire anche se non è admin, altrimenti
// pagare per diventare proprietario non darebbe i diritti promessi.
router.post('/', authenticateToken, requireRole('autore', 'admin'), createArtwork);
router.put('/:id', authenticateToken, updateArtwork);
router.delete('/:id', authenticateToken, deleteArtwork);

// Adozione: licenzia l'uso, non trasferisce diritti editoriali —
// aperta a qualunque utente autenticato (anche 'visitatore').
router.post('/:id/adopt', authenticateToken, adoptArtwork);

// Acquisizione: trasferisce i pieni diritti editoriali — stessa
// restrizione di ruolo della creazione, per lo stesso motivo: un
// 'visitatore' non deve poter ottenere diritti editoriali pagando,
// quando non può nemmeno crearne una da zero.
router.post('/:id/acquire', authenticateToken, requireRole('autore', 'admin'), acquireArtwork);

export default router;
