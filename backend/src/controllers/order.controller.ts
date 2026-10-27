import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const { seller_id, listing_id, expected_qty, notes, rawMaterials } = req.body;

  if (!seller_id || !listing_id || !expected_qty) {
    res.status(400).json({ error: 'seller_id, listing_id ve expected_qty zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const orderId = await insertQuery(
      sequelize,
      'INSERT INTO orders (buyer_id, seller_id, listing_id, expected_qty, notes) VALUES (?, ?, ?, ?, ?)',
      [req.user!.id, seller_id, listing_id, expected_qty, notes || null],
      t
    );

    if (rawMaterials && Array.isArray(rawMaterials)) {
      for (const rm of rawMaterials) {
        await insertQuery(
          sequelize,
          `INSERT INTO order_raw_materials (order_id, lot_id, material_type, quantity, unit, unit_price, total_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, rm.lot_id, rm.material_type, rm.quantity, rm.unit, rm.unit_price || 0, rm.quantity * (rm.unit_price || 0)],
          t
        );
      }
    }

    await insertQuery(
      sequelize,
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES (?, 'siparis', 'Yeni Sipariş', 'Yeni bir sipariş aldınız.', 'order', ?)`,
      [seller_id, orderId],
      t
    );

    await t.commit();
    res.status(201).json({ message: 'Sipariş oluşturuldu', orderId });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Sipariş oluşturulamadı' });
  }
}

export async function getOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;

    const condition = role === 'hayvanci' ? 'o.buyer_id = ?' : 'o.seller_id = ?';

    const orders = await selectQuery(
      sequelize,
      `SELECT o.*, bu.name as buyer_name, su.name as seller_name,
              su.phone as seller_phone, su.address as seller_address,
              pl.product_name
       FROM orders o
       JOIN users bu ON o.buyer_id  = bu.id
       JOIN users su ON o.seller_id = su.id
       JOIN producer_listings pl ON o.listing_id = pl.id
       WHERE ${condition}
       ORDER BY o.order_date DESC`,
      [userId]
    );
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Siparişler alınamadı' });
  }
}

export async function getOrderById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orders = await selectQuery(
      sequelize,
      `SELECT o.*, bu.name as buyer_name, su.name as seller_name,
              su.phone as seller_phone, su.address as seller_address,
              pl.product_name
       FROM orders o
       JOIN users bu ON o.buyer_id  = bu.id
       JOIN users su ON o.seller_id = su.id
       JOIN producer_listings pl ON o.listing_id = pl.id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (orders.length === 0) {
      res.status(404).json({ error: 'Sipariş bulunamadı' });
      return;
    }

    const rawMaterials = await selectQuery(
      sequelize,
      `SELECT orm.*, l.lot_number
       FROM order_raw_materials orm
       JOIN lots l ON orm.lot_id = l.id
       WHERE orm.order_id = ?`,
      [req.params.id]
    );

    res.json({ order: orders[0], rawMaterials });
  } catch {
    res.status(500).json({ error: 'Sipariş detayı alınamadı' });
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = req.body;
  const validStatuses = ['onaylandi', 'hammadde_gonderildi', 'uretimde', 'tamamlandi', 'iptal'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Geçersiz durum' });
    return;
  }

  // Sadece sucukçu kendi siparişini onaylayabilir / iptal edebilir
  // Hayvancı sadece 'hammadde_gonderildi' yapabilir
  const t = await sequelize.transaction();
  try {
    const orders = await selectQuery<{
      id: number; buyer_id: number; seller_id: number; status: string;
    }>(
      sequelize,
      'SELECT id, buyer_id, seller_id, status FROM orders WHERE id = ?',
      [req.params.id],
      t
    );

    if (orders.length === 0) {
      await t.rollback();
      res.status(404).json({ error: 'Sipariş bulunamadı' });
      return;
    }

    const order = orders[0];

    // Sipariş onaylanınca hayvancının stoğundan hammaddeler düşülür
    if (status === 'onaylandi' && order.status === 'beklemede') {
      const rawMaterials = await selectQuery<{
        lot_id: number; material_type: string; quantity: number; unit: string;
      }>(
        sequelize,
        'SELECT lot_id, material_type, quantity, unit FROM order_raw_materials WHERE order_id = ?',
        [req.params.id],
        t
      );

      for (const rm of rawMaterials) {
        // Lot miktarını düş
        await sequelize.query(
          'UPDATE lots SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          { replacements: [rm.quantity, rm.lot_id, rm.quantity], transaction: t }
        );

        // raw_materials tablosunu da güncelle
        await sequelize.query(
          'UPDATE raw_materials SET quantity = quantity - ? WHERE lot_id = ?',
          { replacements: [rm.quantity, rm.lot_id], transaction: t }
        );

        // Lot hareketi kaydet (çıkış)
        await insertQuery(
          sequelize,
          `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, from_user_id, to_user_id)
           VALUES (?, 'sevk', ?, ?, 'order', ?, ?, ?)`,
          [rm.lot_id, rm.quantity, rm.unit, req.params.id, order.buyer_id, order.seller_id],
          t
        );
      }

      // Hayvancıya bildirim
      await insertQuery(
        sequelize,
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
         VALUES (?, 'siparis', 'Siparişiniz Onaylandı', 'Sucukçu siparişinizi onayladı. Hammaddeler stoğunuzdan düşüldü.', 'order', ?)`,
        [order.buyer_id, req.params.id],
        t
      );
    }

    await sequelize.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      { replacements: [status, req.params.id], transaction: t }
    );

    await t.commit();
    res.json({ message: 'Sipariş durumu güncellendi' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Sipariş güncellenemedi' });
  }
}
