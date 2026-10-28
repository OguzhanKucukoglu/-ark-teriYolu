# AVATAR — Akıllı Gıda Tedarik Zinciri, Maliyet Muhasebesi (EKP), Satış ve Lot İzlenebilirlik Platformu

AVATAR platformu; hayvancı (işletme), fason sucuk üreticisi ve perakendeci (market) paydaşları arasındaki hammadde takibi, parçalama, fason üretim, EKP (Eşdeğer Kalite Puanlı) maliyet muhasebesi, e-fatura/belge yönetimi, iki yönlü lot izlenebilirliği, acil ürün geri çağırma (recall) ve yapay zeka destekli verim tahmin/doğrulama süreçlerini uçtan uca yöneten kurumsal bir platformdur.

---

## 🛠️ Mimari & Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Backend API** | Node.js, Express, TypeScript, Sequelize | RESTful servis mimarisi, JWT kimlik doğrulama, işlem (transaction) yönetimi |
| **Frontend Web** | React 18, Vite, TypeScript, Ant Design | Rol bazlı arayüz (İşletme, Üretici, Market), E-Fatura/PDF çıktı motoru, interaktif lot ağacı |
| **Veritabanı** | MySQL 8.0 (InnoDB, UTF8mb4) | İlişkisel veri modeli, ACID desteği, lot hareketleri ve fatura tabloları |
| **Yapay Zeka (ML)** | Python 3.10, FastAPI, scikit-learn | Üretim verim tahmini (Model A), Karkas parçalama tahmini (Model B), Model doğrulama API'leri |
| **Konteynerizasyon** | Docker, Docker Compose | Tek komutla orkestre edilen mikroservis altyapısı |
| **Birim Testleri** | Jest, ts-jest | EKP hesaplamaları, fatura tutarları ve lot üretim testleri |

---

## 🚀 Hızlı Başlangıç (Docker ile Çalıştırma)

Tüm sistemi ayağa kaldırmak için proje kök dizininde şu komutu çalıştırın:

```bash
docker-compose up -d --build
```

