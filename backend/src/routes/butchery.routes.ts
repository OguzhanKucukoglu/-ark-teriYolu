import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createButcheryOperation, getButcheryOperations, getButcheryById } from '../controllers/butchery.controller';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate, authorize('hayvanci'));

router.get('/',    getButcheryOperations);

// Aktif parça lotları — hayvan türü ve parça adıyla birlikte
// Sucukçu ilanları filtresinde "hangi hayvandan hangi parça" seçimi için kullanılır
router.get('/parts/available', async (req: AuthRequest, res) => {
  try {
    const parts = await selectQuery(
      sequelize,
      `SELECT
         bp.id          AS part_id,
         bp.part_name,
         bo.animal_type,
         bo.operation_date,
         l.id           AS lot_id,
         l.lot_number,
         l.quantity     AS available_kg,
         l.status       AS lot_status
       FROM butchery_parts bp
       JOIN butchery_operations bo ON bp.butchery_operation_id = bo.id
       JOIN lots l ON bp.lot_id = l.id
       WHERE bo.operator_id = ?
         AND l.status = 'active'
         AND l.quantity > 0
         AND bp.is_byproduct = 0
       ORDER BY bo.animal_type, bp.part_name`,
      [req.user!.id]
    );
    res.json(parts);
  } catch {
    res.status(500).json({ error: 'Parça lotları alınamadı' });
  }
});

router.get('/:id', getButcheryById);
router.post('/',   createButcheryOperation);

export default router;
