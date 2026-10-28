-- ============================================================
-- AVATAR: Paket Standartı (1 kg/paket) ve Fire (Kayıp) Sütunları
-- ============================================================

ALTER TABLE production_orders
ADD COLUMN package_weight DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT 'Paket gramajı standartı (1 kg/paket)',
ADD COLUMN total_input_kg DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Kullanılan toplam hammadde ağırlığı (kg)',
ADD COLUMN fire_qty DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Kuruma, kırım ve dolum firesi miktarı (kg)',
ADD COLUMN fire_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Üretim fire oranı (%)';

-- Mevcut tamamlanmış sipariş 1 için fire değerlerini güncelle
UPDATE production_orders po
LEFT JOIN (
    SELECT production_order_id, COALESCE(SUM(quantity_used), 0) as total_kg
    FROM production_raw_materials
    GROUP BY production_order_id
) rm ON po.id = rm.production_order_id
SET 
    po.package_weight = 1.00,
    po.total_input_kg = COALESCE(rm.total_kg, 4.300),
    po.fire_qty = GREATEST(0, COALESCE(rm.total_kg, 4.300) - (COALESCE(po.actual_qty, 4) * 1.00)),
    po.fire_rate = CASE 
        WHEN COALESCE(rm.total_kg, 4.300) > 0 THEN 
            ROUND((GREATEST(0, COALESCE(rm.total_kg, 4.300) - (COALESCE(po.actual_qty, 4) * 1.00)) / COALESCE(rm.total_kg, 4.300)) * 100, 2)
        ELSE 0 
    END
WHERE po.status = 'tamamlandi';
