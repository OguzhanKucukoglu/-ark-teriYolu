import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { parseInvoiceOcr } from '../controllers/ocr.controller';

const router = Router();
router.use(authenticate);

// POST /api/ocr/analyze - Fatura ve İrsaliye Görsel / Metin Analizi (OCR)
router.post('/analyze', parseInvoiceOcr);

export default router;
