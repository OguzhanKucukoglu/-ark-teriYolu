import { getPartMultiplier } from '../../controllers/butchery.controller';

describe('Görev 2 - Bütün Kuzu Parçalama ve Maliyet Dağıtım Anahtarı Testleri', () => {
  // Şartname kuzu parçalama verileri: 25 kg giriş, 287.50 € alış maliyeti, 22 kg çıkan parçalar
  const inputWeightKg = 25.0;
  const purchaseCost = 287.50; // 25 kg x 11.50 €/kg
  const kuzuParts = [
    { part_name: 'Pirzola',          actual_weight_kg: 3.50 },
    { part_name: 'But',              actual_weight_kg: 6.00 },
    { part_name: 'Sırt / Kontrfile', actual_weight_kg: 2.50 },
    { part_name: 'Kol / Omuz',       actual_weight_kg: 4.50 },
    { part_name: 'Kaburga',          actual_weight_kg: 2.50 },
    { part_name: 'Gerdan',           actual_weight_kg: 1.50 },
    { part_name: 'Kıyma / Kuşbaşı',  actual_weight_kg: 0.50 },
    { part_name: 'İncik',            actual_weight_kg: 0.50 },
    { part_name: 'Bağırsak',         actual_weight_kg: 0.50 },
  ];

  const totalOutputKg = kuzuParts.reduce((s, p) => s + p.actual_weight_kg, 0);

  test('Kütle dengesi: 25 kg girişten 22 kg çıkış ve 3 kg fire (%12) tespit edilmeli', () => {
    expect(totalOutputKg).toBe(22.0);
    const wasteKg = Math.max(0, inputWeightKg - totalOutputKg);
    expect(wasteKg).toBe(3.0);
    const fireRate = (wasteKg / inputWeightKg) * 100;
    expect(fireRate).toBeCloseTo(12.0, 1);
  });

  test('Miktar (Ağırlık) Ağırlıklı Dağıtım: Toplam maliyet tam 287.50 € olmalı ve eşit birim maliyet çıkmalı', () => {
    const allocations = kuzuParts.map(p => {
      const ratio = p.actual_weight_kg / totalOutputKg;
      const allocatedCost = purchaseCost * ratio;
      const unitCost = allocatedCost / p.actual_weight_kg;
      return { ...p, ratio, allocatedCost, unitCost };
    });

    const sumAllocated = allocations.reduce((s, p) => s + p.allocatedCost, 0);
    expect(sumAllocated).toBeCloseTo(287.50, 2);

    // Her parçanın birim maliyeti 287.50 / 22 = 13.068 €/kg olmalı (Fire sağlam parçalara yüklenir)
    allocations.forEach(p => {
      expect(p.unitCost).toBeCloseTo(287.50 / 22.0, 3);
    });
  });

  test('Değer (Piyasa Çarpanı) Ağırlıklı Dağıtım: Pirzola birim maliyeti Bağırsaktan belirgin derecede yüksek olmalı', () => {
    const totalPoints = kuzuParts.reduce((s, p) => {
      const mult = getPartMultiplier(p.part_name);
      return s + (p.actual_weight_kg * mult);
    }, 0);

    const allocations = kuzuParts.map(p => {
      const mult = getPartMultiplier(p.part_name);
      const ratio = (p.actual_weight_kg * mult) / totalPoints;
      const allocatedCost = purchaseCost * ratio;
      const unitCost = allocatedCost / p.actual_weight_kg;
      return { ...p, mult, allocatedCost, unitCost };
    });

    const sumAllocated = allocations.reduce((s, p) => s + p.allocatedCost, 0);
    expect(sumAllocated).toBeCloseTo(287.50, 2);

    const pirzola = allocations.find(p => p.part_name === 'Pirzola')!;
    const bagirsak = allocations.find(p => p.part_name === 'Bağırsak')!;

    // Pirzola değerli (çarpan: 2.2), Bağırsak yan ürün (çarpan: 0.3)
    expect(pirzola.unitCost).toBeGreaterThan(bagirsak.unitCost);
    expect(pirzola.unitCost).toBeGreaterThan(15.0); // Değerli et yüksek birim maliyet alır
    expect(bagirsak.unitCost).toBeLessThan(5.0);   // Yan ürün düşük birim maliyet alır
  });

  test('Şartname Alternatif 351.00 € senaryosunda da maliyet dengesi tam korunmalı', () => {
    const altCost = 351.00;
    const allocations = kuzuParts.map(p => {
      const ratio = p.actual_weight_kg / totalOutputKg;
      return p.actual_weight_kg * (altCost / totalOutputKg);
    });

    const sumAllocated = allocations.reduce((s, v) => s + v, 0);
    expect(sumAllocated).toBeCloseTo(351.00, 2);
  });
});
