import express from 'express';
import { getVisits, createVisit } from '../controllers/visitsController.js';

const router = express.Router();

router.get('/', getVisits);
router.post('/', createVisit);

export default router;
