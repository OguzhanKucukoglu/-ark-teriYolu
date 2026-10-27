import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

// ── SUCUKÇU İLANLARI ─────────────────────────────────────────────────────────

// Sucukçunun kendi ilanlarını getir  ← /producer/:id'den ÖNCE tanımlanmalı
router.get('/producer/mine', authorize('sucukcu'), async (req: AuthRequest, res) => {
  try {
    const listings = await selectQuery(
      sequelize,
      `SELECT * FROM producer_listings WHERE producer_id = ? ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json(listings);
  } catch {
    res.status(500).json({ error: 'İlanlar alınamadı' });
  }
});

// Tüm aktif ilanları getir (hayvancılar görür)
router.get('/producer', async (_req, res) => {
  try {
    const listings = await selectQuery(
      sequelize,
      `SELECT pl.*, u.name as producer_name, u.phone, u.address
       FROM producer_listings pl
       JOIN users u ON pl.producer_id = u.id
       WHERE pl.is_active = 1
       ORDER BY pl.created_at DESC`,
      []
    );
    res.json(listings);
  } catch {
    res.status(500).json({ error: 'İlanlar alınamadı' });
  }
});

// Yeni ilan oluştur
router.post('/producer', authorize('sucukcu'), async (req: AuthRequest, res) => {
  const { product_name, description, service_price, service_unit, min_order_qty, required_materials } = req.body;
  try {
    const listingId = await insertQuery(
      sequelize,
      `INSERT INTO producer_listings (producer_id, product_name, description, service_price, service_unit, min_order_qty, required_materials)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, product_name, description || null, service_price, service_unit, min_order_qty || null, required_materials ? JSON.stringify(required_materials) : null]
    );
    res.status(201).json({ message: 'İlan oluşturuldu', listingId });
  } catch {
    res.status(500).json({ error: 'İlan oluşturulamadı' });
  }
});

// İlan güncelle
router.put('/producer/:id', authorize('sucukcu'), async (req: AuthRequest, res) => {
  const { description, service_price, min_order_qty, required_materials } = req.body;
  try {
    await sequelize.query(
      `UPDATE producer_listings
       SET description = ?, service_price = ?, min_order_qty = ?, required_materials = ?, updated_at = NOW()
       WHERE id = ? AND producer_id = ?`,
      { replacements: [
        description || null,
        service_price,
        min_order_qty || null,
        required_materials ? JSON.stringify(required_materials) : null,
        req.params.id,
        req.user!.id,
      ]}
    );
    res.json({ message: 'İlan güncellendi' });
  } catch {
    res.status(500).json({ error: 'İlan güncellenemedi' });
  }
});

// Aktif / Pasif toggle
router.patch('/producer/:id/toggle', authorize('sucukcu'), async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `UPDATE producer_listings SET is_active = NOT is_active, updated_at = NOW() WHERE id = ? AND producer_id = ?`,
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'İlan durumu güncellendi' });
  } catch {
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

// İlan sil
router.delete('/producer/:id', authorize('sucukcu'), async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `DELETE FROM producer_listings WHERE id = ? AND producer_id = ?`,
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'İlan silindi' });
  } catch {
    res.status(500).json({ error: 'İlan silinemedi' });
  }
});

// ── HAYVANCı İLANLARI ────────────────────────────────────────────────────────

// Hayvancının kendi ilanları (aktif + pasif)
router.get('/farmer/mine', authorize('hayvanci'), async (req: AuthRequest, res) => {
  try {
    const listings = await selectQuery(
      sequelize,
      `SELECT fl.*, l.lot_number, l.quantity as lot_quantity, l.status as lot_status
       FROM farmer_listings fl
       JOIN lots l ON fl.lot_id = l.id
       WHERE fl.farmer_id = ?
       ORDER BY fl.created_at DESC`,
      [req.user!.id]
    );
    res.json(listings);
  } catch {
    res.status(500).json({ error: 'İlanlar alınamadı' });
  }
});

// Tüm aktif hayvancı ilanları (marketler görür)
router.get('/farmer', async (_req, res) => {
  try {
    const listings = await selectQuery(
      sequelize,
      `SELECT fl.*, u.name as farmer_name, u.phone, l.lot_number, l.status as lot_status
       FROM farmer_listings fl
       JOIN users u ON fl.farmer_id = u.id
       JOIN lots l ON fl.lot_id = l.id
       WHERE fl.is_active = 1 AND l.status = 'active'
       ORDER BY fl.created_at DESC`,
      []
    );
    res.json(listings);
  } catch {
    res.status(500).json({ error: 'İlanlar alınamadı' });
  }
});

// Yeni hayvancı ilanı oluştur
router.post('/farmer', authorize('hayvanci'), async (req: AuthRequest, res) => {
  const { lot_id, product_name, quantity, unit, unit_price, description } = req.body;
  try {
    const listingId = await insertQuery(
      sequelize,
      `INSERT INTO farmer_listings (farmer_id, lot_id, product_name, quantity, unit, unit_price, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, lot_id, product_name, quantity, unit, unit_price, description || null]
    );
    res.status(201).json({ message: 'İlan oluşturuldu', listingId });
  } catch {
    res.status(500).json({ error: 'İlan oluşturulamadı' });
  }
});

// Hayvancı ilanı güncelle
router.put('/farmer/:id', authorize('hayvanci'), async (req: AuthRequest, res) => {
  const { unit_price, quantity, description } = req.body;
  try {
    await sequelize.query(
      `UPDATE farmer_listings SET unit_price = ?, quantity = ?, description = ?, updated_at = NOW()
       WHERE id = ? AND farmer_id = ?`,
      { replacements: [unit_price, quantity, description || null, req.params.id, req.user!.id] }
    );
    res.json({ message: 'İlan güncellendi' });
  } catch {
    res.status(500).json({ error: 'İlan güncellenemedi' });
  }
});

// Hayvancı ilanı aktif/pasif toggle
router.patch('/farmer/:id/toggle', authorize('hayvanci'), async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `UPDATE farmer_listings SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = ? AND farmer_id = ?`,
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'İlan durumu güncellendi' });
  } catch {
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

export default router;
