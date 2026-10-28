import { Router, Request, Response } from 'express';
import { CURRENCY_CONFIG, convertCurrency, convertToEur, normalizeCurrency } from '../utils/currency';

const router = Router();

// GET /api/currencies - Desteklenen para birimleri ve güncel kurlar
router.get('/', (_req: Request, res: Response) => {
  res.json({
    base: 'EUR',
    currencies: Object.values(CURRENCY_CONFIG),
    updated_at: new Date().toISOString(),
  });
});

// POST /api/currencies/convert - İki para birimi arasında kur çevrimi hesapla
router.post('/convert', (req: Request, res: Response) => {
  const { amount, from, to } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    res.status(400).json({ error: 'Geçersiz miktar' });
    return;
  }

  const fromCurr = normalizeCurrency(from);
  const toCurr = normalizeCurrency(to || 'EUR');
  const converted = convertCurrency(numAmount, fromCurr, toCurr);
  const eurEquivalent = convertToEur(numAmount, fromCurr);

  res.json({
    amount: numAmount,
    from: fromCurr,
    to: toCurr,
    result: parseFloat(converted.toFixed(4)),
    eur_equivalent: parseFloat(eurEquivalent.toFixed(4)),
  });
});

export default router;
