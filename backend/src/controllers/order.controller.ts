import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';
import { generateLotNumber } from '../utils/lotNumberGenerator';

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const { seller_id, listing_id, expected_qty, notes, rawMaterials } = req.body;

  if (!listing_id || !expected_qty) {
    res.status(400).json({ error: 'listing_id ve expected_qty zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    // 1. İlanı doğrula ve seller_id'yi ilandan al (tutarsızlıkları önle)
    const listings = await selectQuery<{ id: number; producer_id: number; product_name: string }>(
      sequelize,
      'SELECT id, producer_id, product_name FROM producer_listings WHERE id = ?',
      [listing_id],
      t
    );

    if (listings.length === 0) {
      await t.rollback();
      res.status(404).json({ error: 'İlan bulunamadı' });
      return;
    }

    const finalSellerId = listings[0].producer_id || seller_id;

    // 2. Siparişi oluştur
    const orderId = await insertQuery(
      sequelize,
      'INSERT INTO orders (buyer_id, seller_id, listing_id, expected_qty, notes) VALUES (?, ?, ?, ?, ?)',
      [req.user!.id, finalSellerId, listing_id, expected_qty, notes || null],
      t
    );

    // 3. Hammaddeleri doğrula ve lot_id'lerini bağla
    if (rawMaterials && Array.isArray(rawMaterials)) {
      for (const rm of rawMaterials) {
        if (!rm.quantity || Number(rm.quantity) <= 0) continue;

        let lotId = rm.lot_id ? parseInt(String(rm.lot_id), 10) : null;
        if (lotId === 0 || isNaN(lotId as number)) {
          lotId = null;
        }

        // Verilen lotId geçerli bir lot mu?
        if (lotId) {
          const lotExists = await selectQuery<{ id: number }>(
            sequelize,
            'SELECT id FROM lots WHERE id = ?',
            [lotId],
            t
          );
          if (lotExists.length === 0) {
            lotId = null;
          }
        }

        // Eğer lotId yoksa, alıcının (hayvancının) bu isimdeki hammaddelerinden lot bul
        if (!lotId) {
          const cleanMatName = (rm.material_type || '').split('-').pop()?.trim().toLowerCase() || '';
          const userMat = await selectQuery<{ lot_id: number; unit_price: number }>(
            sequelize,
            `SELECT rm.lot_id, rm.unit_price FROM raw_materials rm 
             WHERE rm.owner_id = ? AND LOWER(rm.material_type) LIKE ? AND rm.lot_id IS NOT NULL 
             LIMIT 1`,
            [req.user!.id, `%${cleanMatName}%`],
            t
          );
          if (userMat.length > 0 && userMat[0].lot_id) {
            lotId = userMat[0].lot_id;
            if (!rm.unit_price) rm.unit_price = userMat[0].unit_price;
          }
        }

        // Hala lot yoksa, bu hammadde için otomatik aktif bir lot oluştur (zincir bozulmaz)
        if (!lotId) {
          const countRows = await selectQuery<{ cnt: number }>(
            sequelize,
            "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'hammadde'",
            [],
            t
          );
          const seq = (countRows[0]?.cnt || 0) + 1;
          const lotNumber = generateLotNumber('hammadde', seq);

          lotId = await insertQuery(
            sequelize,
            `INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, status)
             VALUES (?, 'hammadde', ?, ?, ?, ?, ?, 'active')`,
            [
              lotNumber,
              req.user!.id,
              Number(rm.quantity),
              rm.unit || 'kg',
              Number(rm.unit_price || 0),
              Number(rm.quantity) * Number(rm.unit_price || 0),
            ],
            t
          );
        }

        // order_raw_materials tablosuna ekle
        await insertQuery(
          sequelize,
          `INSERT INTO order_raw_materials (order_id, lot_id, material_type, quantity, unit, unit_price, total_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            lotId,
            rm.material_type,
            Number(rm.quantity),
            rm.unit || 'kg',
            Number(rm.unit_price || 0),
            Number(rm.quantity) * Number(rm.unit_price || 0),
          ],
          t
        );
      }
    }

    // 4. Sucukçuya bildirim gönder
    await insertQuery(
      sequelize,
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES (?, 'siparis', 'Yeni Sipariş', 'Yeni bir sipariş aldınız.', 'order', ?)`,
      [finalSellerId, orderId],
      t
    );

    await t.commit();
    res.status(201).json({ message: 'Sipariş oluşturuldu', orderId });
  } catch (err) {
    await t.rollback();
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('CREATE_ORDER_FAILED:', errMsg);
    res.status(500).json({ error: 'Sipariş oluşturulamadı', detail: errMsg });
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

  const t = await sequelize.transaction();
  try {
    const orders = await selectQuery<{
      id: number;
      buyer_id: number;
      seller_id: number;
      status: string;
      expected_qty: number;
      product_name: string;
    }>(
      sequelize,
      `SELECT o.id, o.buyer_id, o.seller_id, o.expected_qty, o.status, pl.product_name 
       FROM orders o 
       LEFT JOIN producer_listings pl ON o.listing_id = pl.id 
       WHERE o.id = ?`,
      [req.params.id],
      t
    );

    if (orders.length === 0) {
      await t.rollback();
      res.status(404).json({ error: 'Sipariş bulunamadı' });
      return;
    }

    const order = orders[0];

    // Sadece ilgili taraflar güncelleyebilir
    if (req.user!.role === 'hayvanci' && order.buyer_id !== req.user!.id) {
      await t.rollback();
      res.status(403).json({ error: 'Bu siparişi güncelleme yetkiniz yok' });
      return;
    }
    if (req.user!.role === 'sucukcu' && order.seller_id !== req.user!.id) {
      await t.rollback();
      res.status(403).json({ error: 'Bu siparişi güncelleme yetkiniz yok' });
      return;
    }

    let targetStatus = status;

    // Onaylandığında veya hammadde gönderildiğinde stok hareketlerini kaydet ve doğrudan üretime al
    if (status === 'onaylandi') {
      const rawMaterials = await selectQuery<{
        lot_id: number; quantity: number; unit: string; material_type: string;
      }>(
        sequelize,
        'SELECT lot_id, quantity, unit, material_type FROM order_raw_materials WHERE order_id = ?',
        [req.params.id],
        t
      );

      for (const rm of rawMaterials) {
        if (!rm.lot_id) continue;
        await insertQuery(
          sequelize,
          `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, from_user_id, to_user_id)
           VALUES (?, 'cikis', ?, ?, 'order', ?, ?, ?)`,
          [rm.lot_id, rm.quantity, rm.unit, req.params.id, order.buyer_id, order.seller_id],
          t
        );

        // Lot miktarını güncelle
        await sequelize.query(
          'UPDATE lots SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
          { replacements: [rm.quantity, rm.lot_id], transaction: t }
        );
      }

      // Doğrudan Üretim Emri (URT-YYYY-XXX) oluştur
      const existingProd = await selectQuery<{ id: number }>(
        sequelize,
        'SELECT id FROM production_orders WHERE order_id = ?',
        [req.params.id],
        t
      );

      if (existingProd.length === 0) {
        const countRows = await selectQuery<{ cnt: number }>(
          sequelize, 'SELECT COUNT(*) as cnt FROM production_orders', [], t
        );
        const seq = (countRows[0]?.cnt || 0) + 1;
        const productionNumber = `URT-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

        const productName = order.product_name || 'Sucuk';
        const expectedQty = Number(order.expected_qty) || 1;

        const productionOrderId = await insertQuery(
          sequelize,
          `INSERT INTO production_orders (order_id, producer_id, production_number, product_name, expected_qty, status)
           VALUES (?, ?, ?, ?, ?, 'uretimde')`,
          [order.id, order.seller_id, productionNumber, productName, expectedQty],
          t
        );

        // Siparişteki hammaddeleri üretim emrine aktar
        await sequelize.query(
          `INSERT INTO production_raw_materials (production_order_id, lot_id, material_type, quantity_used, unit, unit_price, total_cost)
           SELECT ?, lot_id, material_type, quantity, unit, unit_price, total_cost
           FROM order_raw_materials
           WHERE order_id = ?`,
          { replacements: [productionOrderId, req.params.id], transaction: t }
        );
      }

      targetStatus = 'uretimde';
    }

    // Durumu güncelle
    await sequelize.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      { replacements: [targetStatus, req.params.id], transaction: t }
    );

    await t.commit();
    res.json({ message: 'Sipariş onaylandı ve doğrudan üretime alındı', status: targetStatus });
  } catch (error) {
    console.error('Sipariş durumu güncellenirken hata:', error);
    await t.rollback();
    res.status(500).json({ error: 'Sipariş durumu güncellenemedi' });
  }
}
