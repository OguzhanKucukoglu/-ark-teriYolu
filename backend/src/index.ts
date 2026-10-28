import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './config/database';
import { logger } from './utils/logger';

// Routes
import authRoutes       from './routes/auth.routes';
import userRoutes       from './routes/user.routes';
import lotRoutes        from './routes/lot.routes';
import butcheryRoutes   from './routes/butchery.routes';
import rawMaterialRoutes from './routes/rawmaterial.routes';
import orderRoutes      from './routes/order.routes';
import productionRoutes from './routes/production.routes';
import listingRoutes    from './routes/listing.routes';
import purchaseRoutes   from './routes/purchase.routes';
import recallRoutes     from './routes/recall.routes';
import mlRoutes         from './routes/ml.routes';
import notificationRoutes from './routes/notification.routes';
import reportRoutes       from './routes/report.routes';
import invoiceRoutes      from './routes/invoice.routes';
import anomalyRoutes      from './routes/anomaly.routes';
import ocrRoutes          from './routes/ocr.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/lots',       lotRoutes);
app.use('/api/butchery',      butcheryRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/listings',   listingRoutes);
app.use('/api/purchases',  purchaseRoutes);
app.use('/api/recalls',    recallRoutes);
app.use('/api/ml',         mlRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/invoices',      invoiceRoutes);
app.use('/api/anomalies',     anomalyRoutes);
app.use('/api/ocr',           ocrRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// DB bağlantısı ve sunucu başlatma
async function bootstrap() {
  try {
    await sequelize.authenticate();
    logger.info('MySQL bağlantısı başarılı.');

    // Görev 2 Parçalama Maliyet Dağıtım Anahtarı Şema Senkronizasyonu (Idempotent)
    const butcheryOpsCols = [
      { col: 'input_weight_kg', type: 'DECIMAL(10,3) NOT NULL DEFAULT 0.000' },
      { col: 'animal_ear_tag', type: 'VARCHAR(50) NULL' },
      { col: 'unit_cost_input', type: 'DECIMAL(12,4) NOT NULL DEFAULT 0.0000' },
      { col: 'distribution_method', type: "VARCHAR(30) NOT NULL DEFAULT 'agirlik'" },
    ];
    for (const c of butcheryOpsCols) {
      try {
        await sequelize.query(`ALTER TABLE butchery_operations ADD COLUMN ${c.col} ${c.type}`);
      } catch {
        // Kolon zaten varsa yoksayılır
      }
    }

    const butcheryPartsCols = [
      { col: 'allocated_cost', type: 'DECIMAL(12,4) NOT NULL DEFAULT 0.0000' },
      { col: 'unit_cost', type: 'DECIMAL(12,4) NOT NULL DEFAULT 0.0000' },
    ];
    for (const c of butcheryPartsCols) {
      try {
        await sequelize.query(`ALTER TABLE butchery_parts ADD COLUMN ${c.col} ${c.type}`);
      } catch {
        // Kolon zaten varsa yoksayılır
      }
    }

    try {
      await sequelize.query('ALTER TABLE order_raw_materials MODIFY COLUMN lot_id INT UNSIGNED NULL');
    } catch {
      // Yoksay
    }

    app.listen(PORT, () => {
      logger.info(`AVATAR Backend çalışıyor: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Sunucu başlatılamadı:', error);
    process.exit(1);
  }
}

bootstrap();

export default app;
