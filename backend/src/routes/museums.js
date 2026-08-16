import express from 'express';
import { getMuseums, getMuseumById, getMuseumBySlug } from '../controllers/museumsController.js';

const router = express.Router();

// Sola lettura: i musei vengono popolati direttamente nel DB (seed data),
// non c'è un flusso di creazione/editing da interfaccia per lo scope
// attuale del progetto.
router.get('/', getMuseums);
router.get('/:id', getMuseumById);
router.get('/slug/:slug', getMuseumBySlug);

export default router;