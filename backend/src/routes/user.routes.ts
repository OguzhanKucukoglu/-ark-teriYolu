import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Rol bazlı kullanıcı listesi (örn: tüm sucukçuları getir)
router.get('/by-role/:role', async (req: AuthRequest, res) => {
  try {
    const [users] = await sequelize.query(
      'SELECT id, name, email, role, phone, address FROM users WHERE role = ? AND is_active = 1',
      { replacements: [req.params.role] }
    );
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Kullanıcılar alınamadı' });
  }
});

export default router;
