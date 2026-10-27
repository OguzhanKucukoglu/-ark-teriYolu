import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

export async function initiateRecall(req: AuthRequest, res: Response): Promise<void> {
  const lotId = req.body.lotId ?? req.body.lot_id;
  const { reason } = req.body;

  if (!lotId || !reason) {
    res.status(400).json({ error: 'lotId ve reason zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const lots = await selectQuery<{ id: number; quantity: number; unit: string; owner_id: number }>(
      sequelize,
      'SELECT * FROM lots WHERE id = ? AND owner_id = ?',
      [lotId, req.user!.id],
      t
    );

    if (lots.length === 0) {
      await t.rollback();
      res.status(404).json({ error: 'Lot bulunamadı veya yetkiniz yok' });
      return;
    }

    const recallId = await insertQuery(
      sequelize,
      "INSERT INTO recalls (initiated_by, lot_id, reason, status) VALUES (?, ?, ?, 'aktif')",
      [req.user!.id, lotId, reason],
      t
    );

    // Hem doğrudan bu lotun satışlarını hem de bu hammadde lotundan üretilen mamul lotlarının satışlarını bul
    const purchases = await selectQuery<{ id: number; market_id: number; quantity: number; unit: string; lot_id: number }>(
      sequelize,
      `SELECT DISTINCT mp.id, mp.market_id, mp.quantity, mp.unit, mp.lot_id
       FROM market_purchases mp
       WHERE mp.lot_id = ?
          OR mp.lot_id IN (
            SELECT pfl.lot_id
            FROM production_finished_lots pfl
            JOIN production_raw_materials prm ON pfl.production_order_id = prm.production_order_id
            WHERE prm.lot_id = ?
          )`,
      [lotId, lotId],
      t
    );

    for (const purchase of purchases) {
      await insertQuery(
        sequelize,
        `INSERT INTO recall_affected_markets (recall_id, market_id, purchase_id, quantity, unit, status, notified_at)
         VALUES (?, ?, ?, ?, ?, 'bildirildi', NOW())`,
        [recallId, purchase.market_id, purchase.id, purchase.quantity, purchase.unit],
        t
      );
    }

    // Etkilenen mamul lotlarını da bul ve bloke/recalled yap
    const affectedFinishedLots = await selectQuery<{ lot_id: number }>(
      sequelize,
      `SELECT DISTINCT pfl.lot_id
       FROM production_finished_lots pfl
       JOIN production_raw_materials prm ON pfl.production_order_id = prm.production_order_id
       WHERE prm.lot_id = ?`,
      [lotId],
      t
    );

    const allAffectedLotIds = [Number(lotId), ...affectedFinishedLots.map(f => f.lot_id)];

    for (const affectedLotId of allAffectedLotIds) {
      await sequelize.query(
        "UPDATE lots SET status = 'recalled' WHERE id = ?",
        { replacements: [affectedLotId], transaction: t }
      );

      await sequelize.query(
        'UPDATE farmer_listings SET is_active = 0 WHERE lot_id = ?',
        { replacements: [affectedLotId], transaction: t }
      );

      await insertQuery(
        sequelize,
        `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, from_user_id, notes)
         SELECT id, 'bloke', quantity, unit, 'recall', ?, owner_id, ? FROM lots WHERE id = ?`,
        [recallId, reason, affectedLotId],
        t
      );
    }

    await sequelize.query(
      'UPDATE recalls SET affected_count = ? WHERE id = ?',
      { replacements: [purchases.length, recallId], transaction: t }
    );

    await t.commit();

    res.status(201).json({
      message: 'Geri çağırma başlatıldı',
      recallId,
      affectedMarkets: purchases.length,
      lotBlocked: true,
    });
  } catch {
    await t.rollback();
    res.status(500).json({ error: 'Geri çağırma başlatılamadı' });
  }
}

export async function getRecalls(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recalls = await selectQuery(
      sequelize,
      `SELECT r.*, l.lot_number, u.name as initiated_by_name
       FROM recalls r
       JOIN lots l ON r.lot_id = l.id
       JOIN users u ON r.initiated_by = u.id
       WHERE r.initiated_by = ? OR l.owner_id = ?
       ORDER BY r.created_at DESC`,
      [req.user!.id, req.user!.id]
    );
    res.json(recalls);
  } catch {
    res.status(500).json({ error: 'Geri çağırmalar alınamadı' });
  }
}

export async function getRecallById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recalls = await selectQuery(
      sequelize,
      `SELECT r.*, l.lot_number, u.name as initiated_by_name
       FROM recalls r
       JOIN lots l ON r.lot_id = l.id
       JOIN users u ON r.initiated_by = u.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (recalls.length === 0) {
      res.status(404).json({ error: 'Geri çağırma bulunamadı' });
      return;
    }

    const affectedMarkets = await selectQuery(
      sequelize,
      `SELECT ram.*, u.name as market_name, u.phone as market_phone, u.address as market_address
       FROM recall_affected_markets ram
       JOIN users u ON ram.market_id = u.id
       WHERE ram.recall_id = ?`,
      [req.params.id]
    );

    res.json({ recall: recalls[0], affectedMarkets });
  } catch {
    res.status(500).json({ error: 'Geri çağırma detayı alınamadı' });
  }
}

export async function completeRecall(req: AuthRequest, res: Response): Promise<void> {
  try {
    await sequelize.query(
      "UPDATE recalls SET status = 'tamamlandi' WHERE id = ? AND initiated_by = ?",
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'Geri çağırma tamamlandı' });
  } catch {
    res.status(500).json({ error: 'Geri çağırma güncellenemedi' });
  }
}
