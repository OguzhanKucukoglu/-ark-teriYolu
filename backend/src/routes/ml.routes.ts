import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { selectQuery } from '../utils/dbHelpers';
import axios from 'axios';

const router = Router();
router.use(authenticate);

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ── TAHMİN ENDPOINT'LERİ (ML servisine proxy) ────────────────────────────────

// Üretim verimi + EKP tahmini
router.post('/predict/production', async (req, res) => {
  try {
    // Üreticiye ait geçmiş veriyi ML servisine ekle
    const { producer_id } = req.body;
    let history: unknown[] = [];

    if (producer_id) {
      history = await selectQuery(
        sequelize,
        `SELECT
           po.id,
           po.expected_qty,
           po.actual_qty,
           po.service_cost,
           po.total_raw_cost,
           po.ekp,
           po.product_name,
           pl.required_materials
         FROM production_orders po
         JOIN orders o ON po.order_id = o.id
         JOIN producer_listings pl ON o.listing_id = pl.id
         WHERE po.producer_id = ? AND po.status = 'tamamlandi' AND po.actual_qty IS NOT NULL
         ORDER BY po.created_at DESC
         LIMIT 100`,
        [producer_id]
      );
    }

    const response = await axios.post(`${ML_URL}/predict/production`, {
      ...req.body,
      history,
    });
    res.json(response.data);
  } catch {
    res.status(503).json({ error: 'ML servisi kullanılamıyor' });
  }
});

// Parçalama verimi tahmini
router.post('/predict/butchery', async (req, res) => {
  try {
    // Aynı hayvan türüne ait geçmiş parçalama verisini ekle
    const { animal_type } = req.body;
    let history: unknown[] = [];

    if (animal_type) {
      history = await selectQuery(
        sequelize,
        `SELECT
           bo.id,
           bo.animal_type,
           bo.total_output_kg,
           bo.waste_kg,
           bp.part_name,
           bp.actual_weight_kg,
           bp.allocated_cost,
           bp.unit_cost
         FROM butchery_operations bo
         JOIN butchery_parts bp ON bp.butchery_operation_id = bo.id
         WHERE LOWER(bo.animal_type) = LOWER(?)
         ORDER BY bo.created_at DESC
         LIMIT 200`,
        [animal_type]
      );
    }

    const response = await axios.post(`${ML_URL}/predict/butchery`, {
      ...req.body,
      history,
    });
    res.json(response.data);
  } catch {
    res.status(503).json({ error: 'ML servisi kullanılamıyor' });
  }
});

// ── MODEL DOĞRULAMA VE METRİK ENDPOINT'LERİ (Baseline vs ML) ───────────────

// Model A: Üretim ve EKP modelinin baseline ile karşılaştırması ve metrikleri
router.get('/evaluate/production', async (_req, res) => {
  try {
    const history = await selectQuery(
      sequelize,
      `SELECT
         po.id,
         po.expected_qty,
         po.actual_qty,
         po.service_cost,
         po.total_raw_cost,
         po.ekp
       FROM production_orders po
       WHERE po.status = 'tamamlandi' AND po.actual_qty IS NOT NULL
       ORDER BY po.created_at DESC
       LIMIT 100`,
      []
    );

    const response = await axios.post(`${ML_URL}/evaluate/production`, {
      history,
    });
    res.json(response.data);
  } catch {
    res.status(503).json({ error: 'ML servisi kullanılamıyor' });
  }
});

// Model B: Parçalama modelinin reçete baseline ile karşılaştırması ve metrikleri
router.get('/evaluate/butchery', async (req, res) => {
  try {
    const animalType = (req.query.animal_type as string) || 'koyun';
    const history = await selectQuery(
      sequelize,
      `SELECT
         bo.id,
         bo.animal_type,
         bo.input_weight_kg,
         bo.total_output_kg,
         bo.waste_kg,
         bp.part_name,
         bp.actual_weight_kg
       FROM butchery_operations bo
       JOIN butchery_parts bp ON bp.butchery_operation_id = bo.id
       WHERE LOWER(bo.animal_type) = LOWER(?)
       ORDER BY bo.created_at DESC
       LIMIT 200`,
      [animalType]
    );

    const response = await axios.post(`${ML_URL}/evaluate/butchery`, {
      animal_type: animalType,
      history,
    });
    res.json(response.data);
  } catch {
    res.status(503).json({ error: 'ML servisi kullanılamıyor' });
  }
});

// ── EĞİTİM VERİSİ ENDPOINT'LERİ (ML servisi için ham veri) ──────────────────

// Üretici bazlı geçmiş üretim verisi
router.get('/training-data/production', async (req, res) => {
  try {
    const { producer_id } = req.query;
    const rows = await selectQuery(
      sequelize,
      `SELECT
         po.id,
         po.producer_id,
         po.product_name,
         po.expected_qty,
         po.actual_qty,
         po.service_cost,
         po.total_raw_cost,
         po.ekp,
         po.production_date,
         pl.required_materials,
         pl.service_price
       FROM production_orders po
       JOIN orders o ON po.order_id = o.id
       JOIN producer_listings pl ON o.listing_id = pl.id
       WHERE po.status = 'tamamlandi'
         AND po.actual_qty IS NOT NULL
         ${producer_id ? 'AND po.producer_id = ?' : ''}
       ORDER BY po.created_at ASC`,
      producer_id ? [producer_id] : []
    );
    res.json({ count: rows.length, data: rows });
  } catch {
    res.status(500).json({ error: 'Veri alınamadı' });
  }
});

// Parçalama geçmiş verisi (hayvan türü bazlı)
router.get('/training-data/butchery', async (req, res) => {
  try {
    const { animal_type } = req.query;
    const rows = await selectQuery(
      sequelize,
      `SELECT
         bo.id,
         bo.animal_type,
         bo.total_output_kg,
         bo.waste_kg,
         bo.total_cost,
         bo.operation_date,
         bp.part_name,
         bp.actual_weight_kg,
         bp.allocated_cost,
         bp.unit_cost,
         bp.is_byproduct
       FROM butchery_operations bo
       JOIN butchery_parts bp ON bp.butchery_operation_id = bo.id
       WHERE 1=1
         ${animal_type ? "AND LOWER(bo.animal_type) = LOWER(?)" : ''}
       ORDER BY bo.created_at ASC`,
      animal_type ? [animal_type] : []
    );
    res.json({ count: rows.length, data: rows });
  } catch {
    res.status(500).json({ error: 'Veri alınamadı' });
  }
});

export default router;
