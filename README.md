# ⚽🔥 Mad Football

**Hakem yok. Kural yok. Sadece gol.**

Mad Football, mobil için yapılmış 2D, kuralsız, arcade bir futbol oyunu. Rakibi kayarak yere ser, iterek topu kap, öfke barını doldur ve önüne çıkan herkesi deviren ateş topunu gönder. Faul de yok, kart da yok; kaleci bile hedef.

> Mekanik ilhamı Roblox'taki kuralsız futbol oyunlarından geliyor. Mad Football'un isimleri, takımları, karakterleri ve görselleri tamamen özgün.

## Özellikler

- **Kuralsız oynanış**: kayarak müdahale, itme ve yere serme. Yere düşen oyuncu topu kaybeder.
- **Öfke sistemi ve Güç Şutu**: yere serdikçe öfke barı dolar. Bar dolunca atılan ateş topu yolundaki herkesi devirir ve kaleci onu tutamaz.
- **Beceri gerektiren şut**: basılı tutarak şutu doldurursun; aşırı doldurursan top auta uçar. Nişan yardımı ve nişan oku da var.
- **Çalım**: kısa süre dokunulmaz olursun ve rakibin kayması boşa gider.
- **Kafa vuruşu ve vole**, kaleci **plonjonu, topu tutması ve çelmesi**, direk ve üst direkten dönen toplar.
- **Yapay zekâ**: pres, alan kapatma, adam markajı, koşular, pas tercihleri. 4 zorluk seviyesi var: Kolay, Normal, Zor, Çılgın.
- **8 özgün takım**: her birinin kendi forma deseni ve hız, güç, sertlik, teknik değerleri var.
- **3v3, 4v4 ve 5v5**; 2, 3 ve 5 dakikalık maçlar.
- **Pixel art grafikler**: oyun ~232 px yükseklikte sanal bir çerçeveye çizilip tam sayı katlarla, keskin piksellerle büyütülüyor.
  - Oyuncu sprite'ları iskeletten **piksel piksel** üretiliyor: piksel başına ışıklandırma, ton kaydırmalı renk paletleri, iç ve dış hatlar, takım formasına göre desen (çizgili, yatay çizgili, yarım, kuşak, V). Koşu, şut, kayma, yere düşme, kalkma, plonjon, sevinç, itme, kafa ve üzgün kareleri var.
  - El yapımı **5x7 bitmap font** (Ç, Ğ, İ, Ö, Ş, Ü dahil). Piksel saha dokusu, çim tutamları ve aşınma; atkı ve bayrak sallayan, 3 kare animasyonlu seyirci; kayan LED panolar; piksel kale ağları; dither'lı vinyet.
