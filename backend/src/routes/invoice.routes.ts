import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { selectQuery } from '../utils/dbHelpers';

const router = Router();
router.use(authenticate);

// GET /api/invoices - Kullanıcının taraf olduğu tüm faturaları listele (gönderen veya alıcı)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, reference_type, reference_id, order_id } = req.query;

    let query = `
      SELECT 
        i.*,
        u_sender.name   AS sender_name,
        u_sender.email  AS sender_email,
        u_sender.role   AS sender_role,
        u_recv.name     AS receiver_name,
        u_recv.email    AS receiver_email,
        u_recv.role     AS receiver_role
      FROM invoices i
      JOIN users u_sender ON i.sender_id = u_sender.id
      JOIN users u_recv   ON i.receiver_id = u_recv.id
      WHERE (i.sender_id = ? OR i.receiver_id = ?)
    `;
    const params: unknown[] = [userId, userId];

    if (type) {
      query += ` AND i.invoice_type = ?`;
      params.push(type);
    }
    if (order_id) {
      query += ` AND (
        (i.reference_type = 'order' AND i.reference_id = ?) OR
        (i.reference_type = 'production_order' AND i.reference_id IN (SELECT id FROM production_orders WHERE order_id = ?))
      )`;
      params.push(order_id, order_id);
    } else {
      if (reference_type) {
        query += ` AND i.reference_type = ?`;
        params.push(reference_type);
      }
      if (reference_id) {
        query += ` AND i.reference_id = ?`;
        params.push(reference_id);
      }
    }

    query += ` ORDER BY i.invoice_date DESC, i.id DESC`;

    const invoices = await selectQuery(sequelize, query, params);
    res.json(invoices);
  } catch (error) {
    console.error('Faturalar getirilirken hata:', error);
    res.status(500).json({ error: 'Faturalar alınamadı' });
  }
});

// GET /api/invoices/:id - Belirli bir faturanın detayını getir
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoiceId = req.params.id;

    const invoices = await selectQuery(
      sequelize,
      `
      SELECT 
        i.*,
        u_sender.name   AS sender_name,
        u_sender.email  AS sender_email,
        u_sender.role   AS sender_role,
        u_recv.name     AS receiver_name,
        u_recv.email    AS receiver_email,
        u_recv.role     AS receiver_role
      FROM invoices i
      JOIN users u_sender ON i.sender_id = u_sender.id
      JOIN users u_recv   ON i.receiver_id = u_recv.id
      WHERE i.id = ? AND (i.sender_id = ? OR i.receiver_id = ?)
      `,
      [invoiceId, userId, userId]
    );

    if (invoices.length === 0) {
      res.status(404).json({ error: 'Fatura bulunamadı veya bu faturayı görüntüleme yetkiniz yok' });
      return;
    }

    res.json(invoices[0]);
  } catch (error) {
    console.error('Fatura detayı getirilirken hata:', error);
    res.status(500).json({ error: 'Fatura detayı alınamadı' });
  }
});

export default router;
