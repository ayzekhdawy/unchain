import type { AmbientName } from "./books";
import { resumeAudio } from "./ema";

const RATE = 22050;
const SECONDS = 2;

export function ambientGain(level: number): number {
  const unit = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  return unit * 0.12;
}

export function ambientPcm(kind: Exclude<AmbientName, "yok">): Float32Array {
  const length = RATE * SECONDS;
  const out = new Float32Array(length);
  const rand = mulberry(kind === "yagmur" ? 11 : kind === "ocak" ? 29 : 47);
  let brown = 0;
  for (let index = 0; index < length; index += 1) {
    const white = rand() * 2 - 1;
    brown = brown * 0.985 + white * 0.015;
    if (kind === "yagmur") {
      out[index] = brown * 1.8;
      if (rand() < 0.0035) drop(out, index, rand, 0.55);
    } else if (kind === "ocak") {
      out[index] = brown * 1.2 + Math.sin((index / RATE) * 2 * Math.PI * 7) * 0.04;
      if (rand() < 0.002) drop(out, index, rand, 0.85);
    } else {
      out[index] = brown * 0.7 + Math.sin((index / RATE) * 2 * Math.PI * 96) * 0.03;
    }
  }
  let peak = 0;
  for (const sample of out) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.3 / peak : 0;
  const fade = Math.round(RATE * 0.02);
  for (let index = 0; index < length; index += 1) {
    let sample = out[index] * scale;
    if (index < fade) sample *= index / fade;
    if (index >= length - fade) sample *= (length - 1 - index) / fade;
    out[index] = sample;
  }
  return out;
}

let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let current: AmbientName = "yok";

export function setAmbient(kind: AmbientName, level: number) {
  const ctx = resumeAudio();
  if (!ctx || kind === "yok") {
    stopAmbient();
    return;
  }
  if (ctx.state === "suspended") void ctx.resume();
  const amount = ambientGain(level);
  if (current === kind && source && gain) {
    gain.gain.setTargetAtTime(amount, ctx.currentTime, 0.05);
    return;
  }
  stopAmbient();
  const pcm = ambientPcm(kind);
  const buffer = ctx.createBuffer(1, pcm.length, RATE);
  const copy = new Float32Array(pcm.length);
  copy.set(pcm);
  buffer.copyToChannel(copy, 0);
  const nextGain = ctx.createGain();
  nextGain.gain.value = amount;
  const next = ctx.createBufferSource();
  next.buffer = buffer;
  next.loop = true;
  next.connect(nextGain);
  nextGain.connect(ctx.destination);
  next.start();
  source = next;
  gain = nextGain;
  current = kind;
}

export function stopAmbient() {
  if (source) {
    try {
      source.stop();
    } catch {
      /* already ended */
    }
    source.disconnect();
  }
  if (gain) gain.disconnect();
  source = null;
  gain = null;
  current = "yok";
}

function drop(out: Float32Array, at: number, rand: () => number, amount: number) {
  const span = 70 + Math.floor(rand() * 90);
  for (let step = 0; step < span && at + step < out.length; step += 1) {
    out[at + step] += Math.exp(-step / 18) * (rand() * 2 - 1) * amount;
  }
}

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
