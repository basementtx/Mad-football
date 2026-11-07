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
- **Oyuncu Kariyeri** (yeni, ayrı kayıt): 17 yaşında yarattığın futbolcuyu emekliliğe kadar yönet.
  - **Yaratım**: isim, numara, 12 ülke (piksel bayraklar), güçlü ayak, mevki (DEF/MID/FWD), geçmiş (Sokak Futbolcusu, Akademi Mezunu, Kasabanın Kahramanı, Geç Açan Çiçek), kişilik (Mütevazı, Özgüvenli, Şovmen, Lider), görünüm, zorluk ve maç süresi.
  - **Deneme maçı**: tribünde üç scout; maç notuna göre 2-3 kulüpten ilk sözleşme teklifi gelir (iyi oynarsan üst lig kulübü).
  - **Sahada sadece kendi oyuncun**: takım arkadaşları yapay zekâ. Top sende değilken PAS tuşu = **topu iste**; takım arkadaşlarınla ilişkin ve şöhretin arttıkça sana daha çok pas atarlar. Canlı maç notu ve hocanın maç hedefleri ekranda. Yedekten oyuna girersen maç 60. dakikadan, o anki skorla başlar. Rakip takımlar gerçek, isimli oyuncularıyla sahaya çıkar.
  - **Dünya**: 4 ülkede (İngiltere, İspanya, İtalya, Türkiye) 2'şer lig; 80 kulüp gerçek şehirlerde, gerçek renk ve forma desenleriyle, gerçek derbileri ve gerçekçi prestijleriyle ("Manchester Red", "Madrid White", "İstanbul Sarı-Kırmızı" gibi lisanssız tarzda isimler). Her kulübün kendine özel tasarlanmış piksel arması var (desenli zemin, renkli halka, baş harfler, hayvan ve sembol ikonları; gerçek armalar kopyalanmadı). **Düzenleme modu** (Sezon sekmesi → ✎): kendi kaydında kulüp adını, kısaltmasını, stadyumu, teknik direktörü, oyuncu isimlerini ve numaralarını değiştirebilirsin. ~800 isimli oyuncu, ulusal kupalar, Mad Şampiyonlar Kupası (gruplar + eleme), milli maçlar ve çift sezonlarda yazın Mad Uluslar Kupası. Her ligde 18 hafta; takvimde lig/kupa/kıta/milli ara haftaları. Çıkış-düşme, kulüp prestiji, oyuncuların yaşlanıp gelişmesi, emeklilikler ve gençler, kendi aralarında transferler.
  - **Her maçı oyna ya da simüle et**: simülasyon dakika dakika anlatımlı bir "canlı skor" ekranıyla oynanır (sim notu biraz daha düşüktür). Eleme maçlarında beraberlikte **penaltı atışları** (kendi penaltının köşesini sen seçersin).
  - **Gelişim**: haftalık antrenman (5 odak, 3 yoğunluk) ya da 45 saniyelik **şut drilli** (gerçek oynanış, S/A/B/C/D notu kazanımı çarpar). Maç deneyimi, XP ve seviye; 3 dallı **yetenek ağacı** (Bitirici, Motor, Süperstar; bazıları sahada da etkili). Gizli potansiyel ve scout tahmini, yaşlanma, kondisyon, moral, keskinlik, form, sakatlıklar (hafif darbeden diz bağına).
  - **Seçilme ve rol**: Gelecek Vadeden → Rotasyon → İlk 11 → Kilit Oyuncu; hoca formuna, güvenine, kondisyonuna ve rakiplerine göre seni ilk 11'e, yedeğe ya da kadro dışına koyar.
  - **Transfer ve sözleşme**: sezon öncesi ve devre arası transfer dönemleri, kulüp teklifleri (kulübün kabul edebilir ya da reddedebilir; transfer talebiyle zorlayabilirsin), kiralık teklifleri, sözleşme yenileme, serbest oyuncu dönemi. **Pazarlık**: maaş, yıl, rol, serbest kalma bedeli; kulübün sabrı ve menajerinin ipuçları. Piyasa değeri ve maaşlar gerçekçi biçimde yükselir.
  - **KICKR (oyun içi sosyal medya)**: maçlarına, transferlerine, sakatlıklarına göre üretilen gönderiler; kulüp resmi hesapları, gazeteciler (güvenilirlik seviyeleriyle), istatistik hesapları, mizah hesapları, rakip taraftarlar, takım arkadaşları ve **ezeli rakibin** (nemesis). Yanıt zincirleri, beğeni/RT sayıları şöhretine göre ölçeklenir; maç kartı, not kartı, transfer kartı gibi medya ekleri; gündem etiketleri ve taraftar havası göstergesi.
  - **Kendi gönderilerin**: maç sonrası mütevazı, özgüvenli, taraftara teşekkür, rakibe laf sokma ya da sponsor paylaşımı. Takipçini, imajını ve ilişkilerini etkiler; kötü maçtan sonra iddialı paylaşım "ratio" yer ve gazete manşeti olur.
  - **Mesajlar (DM)**: menajer, teknik direktör, takım arkadaşları, aile, sponsorlar, milli takım hocası ve rakibinden mesajlar; cevap seçimlerin ilişkileri değiştirir (kaptanlık teklifi, transfer isteği, sponsor anlaşmaları…).
  - **Mad Sport Daily**: manşetli spor gazetesi ve güvenilirlik yıldızlı dedikodu köşesi. **Basın toplantıları** (derbi, final, form düşüşü, transfer söylentisi, rakip): mütevazı / iddialı / sert cevaplar hocayı, taraftarı ve medyayı etkiler.
  - **Yaşam**: maaş, gol primi, sponsor gelirleri; ev, araba ve kişisel ekip (aşçı, antrenör, fizyoterapist, PR, video analist) satın al, her birinin oyuna etkisi var. Takipçin arttıkça daha büyük markalar teklif verir.
  - **Ödüller ve miras**: lig şampiyonluğu, kupalar, sezonun oyuncusu, gol kralı, genç oyuncu, sezonun takımı, sezon sonu değerlendirmesi ve **Altın Top gecesi** (dünya sıralaması). Kariyer hikâyesi zaman çizelgesi, kupa dolabı, sezon sezon istatistikler, piyasa değeri ve takipçi grafikleri, ilişki göstergeleri.
  - **Hikâye anları**: ilk sözleşme, ilk maç, ilk gol, hat-trick, milli davet, ciddi sakatlık ve dönüş, kupalar, ödüller, gol rekorları sinematik ekranlarla gelir.
  - **Ana profile bağlantı**: sezon sonları, kupalar, ödüller ve emeklilik mirası ana profiline **altın** kazandırır; kariyer maçlarında ana profildeki krampon, gol patlaması, top izi ve eşyalar kullanılır. 33 yaşından sonra emekliliğini açıklayabilirsin; 38'de kramponlar asılır.
