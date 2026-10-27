-- ============================================================
-- AVATAR Örnek Veriler
-- ============================================================

-- Kullanıcılar (şifreler bcrypt hash — plain: 'password123')
INSERT INTO users (name, email, password, role, phone, address) VALUES
('Ahmet Yılmaz',   'ahmet@hayvanci.com',  '$2b$10$example_hash_hayvanci',  'hayvanci', '05551234567', 'Ankara, Türkiye'),
('Mehmet Sucuk',   'mehmet@sucukcu.com',  '$2b$10$example_hash_sucukcu',   'sucukcu',  '05559876543', 'Afyon, Türkiye'),
('Süpermarket A',  'market_a@market.com', '$2b$10$example_hash_market_a',  'market',   '05551111111', 'İstanbul, Türkiye'),
('Süpermarket B',  'market_b@market.com', '$2b$10$example_hash_market_b',  'market',   '05552222222', 'İzmir, Türkiye'),
('Süpermarket C',  'market_c@market.com', '$2b$10$example_hash_market_c',  'market',   '05553333333', 'Bursa, Türkiye');

-- Hayvan Türleri
INSERT INTO animal_types (name, description) VALUES
('Kuzu',  'Küçükbaş hayvan — kuzu'),
('Dana',  'Büyükbaş hayvan — dana'),
('Koyun', 'Küçükbaş hayvan — koyun');

-- Kuzu Parçalama Reçetesi (toplam fire dahil = 1.0000)
INSERT INTO butchery_recipes (animal_type_id, part_name, expected_ratio, is_byproduct) VALUES
(1, 'But',     0.2800, 0),
(1, 'Sırt',    0.1800, 0),
(1, 'Omuz',    0.1600, 0),
(1, 'Kaburga', 0.1200, 0),
(1, 'Kıyma',   0.1500, 0),
(1, 'Sakatat', 0.0600, 0),
(1, 'Fire',    0.0500, 1);

-- Dana Parçalama Reçetesi
INSERT INTO butchery_recipes (animal_type_id, part_name, expected_ratio, is_byproduct) VALUES
(2, 'But',      0.3000, 0),
(2, 'Sırt',     0.2000, 0),
(2, 'Omuz',     0.1500, 0),
(2, 'Kaburga',  0.1200, 0),
(2, 'Kıyma',    0.1600, 0),
(2, 'Sakatat',  0.0500, 0),
(2, 'Fire',     0.0200, 1);

-- Sucukçu İlanı
INSERT INTO producer_listings (producer_id, product_name, description, service_price, service_unit, min_order_qty, required_materials) VALUES
(2, 'Narin Sucuk 1kg', 'Geleneksel yöntemle üretilen narin sucuk', 5.50, 'paket', 50, 
 '{"et_kg": 100, "baharat_kg": 2, "bagırsak_kg": 5}');

-- ============================================================
-- GÖREV 1 Demo Verisi: ET-2026-001 → URT-2026-045 → SUC-2026-045
-- ============================================================

-- Hammadde Lotları
INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, supplier_name, production_date, status) VALUES
('ET-2026-001',   'hammadde', 1, 100.000, 'kg',   9.7000,  970.00, 'Et Tedarik A.Ş.', '2026-01-10', 'active'),
('BAH-2026-001',  'hammadde', 1,   2.000, 'kg',  24.0000,   48.00, 'Baharat Ltd.',    '2026-01-10', 'active'),
('BAG-2026-001',  'hammadde', 1,   5.000, 'kg',  11.6000,   58.00, 'Bağırsak A.Ş.',   '2026-01-10', 'active');

-- Hammadde Stok Kayıtları
INSERT INTO raw_materials (owner_id, lot_id, material_type, quantity, unit, unit_price, total_cost) VALUES
(1, 1, 'et',       100.000, 'kg',  9.7000,  970.00),
(1, 2, 'baharat',    2.000, 'kg', 24.0000,   48.00),
(1, 3, 'bağırsak',   5.000, 'kg', 11.6000,   58.00);

-- Sipariş
INSERT INTO orders (buyer_id, seller_id, listing_id, status, expected_qty) VALUES
(1, 2, 1, 'tamamlandi', 85.000);

-- Üretim Emri
INSERT INTO production_orders 
(order_id, producer_id, production_number, product_name, expected_qty, actual_qty, service_cost, total_raw_cost, ekp, status, production_date) VALUES
(1, 2, 'URT-2026-045', 'Narin Sucuk 1kg', 85.000, 85.000, 467.50, 1076.00, 18.1588, 'sevk_edildi', '2026-01-15');

-- Üretimde kullanılan hammadde lotları
INSERT INTO production_raw_materials (production_order_id, lot_id, material_type, quantity_used, unit, unit_price, total_cost) VALUES
(1, 1, 'et',       100.000, 'kg',  9.7000,  970.00),
(1, 2, 'baharat',    2.000, 'kg', 24.0000,   48.00),
(1, 3, 'bağırsak',   5.000, 'kg', 11.6000,   58.00);

-- Mamul Lotu
INSERT INTO lots (lot_number, lot_type, owner_id, quantity, unit, unit_cost, total_cost, production_date, status) VALUES
('SUC-2026-045', 'mamul', 1, 85.000, 'paket', 18.1588, 1543.50, '2026-01-15', 'active');

-- Üretim - Mamul lot bağlantısı
INSERT INTO production_finished_lots (production_order_id, lot_id, quantity, unit) VALUES
(1, 4, 85.000, 'paket');

-- Hayvancı İlanı (market için)
INSERT INTO farmer_listings (farmer_id, lot_id, product_name, quantity, unit, unit_price, description) VALUES
(1, 4, 'Narin Sucuk 1kg', 85.000, 'paket', 25.00, 'Özel üretim Narin Sucuk, lot: SUC-2026-045');

-- Market Satın Almaları
INSERT INTO market_purchases (market_id, farmer_id, listing_id, lot_id, quantity, unit, unit_price, total_price, status) VALUES
(3, 1, 1, 4, 30.000, 'paket', 25.00,  750.00, 'teslim_alindi'),  -- Market A: 30
(4, 1, 1, 4, 25.000, 'paket', 25.00,  625.00, 'teslim_alindi'),  -- Market B: 25
(5, 1, 1, 4, 30.000, 'paket', 25.00,  750.00, 'teslim_alindi');  -- Market C: 30

-- Lot Hareketleri
INSERT INTO lot_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, from_user_id, to_user_id) VALUES
(1, 'giris',  100.000, 'kg',    'raw_material', 1, NULL, 1),
(2, 'giris',    2.000, 'kg',    'raw_material', 2, NULL, 1),
(3, 'giris',    5.000, 'kg',    'raw_material', 3, NULL, 1),
(1, 'sevk',   100.000, 'kg',    'order',        1, 1,    2),
(2, 'sevk',     2.000, 'kg',    'order',        1, 1,    2),
(3, 'sevk',     5.000, 'kg',    'order',        1, 1,    2),
(4, 'giris',   85.000, 'paket', 'production_order', 1, NULL, 1),
(4, 'satis',   30.000, 'paket', 'market_purchase',  1, 1, 3),
(4, 'satis',   25.000, 'paket', 'market_purchase',  2, 1, 4),
(4, 'satis',   30.000, 'paket', 'market_purchase',  3, 1, 5);
