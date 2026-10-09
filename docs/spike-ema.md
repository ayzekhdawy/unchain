# EMA Lightning ölçüm kapısı

Ses: [EMA Lightning](https://huggingface.co/canberkkkkkk/ema-lightning), Canberk Aslan, Apache 2.0.
Kod: [canberk7/ema-lightning](https://github.com/canberk7/ema-lightning). Python 3.11–3.13, PyTorch 2.1+.

## Neden kapı var

Model kartı GPU’da ilk sesi yaklaşık 4 ms, CPU’da yaklaşık 6 kat gerçek zaman diyor.
Depoda ONNX veya ExecuTorch dışa aktarımı yok. Akustik model özel bir DiT,
pencereli hizalayıcı ve HiFi-GAN çözücüsüdür. Telefon paketine Python gömmek
hedef değildir. Önce bu makinede CPU ölçülür, sonra dışa aktarım denenir.

Geçiş eşiği: ilk ses 2 saniyenin altında, uzun parça dinlemeden en az 1 kat hızlı.

## Nasıl çalıştırılır

```
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install ema-lightning --extra-index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python tools\spike_ema.py
```

Sonuç `docs/spike-result.json` dosyasına yazılır. Ağırlıklar ilk çalıştırmada
Hugging Face’ten iner (yaklaşık 34 MB). PyTorch CPU tekeri ayrıca iner.

## Karaoke

`say()` her sözcüğün başlangıç ve bitişini `speech.words` ile verir. Okuyucudaki
yeşil kapsül bu zamanlara bağlanacak. Önizleme bunları kullanmaz.

## Bu makinede ölçülen

Python 3.13, `ema-lightning` 1.0.4, `torch` 2.14.1+cpu. Ağırlıklar Hugging Face’ten
bir kez indi. Sayılar `docs/spike-result.json` dosyasındadır.

İlk süreç, kurulumdan hemen sonra: model yükleme 9.491 s, ilk cümle 24.318 s
üretim / 2.72 s ses. Bu çağrı 2 saniye eşiğini geçemedi. Aynı süreçte ısınmış
217 karakterlik paragraf 1.818 s üretim / 14.89 s ses, rtf 0.122.

İkinci süreç, ağırlıklar önbellekte: yükleme 0.920 s, ilk cümle 0.371 s,
ikinci aynı cümle 0.222 s, paragraf 1.780 s / 14.89 s, rtf 0.120. Bu koşuda
hem ilk ses hem gerçek zaman eşiği geçti.

`speech.words` sözcük zamanı veriyor. “zekâ” normalleştirmeden “zeka” olarak
dönüyor. Karaoke bu zamanlara bağlanabilir.

Telefon ölçülmedi. ONNX ve ExecuTorch dışa aktarımı denenmedi. Bu yüzden
oynatıcıya Ema bağlanmadı. Web’deki çalma tarayıcı önizlemesidir ve ekranda
böyle yazılır. PyTorch bir Vercel fonksiyonuna konmaz.
