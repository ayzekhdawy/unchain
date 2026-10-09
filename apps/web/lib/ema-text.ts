/** Text the EMA graph can read: cardinals, alphabet, chunks, and the frame timeline.
 *  No runtime import. Bankers' rounding matches torch.round in engine.plan.
 */
import meta from "../public/ema/meta.json";

export const SAMPLE_RATE = meta.sample_rate;
export const HOP = meta.hop;
export const FPS = meta.fps;
export const LATENT = meta.latent_dim;
export const STEPS = meta.steps;
export const MAX_WORD_FRAMES = meta.max_word_frames;
export const MAX_FRAMES = meta.max_frames;
export const MAX_LETTERS = meta.max_letters;
export const VOCAB = meta.vocab;

const STOI = new Map(VOCAB.map((token, index) => [token, index]));
const TURKISH = new Set("çğıöşüÇĞİÖŞÜ");
const TYPOGRAPHY: Record<string, string> = {
  "’": "'",
  "‘": "'",
  "ʼ": "'",
  "´": "'",
  "`": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "..."
};

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const LETTERS_PER_SECOND = 18;
const MAX_SECONDS = 10;
const SENTENCE_PAUSE = 0.25;
const CLAUSE_PAUSE = 0.12;

export type Timeline = {
  scaled: number[];
  counts: number[];
  fw: number[];
  fp: number[];
  frames: number;
};

export type Piece = { text: string; pause: number };

function rstrip(value: string, chars: string): string {
  let end = value.length;
  while (end > 0 && chars.includes(value[end - 1])) end -= 1;
  return value.slice(0, end);
}

function stripMarks(char: string): string {
  return char.normalize("NFKD").replace(/\p{M}/gu, "");
}

/** Integers 0–999999. 100 is "yüz", 1000 is "bin". */
export function cardinal(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999999) return String(value);
  if (value === 0) return "sıfır";
  const underThousand = (n: number) => {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    const parts: string[] = [];
    if (hundreds === 1) parts.push("yüz");
    else if (hundreds > 1) parts.push(ONES[hundreds], "yüz");
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push(ONES[ones]);
    return parts.join(" ");
  };
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const parts: string[] = [];
  if (thousands === 1) parts.push("bin");
  else if (thousands > 1) parts.push(underThousand(thousands), "bin");
  if (rest) parts.push(underThousand(rest));
  return parts.join(" ");
}

/** Replace standalone integers. Leaves decimals such as 3.14 and 3,14 written. */
export function speakCardinals(text: string): string {
  return text.replace(/(^|[^\p{L}\d])(\d{1,6})(?!\d)/gu, (match, prefix: string, digits: string, offset: number, src: string) => {
    if (prefix === "." || prefix === ",") return match;
    const afterAt = offset + match.length;
    const after = src[afterAt] ?? "";
    if ((after === "." || after === ",") && /\d/.test(src[afterAt + 1] ?? "")) return match;
    return prefix + cardinal(Number(digits));
  });
}

