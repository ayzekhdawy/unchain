import { acceptLibrary } from "../lib/kitaplik";
import { decodeClip, encodeClip, clipKey } from "../lib/klip";
import { emptyLibrary } from "../lib/books";
import {
  audioPath,
  cleanEmail,
  filePath,
  isSha256,
  mailOrigin,
  safeBookId,
  safeFileName,
  sameSiteMutation,
  sha256Hex
} from "../lib/hesap";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(cleanEmail("  A@B.CO ") === "a@b.co", "e-posta");
  assert(cleanEmail("yok") === null, "e-posta bozuk");
  assert(mailOrigin("evil.example", "production", "preview.vercel.app") === "https://unchain.noniux.com", "üretim köken");
  assert(mailOrigin("localhost:4177", undefined, undefined) === "http://localhost:4177", "yerel köken");
  assert(mailOrigin("evil.example", "preview", "unchain-abc.vercel.app") === "https://unchain-abc.vercel.app", "önizleme");

  const hash = await sha256Hex("unchain");
  assert(hash === (await sha256Hex("unchain")), "özet");
  assert(isSha256(hash), "özet biçimi");
  assert(hash !== (await sha256Hex("unchain ")), "özet değişir");

  const slow = await clipKey("Gece inince oda küçülür.", 1);
  const fast = await clipKey("Gece inince oda küçülür.", 1.2);
  const other = await clipKey("Başka cümle.", 1);
  assert(slow !== fast && slow !== other, "önbellek anahtarı");

  const pcm = new Float32Array([0, 0.25, -0.5, 1]);
  const encoded = encodeClip({ pcm, sampleRate: 24000, wordStarts: [0, 0.4], seconds: 1.5 });
  const decoded = decodeClip(encoded);
  assert(Boolean(decoded), "çöz");
  assert(decoded!.sampleRate === 24000, "oran");
  assert(decoded!.seconds === 1.5, "süre");
  assert(decoded!.wordStarts.length === 2 && Math.abs(decoded!.wordStarts[1] - 0.4) < 1e-6, "sözcük");
  assert(decoded!.pcm.length === 4 && decoded!.pcm[2] === -0.5, "örnek");
  const bad = encoded.slice();
  bad[0] = 0;
  assert(decodeClip(bad) === null, "bozuk");

  assert(safeBookId("pd-kir-sinegi") === "pd-kir-sinegi", "kitap");
  assert(safeBookId("../gizli") === null, "kitap yol");
  assert(safeFileName("C:\\kitap\\Gece.epub") === "Gece.epub", "ad");
  assert(safeFileName("%47ece.epub") === "Gece.epub", "kodlu ad");
  assert(filePath("usrabc", "b1", "gece.epub") === "u/usrabc/dosya/b1/gece.epub", "dosya yolu");
  assert(audioPath("usrabc", hash) === `u/usrabc/ses/${hash}`, "ses yolu");

  const allowed = new Request("https://unchain.noniux.com/api/kitaplik", {
    method: "PUT",
    headers: { origin: "https://unchain.noniux.com", host: "unchain.noniux.com" }
  });
  const blocked = new Request("https://unchain.noniux.com/api/kitaplik", {
    method: "PUT",
    headers: { origin: "https://evil.example", host: "unchain.noniux.com" }
  });
  assert(sameSiteMutation(allowed), "aynı site");
  assert(!sameSiteMutation(blocked), "yabancı site");

  const library = emptyLibrary();
  const accepted = acceptLibrary(library);
  assert(accepted.ok && accepted.library.books[0].id === "sample-gece", "kitaplık");
  assert(!acceptLibrary({ books: [] }).ok, "boş kitaplık");
  assert(!acceptLibrary({ books: [{ id: 1 }] }).ok, "eksik kitap");

  console.log("hesap tamam");
}

void main();
