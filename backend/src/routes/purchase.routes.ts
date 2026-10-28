import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

router.post('/', authorize('market'), async (req: AuthRequest, res) => {
  const { farmer_id, listing_id, lot_id, quantity, unit, unit_price } = req.body;

  const t = await sequelize.transaction();
  try {
    const lots = await selectQuery<{ id: number; status: string; quantity: number; lot_number: string }>(
      sequelize,
      "SELECT id, status, quantity, lot_number FROM lots WHERE id = ? AND status = 'active'",
      [lot_id],
      t
    );

    if (lots.length === 0) {
      await t.rollback();
      res.status(400).json({ error: 'Bu lot aktif değil veya geri çekilmiş' });
      return;
    }

    const totalPrice = quantity * unit_price;

    const purchaseId = await insertQuery(
      sequelize,
      `INSERT INTO market_purchases (market_id, farmer_id, listing_id, lot_id, quantity, unit, unit_price, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'teslim_alindi')`,
      [req.user!.id, farmer_id, listing_id, lot_id, quantity, unit, unit_price, totalPrice],
      t
    );

    // İlan miktarını düşür, miktar bittiyse ilanı pasife al
    await sequelize.query(
      `UPDATE farmer_listings
       SET quantity = GREATEST(0, quantity - ?),
           is_active = CASE WHEN quantity - ? <= 0 THEN 0 ELSE is_active END,
           updated_at = NOW()
       WHERE id = ?`,
      { replacements: [quantity, quantity, listing_id], transaction: t }
    );

    // Lot miktarını düşür
    await sequelize.query(
      `UPDATE lots
       SET quantity = GREATEST(0, quantity - ?),
           updated_at = NOW()
       WHERE id = ?`,
      { replacements: [quantity, lot_id], transaction: t }
    );

    await insertQuery(
      sequelize,
      `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, from_user_id, to_user_id)
       VALUES (?, 'satis', ?, ?, 'market_purchase', ?, ?, ?)`,
      [lot_id, quantity, unit, purchaseId, farmer_id, req.user!.id],
      t
    );

    await insertQuery(
      sequelize,
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES (?, 'satis', 'Yeni Satış', 'Ürününüz satın alındı.', 'market_purchase', ?)`,
      [farmer_id, purchaseId],
      t
    );

    // Satış Faturası oluştur (Hayvancı -> Market)
    const invCount = await selectQuery<{ cnt: number }>(
      sequelize, "SELECT COUNT(*) as cnt FROM invoices WHERE invoice_type = 'satis'", [], t
    );
    const invSeq = (invCount[0]?.cnt || 0) + 1;
    const invoiceNumber = `FTR-SAT-${new Date().getFullYear()}-${String(invSeq).padStart(3, '0')}`;
    const lotNumber = lots[0]?.lot_number || 'LOT';

    const listings = await selectQuery<{ title: string }>(
      sequelize, 'SELECT title FROM farmer_listings WHERE id = ?', [listing_id], t
    );
    const productName = listings[0]?.title || 'Narin Sucuk 1kg';

    await insertQuery(
      sequelize,
      `INSERT INTO invoices 
       (invoice_number, invoice_type, sender_id, receiver_id, reference_type, reference_id, lot_number, product_name, description, quantity, unit, unit_price, subtotal, tax_rate, tax_amount, total_amount, currency, status, invoice_date)
       VALUES (?, 'satis', ?, ?, 'market_purchase', ?, ?, ?, 'Toptan mamul sucuk satışı faturası.', ?, ?, ?, ?, 0.00, 0.00, ?, '€', 'odendi', NOW())`,
      [invoiceNumber, farmer_id, req.user!.id, purchaseId, lotNumber, productName, quantity, unit, unit_price, totalPrice, totalPrice],
      t
    );

    await t.commit();
    res.status(201).json({ message: 'Satın alma kaydedildi', purchaseId });
  } catch {
    await t.rollback();
    res.status(500).json({ error: 'Satın alma kaydedilemedi' });
  }
});

router.get('/complaints', authorize('hayvanci'), async (req: AuthRequest, res) => {
  try {
    const complaints = await selectQuery(
      sequelize,
      `SELECT n.id, n.title, n.message, n.reference_id as lot_id, n.is_read, n.created_at,
              l.lot_number, l.status as lot_status, l.quantity as lot_quantity, l.unit as lot_unit
       FROM notifications n
       JOIN lots l ON n.reference_id = l.id
       WHERE n.user_id = ? AND n.type = 'kalite_sorunu'
       ORDER BY n.created_at DESC`,
      [req.user!.id]
    );
    res.json(complaints);
  } catch {
    res.status(500).json({ error: 'Sorun bildirimleri alınamadı' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    const condition = role === 'market' ? 'mp.market_id = ?' : 'mp.farmer_id = ?';

    const purchases = await selectQuery(
      sequelize,
      `SELECT mp.*, mu.name as market_name, mu.phone as market_phone, mu.address as market_address,
              fu.name as farmer_name, fu.phone as farmer_phone,
              l.lot_number, l.status as lot_status, fl.product_name,
              (SELECT COUNT(*) FROM notifications n WHERE n.reference_type = 'lot' AND n.reference_id = mp.lot_id AND n.type = 'kalite_sorunu') as complaint_count,
              (SELECT n.message FROM notifications n WHERE n.reference_type = 'lot' AND n.reference_id = mp.lot_id AND n.type = 'kalite_sorunu' ORDER BY n.id DESC LIMIT 1) as latest_complaint
       FROM market_purchases mp
       JOIN users mu ON mp.market_id = mu.id
       JOIN users fu ON mp.farmer_id = fu.id
       JOIN lots l ON mp.lot_id = l.id
       LEFT JOIN farmer_listings fl ON mp.listing_id = fl.id
       WHERE ${condition}
       ORDER BY mp.purchase_date DESC`,
      [req.user!.id]
    );
    res.json(purchases);
  } catch {
    res.status(500).json({ error: 'Satın almalar alınamadı' });
  }
});

router.post('/feedback', authorize('market'), async (req: AuthRequest, res) => {
  const { lot_number, issue_description, issue, farmer_id, lot_id } = req.body;
  const description = issue_description || issue;

  if (!lot_number || !description) {
    res.status(400).json({ error: 'Lot numarası ve sorun açıklaması gereklidir' });
    return;
  }

  try {
    const lots = await selectQuery<{ id: number; owner_id: number; lot_number: string }>(
      sequelize,
      'SELECT id, owner_id, lot_number FROM lots WHERE lot_number = ?',
      [lot_number]
    );

    if (lots.length === 0) {
      res.status(404).json({ error: 'Lot bulunamadı' });
      return;
    }

    const lot = lots[0];

    // Bildirimin gideceği hayvancı (üretici/işletme sahibi)
    let recipientId = farmer_id || lot.owner_id;
    if (!recipientId) {
      const purchases = await selectQuery<{ farmer_id: number }>(
        sequelize,
        'SELECT farmer_id FROM market_purchases WHERE market_id = ? AND lot_id = ? ORDER BY id DESC LIMIT 1',
        [req.user!.id, lot.id]
      );
      recipientId = purchases[0]?.farmer_id || lot.owner_id;
    }

    const userRows = await selectQuery<{ name: string }>(
      sequelize,
      'SELECT name FROM users WHERE id = ?',
      [req.user!.id]
    );
    const marketName = userRows[0]?.name || req.user?.email || 'Market';

    await insertQuery(
      sequelize,
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES (?, 'kalite_sorunu', ?, ?, 'lot', ?)`,
      [
        recipientId,
        `⚠️ Lot Kalite Bildirimi (${lot.lot_number})`,
        `"${marketName}" marketi, "${lot.lot_number}" numaralı lot için sorun bildirdi: "${description}".`,
        lot.id,
      ]
    );

    res.json({
      message: 'Geri bildirim başarıyla iletildi',
      lotId: lot.id,
      lotNumber: lot.lot_number,
      recipientId,
    });
  } catch {
    res.status(500).json({ error: 'Geri bildirim gönderilemedi' });
  }
});

export default router;
