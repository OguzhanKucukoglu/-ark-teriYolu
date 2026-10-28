import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getAnomalies } from '../controllers/anomaly.controller';

const router = Router();
router.use(authenticate);

// GET /api/anomalies - Akıllı Anomali ve Risk Analiz Verileri
router.get('/', getAnomalies);

export default router;
