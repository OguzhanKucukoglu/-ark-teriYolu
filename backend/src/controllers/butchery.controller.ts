import { Response } from 'express';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateLotNumber } from '../utils/lotNumberGenerator';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

interface ButcheryPartInput {
  part_name: string;
  actual_weight_kg: number;
  is_byproduct?: boolean;
}

// ── Değer Ağırlıklı Dağıtım İçin Piyasa Çarpanları (Market Multipliers) ─────────
export const PART_VALUE_MULTIPLIERS: Record<string, number> = {
  // Koyun / Kuzu
  'pirzola':          2.2, // En değerli kuzu eti
  'sırt / kontrfile': 1.8,
  'sırt':             1.8,
  'but':              1.3,
  'kol / omuz':       1.1,
  'kol':              1.1,
  'omuz':             1.1,
  'kaburga':          0.9,
  'incik':            0.9,
  'gerdan':           0.8,
  'kıyma / kuşbaşı':  1.0,
  'kıyma':            1.0,
  'kuşbaşı':          1.1,
  'bağırsak':         0.3,

  // İnek / Dana
  'antrikot':         2.5,
  'bonfile':          2.8,
  'kontrfile':        2.2,
  'kontrifile':       2.2,
  'sokum':            1.5,
  'tavuk':            1.0,
};

export function getPartMultiplier(partName: string): number {
  const norm = partName.toLowerCase().trim();
  for (const [key, mult] of Object.entries(PART_VALUE_MULTIPLIERS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return mult;
    }
  }
  return 1.0;
}

