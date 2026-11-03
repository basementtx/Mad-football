# ⚽🔥 Mad Football

**Hakem yok. Kural yok. Sadece gol.**

Mad Football, mobil için yapılmış 2D, kuralsız, arcade bir futbol oyunu. Rakibi kayarak yere ser, iterek topu kap, sahadaki gizemli kutulardan bomba, tüfek, ateş topu gibi özel eşyalar topla. Faul de yok, kart da yok.

> Mekanik ilhamı Roblox'taki kuralsız futbol oyunlarından geliyor. Mad Football'un isimleri, takımları, karakterleri ve görselleri tamamen özgün.

## Özellikler

- **Kuralsız oynanış**: kayarak müdahale, itme ve yere serme. Yere düşen oyuncu topu kaybeder.
- **Gizemli kutular ve özel eşyalar**: sahada rastgele yerlerde dönen, gökkuşağı renklerinde parlayan 3D "?" kutuları çıkar. Üstünden geçen oyuncunun takımı, envanterde seçili eşyalardan rastgele birini kazanır; **EŞYA** tuşuyla (E / Q) kullanılır. Rakip takım da kutu toplar ve eşyalarını kullanır. Eşyalar: Ateş Topu, Buz Şutu, Falso Şutu, Şimşek Şutu (top gerekir), Bomba, Tüfek, Şok Dalgası, Turbo, Mıknatıs.
- **Envanter**: 3 eşya (Ateş Topu, Bomba, Tüfek) başlangıçta sende. Kutulardan çıkacak 3-5 eşyayı Envanter ekranından seç. Kasalardan yeni eşyalar çıkar.
- **Eşya seviyeleri (skin)**: kasadan zaten sahip olduğun bir eşya çıkarsa o eşya bir üst seviye görünümüne ilerler: I Standart → II Krom → III Altın → IV Neon → V Prizma. Gereken kopya sayısı eşyanın değerine göre değişir (sıradan: 2/3/4/5, nadir: 1/2/3/4, epik: 1/2/2/3, efsanevi: 1/1/2/2). Seviye, eşyanın oyundaki efekt renklerini değiştirir.
- **Falso şut ve şutla pas**: şutu doldururken joystick'i yana itersen top kavis alır (nişan çizgisi kavisli yolu gösterir). Bir takım arkadaşına doğru şut çekersen sert, hızlı bir pas olur; uzun ve hızlı paslar için ideal.
- **Kaleciyi kontrol et**: top kalecine geçince kaleciyi sen yönetirsin. PAS ile topu elle atar (basılı tut: havadan), ŞUT ile uzağa vurursun. 6 saniyelik tutma süresi dolarsa kaleci topu kendisi atar. Kaleciler hiçbir şeyden (kayma, itme, tüfek, bomba, buz) etkilenmez ve saha oyuncularından daha yavaş yürür.
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
- **Mobil öncelikli kontroller**: yüzen joystick ve duruma göre değişen 5 tuş (ŞUT/KAY/İT/KAFA, PAS/DEĞİŞ, DEPAR, ÇALIM, EŞYA). Ayarlardan tuş boyutu (Küçük/Orta/Büyük/Dev), sabit veya parmağı takip eden joystick, solak modu, titreşim ve çentikli ekranlar için güvenli alan desteği var.
- **Ana menü merkezi**: açılış ekranı, ardından kulüp, kadro, oyuncum, kasalar, koleksiyon ve maç kutucukları.
- **Kulübünü kur**: isim, 3 harfli kısaltma, 4 forma rengi, forma deseni, piksel arma (5 şekil, 10 simge).
- **Oyuncunu yarat**: ad, numara, pozisyon, ten, saç modeli ve rengi, sakal; 110 yetenek puanını HIZ/ŞUT/PAS/ÇAL/DEF/FİZ arasında dağıt. Maçta yıldız işaretiyle oynar.
- **Oyuncu kartları**: genel güç, pozisyon, 6 özellik, piksel portre; Bronz, Gümüş, Altın, Kahraman ve Efsane seviyeleri. Kadro ekranında ilk 5'i seç; maçlar bu kartların değerleriyle oynanır.
- **Kasalar**: Temel (250), Premium (700) ve Efsane (1800 altın). Her 4 saatte bir bedava temel kasa, başlangıçta bir bedava Premium. İçinden oyuncu kartı, gol patlaması, top izi ve özel eşya çıkar. Eşya kopyaları seviye ilerletir, diğer kopyalar altına çevrilir. Açılış animasyonu: kasa düşer, dokununca giderek sertleşen sarsıntı ve en değerli ödülün renginde parlayan aralık, patlama, ardından kartlar ters yüzlü saçılır ve tek tek döner (dokunarak ya da HEPSİNİ AÇ ile hızlandırılabilir).
- **Gol patlamaları** (Rocket League tarzı, kale önündekileri savurur): Konfeti, Havai Fişek, Piksel Yağmuru, Derin Dondurucu, Yıldırım, Süpernova, Ejder Ateşi, Kara Delik, Altına Hücum. **Top izleri**: Alev, Pırıltı, Duman, Gökkuşağı, Elektrik, Galaksi, Midas.
- **Lig modu**: 5 lig (Bronz → Gümüş → Altın → Elit → Mad Süper Lig), her ligde 8 kulüp, 7 haftalık sezon ve puan tablosu (O/G/B/M/AV/P). Diğer maçlar simüle edilir. Sezon sonunda ilk 2 üst lige çıkar, son 2 küme düşer; sıralamaya göre altın ödülü verilir. Zorluk lige göre artar.
- **Taktiksel yapay zekâ**: top sana geçtiği anda rakipler üstüne depar atmaz; topu yeni alan oyuncuya yerleşme süresi tanır (zorluğa göre ~1-2 sn), mesafeyi koruyarak bekler ve ancak kalesine yaklaşınca ya da geçilince sıkıştırır. Yetişemeyecekleri paslar için koşmak yerine savunma pozisyonu alırlar. Bir oyuncu bekleyerek pres yapar, biri arkayı kapatıp pas yolunu keser, diğerleri adam veya bölge tutar; hücumda roller (forvet koşusu, orta saha destek, savunma çizgisi), boş adama ve ileri pas, sıkışınca topu geri dolaştırma.
- Kaleci topu tutarken korunur; rakipler ceza sahasından çekilir, kaleci boş arkadaşa atar ya da adamların üstünden aşırtır.
- **Hafif pas nişan yardımı** (yalnızca ~20° içindeki arkadaşa yönelir) ve **zarif nişan çizgisi**; ikisi de ayarlardan kapatılabilir.
- **5 zorluk seviyesi** (Kolay → Efsane); ödül çarpanı ×0.6'dan ×3'e çıkar.
- Kariyer kaydı (G/B/M), altın, maçın yıldızı ve maç istatistikleri.
- İngilizce (varsayılan) ve Türkçe arayüz; dil, ayarlardan ya da ana menüdeki piksel bayrak düğmesinden değiştirilebilir.

## Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Ekranın sol yarısı (joystick) | WASD / Ok tuşları |
| Şut (top sende) / Kay-İt (top sende değil) | Kırmızı/turuncu tuş | J / Boşluk |
| Pas (dokun: yerden, basılı tut: havadan) / Oyuncu değiştir | Mavi tuş | K |
| Depar | Yeşil tuş | Shift / L |
| Çalım | Mor tuş | I / C |
| Özel eşya kullan | Eşya tuşu (eşya ikonu) | E / Q |
| Kaleci topu tutarken: elle at / uzağa vur | Mavi / Kırmızı tuş | K / J |
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

**4. Denge testi:** `npm run sim -- normal 4` komutu 20 maçı yapay zekâya karşı yapay zekâ olarak arka planda oynatır; maç başına gol, yere serme, şut, kurtarış ve kullanılan eşya ortalamalarını yazar. `npm run smoke -- normal` ise senaryolu bir "insan" oyuncuyla kaleci kontrolünü, tutma süresini, eşya kullanımını, falsoyu ve rakip presini test eder.

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

## Android APK

Proje Capacitor ile Android'e paketli (`android/` klasörü repoda). Her push'ta GitHub Actions (`.github/workflows/android-apk.yml`) APK'yı derler ve **Releases** sayfasına `MadFootball.apk` olarak koyar. Sabit indirme linki: https://github.com/basementtx/Mad-football/releases/latest/download/MadFootball.apk

1. Telefonda repo sayfasında **Releases → en son sürüm** → `.apk` dosyasını indir.
2. Dosyayı aç ve kur (tarayıcın için "bilinmeyen uygulamaları yükle" iznini vermen istenebilir).
3. Tüm sürümler aynı anahtarla imzalanır: yeni APK eskisinin üstüne kurulur, kayıtların silinmez.

Oyun yatay ve tam ekran açılır, ekran kapanmaz. Yerelde derlemek için (Android SDK gerekir):

```bash
npm install
npm run android                    # web derlemesi + cap sync
cd android && ./gradlew assembleDebug
```

Oyun aynı zamanda bir PWA: mobil tarayıcıda "Ana ekrana ekle" ile tam ekran ve yatay olarak açılır.

## Yol haritası (öneriler)

- Online 1v1 / 2v2 (WebSocket ya da WebRTC)
- Turnuva / lig modu
- Karakter özelleştirme ve altınla açılan formalar, kramponlar, gol sevinçleri
- Hava ve gece/gündüz stadyumları
