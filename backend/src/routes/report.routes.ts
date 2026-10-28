import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

// ── 1. ÖZET KPI VE DASHBOARD RAPORU ───────────────────────────────────────────
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    // Hammadde toplamı
    const rawSummary = await selectQuery<{ total_cost: string; total_items: number }>(
      sequelize,
      `SELECT COALESCE(SUM(total_cost), 0) as total_cost, COUNT(*) as total_items
       FROM raw_materials`,
      []
    );

    // Parçalama özeti
    const butcherySummary = await selectQuery<{
      op_count: number;
      total_input: string;
      total_output: string;
      total_waste: string;
      total_cost: string;
    }>(
      sequelize,
      `SELECT
         COUNT(*) as op_count,
         COALESCE(SUM(input_weight_kg), 0) as total_input,
         COALESCE(SUM(total_output_kg), 0) as total_output,
         COALESCE(SUM(waste_kg), 0) as total_waste,
         COALESCE(SUM(total_cost), 0) as total_cost
       FROM butchery_operations`,
      []
    );

    // Üretim ve EKP özeti
    const prodSummary = await selectQuery<{
      total_orders: number;
      completed_orders: number;
      total_output_qty: string;
      total_service_cost: string;
      total_raw_cost: string;
      avg_ekp: string;
    }>(
      sequelize,
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'tamamlandi' OR status = 'sevk_edildi' THEN 1 ELSE 0 END) as completed_orders,
         COALESCE(SUM(actual_qty), 0) as total_output_qty,
         COALESCE(SUM(service_cost), 0) as total_service_cost,
         COALESCE(SUM(total_raw_cost), 0) as total_raw_cost,
         COALESCE(AVG(ekp), 0) as avg_ekp
       FROM production_orders
       WHERE actual_qty IS NOT NULL`,
      []
    );

    // Satış ve Ciro özeti
    const salesSummary = await selectQuery<{
      sale_count: number;
      total_revenue: string;
      total_sold_qty: string;
    }>(
      sequelize,
      `SELECT
         COUNT(*) as sale_count,
         COALESCE(SUM(total_price), 0) as total_revenue,
         COALESCE(SUM(quantity), 0) as total_sold_qty
       FROM market_purchases`,
      []
    );

    // Lot ve Geri Çağırma özeti
    const lotSummary = await selectQuery<{
      total_lots: number;
      active_lots: number;
      recalled_lots: number;
    }>(
      sequelize,
      `SELECT
         COUNT(*) as total_lots,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_lots,
         SUM(CASE WHEN status = 'recalled' OR status = 'blocked' THEN 1 ELSE 0 END) as recalled_lots
       FROM lots`,
      []
    );

    const inputKg  = parseFloat(butcherySummary[0]?.total_input || '0');
    const wasteKg  = parseFloat(butcherySummary[0]?.total_waste || '0');
    const avgWasteRatio = inputKg > 0 ? (wasteKg / inputKg) * 100 : 0;

    const avgEkp = parseFloat(prodSummary[0]?.avg_ekp || '0');
    const avgVkp = avgEkp * 1.38;
    const avgMargin = avgVkp > 0 ? ((avgVkp - avgEkp) / avgVkp) * 100 : 0;

    res.json({
      rawMaterials: {
        totalCost: parseFloat(rawSummary[0]?.total_cost || '0'),
        itemCount: Number(rawSummary[0]?.total_items || 0),
      },
      butchery: {
        operationCount: Number(butcherySummary[0]?.op_count || 0),
        totalInputKg:   inputKg,
        totalOutputKg:  parseFloat(butcherySummary[0]?.total_output || '0'),
        totalWasteKg:   wasteKg,
        averageWastePercent: parseFloat(avgWasteRatio.toFixed(2)),
        totalCost:      parseFloat(butcherySummary[0]?.total_cost || '0'),
      },
      production: {
        totalOrders:      Number(prodSummary[0]?.total_orders || 0),
        completedOrders:  Number(prodSummary[0]?.completed_orders || 0),
        totalOutputQty:   parseFloat(prodSummary[0]?.total_output_qty || '0'),
        totalServiceCost: parseFloat(prodSummary[0]?.total_service_cost || '0'),
        totalRawCost:     parseFloat(prodSummary[0]?.total_raw_cost || '0'),
        avgEkp:           parseFloat(avgEkp.toFixed(4)),
        avgVkp:           parseFloat(avgVkp.toFixed(4)),
        avgMarginPercent: parseFloat(avgMargin.toFixed(2)),
      },
      sales: {
        saleCount:    Number(salesSummary[0]?.sale_count || 0),
        totalRevenue: parseFloat(salesSummary[0]?.total_revenue || '0'),
        totalSoldQty: parseFloat(salesSummary[0]?.total_sold_qty || '0'),
      },
      lots: {
        totalLots:    Number(lotSummary[0]?.total_lots || 0),
        activeLots:   Number(lotSummary[0]?.active_lots || 0),
        recalledLots: Number(lotSummary[0]?.recalled_lots || 0),
      },
    });
  } catch {
    res.status(500).json({ error: 'Özet rapor alınamadı' });
  }
});

// ── 2. HAMMADDE VE ALIŞ RAPORU ───────────────────────────────────────────────
router.get('/purchases', async (req: AuthRequest, res) => {
  try {
    const rows = await selectQuery(
      sequelize,
      `SELECT
         rm.id,
         rm.material_type,
         rm.quantity,
         rm.unit,
         rm.unit_price,
         rm.total_cost,
         rm.created_at,
         l.lot_number,
         l.supplier_name,
         l.status as lot_status,
         u.name as owner_name
       FROM raw_materials rm
       JOIN lots l ON rm.lot_id = l.id
       JOIN users u ON rm.owner_id = u.id
       ORDER BY rm.created_at DESC`,
      []
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Hammadde raporu alınamadı' });
  }
});

// ── 3. PARÇALAMA VE FİRE DENGE RAPORU (SAPMA HESAPLI) ────────────────────────
router.get('/butchery', async (req: AuthRequest, res) => {
  try {
    const operations = await selectQuery<{
      id: number;
      operator_name: string;
      animal_type: string;
      input_weight_kg: string;
      total_output_kg: string;
      waste_kg: string;
      distribution_method: string;
      total_cost: string;
      operation_date: string;
      created_at: string;
    }>(
      sequelize,
      `SELECT
         bo.id,
         u.name as operator_name,
         bo.animal_type,
         bo.input_weight_kg,
         bo.total_output_kg,
         bo.waste_kg,
         bo.distribution_method,
         bo.total_cost,
         bo.operation_date,
         bo.created_at
       FROM butchery_operations bo
       JOIN users u ON bo.operator_id = u.id
       ORDER BY bo.operation_date DESC, bo.id DESC`,
      []
    );

    // Her operasyon için parçaları getir
    const opIds = operations.map(o => o.id);
    let parts: Array<{
      id: number;
      butchery_operation_id: number;
      part_name: string;
      actual_weight_kg: string;
      allocated_cost: string;
      unit_cost: string;
      is_byproduct: boolean;
      lot_number: string;
    }> = [];

    if (opIds.length > 0) {
      parts = await selectQuery(
        sequelize,
        `SELECT bp.*, l.lot_number
         FROM butchery_parts bp
         LEFT JOIN lots l ON bp.lot_id = l.id
         WHERE bp.butchery_operation_id IN (${opIds.map(() => '?').join(',')})
         ORDER BY bp.id ASC`,
        opIds
      );
    }

    const result = operations.map(op => {
      const inputKg  = parseFloat(op.input_weight_kg || '0');
      const outputKg = parseFloat(op.total_output_kg || '0');
      const wasteKg  = parseFloat(op.waste_kg || '0');
      const wastePercent = inputKg > 0 ? (wasteKg / inputKg) * 100 : 0;
      const opParts = parts.filter(p => p.butchery_operation_id === op.id);

      return {
        ...op,
        input_weight_kg: inputKg,
        total_output_kg: outputKg,
        waste_kg:        wasteKg,
        waste_percent:   parseFloat(wastePercent.toFixed(2)),
        total_cost:      parseFloat(op.total_cost || '0'),
        parts: opParts.map(p => ({
          ...p,
          actual_weight_kg: parseFloat(p.actual_weight_kg || '0'),
          allocated_cost:   parseFloat(p.allocated_cost || '0'),
          unit_cost:        parseFloat(p.unit_cost || '0'),
          ratio_percent:    inputKg > 0 ? parseFloat(((parseFloat(p.actual_weight_kg || '0') / inputKg) * 100).toFixed(2)) : 0,
        })),
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Parçalama raporu alınamadı' });
  }
});

// ── 4. ÜRETİM VE EKP MALİYET RAPORU (TAHMİN VS GERÇEK SAPMA DAHİL) ───────────
router.get('/production', async (req: AuthRequest, res) => {
  try {
    const rows = await selectQuery(
      sequelize,
      `SELECT
         po.id,
         po.production_number,
         po.product_name,
         po.expected_qty,
         po.actual_qty,
         po.package_weight,
         po.total_input_kg,
         po.fire_qty,
         po.fire_rate,
         po.service_cost,
         po.total_raw_cost,
         (COALESCE(po.total_raw_cost, 0) + COALESCE(po.service_cost, 0)) as total_cost,
         po.ekp,
         (po.ekp * 1.38) as vkp,
         ((po.ekp * 1.38) - po.ekp) as brut_kar,
         CASE WHEN po.ekp > 0 THEN (((po.ekp * 1.38 - po.ekp) / (po.ekp * 1.38)) * 100) ELSE 0 END as brut_kar_marji,
         (po.actual_qty - po.expected_qty) as qty_variance,
         CASE WHEN po.expected_qty > 0 THEN ((po.actual_qty - po.expected_qty) / po.expected_qty * 100) ELSE 0 END as qty_variance_percent,
         po.status,
         po.production_date,
         po.created_at,
         pu.name as producer_name,
         bu.name as buyer_name
       FROM production_orders po
       JOIN orders o ON po.order_id = o.id
       JOIN users pu ON po.producer_id = pu.id
       JOIN users bu ON o.buyer_id = bu.id
       ORDER BY po.created_at DESC`,
      []
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Üretim raporu alınamadı' });
  }
});

// ── 5. TÜM LOT HAREKETLERİ DENETİM RAPORU (AUDIT TRAIL) ──────────────────────
router.get('/lot-movements', async (req: AuthRequest, res) => {
  try {
    const rows = await selectQuery(
      sequelize,
      `SELECT
         lm.id,
         lm.movement_type,
         lm.quantity,
         lm.unit,
         lm.reference_type,
         lm.reference_id,
         lm.notes,
         lm.created_at,
         l.lot_number,
         l.lot_type,
         l.status as lot_status,
         fu.name as from_user_name,
         tu.name as to_user_name
       FROM lot_movements lm
       JOIN lots l ON lm.lot_id = l.id
       LEFT JOIN users fu ON lm.from_user_id = fu.id
       LEFT JOIN users tu ON lm.to_user_id = tu.id
       ORDER BY lm.created_at DESC
       LIMIT 500`,
      []
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Lot hareketleri raporu alınamadı' });
  }
});

// ── 6. SATIŞ VE CİRO RAPORU ──────────────────────────────────────────────────
router.get('/sales', async (req: AuthRequest, res) => {
  try {
    const rows = await selectQuery(
      sequelize,
      `SELECT
         mp.id,
         mp.quantity,
         mp.unit,
         mp.unit_price,
         mp.total_price,
         mp.status,
         mp.purchase_date,
         l.lot_number,
         l.lot_type,
         fl.product_name,
         mu.name as market_name,
         mu.phone as market_phone,
         mu.address as market_address,
         fu.name as farmer_name,
         (SELECT COUNT(*) FROM notifications n WHERE n.reference_type = 'lot' AND n.reference_id = mp.lot_id AND n.type = 'kalite_sorunu') as complaint_count
       FROM market_purchases mp
       JOIN users mu ON mp.market_id = mu.id
       JOIN users fu ON mp.farmer_id = fu.id
       JOIN lots l ON mp.lot_id = l.id
       LEFT JOIN farmer_listings fl ON mp.listing_id = fl.id
       ORDER BY mp.purchase_date DESC`,
      []
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Satış raporu alınamadı' });
  }
});

// ── 7. GERİ ÇAĞIRMA (RECALL) RAPORU ──────────────────────────────────────────
router.get('/recalls', async (req: AuthRequest, res) => {
  try {
    const recalls = await selectQuery<{
      id: number;
      lot_id: number;
      lot_number: string;
      reason: string;
      status: string;
      affected_count: number;
      created_at: string;
      initiator_name: string;
    }>(
      sequelize,
      `SELECT
         r.id,
         r.lot_id,
         l.lot_number,
         r.reason,
         r.status,
         r.affected_count,
         r.created_at,
         u.name as initiator_name
       FROM recalls r
       JOIN lots l ON r.lot_id = l.id
       JOIN users u ON r.initiated_by = u.id
       ORDER BY r.created_at DESC`,
      []
    );

    const recallIds = recalls.map(r => r.id);
    let affectedMarkets: Array<{
      recall_id: number;
      market_name: string;
      market_phone: string;
      quantity: string;
      unit: string;
      status: string;
      notified_at: string;
    }> = [];

    if (recallIds.length > 0) {
      affectedMarkets = await selectQuery(
        sequelize,
        `SELECT ram.*, u.name as market_name, u.phone as market_phone
         FROM recall_affected_markets ram
         JOIN users u ON ram.market_id = u.id
         WHERE ram.recall_id IN (${recallIds.map(() => '?').join(',')})`,
        recallIds
      );
    }

    const result = recalls.map(r => ({
      ...r,
      affectedMarkets: affectedMarkets.filter(m => m.recall_id === r.id),
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Geri çağırma raporu alınamadı' });
  }
});

export default router;