- **Taktiksel yapay zekâ**: top sana geçtiği anda rakipler üstüne depar atmaz; topu yeni alan oyuncuya yerleşme süresi tanır (zorluğa göre ~1-2 sn), mesafeyi koruyarak bekler ve ancak kalesine yaklaşınca ya da geçilince sıkıştırır. Yetişemeyecekleri paslar için koşmak yerine savunma pozisyonu alırlar. Bir oyuncu bekleyerek pres yapar, biri arkayı kapatıp pas yolunu keser, diğerleri adam veya bölge tutar; hücumda roller (forvet koşusu, orta saha destek, savunma çizgisi), boş adama ve ileri pas, sıkışınca topu geri dolaştırma.
- Kaleci topu tutarken korunur; rakipler ceza sahasından çekilir, kaleci boş arkadaşa atar ya da adamların üstünden aşırtır.
- **Hafif pas nişan yardımı** (yalnızca ~20° içindeki arkadaşa yönelir) ve **zarif nişan çizgisi**; ikisi de ayarlardan kapatılabilir.
- **5 zorluk seviyesi** (Kolay → Efsane); ödül çarpanı ×0.6'dan ×3'e çıkar.
- Kariyer kaydı (G/B/M), altın, maçın yıldızı ve maç istatistikleri.
- **Hava durumları**: Güneşli (gündüz, çatı gölgesi), Gece (projektörler), Yağmurlu (su birikintileri, şemsiyeli taraftarlar, kaygan zemin: top kayar, kaymalar uzar), Fırtına (şimşek, gök gürültüsü, sert rüzgar), Karlı (karla kaplı zemin, süpürülmüş çizgiler, ağır top, yavaş koşu), Sisli (sürüklenen sis katmanları), Rüzgarlı (uçuşan yapraklar, havadaki topu savuran rüzgar ve saatin altında rüzgar göstergesi). Yağmur ve rüzgar sesleri de sentezleniyor.
- **6 saha deseni**: Çizgili, Damalı, Çapraz, Halkalı, Kurak (sararmış çim, daha fazla toprak) ve Suni Çim (topu biraz daha hızlı ve sektiren zemin).
- **5 stadyum**: Arena, Eski Tribün (ahşap çatı, görüşü kapatan direkler, köşe projektör kuleleri), Sokak Kafesi (tel örgü, grafiti, şehir silueti, seyrek seyirci), Kolezyum (kumtaşı kemerler, titreyen meşaleler) ve Neon Kubbe (neon şeritler).
- Hızlı maçta zorluk seçiminden sonra **Saha & Hava** ekranında stadyum, çim ve hava seçilir (ya da hepsi rastgele); seçim menü arka planında canlı önizlenir. Lig maçları ev sahibi takımın stadyumunda, o takıma özgü havalarla oynanır; kariyer maçlarında stadyum, çim ve hava rastgeledir.
- **Orta ve aşırtma**: PAS tuşunu basılı tutup parmağını yukarı kaydırıp bırakınca ceza sahasındaki arkadaşına kafa yüksekliğinde orta açılır; ŞUT tuşunda aynı hareket kalecinin üstünden aşırtma şutu çeker. Tuşun üstünde yukarı ok belirir, kaydırma algılanınca kırmızıya döner ve oyuncunun üstünde ORTA/AŞIRTMA yazar; nişan çizgisi topun yayını gösterir. Gelen ortaya ŞUT ile kafa/vole vurulur. Klavyede R basılıyken K (orta) veya J (aşırtma). Yapay zekâ da kanattan orta açar.
- **Günlük ve haftalık görevler**: her gün 3, her hafta (pazartesi yenilenir) 3 rastgele görev: maç oyna/kazan, gol, yere serme, pas, orta, aşırtma, kafa/vole, eşya kullanımı, gol yememe, zorda galibiyet, kötü havada galibiyet, lig maçı, top kapma. Ana menünün üst çubuğundaki GÖREVLER düğmesinden açılır, tamamlananlar altın olarak alınır; maç sonu ekranı tamamlanan görevleri gösterir.
- **Takım kimyası**: ilk 5'teki her oyuncu 0-3 kimya puanı alır: doğru mevki +1, kulüpte 3 maç +1, 10 maç +2 (kaleci yerinde değilse 0). Takım kimyası 0-100 arası; maçta oyuncu değerleri kimyaya göre ×0.93 ile ×1.04 arasında ölçeklenir. Kadro ekranında kimya çubuğu ve oyuncu başına ◆ puanları görünür.
- İngilizce (varsayılan) ve Türkçe arayüz; dil, ayarlardan ya da ana menüdeki piksel bayrak düğmesinden değiştirilebilir.

