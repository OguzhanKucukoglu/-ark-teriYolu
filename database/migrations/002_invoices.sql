-- ============================================================
-- AVATAR Fatura Tablosu (Hizmet ve Satış Faturaları)
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_number      VARCHAR(50)  NOT NULL UNIQUE,
    invoice_type        ENUM('hizmet', 'satis') NOT NULL,  -- 'hizmet' (Sucukçu -> İşletme), 'satis' (İşletme -> Market)
    sender_id           INT UNSIGNED NOT NULL,             -- Düzenleyen
    receiver_id         INT UNSIGNED NOT NULL,             -- Alıcı
    reference_type      VARCHAR(50)  NOT NULL,             -- 'production_order' veya 'market_purchase'
    reference_id        INT UNSIGNED NOT NULL,             -- İlgili işlem ID
    lot_number          VARCHAR(50),
    product_name        VARCHAR(150) NOT NULL,
    description         TEXT,
    quantity            DECIMAL(12,3) NOT NULL,
    unit                VARCHAR(20)  NOT NULL,
    unit_price          DECIMAL(12,4) NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL,
    tax_rate            DECIMAL(5,2) DEFAULT 0.00,
    tax_amount          DECIMAL(12,2) DEFAULT 0.00,
    total_amount        DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(10) DEFAULT '€',
    status              ENUM('odendi', 'beklemede', 'iptal') DEFAULT 'odendi',
    invoice_date        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mevcut Demo İşlemlerine Ait Faturalar (Sucukçu ID: 3, Hayvancı ID: 2, Market ID: 4)
INSERT INTO invoices 
(id, invoice_number, invoice_type, sender_id, receiver_id, reference_type, reference_id, lot_number, product_name, description, quantity, unit, unit_price, subtotal, tax_rate, tax_amount, total_amount, currency, status, invoice_date)
VALUES
-- 1. Sucukçu Ahmet -> Hayvancı Oğuzhan (Fason İşçilik / Hizmet Faturası: 4 paket x 1.40 € = 5.60 €)
(1, 'FTR-HZM-2026-001', 'hizmet', 3, 2, 'production_order', 1, 'SUC-2026-001', 'Narin Sucuk 1kg - Fason Üretim / İşçilik Hizmeti', 'Hammaddeler işletmeye (hayvancı) aittir; hizmet bedeli fason işçilik faturasıdır.', 4.000, 'paket', 1.4000, 5.60, 0.00, 0.00, 5.60, '€', 'odendi', '2026-10-27 14:13:00'),

-- 2. Hayvancı Oğuzhan -> Market Eren (Satış Faturası: 1 paket x 2.00 € = 2.00 €)
(2, 'FTR-SAT-2026-001', 'satis', 2, 4, 'market_purchase', 1, 'SUC-2026-001', 'Narin Sucuk 1kg', 'Toptan sucuk mamul satışı faturası.', 1.000, 'paket', 2.0000, 2.00, 0.00, 0.00, 2.00, '€', 'odendi', '2026-10-27 14:40:00')
ON DUPLICATE KEY UPDATE 
    invoice_number = VALUES(invoice_number),
    sender_id = VALUES(sender_id),
    receiver_id = VALUES(receiver_id);