### Servis Portları:
* 🌐 **Frontend (Web UI):** [http://localhost:5173](http://localhost:5173)
* ⚙️ **Backend API:** [http://localhost:3000](http://localhost:3000) *(Sağlık Kontrolü: `/health`)*
* 🤖 **Yapay Zeka Servisi (FastAPI):** [http://localhost:8000](http://localhost:8000) *(Swagger Docs: `/docs`)*
* 🗄️ **MySQL Veritabanı:** `localhost:3306`
* 🐬 **phpMyAdmin (Opsiyonel):** [http://localhost:8080](http://localhost:8080)

---

## 👥 Roller ve Demo Giriş Bilgileri

| Rol | E-Posta | Varsayılan Şifre | Görev & Yetkiler |
|---|---|---|---|
| **Hayvancı (İşletme)** | `samet@gmail.com` | `password123` | Parçalama, hammadde stoğu, sucukçuya sipariş verme, toptan satış, lot & recall yönetimi |
| **Fason Üretici (Sucukçu)** | `ahmet@gmail.com` | `password123` | Hizmet ilanı açma, sipariş onaylama, üretim tamamlama, fason hizmet faturası kesme |
| **Perakendeci (Market)** | `eren@gmail.com` | `password123` | İlanlardan mamul sucuk satın alma, satış faturası görüntüleme/PDF, kalite/sorun bildirimi |

---

## 📑 Fatura ve Belge Akışı (İş Kuralları)

Sistemdeki fatura ve maliyet akışı gerçek gıda sanayii ve yarışma şartnamesine tam uyumlu olarak tasarlanmıştır:

1. **Hammadde Girişi (İşletme Stoğu):**
   * İşletme dış tedarikçilerden bağımsız olarak hammadde alımlarını (ör. baharat, bağırsak) doğrudan birim maliyetleriyle kendi stoğuna işler. Dış tedarikçi faturası kesilmez.
2. **Fason Üretim / İşçilik Hizmeti Faturası (`FTR-HZM-...`):**
   * **Kimden Kime:** Sucukçu (Fason Üretici) ➔ Hayvancı (İşletme).
   * **İçerik:** Hammaddeler işletmeye ait olduğundan faturada yalnızca fason işleme/işçilik hizmet bedeli (ör. 85 paket × 5.50 € = 467.50 €) yer alır.
   * **Erişim & PDF:** Hem sucukçu hem de hayvancı faturayı sistemde görüntüler ve resmi e-fatura formatında PDF olarak indirebilir.
3. **Toptan Mamul Satış Faturası (`FTR-SAT-...`):**
   * **Kimden Kime:** Hayvancı (İşletme) ➔ Perakendeci (Market).
   * **İçerik:** Üretilen mamul sucukların marketlere satış bedelidir (ör. 30 paket × 25.00 € = 750.00 €).
   * **Erişim & PDF:** Hem hayvancı hem de market tarafından görüntülenebilir ve PDF olarak indirilebilir.

---

## 💰 Parçalama Maliyet Hesabı Analizi (25 kg vs 22 kg / 351 € Çelişkisi ve Çözümü)

Dokümantasyonda karkas parçalama ve maliyet dağıtımında karşılaşılan **25 kg toplam karkas ağırlığı** ile **22 kg kullanılabilir parça / 351 €** ilişkisi aşağıdaki maliyet muhasebesi prensibiyle çözümlenmiştir:

### 1. Durum Tespiti:
* Hayvan karkas ağırlığı: **25 kg**, toplam maliyet: **351.00 €**.
* Parçalama sonrası elde edilen satılabilir et parçaları (But, Sırt, Omuz, Kaburga, Kıyma, Sakatat): **22.00 kg** (%88).
* Parçalama firesi (Kemik, yağ kırpıntısı, su kaybı/buharlaşma): **3.00 kg** (%12).

### 2. İki Farklı Yaklaşım ve Matematiksel Doğrulama:
* **Hatalı Yaklaşım (Düz Ortalama):**
  $$\text{Birim Fiyat} = \frac{351.00\ €}{25\ \text{kg}} = 14.04\ €/\text{kg}$$
  Bu yaklaşımda fireye de maliyet yüklenir ($3\ \text{kg} \times 14.04 = 42.12\ €$). Ancak fire satılamadığı için $42.12\ €$ işletme zararı olarak kalır ve 22 kg et satıldığında toplam 351 € maliyet kurtarılamaz.
* **AVATAR'da Uygulanan Doğru Yöntem (Net Satılabilir Ağırlık / Absorbsiyon Yöntemi):**
  Firenin ekonomik değeri sıfırdır ($0\ €$). Karkasın 351 € olan toplam maliyeti, **yalnızca satılabilir 22 kg et üzerine paylaştırılır**:
  $$\text{Efektif Kullanılabilir Birim Maliyet} = \frac{351.00\ €}{22.00\ \text{kg}} = 15.9545\ €/\text{kg}$$
  Sistemimizde parçalama reçetesi (`butchery_recipes`) her parçanın ekonomik katsayısını ve fire oranını dikkate alarak maliyeti ağırlıklı olarak dağıtır. Böylece parçaların toplam maliyeti tam olarak **351.00 €**'ya eşitlenir ($\sum \text{Parça Maliyetleri} = 351.00\ €$).

---

## 📊 EKP (Eşdeğer Kalite Puanlı Maliyet) ve Fiyatlandırma Formülü

Sucuk üretiminde EKP; işletmenin hammadde maliyetleri ile sucukçunun fason işçilik bedelinin toplamının net üretilen paket sayısına bölünmesiyle elde edilir:

$$\text{Toplam Hammadde Maliyeti} = \sum (\text{Miktar}_i \times \text{Birim Fiyat}_i)$$
$$\text{Toplam Üretim Maliyeti} = \text{Toplam Hammadde Maliyeti} + \text{Fason Hizmet Bedeli}$$
$$\text{EKP (Birim Maliyet)} = \frac{\text{Toplam Üretim Maliyeti}}{\text{Gerçek Üretilen Paket Sayısı}}$$

### Örnek Yarışma Senaryosu:
* **Hammadde:** 100 kg Et (10 €/kg = 1000 €) + 2 kg Baharat (5 €/kg = 10 €) + 5 kg Bağırsak (3 €/kg = 15 €) = **1025.00 €**
* **Fason İşçilik (Sucukçu Faturası):** 85 paket × 5.50 € = **467.50 €**
* **Toplam Maliyet:** 1025.00 € + 467.50 € = **1492.50 €**
* **EKP:** $1492.50\ € / 85\ \text{paket} = \mathbf{17.5588\ €/\text{paket}}$
* **VKP (%38 Kâr Marjı):** $17.5588 \times 1.38 = \mathbf{24.2312\ €}$
* **Toptan Satış Fiyatı:** 25.00 €/paket $\rightarrow$ **Net Birim Kâr:** $7.4412\ €$ (Brüt Marj: %29.76).

---

## 🤖 Yapay Zeka (ML) Modelleri ve Doğrulama

Sistemde iki adet eğitilmiş makine öğrenmesi modeli bulunmaktadır:
1. **Model A (Üretim Verim ve Fire Tahmini - Gradient Boosting Regressor):**
   * Girdi: Et miktarı, yağ oranı, nem, ortam sıcaklığı, fermantasyon süresi.
   * Çıktı: Beklenen mamul paket sayısı, tahmini fire oranı, tahmini EKP.
   * **Doğrulama Sonucu:** Sabit kural tabanlı (%85 kuralı) yaklaşıma kıyasla **hata oranını %77.7 (adet) ve %96.2 (EKP)** azaltmıştır ($R^2 = 0.984$).
2. **Model B (Karkas Parçalama Verimi - Multi-Output Regressor):**
   * Girdi: Hayvan türü, karkas canlı/soğuk ağırlığı, ırk, yaş.
   * Çıktı: But, sırt, omuz, kaburga, kıyma, sakatat ve fire ağırlıkları.
   * **Doğrulama Sonucu:** Sabit reçete oranlarına kıyasla ortalama mutlak hatayı (MAE) **%44.5** düşürmüştür.

ML doğrulama metrikleri (MAE, RMSE, MAPE, $R^2$) arayüzdeki **Raporlar ve Analiz ➔ Yapay Zeka (ML) Model Doğrulama** sekmesinden canlı olarak incelenebilir.

---

## 🧪 Birim ve Entegrasyon Testleri

Backend testlerini çalıştırmak için:

```bash
cd backend
npm test
```

* Testler; lot numarası üretimi/ayrıştırması, EKP maliyet formülleri, fatura tutarları ve kâr marjı kurallarını tam kapsamlı olarak doğrulamaktadır.
