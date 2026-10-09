# Unchain

Türkçe kitabı telefonda sese çevirir. Metin ve ses cihazdan çıkmaz.

Site: [unchain.noniux.com](https://unchain.noniux.com)

Unchain açık kaynak bir okuyucudur. PDF, EPUB, TXT ve DOCX gibi metinler
bölümlere ayrılır, [EMA Lightning](https://huggingface.co/canberkkkkkk/ema-lightning)
ile Türkçe okunur. Model tek seslidir, yaklaşık 34 MB’dir ve Apache 2.0’dır.
Telefon uygulaması çevrimdışı çalışacak şekilde kurulur. Masaüstü arayüz
`unchain.noniux.com` üzerinde, Vercel’de durur.

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
docs            EMA ölçüm kapısı
tools           Ölçüm betiği
```

## Ses

EMA Lightning bugün Python ve PyTorch’tur. Bu dizüstü bilgisayarın CPU’sunda,
ağırlıklar önbellekteyken ilk cümle 0.37 saniyede, uzun paragraf gerçek
zamandan hızlı üretildi. İlk kurulum çağrısı 24 saniye sürdü. Telefon ve
ONNX dışa aktarımı henüz ölçülmedi. Ayrıntı
[docs/spike-ema.md](docs/spike-ema.md) içindedir. Web’deki çalma tarayıcı
önizlemesidir ve ekranda böyle yazar. Ema sesi değildir.

## Lisans

Apache 2.0. NOTICE korunur. Ticari dağıtım atıf ister.
