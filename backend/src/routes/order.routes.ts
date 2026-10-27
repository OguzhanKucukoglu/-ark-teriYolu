import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createOrder, getOrders, getOrderById, updateOrderStatus } from '../controllers/order.controller';

const router = Router();
router.use(authenticate);

router.get('/',    getOrders);
router.get('/:id', getOrderById);
router.post('/',   authorize('hayvanci'), createOrder);
router.patch('/:id/status', updateOrderStatus);

export default router;
