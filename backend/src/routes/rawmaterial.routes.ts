import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';
import { generateLotNumber } from '../utils/lotNumberGenerator';

const router = Router();
router.use(authenticate, authorize('hayvanci'));

// Hammadde listesi
router.get('/', async (req: AuthRequest, res) => {
  try {
    const materials = await selectQuery(
      sequelize,
      `SELECT rm.*, l.lot_number, l.status as lot_status
       FROM raw_materials rm
       JOIN lots l ON rm.lot_id = l.id
       WHERE rm.owner_id = ?
       ORDER BY rm.created_at DESC`,
      [req.user!.id]
    );
    res.json(materials);
  } catch {
    res.status(500).json({ error: 'Hammaddeler alınamadı' });
  }
});

// Hammadde ekle
router.post('/', async (req: AuthRequest, res) => {
  const { material_type, quantity, unit, unit_price, supplier_name, expiry_date } = req.body;

  if (!material_type || !quantity || !unit || !unit_price) {
    res.status(400).json({ error: 'material_type, quantity, unit, unit_price zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const totalCost = parseFloat(quantity) * parseFloat(unit_price);

    // Lot numarası oluştur
    const countRows = await selectQuery<{ cnt: number }>(
      sequelize,
      "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'hammadde'",
      [],
      t
    );
    const seq = (countRows[0]?.cnt || 0) + 1;
    const lotNumber = generateLotNumber('hammadde', seq);

    // Lot kaydı
    const lotId = await insertQuery(
      sequelize,
      `INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, supplier_name, expiry_date, status)
       VALUES (?, 'hammadde', ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [lotNumber, req.user!.id, quantity, unit, unit_price, totalCost, supplier_name || null, expiry_date || null],
      t
    );

    // Hammadde kaydı
    const rmId = await insertQuery(
      sequelize,
      `INSERT INTO raw_materials (owner_id, lot_id, material_type, quantity, unit, unit_price, total_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, lotId, material_type, quantity, unit, unit_price, totalCost],
      t
    );

    // Lot hareketi
    await insertQuery(
      sequelize,
      `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, to_user_id)
       VALUES (?, 'giris', ?, ?, 'raw_material', ?, ?)`,
      [lotId, quantity, unit, rmId, req.user!.id],
      t
    );

    await t.commit();
    res.status(201).json({ message: 'Hammadde eklendi', rmId, lotNumber, totalCost });
  } catch (err) {
    await t.rollback();
    console.error('Hammadde ekleme hatası:', err);
    res.status(500).json({ error: 'Hammadde eklenemedi' });
  }
});

// Hammadde sil (soft — lotu consumed yap)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `UPDATE lots l
       JOIN raw_materials rm ON rm.lot_id = l.id
       SET l.status = 'consumed'
       WHERE rm.id = ? AND rm.owner_id = ?`,
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'Hammadde silindi' });
  } catch {
    res.status(500).json({ error: 'Hammadde silinemedi' });
  }
});

export default router;
