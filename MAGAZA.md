# Microsoft Store'a yükleme adımları

1. https://storedeveloper.microsoft.com adresinden kişisel Microsoft hesabınla **bireysel geliştirici** olarak ücretsiz kayıt ol (kimlik ve selfie doğrulaması).
2. Partner Center'da **Yeni ürün → MSIX veya PWA uygulaması** seç, adı "Namaz Vakti" olarak ayır.
3. Ürün sayfasında **Ürün yönetimi → Ürün kimliği** bölümündeki üç değeri kopyala:
   - `Package/Identity/Name`
   - `Package/Identity/Publisher` (CN=... ile başlar)
   - `Package/Properties/PublisherDisplayName`
4. GitHub deposunda **Settings → Secrets and variables → Actions → Variables** bölümüne bunları ekle:
   - `STORE_IDENTITY_NAME`
   - `STORE_PUBLISHER`
   - `STORE_PUBLISHER_NAME`
5. Yeni bir sürüm etiketi gönder (ya da Actions'tan "Sürüm" iş akışını elle çalıştır). `NamazVakti-Store-x.y.z.appx` dosyası iş akışının "windows" çıktısında oluşur.
6. Partner Center'da bu `.appx` dosyasını yükle, mağaza açıklamasını ve ekran görüntülerini ekleyip incelemeye gönder.

Store paketini Microsoft kendisi imzalar. Bu yüzden ayrıca bir imza sertifikasına gerek yoktur.
