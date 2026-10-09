import { readFileSync } from "node:fs";
import path from "node:path";
import {
  alphabet,
  bankersRound,
  cardinal,
  chunk,
  encodePiece,
  planTimeline,
  speakCardinals,
  toSpoken
} from "../lib/ema-text";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function same(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "ema-timeline.json"), "utf8")) as {
  spoken: string;
  dur: number[];
  cw: number[];
  fw: number[];
  frames: number;
};

const sentence = "Merhaba. Bu ses yapay zekâ ile üretilmiştir.";
assert(toSpoken(sentence) === fixture.spoken, `alfabe: ${toSpoken(sentence)}`);
assert(alphabet("İSTANBUL") === "istanbul", alphabet("İSTANBUL"));
assert(alphabet("IŞIK") === "ışık", alphabet("IŞIK"));
assert(alphabet("zekâ") === "zeka", alphabet("zekâ"));

assert(cardinal(0) === "sıfır", cardinal(0));
assert(cardinal(15) === "on beş", cardinal(15));
assert(cardinal(21) === "yirmi bir", cardinal(21));
assert(cardinal(100) === "yüz", cardinal(100));
assert(cardinal(101) === "yüz bir", cardinal(101));
assert(cardinal(1000) === "bin", cardinal(1000));
assert(cardinal(1100) === "bin yüz", cardinal(1100));
assert(cardinal(2000) === "iki bin", cardinal(2000));
assert(cardinal(2024) === "iki bin yirmi dört", cardinal(2024));
assert(cardinal(100000) === "yüz bin", cardinal(100000));
assert(speakCardinals("15 saniye.") === "on beş saniye.", speakCardinals("15 saniye."));
assert(speakCardinals("1000.") === "bin.", speakCardinals("1000."));
assert(speakCardinals("3.14 kaldı") === "3.14 kaldı", speakCardinals("3.14 kaldı"));
assert(speakCardinals("3,14 kaldı") === "3,14 kaldı", speakCardinals("3,14 kaldı"));

assert(bankersRound(2.5) === 2, "2.5");
assert(bankersRound(3.5) === 4, "3.5");
assert(planTimeline([2.5], [0], 1).counts[0] === 2, "sözcük 2.5");
assert(planTimeline([3.5], [0], 1).counts[0] === 4, "sözcük 3.5");
assert(planTimeline([0.5], [0], 1).counts[0] === 1, "alt sınır");

const encoded = encodePiece(fixture.spoken);
assert(same(encoded.cw, fixture.cw), "cw uyuşmadı");
const timeline = planTimeline(fixture.dur, fixture.cw, 1);
assert(timeline.frames === fixture.frames, `kare ${timeline.frames} != ${fixture.frames}`);
assert(same(timeline.fw, fixture.fw), `fw ilk fark ${timeline.fw.findIndex((value, index) => value !== fixture.fw[index])}`);

const pieces = chunk(fixture.spoken, 1);
assert(pieces.length === 1 && pieces[0].text === fixture.spoken && pieces[0].pause === 0, "kısa parça bölünmemeli");
const bare = chunk("kısa cümle", 1);
assert(bare.length === 1 && bare[0].text === "kısa cümle.", bare[0]?.text ?? "");
const long = chunk(`Birinci cümle bitti. ${"kelime ".repeat(80)}`, 1);
assert(long.length > 1, "uzun metin bölünmeli");
assert(long[0].text === "Birinci cümle bitti.", long[0].text);
assert(long[0].pause === 0.25, `durak ${long[0].pause}`);
assert(long[long.length - 1].pause === 0, "son parça susmaz");

console.log("ema metin tamam");
