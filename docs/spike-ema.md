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

`say()` her sözcüğün başlangıç ve bitişini `speech.words` ile verir. Web
okuyucudaki yeşil kapsül Python zamanını kullanmaz. ONNX zaman çizelgesindeki
`fw` dizisini 25 Hz ile izler. Önizleme bunları kullanmaz.

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

## ONNX

`tools/export_ema_onnx.py` üç grafiği legacy TorchScript ile, opset 17, dışa
aktarır. `torch.expm1` dışa aktarımdan önce `exp(x) - 1` olur. Dikkat katmanı
eager matmul kullanır. NVIDIA `.lightning()` gerekmez.

Ölçülen cümle “Merhaba. Bu ses yapay zekâ ile üretilmiştir.” ONNX ile yamalı
PyTorch arasında ilgileşim 1.0, en büyük mutlak fark 8e-06. Kısa “Deneme.”
14 kare, 26880 örnek verir.

Dosyalar `apps/web/public/ema` altındadır: `text.onnx` 4.81 MB, `sound.onnx`
18.09 MB, `decoder.onnx` 12.04 MB, `meta.json`. Zaman çizelgesi sabiti
`apps/web/fixtures/ema-timeline.json` dosyasındadır. `npm run check:ema` bunu
doğrular.

## Tarayıcı

onnxruntime-web 1.30.0. Tek iş parçacığı (`numThreads = 1`), vekil yok,
COOP/COEP yok. Oturumlar sırayla açılır. Önbellek adı `unchain-ema-v1`.

Yerel üretim sunucusunda (`next start`, 2026-10-09, Chrome) ağırlıklar
önceden yüklenmişken Oynat’tan sonra bant “İlk cümle 0.9 saniyede üretildi.”
yazdı. Oynat düğmesinin adı “Durdur” oldu. Bölüm “Cümle cümle”ye geçti. Yeşil
kapsül “geri” sözcüğündeydi. Bu, “Tarayıcı önizlemesi. Ema sesi değil.”
cümlesi değildir. Hoparlör dinlenmedi.

Üretim başarısız olursa bant yine “Tarayıcı önizlemesi. Ema sesi değil.” olur.

Telefon ölçülmedi. ExecuTorch denenmedi. PyTorch bir Vercel fonksiyonuna
konmaz. Android paketinde Ema yok.
