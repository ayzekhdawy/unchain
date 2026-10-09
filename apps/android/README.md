# Android

Telefon uygulaması Kotlin ve Jetpack Compose olacak. Modüller:

- `:app` beş sekmeli kabuk, kitaplık, mini oynatıcı
- `:import` PDF, EPUB, TXT, DOCX, kamera
- `:player` okuyucu ve Media3
- `:tts` EMA çalıştırıcısı, ölçüm kapısı geçince

Bu makinede Android Studio var, JDK 17 Android Studio’nun `jbr` klasöründe.
Android SDK kurulu değil (`%LOCALAPPDATA%\Android\Sdk` yok). Gradle projesi
SDK yolu olmadan derlenmez. Kabuk, SDK kurulunca açılacak. O zamana kadar
aynı arayüz `apps/web` içindeki masaüstü okuyucudadır.

APK inince kitap, ilerleme ve ses aygıtta kalır. Hesap sunucusu yoktur.
Giriş ekranı yerel bir profildir.
