import express from 'express';
import { getMuseums, getMuseumById, getMuseumBySlug } from '../controllers/museumsController.js';

const router = express.Router();

router.get('/', getMuseums);
router.get('/:id', getMuseumById);
router.get('/slug/:slug', getMuseumBySlug);

export default router;