## Oynanış mekanikleri (son güncelleme)

- **Daha geniş saha ve kale**: saha ~%9 büyüdü (pas ve taktik için alan), kale 7.4 m'den 9.2 m'ye genişledi; falsolu şutların gerçek bir hedefi var. Kaleciler daha uzağa ve daha hızlı plonjon yapıyor.
- **Kaleci artık geçilemiyor**: top süren oyuncuya çıkar, açıyı kapatır ve ayağına yatarak topu kapar. Sadece top sürerek kaleciyi geçip gol atmak artık işe yaramıyor; doğru anda çalım atarsan şansın var.
- **Pas karşılama ve topa koşma**: sana gelen pasa, yakındaki boştaki topa ve joystick'le yöneldiğin topa oyuncun topun şu anki yerine değil, onu karşılayabileceği noktaya koşar; uzaktaysa kendiliğinden depar atar. Joystick'i açıkça başka yöne itersen seni dinler.
- **Bitiriciler**: havadaki topa ŞUT: kafa, koşarak gelirken balıklama, alçak topa vole, sırtın kaleye dönükken rövaşata. Ağır çekim, parıltı izi ve gol yazısında hareketin adı.
- **Çalımlar**: büyük tuşu bir yöne kaydır. İleri: dibindeki rakibe bacak arası, biraz uzaktakine şapka, boşlukta topu öne atma; yana: makas; geri-yana: rulet (top vücudun etrafında döner); geri: top çekme. Her hareketin top yolu ve vücut hareketi farklı. Kimse sersemlemez: çalımı yiyen savunmacı ağırlığını yanlış tarafa verir ya da momentumuyla geçer, dönene kadar ara açılır.
- **Ara pas** ve **baskı** tuşu. Baskı rakibi kale tarafından bir kol mesafesinden karşılar; topu kendiliğinden almaz, kayma/itme ile zamanlamak gerekir.
- **Kaleci elden bırakınca** (atış ya da vole) top önünde duran rakibe çarpıp ona geçmez; önü kapalıysa kaleci topu üstünden atar.

## Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Ekranın sol yarısı (joystick) | WASD / Ok tuşları |
| Şut (top sende; yukarı kaydır: aşırtma) / Kay (top sende değil) / havadaki topa bitirici | Üst sağ tuş (ŞUT) | J / Boşluk |
| Ara pas (yukarı kaydır: havadan ara pas) / Baskı-İt (top sende değil) | Şutun solundaki tuş (ARA) | L / V |
| Pas (yukarı kaydır: orta / havadan pas) / Oyuncu değiştir | Sol alt tuş (PAS) | K |
| Depar (basılı tut) + Çalım (basılıyken bir yöne kaydır) | Sağ alttaki büyük tuş | Shift, çalım: I + yön |
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

**4. Denge testi:** `npm run sim -- normal 4` komutu (isteğe bağlı üçüncü parametre hava durumu: `rain`, `snow`, `wind`…) 20 maçı yapay zekâya karşı yapay zekâ olarak arka planda oynatır; maç başına gol, yere serme, şut, kurtarış ve kullanılan eşya ortalamalarını yazar. `npm run smoke -- normal` ise senaryolu bir "insan" oyuncuyla kaleci kontrolünü, tutma süresini, eşya kullanımını, falsoyu ve rakip presini test eder.

**5. Kariyer testi:** `npm run career -- 10 FWD` bir kariyeri 10 sezon boyunca rastgele kararlarla arka planda oynatır (transferler, pazarlık, gönderiler, DM'ler, yetenekler) ve her sezonun özetini yazar; dünya tutarlılığını da kontrol eder. `npm run career-match` ise "sadece kendi oyuncun" modunda kontrolün hiç kaymadığını ve topu istediğinde takım arkadaşlarının ne sıklıkla pas verdiğini ölçer.

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
