import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { selectQuery } from '../utils/dbHelpers';

export async function getLots(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lots = await selectQuery(
      sequelize,
      `SELECT l.*, u.name as owner_name
       FROM lots l
       JOIN users u ON l.owner_id = u.id
       WHERE l.owner_id = ?
       ORDER BY l.created_at DESC`,
      [req.user!.id]
    );
    res.json(lots);
  } catch {
    res.status(500).json({ error: 'Lotlar alınamadı' });
  }
}

export async function getLotById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lots = await selectQuery(
      sequelize,
      `SELECT l.*, u.name as owner_name
       FROM lots l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = ?`,
      [req.params.id]
    );

    if (lots.length === 0) {
      res.status(404).json({ error: 'Lot bulunamadı' });
      return;
    }
    res.json(lots[0]);
  } catch {
    res.status(500).json({ error: 'Lot bilgisi alınamadı' });
  }
}

export async function getLotMovements(req: AuthRequest, res: Response): Promise<void> {
  try {
    const movements = await selectQuery(
      sequelize,
      `SELECT lm.*,
              fu.name as from_user_name,
              tu.name as to_user_name
       FROM lot_movements lm
       LEFT JOIN users fu ON lm.from_user_id = fu.id
       LEFT JOIN users tu ON lm.to_user_id = tu.id
       WHERE lm.lot_id = ?
       ORDER BY lm.created_at ASC`,
      [req.params.id]
    );
    res.json(movements);
  } catch {
    res.status(500).json({ error: 'Lot hareketleri alınamadı' });
  }
}

export async function traceForward(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lotId = req.params.id;

    const lots = await selectQuery(sequelize, 'SELECT * FROM lots WHERE id = ?', [lotId]);
    if (lots.length === 0) {
      res.status(404).json({ error: 'Lot bulunamadı' });
      return;
    }

    const productionOrders = await selectQuery(
      sequelize,
      `SELECT po.*, prm.quantity_used
       FROM production_orders po
       JOIN production_raw_materials prm ON po.id = prm.production_order_id
       WHERE prm.lot_id = ?`,
      [lotId]
    );

    const finishedLots = await selectQuery(
      sequelize,
      `SELECT l.*, pfl.production_order_id
       FROM lots l
       JOIN production_finished_lots pfl ON l.id = pfl.lot_id
       JOIN production_raw_materials prm ON pfl.production_order_id = prm.production_order_id
       WHERE prm.lot_id = ?`,
      [lotId]
    );

    const marketSales = await selectQuery(
      sequelize,
      `SELECT DISTINCT mp.*, u.name as market_name, u.address as market_address, u.phone as market_phone, l.lot_number
       FROM market_purchases mp
       JOIN users u ON mp.market_id = u.id
       JOIN lots l ON mp.lot_id = l.id
       LEFT JOIN production_finished_lots pfl ON mp.lot_id = pfl.lot_id
       LEFT JOIN production_raw_materials prm ON pfl.production_order_id = prm.production_order_id
       WHERE prm.lot_id = ? OR mp.lot_id = ?`,
      [lotId, lotId]
    );

    res.json({
      sourceLot:        lots[0],
      productionOrders,
      finishedLots,
      marketSales,
      summary: {
        productionOrderCount: productionOrders.length,
        finishedLotCount:     finishedLots.length,
        affectedMarketCount:  marketSales.length,
      },
    });
  } catch {
    res.status(500).json({ error: 'İleri izleme yapılamadı' });
  }
}

export async function traceBackward(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lotId = req.params.id;

    const lots = await selectQuery(sequelize, 'SELECT * FROM lots WHERE id = ?', [lotId]);
    if (lots.length === 0) {
      res.status(404).json({ error: 'Lot bulunamadı' });
      return;
    }

    const productionOrders = await selectQuery(
      sequelize,
      `SELECT po.*
       FROM production_orders po
       JOIN production_finished_lots pfl ON po.id = pfl.production_order_id
       WHERE pfl.lot_id = ?`,
      [lotId]
    );

    const rawMaterialLots = await selectQuery<{ supplier_name: string }>(
      sequelize,
      `SELECT l.*, prm.quantity_used, prm.material_type, prm.unit_price, prm.total_cost
       FROM lots l
       JOIN production_raw_materials prm ON l.id = prm.lot_id
       JOIN production_finished_lots pfl ON prm.production_order_id = pfl.production_order_id
       WHERE pfl.lot_id = ?`,
      [lotId]
    );

    res.json({
      finishedLot:      lots[0],
      productionOrders,
      rawMaterialLots,
      summary: {
        productionOrderCount: productionOrders.length,
        rawMaterialLotCount:  rawMaterialLots.length,
        suppliers: [...new Set(rawMaterialLots.map(r => r.supplier_name).filter(Boolean))],
      },
    });
  } catch {
    res.status(500).json({ error: 'Geri izleme yapılamadı' });
  }
}
