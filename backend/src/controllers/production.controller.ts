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

    // Toplam hammadde girdi miktarını (kg) ve toplam hammadde maliyetini hesapla
    const rawMaterialsSum = await selectQuery<{ total_kg: string; total_cost: string }>(
      sequelize,
      'SELECT COALESCE(SUM(quantity_used), 0) as total_kg, COALESCE(SUM(total_cost), 0) as total_cost FROM production_raw_materials WHERE production_order_id = ?',
      [req.params.id],
      t
    );

    const totalInputKg = parseFloat(rawMaterialsSum[0]?.total_kg || '0');
    const totalRawCost = parseFloat(rawMaterialsSum[0]?.total_cost || '0');
    const packageWeight = 1.00; // Standart 1.00 kg/paket
    const actualPackages = parseInt(String(actual_qty), 10) || Math.floor(Number(actual_qty));
    const netPackagedKg = actualPackages * packageWeight;
    const fireQty = Math.max(0, parseFloat((totalInputKg - netPackagedKg).toFixed(3)));
    const fireRate = totalInputKg > 0 ? parseFloat(((fireQty / totalInputKg) * 100).toFixed(2)) : 0.00;

    const totalCost = totalRawCost + parseFloat(String(service_cost));
    const ekp = actualPackages > 0 ? totalCost / actualPackages : 0;

    await sequelize.query(
      `UPDATE production_orders
       SET actual_qty = ?, package_weight = ?, total_input_kg = ?, fire_qty = ?, fire_rate = ?,
           service_cost = ?, total_raw_cost = ?, ekp = ?,
           status = 'tamamlandi', production_date = ?
       WHERE id = ?`,
      { replacements: [actualPackages, packageWeight, totalInputKg, fireQty, fireRate, service_cost, totalRawCost, ekp, production_date || new Date(), req.params.id], transaction: t }
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
      [lotNumber, actualPackages, ekp, totalCost, production_date || new Date(), productionOrder.order_id],
      t
    );

    await insertQuery(
      sequelize,
      'INSERT INTO production_finished_lots (production_order_id, lot_id, quantity, unit) VALUES (?, ?, ?, ?)',
      [req.params.id, lotId, actualPackages, 'paket'],
      t
    );

    await insertQuery(
      sequelize,
      `INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id)
       VALUES (?, 'giris', ?, 'paket', 'production_order', ?)`,
      [lotId, actualPackages, req.params.id],
      t
    );

    await sequelize.query(
      "UPDATE orders SET status = 'tamamlandi' WHERE id = ?",
      { replacements: [productionOrder.order_id], transaction: t }
    );

    // Fason Üretim / İşçilik Hizmeti Faturası oluştur (Sucukçu -> İşletme / Hayvancı)
    const invCount = await selectQuery<{ cnt: number }>(
      sequelize, "SELECT COUNT(*) as cnt FROM invoices WHERE invoice_type = 'hizmet'", [], t
    );
    const invSeq = (invCount[0]?.cnt || 0) + 1;
    const invoiceNumber = `FTR-HZM-${new Date().getFullYear()}-${String(invSeq).padStart(3, '0')}`;
    const unitServiceCost = actualPackages > 0 ? parseFloat((Number(service_cost) / actualPackages).toFixed(4)) : Number(service_cost);

    await sequelize.query(
      `INSERT INTO invoices 
       (invoice_number, invoice_type, sender_id, receiver_id, reference_type, reference_id, lot_number, product_name, description, quantity, unit, unit_price, subtotal, tax_rate, tax_amount, total_amount, currency, status, invoice_date)
       SELECT ?, 'hizmet', ?, o.buyer_id, 'production_order', ?, ?, CONCAT(?, ' - Fason Üretim / İşçilik Hizmeti'),
              'Hammaddeler işletmeye aittir; hizmet bedeli fason işçilik faturasıdır.',
              ?, 'paket', ?, ?, 0.00, 0.00, ?, '€', 'odendi', ?
       FROM orders o WHERE o.id = ?`,
      {
        replacements: [
          invoiceNumber,
          req.user!.id,
          req.params.id,
          lotNumber,
          productionOrder.product_name,
          actualPackages,
          unitServiceCost,
          service_cost,
          service_cost,
          production_date || new Date(),
          productionOrder.order_id
        ],
        transaction: t
      }
    );

    await t.commit();

    const vkp     = ekp * 1.38;
    const brutKar = vkp - ekp;
    const marj    = (brutKar / vkp) * 100;

    res.json({
      message:     'Üretim tamamlandı',
      lotNumber,
      actualQty:   actualPackages,
      packageWeight,
      totalInputKg,
      fireQty,
      fireRate,
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
