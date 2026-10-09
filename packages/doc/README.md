# Kitap ara biçimi

Okuyucu ve ses aynı JSON’u okur. Şema `book.schema.json` dosyasındadır.

Bir bölüm, cümlelere bölünmüş düz metindir. Karaoke sözcüğü cümleyi
boşluklardan böler. Süre tahmini Türkçe için 900 karakter / dakikadır,
hız 1,0 iken. EMA Lightning `speech.words` zamanları geldiğinde bu tahmin
yerini modelin sözcük sürelerine bırakır.
