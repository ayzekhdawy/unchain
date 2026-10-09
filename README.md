# Unchain

Türkçe kitabı telefonda sese çevirir. Metin ve ses cihazdan çıkmaz.

Site: [unchain.noniux.com](https://unchain.noniux.com)

Unchain açık kaynak bir okuyucudur. Web okuyucusu PDF, EPUB, DOCX, TXT ve MD
dosyalarını tarayıcıda bölümlere ayırır; dosya sunucuya gitmez. Ses
[EMA Lightning](https://huggingface.co/canberkkkkkk/ema-lightning): tek ses,
yaklaşık 34 MB, Apache 2.0. Web okuyucu bu sesi tarayıcıda, üç ONNX grafiğiyle
üretir. Üretim olmazsa ekranda “Tarayıcı önizlemesi. Ema sesi değil.” yazar.
Telefon uygulaması henüz kurulmaz ve Ema’yı taşımaz. Masaüstü arayüz
`unchain.noniux.com` üzerinde, Vercel’de durur. Açık rafta üç kamu malı
eser durur: Ömer Seyfettin’den Kır Sineği ve Yalnızlık, Orhan Veli’den
Yaşamak. Örnek metin Gece okuması Unchain’e aittir. Lisanslar
[docs/katalog.md](docs/katalog.md) içindedir.

## Vizyon

Elindeki Türkçe metni, telefondan çıkarmadan, tek bir açık sesle dinlemek.

## Misyon

PDF, EPUB ve düz metni cihazda Türkçe sese çeviren, reklamsız bir okuyucu
yapmak. Ticari türev, uygulamada ve depoda Unchain’e görünür atıf verir.
Ayrıntı [ATTRIBUTION.md](ATTRIBUTION.md) içindedir.

## Depo

```
apps/web        Tanıtım ve masaüstü okuyucu (Next.js, Vercel)
apps/android    Telefon uygulaması (Kotlin, Jetpack Compose) — kabuk sırada
packages/doc    Kitap JSON şeması
brand           İşaret ve Gece Okuma paleti
docs            EMA ölçüm kapısı ve kamu malı katalog
tools           Ölçüm betiği
```

## Ses

Web okuyucu Ema’yı tarayıcıda üretir. Grafikler `apps/web/public/ema` altındadır:
metin, ses ve çözücü. Çalışma zamanı onnxruntime-web 1.30.0, tek WASM iş
parçacığı, COOP/COEP yok. Ağırlıklar yüklendikten sonra bu makinedeki Chrome
penceresinde ilk cümle 0.9 saniyede üretime geçti. Bant “Ema. Bu ses yapay
zekâ ile üretilmiştir.” yazar. Üretim olmazsa yazı “Tarayıcı önizlemesi. Ema
sesi değil.” olur.

Aynı dizüstünün CPU’sunda PyTorch, ağırlıklar önbellekteyken ilk cümleyi 0.37
saniyede üretti. İlk kurulum çağrısı 24 saniye sürdü. Bu iki sayı ayrı
ölçümdür. ONNX ile yamalı PyTorch ilgileşimi 1.0, en büyük mutlak fark
8e-06. Ayrıntı [docs/spike-ema.md](docs/spike-ema.md) içindedir.

Telefon uygulamasında Ema yok. ExecuTorch denenmedi. PyTorch bir Vercel
fonksiyonuna konmaz. Hoparlör bu ölçümde dinlenmedi; doğrulama ekran
yazısı, düğme adı ve sözcük kapsülüdür.

## Lisans

Apache 2.0. NOTICE korunur. Ticari dağıtım atıf ister.