export async function createButcheryOperation(req: AuthRequest, res: Response): Promise<void> {
  const {
    animal_type,
    animal_ear_tag,
    operation_date,
    input_weight_kg,
    total_cost,
    unit_cost_input,
    distribution_method,
    currency,
    parts,
    notes,
  } = req.body;
  const curr = currency ? String(currency).trim().toUpperCase() : 'EUR';

  if (!animal_type || !operation_date || !parts || !Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ error: 'animal_type, operation_date ve parts zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const totalOutputWeight = (parts as ButcheryPartInput[]).reduce((s, p) => s + (Number(p.actual_weight_kg) || 0), 0);
    const inputWeight = Number(input_weight_kg) > 0 ? Number(input_weight_kg) : totalOutputWeight;
    const totalCost = Number(total_cost) > 0 ? Number(total_cost) : (Number(unit_cost_input || 0) * inputWeight);
    const unitCostIn = inputWeight > 0 ? (totalCost / inputWeight) : 0;
    const wasteKg = Math.max(0, parseFloat((inputWeight - totalOutputWeight).toFixed(3)));
    const distMethod = distribution_method === 'deger' ? 'deger' : 'agirlik';

    // ── 1. Maliyet Dağıtım Hesaplaması (Şartname Görev 2) ───────────────────
    let totalWeightedPoints = 0;
    if (distMethod === 'deger') {
      totalWeightedPoints = (parts as ButcheryPartInput[]).reduce((s, p) => {
        const mult = getPartMultiplier(p.part_name);
        return s + (Number(p.actual_weight_kg || 0) * mult);
      }, 0);
    }

    const calculatedParts = (parts as ButcheryPartInput[]).map(p => {
      const w = Number(p.actual_weight_kg || 0);
      let ratio = 0;
      if (distMethod === 'deger' && totalWeightedPoints > 0) {
        const mult = getPartMultiplier(p.part_name);
        ratio = (w * mult) / totalWeightedPoints;
      } else if (totalOutputWeight > 0) {
        ratio = w / totalOutputWeight;
      }

      const allocatedCost = parseFloat((totalCost * ratio).toFixed(4));
      const unitCost = w > 0 ? parseFloat((allocatedCost / w).toFixed(4)) : 0;

      return {
        ...p,
        ratio,
        allocatedCost,
        unitCost,
      };
    });

    // Yuvarlama farkını dengeleyerek toplamın kuruşu kuruşuna eşit olmasını sağla
    const sumAllocated = calculatedParts.reduce((s, p) => s + p.allocatedCost, 0);
    const roundingDiff = parseFloat((totalCost - sumAllocated).toFixed(4));
    if (Math.abs(roundingDiff) > 0.0001 && calculatedParts.length > 0) {
      calculatedParts[0].allocatedCost = parseFloat((calculatedParts[0].allocatedCost + roundingDiff).toFixed(4));
      if (Number(calculatedParts[0].actual_weight_kg) > 0) {
        calculatedParts[0].unitCost = parseFloat((calculatedParts[0].allocatedCost / Number(calculatedParts[0].actual_weight_kg)).toFixed(4));
      }
    }

    // ── 2. Parçalama operasyonu kaydet ───────────────────────────────────────
    const operationId = await insertQuery(
      sequelize,
      `INSERT INTO butchery_operations (
        operator_id, animal_type, animal_ear_tag, operation_date,
        input_weight_kg, total_output_kg, waste_kg,
        total_cost, unit_cost_input, distribution_method, currency, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user!.id,
        animal_type,
        animal_ear_tag || null,
        operation_date,
        inputWeight,
        totalOutputWeight,
        wasteKg,
        totalCost,
        unitCostIn,
        distMethod,
        curr,
        notes ?? null,
      ],
      t
    );

    // ── 3. Her parça için lot + butchery_parts + lot_movements oluştur ────────
    const createdParts = [];

    for (const part of calculatedParts) {
      const countRows = await selectQuery<{ cnt: number }>(
        sequelize,
        "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'parca'",
        [],
        t
      );
      const seq = (countRows[0]?.cnt || 0) + 1;
      const lotNumber = generateLotNumber('parca', seq);

      // Lot kaydı: Dağıtılan gerçek birim maliyet ve toplam maliyet ile
      const lotId = await insertQuery(
        sequelize,
        `INSERT INTO lots (
          lot_number, lot_type, owner_id, quantity, unit,
          unit_cost, total_cost, currency, production_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lotNumber,
          'parca',
          req.user!.id,
          part.actual_weight_kg,
          'kg',
          part.unitCost,
          part.allocatedCost,
          curr,
          operation_date,
          'active',
        ],
        t
      );

      // Parça kaydı
      await insertQuery(
        sequelize,
        `INSERT INTO butchery_parts (
          butchery_operation_id, part_name, actual_weight_kg,
          allocated_cost, unit_cost, is_byproduct, lot_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          part.part_name,
          part.actual_weight_kg,
          part.allocatedCost,
          part.unitCost,
          part.is_byproduct ? 1 : 0,
          lotId,
        ],
        t
      );

      // Lot hareketi
      await insertQuery(
        sequelize,
        `INSERT INTO lot_movements (
          lot_id, movement_type, quantity, unit, reference_type, reference_id, to_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lotId, 'giris', part.actual_weight_kg, 'kg', 'butchery', operationId, req.user!.id],
        t
      );

      // Bağırsak parçası aynı zamanda raw_materials'a da kaydedilir
      const partNameNorm = part.part_name.toLocaleLowerCase('tr-TR').trim();
      if (partNameNorm === 'bağırsak') {
        const animalLabel = animal_type.toLocaleLowerCase('tr-TR').includes('inek') || animal_type.toLocaleLowerCase('tr-TR').includes('dana')
          ? 'İnek Bağırsağı'
          : animal_type.toLocaleLowerCase('tr-TR').includes('koyun') || animal_type.toLocaleLowerCase('tr-TR').includes('kuzu')
            ? 'Koyun Bağırsağı'
            : `${animal_type} Bağırsağı`;

        await insertQuery(
          sequelize,
          `INSERT INTO raw_materials (owner_id, lot_id, material_type, quantity, unit, unit_price, total_cost, currency)
           VALUES (?, ?, ?, ?, 'kg', ?, ?, ?)`,
          [req.user!.id, lotId, animalLabel, part.actual_weight_kg, part.unitCost, part.allocatedCost, curr],
          t
        );
      }

      createdParts.push({ ...part, lotNumber, lotId });
    }

    await t.commit();

    res.status(201).json({
      message:            'Parçalama işlemi tamamlandı',
      operationId,
      animalType:         animal_type,
      animalEarTag:       animal_ear_tag,
      inputWeightKg:      inputWeight,
      totalOutputKg:      totalOutputWeight,
      wasteKg,
      totalCost,
      distributionMethod: distMethod,
      partCount:          createdParts.length,
      parts:              createdParts,
    });
  } catch (error) {
    await t.rollback();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('PARCALAMA_HATA:', errMsg);
    res.status(500).json({ error: 'Parçalama işlemi kaydedilemedi', detail: errMsg });
  }
}

export async function getButcheryOperations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const operations = await selectQuery(
      sequelize,
      'SELECT * FROM butchery_operations WHERE operator_id = ? ORDER BY operation_date DESC, created_at DESC',
      [req.user!.id]
    );
    res.json(operations);
  } catch {
    res.status(500).json({ error: 'Parçalama işlemleri alınamadı' });
  }
}

export async function getButcheryById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const operations = await selectQuery(
      sequelize,
      'SELECT * FROM butchery_operations WHERE id = ? AND operator_id = ?',
      [req.params.id, req.user!.id]
    );

    if (operations.length === 0) {
      res.status(404).json({ error: 'İşlem bulunamadı' });
      return;
    }

    const parts = await selectQuery(
      sequelize,
      `SELECT bp.*, l.lot_number
       FROM butchery_parts bp
       LEFT JOIN lots l ON bp.lot_id = l.id
       WHERE bp.butchery_operation_id = ?
       ORDER BY bp.actual_weight_kg DESC`,
      [req.params.id]
    );

    res.json({ operation: operations[0], parts });
  } catch {
    res.status(500).json({ error: 'Parçalama detayı alınamadı' });
  }
}
