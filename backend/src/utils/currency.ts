// ============================================================
// AVATAR: Çoklu Para Birimi (Multi-Currency) & Kur Çevrim Servisi
// ============================================================

export type SupportedCurrency = 'EUR' | 'TRY' | 'USD' | 'GBP';

export interface ExchangeRateInfo {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  rateToEur: number;   // 1 birimin kaç EUR ettiği (EUR = 1.0)
  rateFromEur: number; // 1 EUR'un kaç birim ettiği
}

export const CURRENCY_CONFIG: Record<SupportedCurrency, ExchangeRateInfo> = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro',               rateToEur: 1.0,      rateFromEur: 1.0 },
  TRY: { code: 'TRY', symbol: '₺', name: 'Türk Lirası',        rateToEur: 1 / 37.5, rateFromEur: 37.5 },
  USD: { code: 'USD', symbol: '$', name: 'Amerikan Doları',    rateToEur: 1 / 1.08, rateFromEur: 1.08 },
  GBP: { code: 'GBP', symbol: '£', name: 'İngiliz Sterlini',   rateToEur: 1.1765,   rateFromEur: 0.85 },
};

/**
 * Verilen para birimi kodunu standartlaştırır ('€' -> 'EUR', '₺' -> 'TRY', vb.)
 */
export function normalizeCurrency(currency?: string | null): SupportedCurrency {
  if (!currency) return 'EUR';
  const c = currency.trim().toUpperCase();
  if (c === 'TRY' || c === 'TL' || c === '₺') return 'TRY';
  if (c === 'USD' || c === '$') return 'USD';
  if (c === 'GBP' || c === '£') return 'GBP';
  return 'EUR';
}

/**
 * Belirtilen tutarı EUR tabanına çevirir (özellikle EKP ve finansal raporlar için)
 */
export function convertToEur(amount: number, fromCurrency: string = 'EUR'): number {
  if (!amount || isNaN(amount)) return 0;
  const normalized = normalizeCurrency(fromCurrency);
  return amount * CURRENCY_CONFIG[normalized].rateToEur;
}

/**
 * Bir para biriminden diğerine kur çevrimi yapar
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string = 'EUR',
  toCurrency: string = 'EUR'
): number {
  if (!amount || isNaN(amount)) return 0;
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return amount;
  const inEur = amount * CURRENCY_CONFIG[from].rateToEur;
  return inEur * CURRENCY_CONFIG[to].rateFromEur;
}

/**
 * Para birimi sembolünü döner
 */
export function getCurrencySymbol(currency?: string | null): string {
  const normalized = normalizeCurrency(currency);
  return CURRENCY_CONFIG[normalized].symbol;
}
