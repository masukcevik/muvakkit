# Microsoft Store'a yükleme

Ayrıntılı adımlar için bu dosyadaki bölümleri sırayla takip et.

## Mağaza bilgileri (kopyala-yapıştır)

**Ad:** Namaz Vakti Göstergesi (Partner Center'da ayrılan adla aynı olmalı)

**Kısa açıklama:**
Çalışırken namaz vakitlerini ekranın köşesinde sessizce gösteren, reklamsız ve ücretsiz uygulama.

**Açıklama:**
Namaz Vakti, bilgisayar başında çalışırken, ders çalışırken ya da oyun oynarken namaz vakitlerini kaçırmaman için ekranın köşesinde küçük ve sade bir gösterge sunar.

Gösterge sıradaki vakti ve kalan süreyi gösterir. Tıklamaları arkasındaki pencereye geçirir, bu yüzden işine engel olmaz. Vakte yaklaşırken ince bir çerçeveyle, vakit girince de sessiz bir bildirimle hatırlatır. Oyun oynarken ya da tam ekran video izlerken neredeyse görünmez olur.

Vakitler 81 il için Diyanet yöntemiyle hesaplanır. Hicri tarih Diyanet takvimiyle uyumludur. Renkler, boyut, saydamlık ve göstergede yazan bilgiler tamamen özelleştirilebilir.

Uygulama ücretsiz ve reklamsızdır. Hesap gerektirmez, internete bağlanmaz ve hiçbir veri toplamaz. Kaynak kodu açıktır (GPL-3.0).

**Özellikler (her satır ayrı):**
- Ekranın köşesinde sıradaki vakit ve kalan süre
- Tıklamaları engellemeyen, sürüklenebilen gösterge (Ctrl ile)
- Vakit yaklaşınca ince çerçeve, vakit girince sessiz bildirim
- Oyun ve tam ekran videoda neredeyse görünmez mod
- 81 il, Diyanet yöntemi, Hicri tarih
- Renk, boyut, saydamlık ve içerik özelleştirme
- Reklamsız, ücretsiz, internet bağlantısı gerektirmez

**Arama terimleri:** namaz vakti, ezan vakti, namaz saatleri, imsakiye, hicri takvim, diyanet, ezan

**Kategori:** Yaşam tarzı (Lifestyle)

**Gizlilik politikası adresi:**
https://github.com/masukcevik/namaz-vakti/blob/main/GIZLILIK.md

**Web sitesi / destek:**
https://github.com/masukcevik/namaz-vakti

**runFullTrust gerekçesi (Submission options → Restricted capabilities):**
Namaz Vakti is an Electron desktop application packaged as MSIX. It requires runFullTrust because it runs as a standard Win32 desktop process: it shows a small always-on-top overlay window with the next prayer time, a system tray icon, and Windows toast notifications when a prayer time begins. It also reads the foreground window state (via user32/shell32) solely to dim the overlay while a full-screen game or video is running. The app does not access the network, files, camera, microphone, or location, and collects no personal data. Source code: https://github.com/masukcevik/namaz-vakti
