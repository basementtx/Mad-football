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
- **Yayın kalitesinde sunum**: 3/4 kamera, stadyum, tribünde tepki veren seyirci, kayan LED reklam panoları, perspektifli kale ağları, gol sonrası ağır çekim, konfeti ve **gol tekrarı**, ekran sarsıntısı, partiküller.
- **Tamamen sentezlenmiş ses** (dosya yok): tribün uğultusu, düdük, korna, vuruş ve çarpışma sesleri.
- **Mobil öncelikli kontroller**: yüzen joystick ve duruma göre değişen 4 tuş (ŞUT/KAY/İT/KAFA, PAS/DEĞİŞ, DEPAR, ÇALIM/GÜÇ). Solak modu, titreşim desteği ve çentikli ekranlar için güvenli alan desteği var.
- Kariyer kaydı (G/B/M), altın, maçın yıldızı ve maç istatistikleri.
- Türkçe ve İngilizce arayüz.

## Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Ekranın sol yarısı (joystick) | WASD / Ok tuşları |
| Şut (top sende) / Kay-İt (top sende değil) | Kırmızı/turuncu tuş | J / Boşluk |
| Pas (dokun: yerden, basılı tut: havadan) / Oyuncu değiştir | Mavi tuş | K |
| Depar | Yeşil tuş | Shift / L |
| Çalım / Güç Şutu (öfke doluyken) | Mor tuş | I / E |
| Duraklat | ‖ tuşu | Esc / P |

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
  game/     match (kurallar + fizik), ai (takım yapay zekâsı), entities, renderer, sprites,
            camera, fx (partikül/yazı/banner), hud, game (döngü + kamera)
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
- Hava ve gece/gündüz stadyumları
