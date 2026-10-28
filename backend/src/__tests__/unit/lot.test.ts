import { generateLotNumber, parseLotNumber } from '../../utils/lotNumberGenerator';

describe('Lot Numarası Üretici ve Ayrıştırıcı Testleri', () => {
  const currentYear = new Date().getFullYear();

  test('Sucuk için doğru formatta lot numarası üretmeli', () => {
    const lotNumber = generateLotNumber('sucuk', 45);
    expect(lotNumber).toBe(`SUC-${currentYear}-045`);
  });

  test('Et hammaddesi için doğru formatta lot numarası üretmeli', () => {
    const lotNumber = generateLotNumber('hammadde_et', 1);
    expect(lotNumber).toBe(`ET-${currentYear}-001`);
  });

  test('Baharat için doğru formatta lot numarası üretmeli', () => {
    const lotNumber = generateLotNumber('hammadde_baharat', 12);
    expect(lotNumber).toBe(`BAH-${currentYear}-012`);
  });

  test('Bilinmeyen tip için varsayılan LOT ön ekini kullanmalı', () => {
    const lotNumber = generateLotNumber('bilinmeyen', 7);
    expect(lotNumber).toBe(`LOT-${currentYear}-007`);
  });

  test('Lot numarasını başarıyla ayrıştırmalı', () => {
    const parsed = parseLotNumber(`SUC-${currentYear}-045`);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('SUC');
    expect(parsed?.year).toBe(currentYear);
    expect(parsed?.sequence).toBe(45);
  });

  test('Geçersiz formatlı lot numarasında null dönmeli', () => {
    expect(parseLotNumber('INVALID-FORMAT')).toBeNull();
    expect(parseLotNumber('12345')).toBeNull();
  });
});
