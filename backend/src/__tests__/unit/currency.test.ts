import { convertCurrency, convertToEur, getCurrencySymbol, normalizeCurrency, CURRENCY_CONFIG } from '../../utils/currency';

describe('Çoklu Para Birimi & Kur Çevrimi Testleri', () => {
  test('Para birimi sembolleri doğru dönmeli', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('€')).toBe('€');
    expect(getCurrencySymbol('TRY')).toBe('₺');
    expect(getCurrencySymbol('₺')).toBe('₺');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('$')).toBe('$');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('£')).toBe('£');
    expect(getCurrencySymbol(null)).toBe('€'); // varsayılan EUR
  });

  test('Normalize currency fonksiyonu doğru kod dönmeli', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency('₺')).toBe('TRY');
    expect(normalizeCurrency('TL')).toBe('TRY');
    expect(normalizeCurrency('$')).toBe('USD');
    expect(normalizeCurrency('£')).toBe('GBP');
  });

  test('EUR tabanına kur çevrimi doğru çalışmalı', () => {
    // 375 TRY -> 10 EUR (37.5 kuru ile)
    const eurFromTry = convertToEur(375, 'TRY');
    expect(eurFromTry).toBeCloseTo(10.0, 2);

    // 108 USD -> 100 EUR (1.08 kuru ile)
    const eurFromUsd = convertToEur(108, 'USD');
    expect(eurFromUsd).toBeCloseTo(100.0, 2);

    // 100 EUR -> 100 EUR
    expect(convertToEur(100, 'EUR')).toBe(100);
  });

  test('İki farklı döviz arasında çapraz kur çevrimi doğru çalışmalı', () => {
    // 100 USD -> TRY çevrimi
    // 100 USD = 92.59 EUR * 37.5 = ~3472.22 TRY
    const tryFromUsd = convertCurrency(100, 'USD', 'TRY');
    expect(tryFromUsd).toBeGreaterThan(3400);
    expect(tryFromUsd).toBeLessThan(3550);

    // TRY -> TRY (aynı para birimi)
    expect(convertCurrency(500, 'TRY', 'TRY')).toBe(500);
  });
});
