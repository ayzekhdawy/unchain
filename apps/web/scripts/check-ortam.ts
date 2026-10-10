import type { AmbientName } from "../lib/books";
import { ambientGain, ambientPcm } from "../lib/ortam";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const kinds: Exclude<AmbientName, "yok">[] = ["yagmur", "ocak", "oda"];
for (const kind of kinds) {
  const pcm = ambientPcm(kind);
  assert(pcm.length === 22050 * 2, `${kind} uzunluk`);
  let peak = 0;
  let energy = 0;
  for (const sample of pcm) {
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
  }
  const rms = Math.sqrt(energy / pcm.length);
  assert(peak <= 0.35 && peak > 0.05, `${kind} tepe ${peak}`);
  assert(rms > 0.01, `${kind} rms ${rms}`);
  assert(pcm[0] === 0 && pcm[pcm.length - 1] === 0, `${kind} kenar`);
}

assert(ambientGain(0) === 0, "kapalı");
assert(ambientGain(1) === 0.12, `kazanç ${ambientGain(1)}`);
assert(ambientGain(4) === 0.12, "tavan");
assert(ambientGain(-2) === 0, "taban");
console.log("ortam tamam");
