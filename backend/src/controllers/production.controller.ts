import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateLotNumber } from '../utils/lotNumberGenerator';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

export async function completeProduction(req: AuthRequest, res: Response): Promise<void> {
  const { actual_qty, service_cost, production_date } = req.body;

  if (!actual_qty || !service_cost) {
    res.status(400).json({ error: 'actual_qty ve service_cost zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const orders = await selectQuery<{ id: number; order_id: number; product_name: string }>(
      sequelize,
      'SELECT * FROM production_orders WHERE id = ? AND producer_id = ?',
      [req.params.id, req.user!.id],
      t
    );

    if (orders.length === 0) {
      await t.rollback();
      res.status(404).json({ error: 'Üretim emri bulunamadı' });
      return;
    }

    const productionOrder = orders[0];

    const rawCosts = await selectQuery<{ total: string }>(
      sequelize,
      'SELECT COALESCE(SUM(total_cost), 0) as total FROM production_raw_materials WHERE production_order_id = ?',
      [req.params.id],
      t
    );

    const totalRawCost = parseFloat(rawCosts[0]?.total || '0');
    const totalCost    = totalRawCost + parseFloat(String(service_cost));
    const ekp          = totalCost / actual_qty;

    await sequelize.query(
      `UPDATE production_orders
       SET actual_qty = ?, service_cost = ?, total_raw_cost = ?, ekp = ?,
           status = 'tamamlandi', production_date = ?
       WHERE id = ?`,
      { replacements: [actual_qty, service_cost, totalRawCost, ekp, production_date || new Date(), req.params.id], transaction: t }
    );

    const countRows = await selectQuery<{ cnt: number }>(
      sequelize, "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'mamul'", [], t
    );
    const seq = (countRows[0]?.cnt || 0) + 1;
    const lotNumber = generateLotNumber('sucuk', seq);

    const lotId = await insertQuery(
      sequelize,
      `INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, production_date, status)
       SELECT ?, 'mamul', o.buyer_id, ?, 'paket', ?, ?, ?, 'active'
       FROM orders o WHERE o.id = ?`,
      [lotNumber, actual_qty, ekp, totalCost, production_date || new Date(), productionOrder.order_id],
      t
    );

    await insertQuery(
      sequelize,
      'INSERT INTO production_finished_lots (production_order_id, lot_id, quantity, unit) VALUES (?, ?, ?, ?)',
      [req.params.id, lotId, actual_qty, 'paket'],
      t
    );

    await insertQuery(
      sequelize,
      `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id)
       VALUES (?, 'giris', ?, 'paket', 'production_order', ?)`,
      [lotId, actual_qty, req.params.id],
      t
    );

    await sequelize.query(
      "UPDATE orders SET status = 'tamamlandi' WHERE id = ?",
      { replacements: [productionOrder.order_id], transaction: t }
    );

    await t.commit();

    const vkp     = ekp * 1.38;
    const brutKar = vkp - ekp;
    const marj    = (brutKar / vkp) * 100;

    res.json({
      message:     'Üretim tamamlandı',
      lotNumber,
      actualQty:   actual_qty,
      totalRawCost,
      serviceCost: parseFloat(String(service_cost)),
      totalCost,
      ekp:     parseFloat(ekp.toFixed(4)),
      vkp:     parseFloat(vkp.toFixed(4)),
      brutKar: parseFloat(brutKar.toFixed(4)),
      marj:    parseFloat(marj.toFixed(2)),
    });
  } catch {
    await t.rollback();
    res.status(500).json({ error: 'Üretim tamamlanamadı' });
  }
}

export async function createProductionOrder(req: AuthRequest, res: Response): Promise<void> {
  const { order_id, product_name, expected_qty, rawMaterials } = req.body;

  const t = await sequelize.transaction();
  try {
    const countRows = await selectQuery<{ cnt: number }>(
      sequelize, 'SELECT COUNT(*) as cnt FROM production_orders', [], t
    );
    const seq = (countRows[0]?.cnt || 0) + 1;
    const productionNumber = `URT-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

    const productionOrderId = await insertQuery(
      sequelize,
      `INSERT INTO production_orders (order_id, producer_id, production_number, product_name, expected_qty, status)
       VALUES (?, ?, ?, ?, ?, 'uretimde')`,
      [order_id, req.user!.id, productionNumber, product_name, expected_qty],
      t
    );

    if (rawMaterials && Array.isArray(rawMaterials) && rawMaterials.length > 0) {
      for (const rm of rawMaterials) {
        await insertQuery(
          sequelize,
          `INSERT INTO production_raw_materials (production_order_id, lot_id, material_type, quantity_used, unit, unit_price, total_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [productionOrderId, rm.lot_id, rm.material_type, rm.quantity, rm.unit, rm.unit_price, rm.quantity * rm.unit_price],
          t
        );
      }
    } else if (order_id) {
      // Siparişteki hammaddeleri otomatik olarak üretim emrine aktar
      await sequelize.query(
        `INSERT INTO production_raw_materials (production_order_id, lot_id, material_type, quantity_used, unit, unit_price, total_cost)
         SELECT ?, lot_id, material_type, quantity, unit, unit_price, total_cost
         FROM order_raw_materials
         WHERE order_id = ?`,
        { replacements: [productionOrderId, order_id], transaction: t }
      );
    }

    if (order_id) {
      await sequelize.query(
        "UPDATE orders SET status = 'uretimde' WHERE id = ?",
        { replacements: [order_id], transaction: t }
      );
    }

    await t.commit();
    res.status(201).json({ message: 'Üretim emri oluşturuldu', productionOrderId, productionNumber });
  } catch {
    await t.rollback();
    res.status(500).json({ error: 'Üretim emri oluşturulamadı' });
  }
}

export async function getProductionOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orders = await selectQuery(
      sequelize,
      `SELECT po.*, o.buyer_id, u.name as buyer_name
       FROM production_orders po
       JOIN orders o ON po.order_id = o.id
       JOIN users u ON o.buyer_id = u.id
       WHERE po.producer_id = ?
       ORDER BY po.created_at DESC`,
      [req.user!.id]
    );
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Üretim emirleri alınamadı' });
  }
}

export async function getProductionById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orders = await selectQuery(
      sequelize,
      'SELECT * FROM production_orders WHERE id = ? AND producer_id = ?',
      [req.params.id, req.user!.id]
    );

    if (orders.length === 0) {
      res.status(404).json({ error: 'Üretim emri bulunamadı' });
      return;
    }

    const rawMaterials = await selectQuery(
      sequelize,
      'SELECT prm.*, l.lot_number FROM production_raw_materials prm JOIN lots l ON prm.lot_id = l.id WHERE prm.production_order_id = ?',
      [req.params.id]
    );
    const finishedLots = await selectQuery(
      sequelize,
      'SELECT pfl.*, l.lot_number FROM production_finished_lots pfl JOIN lots l ON pfl.lot_id = l.id WHERE pfl.production_order_id = ?',
      [req.params.id]
    );

    res.json({ productionOrder: orders[0], rawMaterials, finishedLots });
  } catch {
    res.status(500).json({ error: 'Üretim emri detayı alınamadı' });
  }
}
