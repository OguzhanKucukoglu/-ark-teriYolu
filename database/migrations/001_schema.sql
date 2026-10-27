-- ============================================================
-- AVATAR Veritabanı Şeması
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- 1. KULLANICILAR VE ROLLER
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150)  NOT NULL,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    role        ENUM('hayvanci','sucukcu','market') NOT NULL,
    phone       VARCHAR(30),
    address     TEXT,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. HAYVAN TÜRLERİ VE PARÇALAMA REÇETELERİ
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS animal_types (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,  -- 'Kuzu', 'Dana', 'Koyun' vb.
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Parçalama reçetesi: her hayvan türü için beklenen parçalar ve ağırlık oranları
CREATE TABLE IF NOT EXISTS butchery_recipes (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    animal_type_id  INT UNSIGNED NOT NULL,
    part_name       VARCHAR(100) NOT NULL,  -- 'But', 'Sırt', 'Omuz', 'Kaburga', 'Kıyma' vb.
    expected_ratio  DECIMAL(5,4) NOT NULL,  -- 0.2500 = %25
    is_byproduct    TINYINT(1) NOT NULL DEFAULT 0,  -- fire/yan ürün mü?
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_type_id) REFERENCES animal_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. LOT / PARTİ YÖNETİMİ
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lots (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lot_number      VARCHAR(50)  NOT NULL UNIQUE,  -- 'ET-2026-001', 'SUC-2026-045'
    lot_type        ENUM('hammadde','mamul','hayvan','parca') NOT NULL,
    owner_id        INT UNSIGNED NOT NULL,           -- hangi kullanıcıya ait
    quantity        DECIMAL(12,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,           -- 'kg', 'adet', 'paket'
    unit_cost       DECIMAL(12,4),                  -- birim maliyet (EKP)
    total_cost      DECIMAL(12,4),
    supplier_name   VARCHAR(150),                   -- hammadde tedarikçisi
    production_date DATE,
    expiry_date     DATE,
    status          ENUM('active','blocked','recalled','consumed','sold') NOT NULL DEFAULT 'active',
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lot hareketleri — hiçbir şey silinmez, her hareket kaydedilir
CREATE TABLE IF NOT EXISTS lot_movements (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lot_id          INT UNSIGNED NOT NULL,
    movement_type   ENUM('giris','cikis','sevk','iade','fire','bloke','satis','transfer') NOT NULL,
    quantity        DECIMAL(12,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,
    reference_type  VARCHAR(50),   -- 'order', 'production_order', 'recall', 'sale' vb.
    reference_id    INT UNSIGNED,  -- ilgili kaydın id'si
    from_user_id    INT UNSIGNED,
    to_user_id      INT UNSIGNED,
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id)       REFERENCES lots(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. HAYVAN GİRİŞİ VE PARÇALAMA
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS animals (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id        INT UNSIGNED NOT NULL,  -- hayvancı
    animal_type_id  INT UNSIGNED NOT NULL,
    lot_id          INT UNSIGNED,           -- hayvan lotu
    entry_weight_kg DECIMAL(10,3) NOT NULL,
    purchase_cost   DECIMAL(12,2) NOT NULL,  -- toplam alış maliyeti
    purchase_date   DATE NOT NULL,
    supplier_name   VARCHAR(150),
    status          ENUM('beklemede','parcalandi') NOT NULL DEFAULT 'beklemede',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id)       REFERENCES users(id),
    FOREIGN KEY (animal_type_id) REFERENCES animal_types(id),
    FOREIGN KEY (lot_id)         REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Parçalama işlemi
CREATE TABLE IF NOT EXISTS butchery_operations (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    animal_id       INT UNSIGNED NOT NULL,
    operator_id     INT UNSIGNED NOT NULL,  -- hayvancı
    operation_date  DATE NOT NULL,
    input_weight_kg DECIMAL(10,3) NOT NULL,
    total_output_kg DECIMAL(10,3),  -- hesaplanır
    waste_kg        DECIMAL(10,3),  -- fire = input - output
    distribution_method ENUM('agirlik','deger') NOT NULL DEFAULT 'agirlik',
    total_cost      DECIMAL(12,2) NOT NULL,  -- dağıtılacak toplam maliyet
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id)   REFERENCES animals(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Parçalama sonucu oluşan parçalar
CREATE TABLE IF NOT EXISTS butchery_parts (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    butchery_operation_id   INT UNSIGNED NOT NULL,
    part_name               VARCHAR(100) NOT NULL,
    actual_weight_kg        DECIMAL(10,3) NOT NULL,
    allocated_cost          DECIMAL(12,4),  -- dağıtılan maliyet
    unit_cost               DECIMAL(12,4),  -- birim maliyet
    is_byproduct            TINYINT(1) NOT NULL DEFAULT 0,
    lot_id                  INT UNSIGNED,   -- oluşan lot
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (butchery_operation_id) REFERENCES butchery_operations(id),
    FOREIGN KEY (lot_id)                REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 5. HAMMADDE STOĞU (Hayvancının elindeki hammaddeler)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS raw_materials (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id        INT UNSIGNED NOT NULL,
    lot_id          INT UNSIGNED NOT NULL,
    material_type   VARCHAR(100) NOT NULL,  -- 'et', 'baharat', 'bağırsak' vb.
    quantity        DECIMAL(12,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,
    unit_price      DECIMAL(12,4) NOT NULL,
    total_cost      DECIMAL(12,2) NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (lot_id)   REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 6. SUCUKCU İLANLARI
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS producer_listings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    producer_id     INT UNSIGNED NOT NULL,  -- sucukçu
    product_name    VARCHAR(150) NOT NULL,  -- 'Narin Sucuk 1kg'
    description     TEXT,
    service_price   DECIMAL(12,4) NOT NULL,  -- birim işçilik/hizmet ücreti
    service_unit    VARCHAR(20)  NOT NULL,   -- 'paket', 'kg' vb.
    min_order_qty   DECIMAL(10,3),
    required_materials TEXT,                -- JSON: hangi hammaddeleri istiyor
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (producer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 7. SİPARİŞLER (Hayvancı → Sucukçu)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_id        INT UNSIGNED NOT NULL,   -- hayvancı
    seller_id       INT UNSIGNED NOT NULL,   -- sucukçu
    listing_id      INT UNSIGNED NOT NULL,
    status          ENUM('beklemede','onaylandi','hammadde_gonderildi','uretimde','tamamlandi','iptal') NOT NULL DEFAULT 'beklemede',
    order_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_qty    DECIMAL(10,3) NOT NULL,  -- beklenen mamul miktarı
    notes           TEXT,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id)  REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES producer_listings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Siparişe bağlı hammadde kalemleri (hayvancının gönderdiği)
CREATE TABLE IF NOT EXISTS order_raw_materials (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id    INT UNSIGNED NOT NULL,
    lot_id      INT UNSIGNED NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    quantity    DECIMAL(12,3) NOT NULL,
    unit        VARCHAR(20)  NOT NULL,
    unit_price  DECIMAL(12,4) NOT NULL,
    total_cost  DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (lot_id)   REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 8. ÜRETİM EMİRLERİ (Sucukçu tarafı — EKP hesabı)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS production_orders (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id            INT UNSIGNED NOT NULL,
    producer_id         INT UNSIGNED NOT NULL,
    production_number   VARCHAR(50) NOT NULL UNIQUE,  -- 'URT-2026-045'
    product_name        VARCHAR(150) NOT NULL,
    expected_qty        DECIMAL(10,3) NOT NULL,
    actual_qty          DECIMAL(10,3),           -- gerçek üretilen miktar
    service_cost        DECIMAL(12,2),           -- toplam hizmet faturası
    total_raw_cost      DECIMAL(12,2),           -- toplam hammadde maliyeti
    ekp                 DECIMAL(12,4),           -- EKP = (hammadde + hizmet) / actual_qty
    status              ENUM('beklemede','uretimde','tamamlandi','sevk_edildi') NOT NULL DEFAULT 'beklemede',
    production_date     DATE,
    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)    REFERENCES orders(id),
    FOREIGN KEY (producer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Üretim emrinde kullanılan hammadde lotları (çoktan çoğa)
CREATE TABLE IF NOT EXISTS production_raw_materials (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    production_order_id     INT UNSIGNED NOT NULL,
    lot_id                  INT UNSIGNED NOT NULL,
    material_type           VARCHAR(100) NOT NULL,
    quantity_used           DECIMAL(12,3) NOT NULL,
    unit                    VARCHAR(20)  NOT NULL,
    unit_price              DECIMAL(12,4) NOT NULL,
    total_cost              DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (lot_id)              REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Üretim sonucu oluşan mamul lotları (çoktan çoğa)
CREATE TABLE IF NOT EXISTS production_finished_lots (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    production_order_id     INT UNSIGNED NOT NULL,
    lot_id                  INT UNSIGNED NOT NULL,
    quantity                DECIMAL(12,3) NOT NULL,
    unit                    VARCHAR(20)  NOT NULL,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (lot_id)              REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 9. HAYVANCı İLANLARI (Market için)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS farmer_listings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    farmer_id       INT UNSIGNED NOT NULL,
    lot_id          INT UNSIGNED NOT NULL,   -- hangi lot satılıyor
    product_name    VARCHAR(150) NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,
    unit_price      DECIMAL(12,4) NOT NULL,
    description     TEXT,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES users(id),
    FOREIGN KEY (lot_id)    REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 10. MARKET SATIN ALMALARI
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_purchases (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    market_id       INT UNSIGNED NOT NULL,
    farmer_id       INT UNSIGNED NOT NULL,
    listing_id      INT UNSIGNED NOT NULL,
    lot_id          INT UNSIGNED NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,
    unit_price      DECIMAL(12,4) NOT NULL,
    total_price     DECIMAL(12,2) NOT NULL,
    status          ENUM('beklemede','onaylandi','sevk_edildi','teslim_alindi') NOT NULL DEFAULT 'beklemede',
    purchase_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    FOREIGN KEY (market_id)  REFERENCES users(id),
    FOREIGN KEY (farmer_id)  REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES farmer_listings(id),
    FOREIGN KEY (lot_id)     REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 11. GERİ ÇAĞIRMA (RECALL)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recalls (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    initiated_by    INT UNSIGNED NOT NULL,   -- hayvancı veya sucukçu
    lot_id          INT UNSIGNED NOT NULL,   -- sorunlu lot
    reason          TEXT NOT NULL,
    status          ENUM('aktif','tamamlandi','iptal') NOT NULL DEFAULT 'aktif',
    affected_count  INT UNSIGNED,            -- etkilenen market sayısı
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (initiated_by) REFERENCES users(id),
    FOREIGN KEY (lot_id)       REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Geri çağırmadan etkilenen market bazlı kayıtlar
CREATE TABLE IF NOT EXISTS recall_affected_markets (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recall_id       INT UNSIGNED NOT NULL,
    market_id       INT UNSIGNED NOT NULL,
    purchase_id     INT UNSIGNED NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    unit            VARCHAR(20)  NOT NULL,
    status          ENUM('bildirildi','iade_alindi','imha_edildi') NOT NULL DEFAULT 'bildirildi',
    notified_at     DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recall_id)  REFERENCES recalls(id),
    FOREIGN KEY (market_id)  REFERENCES users(id),
    FOREIGN KEY (purchase_id) REFERENCES market_purchases(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 12. BİLDİRİMLER
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    type            VARCHAR(50)  NOT NULL,   -- 'siparis', 'sevkiyat', 'recall' vb.
    title           VARCHAR(200) NOT NULL,
    message         TEXT,
    reference_type  VARCHAR(50),
    reference_id    INT UNSIGNED,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
