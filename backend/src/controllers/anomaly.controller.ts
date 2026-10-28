import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { sequelize } from '../config/database';
import { selectQuery } from '../utils/dbHelpers';

export interface AnomalyItem {
  id: string;
  type: 'high_fire' | 'high_ekp' | 'low_yield' | 'butchery_waste' | 'recall_risk';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entity_type: 'production' | 'butchery' | 'lot';
  entity_id: number;
  entity_code: string;
  metric_value: number;
  metric_unit: string;
  threshold_value: number;
  created_at: string;
  suggested_action: string;
}

export async function getAnomalies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const anomalies: AnomalyItem[] = [];

    // 1. Üretim Emirlerini Tara
    const productions = await selectQuery<{
      id: number;
      production_number: string;
      product_name: string;
      expected_qty: number;
      actual_qty: number | null;
      fire_qty: number | null;
      fire_rate: number | null;
      ekp: number | null;
      status: string;
      created_at: string;
    }>(
      sequelize,
      `SELECT id, production_number, product_name, expected_qty, actual_qty,
              fire_qty, fire_rate, ekp, status, created_at
       FROM production_orders
       ORDER BY created_at DESC LIMIT 50`,
      []
    );

    for (const po of productions) {
      const fireRate = Number(po.fire_rate || 0);
      const ekp = Number(po.ekp || 0);
      const actualQty = Number(po.actual_qty || 0);
      const expectedQty = Number(po.expected_qty || 1);

      // A) Yüksek Fire Anomalisi (> %20)
      if (po.status === 'tamamlandi' || po.status === 'sevk_edildi') {
        if (fireRate > 20.0) {
          anomalies.push({
            id: `ANO-PROD-FIRE-${po.id}`,
            type: 'high_fire',
            severity: fireRate > 25.0 ? 'critical' : 'warning',
            title: `Yüksek Fire / Kuruma Kaybı Anomalisi (${po.production_number})`,
            description: `${po.product_name} üretiminde %${fireRate.toFixed(1)} fire kaydedildi. Standart tolerans üst sınırı %20.0'dir.`,
            entity_type: 'production',
            entity_id: po.id,
            entity_code: po.production_number,
            metric_value: parseFloat(fireRate.toFixed(1)),
            metric_unit: '% fire',
            threshold_value: 20.0,
            created_at: po.created_at,
            suggested_action: 'Kurutma odası nem ve sıcaklık sensörlerini kalibre edin ve dolum gramajlarını kontrol edin.'
          });
        }

        // B) Yüksek EKP Maliyet Sıçraması Anomalisi (> 20.00 €/paket)
        if (ekp > 20.0) {
          anomalies.push({
            id: `ANO-PROD-EKP-${po.id}`,
            type: 'high_ekp',
            severity: ekp > 24.0 ? 'critical' : 'warning',
            title: `Olağandışı EKP Maliyet Sıçraması (${po.production_number})`,
            description: `${po.product_name} paket maliyeti ${ekp.toFixed(4)} € olarak gerçekleşti. Beklenen tavan maliyet 20.00 €/paket.`,
            entity_type: 'production',
            entity_id: po.id,
            entity_code: po.production_number,
            metric_value: parseFloat(ekp.toFixed(4)),
            metric_unit: '€/paket',
            threshold_value: 20.0,
            created_at: po.created_at,
            suggested_action: 'Girdi hammadde faturalarını ve fason işçilik bedelini inceleyin; fire kaynaklı maliyet şişmesini kontrol edin.'
          });
        }

        // C) Beklenenden Düşük Çıktı Anomalisi (actual < expected * 0.8)
        if (actualQty > 0 && actualQty < expectedQty * 0.8) {
          const lossRate = ((expectedQty - actualQty) / expectedQty) * 100;
          anomalies.push({
            id: `ANO-PROD-YIELD-${po.id}`,
            type: 'low_yield',
            severity: 'warning',
            title: `Mamul Paket Verim Kaybı (${po.production_number})`,
            description: `Beklenen ${expectedQty} pakete karşılık yalnızca ${actualQty} paket üretildi (%${lossRate.toFixed(1)} sapma).`,
            entity_type: 'production',
            entity_id: po.id,
            entity_code: po.production_number,
            metric_value: actualQty,
            metric_unit: 'paket',
            threshold_value: expectedQty,
            created_at: po.created_at,
            suggested_action: 'Üretim hattındaki fire ve kılıf patlaması oranlarını gözden geçirin.'
          });
        }
      }
    }

    // 2. Parçalama İşlemlerini Tara
    const butcheries = await selectQuery<{
      id: number;
      animal_id: number;
      tag_number: string;
      input_weight: number;
      actual_weight: number;
      waste_weight: number;
      waste_rate: number;
      purchase_cost: number;
      allocated_cost: number;
      created_at: string;
    }>(
      sequelize,
      `SELECT b.id, b.animal_id, a.tag_number, b.input_weight, b.actual_weight,
              b.waste_weight, b.waste_rate, b.purchase_cost, b.allocated_cost, b.created_at
       FROM butchery b
       LEFT JOIN animals a ON b.animal_id = a.id
       ORDER BY b.created_at DESC LIMIT 50`,
      []
    );

    for (const b of butcheries) {
      const wasteRate = Number(b.waste_rate || 0);
      const wasteKg = Number(b.waste_weight || 0);

      // Parçalama Fire Anomalisi (> %14)
      if (wasteRate > 14.0) {
        anomalies.push({
          id: `ANO-BUTCH-WASTE-${b.id}`,
          type: 'butchery_waste',
          severity: wasteRate > 18.0 ? 'critical' : 'warning',
          title: `Parçalamada Yüksek Kemik/Fire Kaybı (${b.tag_number || `#${b.id}`})`,
          description: `${b.input_weight} kg karkas girdisinde ${wasteKg.toFixed(2)} kg (%${wasteRate.toFixed(1)}) fire/atık oluştu. Standart eşik %14.0'tür.`,
          entity_type: 'butchery',
          entity_id: b.id,
          entity_code: b.tag_number || `KESIM-#${b.id}`,
          metric_value: parseFloat(wasteRate.toFixed(1)),
          metric_unit: '% atık',
          threshold_value: 14.0,
          created_at: b.created_at,
          suggested_action: 'Mezbaha parçalama ustasının kesim firelerini ve kemik sıyırma oranını denetleyin.'
        });
      }
    }

    // 3. Kalite & Geri Çağırma Kardeş Parti Riskleri
    const recalledLots = await selectQuery<{
      id: number;
      lot_number: string;
      supplier_name: string;
      production_date: string;
    }>(
      sequelize,
      `SELECT id, lot_number, supplier_name, production_date
       FROM lots
       WHERE status = 'recalled' LIMIT 10`,
      []
    );

    if (recalledLots.length > 0) {
      for (const rl of recalledLots) {
        // Aynı tedarikçiden veya aynı tarihten gelen diğer aktif lotlar
        const siblingLots = await selectQuery<{
          id: number;
          lot_number: string;
          quantity: number;
          unit: string;
        }>(
          sequelize,
          `SELECT id, lot_number, quantity, unit
           FROM lots
           WHERE status = 'active' AND supplier_name = ? AND id != ?
           LIMIT 5`,
          [rl.supplier_name, rl.id]
        );

        for (const sib of siblingLots) {
          anomalies.push({
            id: `ANO-RECALL-SIB-${sib.id}`,
            type: 'recall_risk',
            severity: 'critical',
            title: `Çapraz Kalite Riski: Geri Çağrılan Lotun Kardeş Partisi (${sib.lot_number})`,
            description: `${rl.lot_number} partisi geri çağrıldı. Aynı tedarikçiden (${rl.supplier_name}) gelen aktif ${sib.lot_number} partisi (${sib.quantity} ${sib.unit}) risk taşımaktadır.`,
            entity_type: 'lot',
            entity_id: sib.id,
            entity_code: sib.lot_number,
            metric_value: sib.quantity,
            metric_unit: sib.unit,
            threshold_value: 0,
            created_at: new Date().toISOString(),
            suggested_action: 'Bu partiyi derhal karantinaya alın ve mikrobiyolojik laboratuvar testi yaptırın.'
          });
        }
      }
    }

    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const warningCount = anomalies.filter(a => a.severity === 'warning').length;
    const infoCount = anomalies.filter(a => a.severity === 'info').length;

    res.json({
      summary: {
        total: anomalies.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        healthy: anomalies.length === 0,
      },
      anomalies,
    });
  } catch (error) {
    console.error('Anomali analizi yapılırken hata:', error);
    res.status(500).json({ error: 'Anomali verileri alınamadı' });
  }
}
