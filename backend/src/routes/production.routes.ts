import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createProductionOrder, getProductionOrders, getProductionById, completeProduction } from '../controllers/production.controller';

const router = Router();
router.use(authenticate, authorize('sucukcu'));

router.get('/',              getProductionOrders);
router.get('/:id',           getProductionById);
router.post('/',             createProductionOrder);
router.patch('/:id/complete', completeProduction);

export default router;
