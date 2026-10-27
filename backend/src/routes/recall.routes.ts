import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  initiateRecall,
  getRecalls,
  getRecallById,
  completeRecall,
} from '../controllers/recall.controller';

const router = Router();

router.use(authenticate);

router.get('/',     getRecalls);
router.get('/:id',  getRecallById);
router.post('/',    authorize('hayvanci', 'sucukcu'), initiateRecall);
router.patch('/:id/complete', authorize('hayvanci', 'sucukcu'), completeRecall);

export default router;
