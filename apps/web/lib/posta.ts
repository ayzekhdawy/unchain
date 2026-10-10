export async function sendMagic(to: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: "Unchain <unchain@noniux.com>",
      to: [to],
      subject: "Unchain giriş bağlantısı",
      text: `Unchain giriş bağlantısı. 20 dakika geçerlidir ve bir kez kullanılır.\n${url}\nBu bağlantıyı sen istemediysen yok say.`
    })
  });
  return response.ok;
}
