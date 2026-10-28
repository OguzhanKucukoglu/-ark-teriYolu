-- ============================================================
-- AVATAR: Çoklu Para Birimi Desteği (EUR, TRY, USD, GBP)
-- ============================================================

-- raw_materials tablosuna currency ekle
ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Para Birimi (EUR, TRY, USD, GBP)';

-- lots tablosuna currency ekle
ALTER TABLE lots
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Para Birimi';

-- butchery_operations tablosuna currency ekle
ALTER TABLE butchery_operations
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Alış Maliyeti Para Birimi';

-- farmer_listings tablosuna currency ekle
ALTER TABLE farmer_listings
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Satış Para Birimi';

-- market_purchases tablosuna currency ekle
ALTER TABLE market_purchases
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Satın Alma Para Birimi';

-- orders tablosuna currency ekle
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Sipariş Para Birimi';

-- producer_listings tablosuna currency ekle
ALTER TABLE producer_listings
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR' COMMENT 'Hizmet Bedeli Para Birimi';
