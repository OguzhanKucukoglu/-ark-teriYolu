describe('AVATAR EKP ve Maliyet Muhasebesi Hesaplama Testleri', () => {
  test('Yarışma senaryosu: EKP, VKP ve Brüt Kâr doğrulaması', () => {
    // 1. Hammaddeler (Hayvancı / İşletme Stoğu)
    const rawMaterials = [
      { name: 'Kıyma/Parça Et', qty: 100, unitPrice: 10.0 }, // 1000 €
      { name: 'Baharat Karışımı', qty: 2, unitPrice: 5.0 },   // 10 €
      { name: 'Kurutulmuş Bağırsak', qty: 5, unitPrice: 3.0 }, // 15 €
    ];

    const totalRawCost = rawMaterials.reduce((sum, rm) => sum + rm.qty * rm.unitPrice, 0);
    expect(totalRawCost).toBe(1025.0);

    // 2. Fason Üretim / İşçilik Bedeli (Sucukçu Faturası)
    const actualQty = 85; // 85 paket
    const serviceCostPerUnit = 5.50;
    const totalServiceCost = actualQty * serviceCostPerUnit; // 467.50 €
    expect(totalServiceCost).toBe(467.50);

    // 3. Toplam Maliyet ve EKP (Eşdeğer Kalite Puanlı Birim Maliyet)
    const totalCost = totalRawCost + totalServiceCost; // 1492.50 €
    expect(totalCost).toBe(1492.50);

    const ekp = totalCost / actualQty; // 17.5588235... €
    expect(parseFloat(ekp.toFixed(4))).toBe(17.5588);

    // 4. VKP (Vergili / Tavsiye Edilen Satış Fiyatı, %38 marj kuralı)
    const markupFactor = 1.38;
    const vkp = ekp * markupFactor;
    expect(parseFloat(vkp.toFixed(4))).toBe(24.2312);

    // 5. Market Satış Fiyatı (25.00 €) ve Kâr Analizi
    const marketSellingPrice = 25.00;
    const grossProfitPerUnit = marketSellingPrice - ekp;
    expect(parseFloat(grossProfitPerUnit.toFixed(4))).toBe(7.4412);

    const grossMarginPercent = (grossProfitPerUnit / marketSellingPrice) * 100;
    expect(parseFloat(grossMarginPercent.toFixed(2))).toBe(29.76);
  });

  test('Paket hesabı (1 kg/paket) ve fire/dolum kaybı ayrımı doğrulaması', () => {
    const packageWeight = 1.00; // 1 kg / paket standartı

    // Senaryo 1: 4.3 kg hammadde girdisi
    const totalInputKg1 = 4.300;
    const actualPackages1 = Math.floor(totalInputKg1 / packageWeight); // 4 tam paket
    expect(actualPackages1).toBe(4);

    const netPackagedKg1 = actualPackages1 * packageWeight; // 4.0 kg
    const fireKg1 = parseFloat((totalInputKg1 - netPackagedKg1).toFixed(3)); // 0.3 kg fire
    expect(fireKg1).toBe(0.300);

    const fireRate1 = parseFloat(((fireKg1 / totalInputKg1) * 100).toFixed(2));
    expect(fireRate1).toBe(6.98); // %6.98 fire oranı

    // Senaryo 2: 107 kg hammadde girdisinden 85 paket çıkması (yarışma şartnamesi)
    const totalInputKg2 = 107.000;
    const actualPackages2 = 85;
    const netPackagedKg2 = actualPackages2 * packageWeight; // 85.0 kg
    const fireKg2 = totalInputKg2 - netPackagedKg2; // 22.0 kg kuruma/dolum firesi
    expect(fireKg2).toBe(22.000);

    const fireRate2 = parseFloat(((fireKg2 / totalInputKg2) * 100).toFixed(2));
    expect(fireRate2).toBe(20.56); // %20.56 fire
  });

  test('Farklı üretici makineleri ve fire oranlarının EKP maliyetine etkisi', () => {
    const totalRawCost = 1000.00; // 100 kg et = 1000 €
    const serviceFeePerPackage = 5.50; // Paket başı fason ücret

    // Üretici A: Kaliteli makine (%15 fire -> 85 paket)
    const packagesA = 85;
    const totalCostA = totalRawCost + (packagesA * serviceFeePerPackage); // 1000 + 467.50 = 1467.50 €
    const ekpA = totalCostA / packagesA; // 17.2647 €/paket

    // Üretici B: Eski/verimsiz makine (%25 fire -> 75 paket)
    const packagesB = 75;
    const totalCostB = totalRawCost + (packagesB * serviceFeePerPackage); // 1000 + 412.50 = 1412.50 €
    const ekpB = totalCostB / packagesB; // 18.8333 €/paket

    // Fire arttıkça paket başına düşen hammadde maliyeti arttığı için EKP yükselir:
    expect(ekpB).toBeGreaterThan(ekpA);
    expect(parseFloat((ekpB - ekpA).toFixed(2))).toBe(1.57); // Paket başına 1.57 € daha pahalıya mal olur!
  });

  test('Fason Hizmet Faturası ve Satış Faturası tutar hesaplama doğrulaması', () => {
    // Fason Hizmet Faturası (Sucukçu -> İşletme)
    const serviceQty = 85;
    const serviceUnitPrice = 5.50;
    const serviceSubtotal = serviceQty * serviceUnitPrice;
    const serviceTaxRate = 0.00;
    const serviceTotal = serviceSubtotal + (serviceSubtotal * serviceTaxRate);
    expect(serviceTotal).toBe(467.50);

    // Satış Faturası (İşletme -> Market A)
    const salesQtyA = 30;
    const salesUnitPrice = 25.00;
    const salesTotalA = salesQtyA * salesUnitPrice;
    expect(salesTotalA).toBe(750.00);

    // Satış Faturası (İşletme -> Market B)
    const salesQtyB = 25;
    const salesTotalB = salesQtyB * salesUnitPrice;
    expect(salesTotalB).toBe(625.00);
  });
});
