# AVATAR — Kiro yeni oturum aktarım notu

Kaynak: 26–27 Ekim 2026 tarihli Kiro sohbet dışa aktarımı (`messages.jsonl`, `session.json`, alt görev kayıtları). Bu belge sohbet kayıtlarından türetilmiştir; güncel proje kodu ve veritabanıyla mutlaka karşılaştırılmalıdır.

## Kullanıcının hedefi
Gıda işletmesinde hammadde, üretim, maliyet, satış, lot takibi ve geri çağırma. Üç rol: işletme/hayvancı, üretici/sucukçu ve market. İşletme parçalama yapar, hammaddeleri stoklar, sucukçunun üretim ilanlarını görüp üretim siparişi verir, mamulü alır ve markete satar. Üretici üretim ilanı verir, işletmelerden sipariş alır ve üretir. Geri çağırma yetkisi yalnızca işletmede olmalı. Önceki görüşmelerde EKP, Kotlin Android satış ve ML tahminleri daha geniş proje hedefidir; mevcut çalışma web uygulamasıdır.

## Seçilen teknik mimari
- Proje çalışma dizini: `C:\Users\kucuk\Desktop\AVATAR`
- Backend: Node.js, Express, TypeScript, Sequelize, MySQL
- Frontend: Vite, React, TypeScript, Ant Design
- Docker Compose altyapısı: MySQL, backend, ML servisleri; geliştirme sırasında frontend host makinede Vite ile çalıştırılmıştır.
- Daha önce çalışan adresler: `http://localhost:5173` (frontend), `http://localhost:3000` (API), `http://localhost:8080` (phpMyAdmin), `http://localhost:8000` (ML). Bunlar güncel çalışma durumu garantisi değildir.
- Kullanıcı event-driven sync yaklaşımını seçti; ne ölçüde uygulandığı güncel koddan doğrulanmalı.

## Kesin kullanıcı kararları ve önceki işler
1. Kayıt: ad-soyad, e-posta, şifre, şifre tekrar; ardından 3 kareden rol seçimi (İşletme/Hayvancı, Üretici/Sucukçu, Market), işletme adı.
2. İşletmede **Hayvanlarım** özelliği İSTENMİYOR: `animals`, `animal_types`, `butchery_recipes` tabloları ve ilgili bağımlılıklar kaldırıldı olarak raporlandı. Parçalama `animal_id` olmadan `animal_type` ile yapılmalı.
3. Parçalama seçimleri: İnek (Gerdan, Antrikot, Kaburga, Kontrfile, Bonfile, Sokum, Bağırsak, Kol), Koyun/Kuzu (Pirzola, But, Kol, Kaburga, Bağırsak, Gerdan, İncik), Tavuk (Bütün tavuk); her parça için kg girişi. Liste ve lot işlemleri mevcut.
4. Parçalamadaki `500` ve `toFixed` tip hataları için `dbHelpers.ts` ve UI düzeltmeleri yapılmış olduğu raporlandı; Sequelize için `decimalNumbers: true` ayarı da konuşmada uygulandı.
5. İşletmenin **Hammadde Stoğu** sayfası: sarımsak, yağ, tuz, jelatin, ilikli kemik suyu, yumurta akı, baharat, kırmızı pancar suyu, yoğurt, salça, çemen; miktar/fiyat/lot takibi.
6. Üretici ürün ilanları: Sucuk, Salam, Sosis, Pastırma; gereken hammaddeler ve miktarları, üretim hizmet fiyatı, minimum sipariş vb. alanlar. Üreticinin ilanları işletmeye görünmeli, markete değil.
7. Üretici menüsünde geri çağırma ve lot yönetimi OLMAMALI. Üretici menüsü: İlanlarım, Gelen Siparişler, Üretim. Geri çağırma yalnızca işletmeye ait.
8. İşletme için **Sucukçu İlanları** sayfası yapılmış: kartlarla ürün, üretici, fiyat, açıklama, hammaddeler, minimum sipariş miktarı ve detay.

## Son kullanıcı talebi — ÖNCELİKLİ
**“Sucukçunun İlanlarım sayfasında ilanı düzenleme pasife alma gibi işlevleri olsun.”**

### Sohbet kesilmeden önce yapılanlar
- `backend/src/routes/listing.routes.ts` üzerinde güncelleme başladı. İlk `str_replace` denemesinin biri başarısız oldu, ardından dosya `fs_write` ile yeniden yazıldı.
- Backend TypeScript kontrol komutu `Exit Code: 0` ile tamamlandı.
- `frontend/src/services/api.ts` dosyasına yeni metotlar eklemek üzere bir `str_replace` başarılı oldu.
- Ardından kullanıcı birkaç kez “Nerede kaldık?” sordu ve istekler sohbet JSON hatası nedeniyle tamamlanamadı.
- **İlanlarım sayfasının arayüzüne düzenleme/pasifleştirme eklenmiş olduğu doğrulanmıyor. İş bitmiş varsayılmamalı.**

### Yeni oturumda izlenecek güvenli yol
1. Öncelikle workspace içindeki güncel `backend/src/routes/listing.routes.ts`, `frontend/src/services/api.ts` ve üretici `İlanlarım` sayfasının component dosyasını okuyun. Gerekli DB şemasını da gözden geçirin.
2. Backend ilan düzenleme ve aktif/pasif endpoint'leri gerçekten mevcut mu; endpoint'ler yalnızca ilanın sahibi olan üreticiye izin veriyor mu; ilan statüsü DB ile uyumlu mu kontrol edin.
3. Gerekliyse eksikleri tamamlayın. Üretici `İlanlarım` ekranına düzenleme modalı/formu ve aktif/pasif butonu ekleyin; kullanıcı mevcut ilanı değiştirebilmeli.
4. Pasif ilanların işletmenin ilan keşif ekranında görünmemesi için filtreyi doğrulayın. Var olan siparişlerin verisini silmeyin. İlanı silmek yerine pasife almak önceliklidir.
5. Backend ve frontend TypeScript kontrolünü çalıştırın; API ve arayüzde temel akışı test edin. Sonuçları açıkça raporlayın.
6. Kullanıcının istemediği `Hayvanlarım` sistemini geri getirmeyin; geri çağırma üreticiye açılmamalı.

## Önemli kısıt
Bu not geçmiş mesajlara dayanır; kodun gerçek güncel hali bu sohbete yüklenmemiştir. Kiro proje klasörünü görerek doğrulayabilir. Eski sohbet yedeği silinmemelidir.
