import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateLotNumber } from '../utils/lotNumberGenerator';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

router.get('/types', async (_req, res) => {
  try {
    const types = await selectQuery(sequelize, 'SELECT * FROM animal_types ORDER BY name', []);
    res.json(types);
  } catch {
    res.status(500).json({ error: 'Hayvan türleri alınamadı' });
  }
});

router.get('/types/:id/recipe', async (req, res) => {
  try {
    const recipe = await selectQuery(
      sequelize,
      'SELECT * FROM butchery_recipes WHERE animal_type_id = ? ORDER BY expected_ratio DESC',
      [req.params.id]
    );
    res.json(recipe);
  } catch {
    res.status(500).json({ error: 'Reçete alınamadı' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const animals = await selectQuery(
      sequelize,
      `SELECT a.*, at.name as animal_type_name, l.lot_number
       FROM animals a
       JOIN animal_types at ON a.animal_type_id = at.id
       LEFT JOIN lots l ON a.lot_id = l.id
       WHERE a.owner_id = ?
       ORDER BY a.created_at DESC`,
      [req.user!.id]
    );
    res.json(animals);
  } catch {
    res.status(500).json({ error: 'Hayvanlar alınamadı' });
  }
});

router.post('/', authorize('hayvanci'), async (req: AuthRequest, res) => {
  const { animal_type_id, entry_weight_kg, purchase_cost, purchase_date, supplier_name } = req.body;

  const t = await sequelize.transaction();
  try {
    const countRows = await selectQuery<{ cnt: number }>(
      sequelize, "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'hayvan'", [], t
    );
    const seq = (countRows[0]?.cnt || 0) + 1;
    const lotNumber = generateLotNumber('hayvan', seq);

    const lotId = await insertQuery(
      sequelize,
      `INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, total_cost, supplier_name, production_date, status)
       VALUES (?, 'hayvan', ?, 1, 'adet', ?, ?, ?, 'active')`,
      [lotNumber, req.user!.id, purchase_cost, supplier_name || null, purchase_date],
      t
    );

    const animalId = await insertQuery(
      sequelize,
      `INSERT INTO animals (owner_id, animal_type_id, lot_id, entry_weight_kg, purchase_cost, purchase_date, supplier_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, animal_type_id, lotId, entry_weight_kg, purchase_cost, purchase_date, supplier_name || null],
      t
    );

    await t.commit();
    res.status(201).json({ message: 'Hayvan kaydedildi', animalId, lotNumber });
  } catch {
    await t.rollback();
    res.status(500).json({ error: 'Hayvan kaydedilemedi' });
  }
});

export default router;
