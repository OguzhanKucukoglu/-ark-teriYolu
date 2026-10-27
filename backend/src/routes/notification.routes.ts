import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

// Kullanıcının bildirimlerini getir
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await selectQuery(
      sequelize,
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user!.id]
    );

    const unreadCountRows = await selectQuery<{ count: number }>(
      sequelize,
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [req.user!.id]
    );

    res.json({
      notifications,
      unreadCount: Number(unreadCountRows[0]?.count || 0),
    });
  } catch {
    res.status(500).json({ error: 'Bildirimler alınamadı' });
  }
});

// Tek bildirimi okundu olarak işaretle
router.patch('/:id/read', async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      { replacements: [req.params.id, req.user!.id] }
    );
    res.json({ message: 'Bildirim okundu' });
  } catch {
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

// Tüm bildirimleri okundu olarak işaretle
router.post('/read-all', async (req: AuthRequest, res) => {
  try {
    await sequelize.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      { replacements: [req.user!.id] }
    );
    res.json({ message: 'Tüm bildirimler okundu' });
  } catch {
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

export default router;