/** Python str.lower() after İ→i and I→ı, then the model alphabet. */
export function alphabet(text: string): string {
  let value = text;
  for (const [from, to] of Object.entries(TYPOGRAPHY)) value = value.split(from).join(to);
  value = value.replaceAll("İ", "i").replaceAll("I", "ı").toLowerCase();
  let out = "";
  for (const char of value) {
    const piece = TURKISH.has(char) ? char : stripMarks(char);
    const readable = piece.length > 0 && [...piece].every((item) => STOI.has(item));
    out += readable ? piece : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

export function toSpoken(text: string): string {
  return alphabet(speakCardinals(text));
}

function finish(piece: string): string {
  const last = rstrip(piece, "\"')").slice(-1);
  if (last === "." || last === "!" || last === "?") return piece;
  return `${rstrip(piece, ",;:- ")}.`;
}

function lastCut(text: string, limit: number): { cut: number; pause: number } | null {
  const window = text.slice(0, limit + 1);
  const cuts: { pattern: RegExp; pause: number }[] = [
    { pattern: new RegExp("[.!?]+[\"')]*" + "(?= )", "g"), pause: SENTENCE_PAUSE },
    { pattern: /[,;:](?= )/g, pause: CLAUSE_PAUSE },
    { pattern: /\S(?= )/g, pause: CLAUSE_PAUSE }
  ];
  for (const cut of cuts) {
    cut.pattern.lastIndex = 0;
    let found = -1;
    let match: RegExpExecArray | null;
    while ((match = cut.pattern.exec(window))) {
      found = match.index + match[0].length;
      if (match[0].length === 0) cut.pattern.lastIndex += 1;
    }
    if (found >= 0) return { cut: found, pause: cut.pause };
  }
  return null;
}

/** Split only when the spoken line is longer than one model pass. */
export function chunk(text: string, speed: number): Piece[] {
  const safe = speed > 0 ? speed : 1;
  const limit = Math.trunc(Math.min(MAX_LETTERS, LETTERS_PER_SECOND * MAX_SECONDS * safe));
  const pieces: Piece[] = [];
  let rest = text.trim();
  while (rest) {
    let cut = rest.length;
    let pause = 0;
    if (rest.length > limit) {
      const found = lastCut(rest, limit);
      cut = found ? found.cut : limit;
      pause = found ? found.pause : 0;
    }
    const piece = rest.slice(0, cut).trim();
    rest = rest.slice(cut).trim();
    if (/\p{L}/u.test(piece)) pieces.push({ text: finish(piece), pause });
  }
  if (pieces.length) pieces[pieces.length - 1].pause = 0;
  return pieces;
}

/** Letter ids and the word index of each letter. A space stays on the previous word. */
export function encodePiece(text: string): { ids: number[]; cw: number[]; wstart: number[] } {
  const chars = [...text];
  const starts: number[] = [];
  chars.forEach((char, index) => {
    if (char !== " " && (index === 0 || chars[index - 1] === " ")) starts.push(index);
  });
  if (!starts.length) starts.push(0);
  const bounds = [0, ...starts.slice(1), chars.length];
  const cw: number[] = [];
  const wstart: number[] = [];
  for (let word = 0; word < bounds.length - 1; word += 1) {
    for (let index = bounds[word]; index < bounds[word + 1]; index += 1) {
      cw.push(word);
      wstart.push(bounds[word]);
    }
  }
  return { ids: chars.map((char) => STOI.get(char) ?? 1), cw, wstart };
}

/** Half rounds to even, then each word is clamped to 1..250 frames. */
export function bankersRound(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const frac = abs - floor;
  let rounded = floor;
  if (frac > 0.5) rounded = floor + 1;
  else if (frac < 0.5) rounded = floor;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return sign * rounded;
}

export function planTimeline(dur: number[], cw: number[], speed: number): Timeline {
  const safe = speed > 0 ? speed : 1;
  const scaled = dur.map((value) => value / safe);
  const words = cw.length ? cw[cw.length - 1] + 1 : 0;
  const sums = new Array<number>(words).fill(0);
  for (let index = 0; index < scaled.length; index += 1) {
    const word = cw[index] ?? 0;
    if (word >= 0 && word < sums.length) sums[word] += scaled[index];
  }
  const counts = sums.map((sum) => Math.max(1, Math.min(MAX_WORD_FRAMES, bankersRound(sum))));
  let budget = Math.min(
    counts.reduce((total, count) => total + count, 0),
    MAX_FRAMES
  );
  const fw: number[] = [];
  for (let word = 0; word < counts.length && fw.length < budget; word += 1) {
    for (let frame = 0; frame < counts[word] && fw.length < budget; frame += 1) fw.push(word);
  }
  budget = fw.length;
  const starts: number[] = [];
  let cursor = 0;
  for (const count of counts) {
    starts.push(cursor);
    cursor += count;
  }
  const fp = fw.map((word, frame) => (frame - starts[word]) / counts[word]);
  return { scaled, counts, fw, fp, frames: budget };
}

export function wordStartFrames(fw: number[]): number[] {
  const starts: number[] = [];
  for (let frame = 0; frame < fw.length; frame += 1) {
    const word = fw[frame];
    if (starts[word] === undefined) starts[word] = frame;
  }
  return starts;
}
