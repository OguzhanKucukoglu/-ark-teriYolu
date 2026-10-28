-- ============================================================
-- AVATAR: Görev 2 - Bütün Kuzu Parçalama ve Maliyet Dağıtım Anahtarı
-- ============================================================

-- butchery_operations tablosunda eksik sütunları tamamla
ALTER TABLE butchery_operations
ADD COLUMN IF NOT EXISTS input_weight_kg DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Giriş hayvanı ağırlığı (kg)',
ADD COLUMN IF NOT EXISTS animal_ear_tag VARCHAR(50) NULL COMMENT 'Giriş hayvanı küpe no veya parti kodu',
ADD COLUMN IF NOT EXISTS unit_cost_input DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Giriş hayvanı kg alış fiyatı (€/kg)',
ADD COLUMN IF NOT EXISTS distribution_method VARCHAR(30) NOT NULL DEFAULT 'agirlik' COMMENT 'Maliyet dağıtım anahtarı: agirlik veya deger';

-- butchery_parts tablosunda eksik sütunlar
ALTER TABLE butchery_parts
ADD COLUMN IF NOT EXISTS allocated_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Dağıtılan toplam maliyet tutarı (€)',
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Parça kg birim maliyeti (€/kg)';
