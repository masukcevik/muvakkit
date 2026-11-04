# Namaz Vakti

Çalışırken, ders çalışırken ya da başka bir işle meşgulken namaz vakitlerini ekranın köşesinde sessizce gösteren masaüstü uygulaması.

**Ücretsiz, reklamsız, hesap gerektirmez ve internete bağlanmaz.**

## Özellikler

- **Köşe göstergesi:** Sıradaki vakti ve ne kadar süre kaldığını gösterir. Göstergenin üstüne tıkladığında tıklama arkasındaki pencereye geçer, yani işine engel olmaz.
- **Ctrl + tık** ile vakitler penceresi açılır, **Ctrl + sürükle** ile gösterge taşınır.
- **Sessiz hatırlatma:** Vakte yaklaşırken göstergenin etrafında ince bir çerçeve çıkar. Vakit girince gösterge birkaç dakika renklenir ve bir Windows bildirimi gelir.
- **Oyun ve video sırasında:** Tam ekran bir uygulama açıkken gösterge neredeyse görünmez olur ve tıklamaları engellemez.
- **Tamamen özelleştirilebilir:** Renkler, saydamlık, boyut, köşe yuvarlaklığı, satırlarda ne yazacağı ve hazır temalar.
- **81 il** için Diyanet yöntemiyle hesaplanan vakitler ve Diyanet takvimiyle uyumlu **Hicri tarih**.

## İndirme

En son sürüm [Releases](../../releases) sayfasında:

| Dosya | Ne için |
|---|---|
| `NamazVakti-Kurulum-x.y.z.exe` | Windows kurulum dosyası (önerilen) |
| `NamazVakti-Windows-x.y.z.zip` | Kurulum gerektirmeyen Windows sürümü |
| `NamazVakti-macOS-...dmg` | macOS (deneme aşamasında) |

> **Windows uyarısı:** Uygulama henüz dijital olarak imzalanmadığı için Windows "Bilgisayarınız korundu" uyarısı gösterebilir. "Ek bilgi" ve ardından "Yine de çalıştır" seçeneğiyle açabilirsin. Microsoft Store sürümü hazırlanıyor. O sürümde bu uyarı çıkmayacak.

## Vakitlerin doğruluğu

Vakitler, Diyanet İşleri Başkanlığı'nın kullandığı hesaplama yöntemiyle ([adhan](https://github.com/batoulapps/adhan-js) kütüphanesinin "Turkey" yöntemi) bilgisayarda hesaplanır. Diyanet'in yayımladığı tablolarla aralarında **1–2 dakika** fark olabilir. Hicri tarih, Diyanet'in 2026–2027 dini günler takvimiyle karşılaştırılarak doğrulanmıştır.

## Gizlilik

Uygulama hiçbir veri toplamaz, hiçbir sunucuya bağlanmaz. Ayarlar sadece senin bilgisayarında saklanır.

## İndirdiğin dosyanın gerçekten bu depodan geldiğini doğrulama

Releases sayfasındaki her dosya, GitHub'ın sunucularında doğrudan bu depodaki koddan derlenir ve kaynağı işaretlenir (build provenance). Bir dosyanın değiştirilmediğini [GitHub CLI](https://cli.github.com) ile kontrol edebilirsin:

```
gh attestation verify NamazVakti-Kurulum-1.0.0.exe --repo masukcevik/namaz-vakti
```

Uygulamayı yalnızca bu deponun Releases sayfasından ya da Microsoft Store'dan indir.

## Geliştirme

```
npm install
npm start          # uygulamayı çalıştırır
npm run dist       # bu bilgisayar için paket üretir (dist/ klasörüne)
```

Yeni bir sürüm yayınlamak için `package.json` içindeki sürümü artırıp `v1.2.3` biçiminde bir etiket göndermen yeterli. GitHub Actions paketleri derler ve Releases sayfasında bir taslak oluşturur.

## Lisans

Copyright (C) 2026 Maşuk

Bu program özgür yazılımdır: **GNU Genel Kamu Lisansı (GPL) sürüm 3** ya da (tercihine göre) sonraki bir sürümün koşulları altında dağıtabilir ve değiştirebilirsin. Ayrıntılar için [LICENSE](LICENSE) dosyasına bak.

Bu lisansa göre, kodu kullanan ya da değiştiren herkes kendi sürümünü de aynı lisansla, kaynak koduyla birlikte ve orijinal telif bildirimini koruyarak paylaşmak zorundadır.
