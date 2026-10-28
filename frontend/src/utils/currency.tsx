import React from 'react';
import { Select, Tag } from 'antd';
import { useTranslation } from '../i18n';

export type SupportedCurrency = 'EUR' | 'TRY' | 'USD' | 'GBP';

export interface CurrencyDetails {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  rateToEur: number;
}

export const CURRENCY_CONFIG: Record<SupportedCurrency, CurrencyDetails> = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro',             rateToEur: 1.0 },
  TRY: { code: 'TRY', symbol: '₺', name: 'Türk Lirası',      rateToEur: 1 / 37.5 },
  USD: { code: 'USD', symbol: '$', name: 'Amerikan Doları',  rateToEur: 1 / 1.08 },
  GBP: { code: 'GBP', symbol: '£', name: 'İngiliz Sterlini', rateToEur: 1.1765 },
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['EUR', 'TRY', 'USD', 'GBP'];

/**
 * Para birimini normalize eder ('€' -> 'EUR', vb.)
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
 * Para birimi sembolü döner ('€', '₺', '$', '£')
 */
export function getCurrencySymbol(currency?: string | null): string {
  const norm = normalizeCurrency(currency);
  return CURRENCY_CONFIG[norm]?.symbol || '€';
}

/**
 * Para miktarını EUR tabanına çevirir
 */
export function convertToEur(amount: number, fromCurrency: string = 'EUR'): number {
  if (!amount || isNaN(amount)) return 0;
  const norm = normalizeCurrency(fromCurrency);
  return amount * CURRENCY_CONFIG[norm].rateToEur;
}

/**
 * İki para birimi arasında kur çevrimi yapar
 */
export function convertCurrency(amount: number, fromCurrency: string = 'EUR', toCurrency: string = 'EUR'): number {
  if (!amount || isNaN(amount)) return 0;
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return amount;
  const inEur = amount * CURRENCY_CONFIG[from].rateToEur;
  return inEur / CURRENCY_CONFIG[to].rateToEur;
}

/**
 * Fiyatı para birimiyle birlikte biçimlendirir (örn: "250.00 ₺" veya "250.00 ₺ (≈ 6.67 €)")
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string = 'EUR',
  showEurEquivalent: boolean = false
): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00 €';
  const num = Number(amount);
  const norm = normalizeCurrency(currency);
  const sym = getCurrencySymbol(norm);

  const formatted = `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;

  if (showEurEquivalent && norm !== 'EUR') {
    const eurVal = convertToEur(num, norm);
    return `${formatted} (≈ ${eurVal.toFixed(2)} €)`;
  }

  return formatted;
}

/**
 * Ant Design InputNumber bileşeninin `addonAfter` veya `addonBefore` kısmına
 * yerleşen kompakt para birimi seçicisi
 */
export const CurrencySelect: React.FC<{
  value?: string;
  onChange?: (val: SupportedCurrency) => void;
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}> = ({ value, onChange, style, size = 'middle' }) => {
  return (
    <Select<SupportedCurrency>
      value={normalizeCurrency(value)}
      onChange={onChange}
      size={size}
      style={{ width: 90, ...style }}
      popupMatchSelectWidth={false}
    >
      <Select.Option value="EUR">EUR (€)</Select.Option>
      <Select.Option value="TRY">TRY (₺)</Select.Option>
      <Select.Option value="USD">USD ($)</Select.Option>
      <Select.Option value="GBP">GBP (£)</Select.Option>
    </Select>
  );
};

/**
 * EUR dışı para birimi girildiğinde altta yaklaşık EUR karşılığını gösteren rozet
 */
export const EurEquivalentPreview: React.FC<{
  amount: number | null | undefined;
  currency: string;
}> = ({ amount, currency }) => {
  const { t } = useTranslation();
  const norm = normalizeCurrency(currency);
  if (norm === 'EUR' || !amount || amount <= 0) return null;
  const eurVal = convertToEur(amount, norm);
  return (
    <div style={{ marginTop: 4 }}>
      <Tag color="blue" style={{ fontSize: 11 }}>
        {t('common.equivalent')}: ≈ {eurVal.toFixed(2)} € (1 EUR ≈ {norm === 'TRY' ? '37.50 ₺' : norm === 'USD' ? '1.08 $' : '0.85 £'})
      </Tag>
    </div>
  );
};