- **Yayın kalitesinde sunum**: gol sonrası ağır çekim, konfeti ve **gol tekrarı**, ekran sarsıntısı, piksel partiküller.
- **Tamamen sentezlenmiş ses** (dosya yok): tribün uğultusu, düdük, korna, vuruş ve çarpışma sesleri.
- **Mobil öncelikli kontroller**: yüzen joystick ve duruma göre değişen 4 tuş (ŞUT/KAY/İT/KAFA, PAS/DEĞİŞ, DEPAR, ÇALIM/GÜÇ). Sabit veya parmağı takip eden joystick seçeneği, solak modu, titreşim desteği ve çentikli ekranlar için güvenli alan desteği var.
- **Ana menü merkezi**: açılış ekranı, ardından kulüp, kadro, oyuncum, kasalar, koleksiyon ve maç kutucukları.
- **Kulübünü kur**: isim, 3 harfli kısaltma, 4 forma rengi, forma deseni, piksel arma (5 şekil, 10 simge).
- **Oyuncunu yarat**: ad, numara, pozisyon, ten, saç modeli ve rengi, sakal; 110 yetenek puanını HIZ/ŞUT/PAS/ÇAL/DEF/FİZ arasında dağıt. Maçta yıldız işaretiyle oynar.
- **Oyuncu kartları**: genel güç, pozisyon, 6 özellik, piksel portre; Bronz, Gümüş, Altın, Kahraman ve Efsane seviyeleri. Kadro ekranında ilk 5'i seç; maçlar bu kartların değerleriyle oynanır.
- **Kasalar**: Temel (250), Premium (700) ve Efsane (1800 altın). Her 4 saatte bir bedava temel kasa, başlangıçta bir bedava Premium. İçinden oyuncu kartı, gol patlaması, top izi ve özel güç çıkar; kopyalar altına çevrilir.
- **Özel güçler** (öfke dolunca): Ateş Topu, Buz Şutu (dondurur), Falso Şutu (kıvrılır), Şimşek Şutu (zincirleme çarpar), Şok Dalgası (çevredeki herkesi devirir), Turbo Öfke (4 sn durdurulamaz hız).
- **Gol patlamaları** (Rocket League tarzı, kale önündekileri savurur): Konfeti, Havai Fişek, Piksel Yağmuru, Derin Dondurucu, Yıldırım, Süpernova, Ejder Ateşi, Kara Delik, Altına Hücum. **Top izleri**: Alev, Pırıltı, Duman, Gökkuşağı, Elektrik, Galaksi, Midas.
- **Lig modu**: 5 lig (Bronz → Gümüş → Altın → Elit → Mad Süper Lig), her ligde 8 kulüp, 7 haftalık sezon ve puan tablosu (O/G/B/M/AV/P). Diğer maçlar simüle edilir. Sezon sonunda ilk 2 üst lige çıkar, son 2 küme düşer; sıralamaya göre altın ödülü verilir. Zorluk lige göre artar.
- **Taktiksel yapay zekâ**: bir oyuncu bekleyerek pres yapar, biri arkayı kapatıp pas yolunu keser, diğerleri adam veya bölge tutar; hücumda roller (forvet koşusu, orta saha destek, savunma çizgisi), boş adama ve ileri pas, sıkışınca topu geri dolaştırma.
- Kaleci topu tutarken korunur; rakipler ceza sahasından çekilir, kaleci boş arkadaşa atar ya da adamların üstünden aşırtır.
- **Hafif pas nişan yardımı** (yalnızca ~20° içindeki arkadaşa yönelir) ve **zarif nişan çizgisi**; ikisi de ayarlardan kapatılabilir.
- **5 zorluk seviyesi** (Kolay → Efsane); ödül çarpanı ×0.6'dan ×3'e çıkar.
- Kariyer kaydı (G/B/M), altın, maçın yıldızı ve maç istatistikleri.
- **Hava durumları**: Güneşli (gündüz, çatı gölgesi), Gece (projektörler), Yağmurlu (su birikintileri, şemsiyeli taraftarlar, kaygan zemin: top kayar, kaymalar uzar), Fırtına (şimşek, gök gürültüsü, sert rüzgar), Karlı (karla kaplı zemin, süpürülmüş çizgiler, ağır top, yavaş koşu), Sisli (sürüklenen sis katmanları), Rüzgarlı (uçuşan yapraklar, havadaki topu savuran rüzgar ve skor tabelasının yanında rüzgar göstergesi). Yağmur ve rüzgar sesleri de sentezleniyor.
- **6 saha deseni**: Çizgili, Damalı, Çapraz, Halkalı, Kurak (sararmış çim, daha fazla toprak) ve Suni Çim (topu biraz daha hızlı ve sektiren zemin).
- **5 stadyum**: Arena, Eski Tribün (ahşap çatı, görüşü kapatan direkler, köşe projektör kuleleri), Sokak Kafesi (tel örgü, grafiti, şehir silueti, seyrek seyirci), Kolezyum (kumtaşı kemerler, titreyen meşaleler) ve Neon Kubbe (neon şeritler).
- Hızlı maçta zorluk seçiminden sonra **Saha & Hava** ekranında stadyum, çim ve hava seçilir (ya da hepsi rastgele); seçim menü arka planında canlı önizlenir. Lig maçları ev sahibi takımın stadyumunda, o takıma özgü havalarla oynanır.
- **Orta ve aşırtma**: PAS tuşunu basılı tutup parmağını yukarı kaydırıp bırakınca ceza sahasındaki arkadaşına kafa yüksekliğinde orta açılır; ŞUT tuşunda aynı hareket kalecinin üstünden aşırtma şutu çeker. Kaydırma algılanınca tuşun içindeki ok sararır ve oyuncunun üstünde ORTA/AŞIRTMA yazar; nişan çizgisi topun yayını gösterir. Gelen ortaya ŞUT ile kafa/vole vurulur. Klavyede Q basılıyken K (orta) veya J (aşırtma). Yapay zekâ da kanattan orta açar.
- **Günlük ve haftalık görevler**: her gün 3, her hafta (pazartesi yenilenir) 3 rastgele görev: maç oyna/kazan, gol, yere serme, pas, orta, aşırtma, kafa/vole, özel güç, gol yememe, zorda galibiyet, kötü havada galibiyet, lig maçı, top kapma. Tamamlananlar Görevler ekranından altın olarak alınır; maç sonu ekranı tamamlanan görevleri gösterir.
- **Takım kimyası**: ilk 11'deki (5'teki) her oyuncu 0-3 kimya puanı alır: doğru mevki +1, kulüpte 3 maç +1, 10 maç +2 (kaleci yerinde değilse 0). Takım kimyası 0-100 arası; maçta oyuncu değerleri kimyaya göre ×0.93 ile ×1.04 arasında ölçeklenir. Kadro ekranında kimya çubuğu ve oyuncu başına ◆ puanları görünür.
- İngilizce (varsayılan) ve Türkçe arayüz; dil, ayarlardan ya da ana menüdeki piksel bayrak düğmesinden değiştirilebilir.

## Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Ekranın sol yarısı (joystick) | WASD / Ok tuşları |
| Şut (top sende) / Kay-İt (top sende değil) | Kırmızı/turuncu tuş | J / Boşluk |
| Pas (dokun: yerden, basılı tut: havadan) / Oyuncu değiştir | Mavi tuş | K |
| Depar | Yeşil tuş | Shift / L |
| Çalım / Güç Şutu (öfke doluyken) | Mor tuş | I / E |
| Duraklat | ‖ tuşu | Esc / P |

## Test etme

**1. Telefonda hemen oyna (kurulum yok):** Claude'un yayınladığı test sürümünü aç: https://claude.ai/artifact/5TkPhqTJ3kquBGVTrQwg4i
Bağlantı özel; yalnızca hesap sahibi açabilir. Telefonu yan çevir.

**2. Bilgisayarda (en hızlı geliştirme döngüsü):**

```bash
git clone https://github.com/basementtx/mad-football.git
cd mad-football
git checkout ccr-5a434576-s3e482
npm install
npm run dev
```

- Tarayıcıda `http://localhost:5173` adresini aç. Klavye: WASD hareket, J/Boşluk şut-kay, K pas, Shift depar, I çalım, Esc duraklat.
- Dokunmatik kontrolleri bilgisayarda denemek için Chrome'da F12 → cihaz simgesi (Toggle device toolbar) → bir telefon seç → yatay çevir.

**3. Kendi telefonunda (aynı Wi-Fi):** `npm run dev` çıktısındaki `Network: http://192.168.x.x:5173` adresini telefonun tarayıcısında aç. Kodu kaydettiğin anda telefonda yenilenir.

**4. Denge testi:** `npm run sim -- normal 4` komutu (isteğe bağlı üçüncü parametre hava durumu: `rain`, `snow`, `wind`…) 20 maçı yapay zekâya karşı yapay zekâ olarak arka planda oynatır; maç başına gol, yere serme, şut ve kurtarış ortalamalarını yazar.

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173 (aynı ağdaki telefondan da açılır)
npm run build      # tip denetimi + üretim derlemesi (dist/)
npm run preview
```

Teknoloji: TypeScript, Vite ve harici oyun motoru kullanmayan özel bir Canvas 2D motoru. Bundle yaklaşık 40 KB (gzip).

```
src/
  engine/   input (joystick + tuşlar + klavye), audio (WebAudio sentezi), storage, i18n, math
  game/     match (kurallar + fizik), ai (takım yapay zekâsı), entities, renderer (piksel stadyum),
            camera (piksel hassas), fx (partikül/yazı/banner), hud, game (döngü + kamera)
  pixel/    player (prosedürel sprite üretici), props (top, gölge, tuşlar), font (bitmap font), palette
tools/sheet.html   geliştirme aracı: tüm oyuncu sprite karelerini gösterir (npm run dev → /tools/sheet.html)
  ui/       menüler (DOM) + stil
```

## Mobil uygulama olarak paketleme (Android / iOS)

Proje [Capacitor](https://capacitorjs.com) ile paketlenmeye hazır (`capacitor.config.json` mevcut):

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android      # veya: npx cap add ios
npx cap sync
npx cap open android     # Android Studio'da çalıştır / imzala
```

Oyun aynı zamanda bir PWA: mobil tarayıcıda "Ana ekrana ekle" ile tam ekran ve yatay olarak açılır.

## Yol haritası (öneriler)

- Online 1v1 / 2v2 (WebSocket ya da WebRTC)
- Turnuva / lig modu
- Karakter özelleştirme ve altınla açılan formalar, kramponlar, gol sevinçleri
- Özel yetenekler (dash, süper kafa, sismik kayma) ve yetenek seçimi
