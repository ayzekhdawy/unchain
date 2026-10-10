import Link from "next/link";

function Mark() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#16181C" />
      <g transform="rotate(-36 32 32)">
        <path
          d="M39 16.5A11 11 0 0 1 44 25.5V39A11 11 0 0 1 22 39V25.5A11 11 0 0 1 31 14.2"
          stroke="#E8A05A"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="landing">
      <header className="top">
        <Link className="brand" href="/">
          <Mark />
          <b>unchain</b>
        </Link>
        <a className="btn" href="https://github.com/ayzekhdawy/unchain">
          GitHub
        </a>
      </header>
      <main className="hero">
        <div>
          <p className="kicker">Açık kaynak okuyucu</p>
          <h1>Türkçe kitabı telefonda sese çevirir.</h1>
          <p className="lede">
            Telefonda metin ve ses cihazdan çıkmaz. PDF, EPUB ve düz yazı bölümlere ayrılır, tek bir açık sesle okunur.
            Web’de giriş yapınca kitaplığın bir kopyası Vercel’de durur; yüklemeden önce bu söylenir.
          </p>
          <div className="actions">
            <Link className="btn solid" href="/uygulama">
              Okuyucuyu aç
            </Link>
            <a className="btn" href="https://github.com/ayzekhdawy/unchain/releases">
              APK yakında
            </a>
          </div>
          <div className="facts">
            <div>
              <strong>Telefonda kalır</strong>
              <span>APK inince kitap, ilerleme ve ses aygıttadır. Telefonun hesap sunucusu yoktur.</span>
            </div>
            <div>
              <strong>Ema, tek ses</strong>
              <span>EMA Lightning, yaklaşık 34 MB, Apache 2.0. Bu ses yapay zekâ ile üretilir.</span>
            </div>
            <div>
              <strong>Ticari kullanım atıf ister</strong>
              <span>Apache 2.0. Türev, hakkında ekranında Unchain bağlantısını tutar.</span>
            </div>
          </div>
        </div>
        <div className="phone" aria-hidden="true">
          <header>
            <b>Kitaplık</b>
            <span className="iconbtn" />
          </header>
          <div className="row">
            <div className="cover" style={{ background: "linear-gradient(160deg,#3d4c63,#8e7d9b)" }} />
            <div>
              <p className="who">Örnek</p>
              <p>
                <b>Gece okuması</b>
              </p>
              <p className="who">2 dk</p>
            </div>
          </div>
          <div className="row">
            <div className="cover" style={{ background: "linear-gradient(160deg,#7eb8c9,#d7efe8)" }} />
            <div>
              <p className="who">Sen</p>
              <p>
                <b>Yapıştırdığın metin</b>
              </p>
              <p className="who">süre, harf sayısından</p>
            </div>
          </div>
          <div className="mini">
            <div className="cover" style={{ width: 36, height: 36, background: "#3d4c63" }} />
            <div>
              <b>Gece okuması</b>
              <div className="who">İlk sayfa</div>
            </div>
            <span className="play" />
          </div>
        </div>
      </main>
      <footer className="site-foot">
        <span>Bu ses yapay zekâ ile üretilmiştir.</span>
        <span>Unchain — github.com/ayzekhdawy/unchain</span>
      </footer>
    </div>
  );
}
