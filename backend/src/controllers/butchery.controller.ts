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

export async function createButcheryOperation(req: AuthRequest, res: Response): Promise<void> {
  const { animal_type, operation_date, parts, notes } = req.body;

  if (!animal_type || !operation_date || !parts || !Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ error: 'animal_type, operation_date ve parts zorunludur' });
    return;
  }

  const t = await sequelize.transaction();
  try {
    const mainParts         = (parts as ButcheryPartInput[]).filter(p => !p.is_byproduct);
    const totalOutputWeight = (parts as ButcheryPartInput[]).reduce((s, p) => s + (p.actual_weight_kg || 0), 0);
    const totalMainWeight   = mainParts.reduce((s, p) => s + (p.actual_weight_kg || 0), 0);

    // 1. Parçalama operasyonu kaydet (? sayısı = replacements sayısı = 7)
    const operationId = await insertQuery(
      sequelize,
      'INSERT INTO butchery_operations (operator_id, animal_type, operation_date, total_output_kg, waste_kg, total_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user!.id, animal_type, operation_date, totalOutputWeight, 0, 0, notes ?? null],
      t
    );

    // 2. Her parça için lot + butchery_parts + lot_movements oluştur
    const createdParts = [];

    for (const part of parts as ButcheryPartInput[]) {
      // Lot numarası için mevcut sayıyı al
      const countRows = await selectQuery<{ cnt: number }>(
        sequelize,
        "SELECT COUNT(*) as cnt FROM lots WHERE lot_type = 'parca'",
        [],
        t
      );
      const seq       = (countRows[0]?.cnt || 0) + 1;
      const lotNumber = generateLotNumber('parca', seq);

      // Ağırlık bazlı maliyet oranı (şimdilik 0 — maliyet bilgisi yoksa)
      const ratio         = (!part.is_byproduct && totalMainWeight > 0) ? part.actual_weight_kg / totalMainWeight : 0;
      const allocatedCost = 0;
      const unitCost      = 0;

      // Lot kaydı (? = 9)
      const lotId = await insertQuery(
        sequelize,
        'INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, production_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [lotNumber, 'parca', req.user!.id, part.actual_weight_kg, 'kg', unitCost, allocatedCost, operation_date, 'active'],
        t
      );

      // Parça kaydı (? = 7)
      await insertQuery(
        sequelize,
        'INSERT INTO butchery_parts (butchery_operation_id, part_name, actual_weight_kg, allocated_cost, unit_cost, is_byproduct, lot_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [operationId, part.part_name, part.actual_weight_kg, allocatedCost, unitCost, part.is_byproduct ? 1 : 0, lotId],
        t
      );

      // Lot hareketi (? = 5)
      await insertQuery(
        sequelize,
        'INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, to_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lotId, 'giris', part.actual_weight_kg, 'kg', 'butchery', operationId, req.user!.id],
        t
      );

      // Bağırsak parçası aynı zamanda raw_materials'a da kaydedilir
      // (İnek Bağırsağı / Koyun Bağırsağı olarak ayrı tutulur)
      const partNameNorm = part.part_name.toLocaleLowerCase('tr-TR').trim();
      if (partNameNorm === 'bağırsak') {
        // Hayvan türüne göre malzeme adı belirle
        const animalLabel = animal_type.toLocaleLowerCase('tr-TR').includes('inek') || animal_type.toLocaleLowerCase('tr-TR').includes('dana')
          ? 'İnek Bağırsağı'
          : animal_type.toLocaleLowerCase('tr-TR').includes('koyun') || animal_type.toLocaleLowerCase('tr-TR').includes('kuzu')
            ? 'Koyun Bağırsağı'
            : `${animal_type} Bağırsağı`;

        await insertQuery(
          sequelize,
          `INSERT INTO raw_materials (owner_id, lot_id, material_type, quantity, unit, unit_price, total_cost)
           VALUES (?, ?, ?, ?, 'kg', 0, 0)`,
          [req.user!.id, lotId, animalLabel, part.actual_weight_kg],
          t
        );
      }

      createdParts.push({ ...part, lotNumber, lotId, ratio });
    }

    await t.commit();

    res.status(201).json({
      message:       'Parçalama işlemi tamamlandı',
      operationId,
      animalType:    animal_type,
      totalOutputKg: totalOutputWeight,
      partCount:     createdParts.length,
      parts:         createdParts,
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
      'SELECT bp.*, l.lot_number FROM butchery_parts bp LEFT JOIN lots l ON bp.lot_id = l.id WHERE bp.butchery_operation_id = ? ORDER BY bp.actual_weight_kg DESC',
      [req.params.id]
    );

    res.json({ operation: operations[0], parts });
  } catch {
    res.status(500).json({ error: 'Parçalama detayı alınamadı' });
  }
}
