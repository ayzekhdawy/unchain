/** EMA Lightning in the browser. Weights stay under /ema and the Cache API.
 *  One WASM thread, so the rest of the site does not need cross-origin isolation.
 *  Speech synthesis is not this module. Callers label that path as a preview.
 */
import {
  FPS,
  HOP,
  LATENT,
  SAMPLE_RATE,
  STEPS,
  chunk,
  encodePiece,
  planTimeline,
  toSpoken,
  wordStartFrames
} from "@/lib/ema-text";

export type EmaClip = {
  pcm: Float32Array;
  sampleRate: number;
  wordStarts: number[];
  spoken: string;
  seconds: number;
};

type Sessions = {
  text: OrtSession;
  sound: OrtSession;
  decoder: OrtSession;
};

type OrtTensor = {
  dims: readonly number[];
  data: Float32Array | BigInt64Array | Uint8Array;
};

type OrtSession = {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
};

type OrtModule = {
  env: { wasm: { numThreads: number; proxy: boolean; wasmPaths: string | { mjs?: string; wasm?: string } } };
  InferenceSession: {
    create(buffer: ArrayBuffer, options: { executionProviders: string[]; graphOptimizationLevel: "all" }): Promise<OrtSession>;
  };
  Tensor: new (type: "float32" | "int64" | "bool", data: Float32Array | BigInt64Array | Uint8Array, dims: number[]) => unknown;
};

let ortPromise: Promise<OrtModule> | null = null;
let sessionPromise: Promise<Sessions> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const clips = new Map<string, Promise<EmaClip>>();
let audio: AudioContext | null = null;

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  let left = 0;
  let right = 0;
  while (left === 0) left = rand();
  while (right === 0) right = rand();
  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
}

async function runtime(): Promise<OrtModule> {
  if (typeof window === "undefined") throw new Error("Ema yalnız tarayıcıda çalışır.");
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web/wasm").then((mod) => {
      const ort = mod as unknown as OrtModule;
      const origin = window.location.origin;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = {
        mjs: `${origin}/ort/ort-wasm-simd-threaded.mjs`,
        wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm`
      };
      return ort;
    }).catch((err) => {
      ortPromise = null;
      throw err;
    });
  }
  return ortPromise;
}

async function modelBytes(file: string): Promise<ArrayBuffer> {
  const url = `/ema/${file}`;
  try {
    const cache = await caches.open("unchain-ema-v1");
    const hit = await cache.match(url);
    if (hit) return hit.arrayBuffer();
    const response = await fetch(url);
    if (!response.ok) throw new Error(file);
    await cache.put(url, response.clone());
    return response.arrayBuffer();
  } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Ema dosyası açılmadı: ${file}`);
    return response.arrayBuffer();
  }
}

export function loadEma(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await runtime();
      const options = { executionProviders: ["wasm"], graphOptimizationLevel: "all" as const };
      const [textBytes, soundBytes, decoderBytes] = await Promise.all([
        modelBytes("text.onnx"),
        modelBytes("sound.onnx"),
        modelBytes("decoder.onnx")
      ]);
      const text = await ort.InferenceSession.create(textBytes, options);
      const sound = await ort.InferenceSession.create(soundBytes, options);
      const decoder = await ort.InferenceSession.create(decoderBytes, options);
      return { text, sound, decoder };
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise.then(() => undefined);
}

function i64(ort: OrtModule, values: number[], dims: number[]) {
  const data = new BigInt64Array(values.length);
  for (let index = 0; index < values.length; index += 1) data[index] = BigInt(values[index]);
  return new ort.Tensor("int64", data, dims);
}

function f32(ort: OrtModule, values: ArrayLike<number>, dims: number[]) {
  const data = values instanceof Float32Array ? values : Float32Array.from(values);
  return new ort.Tensor("float32", data, dims);
}

function bools(ort: OrtModule, length: number, dims: number[]) {
  return new ort.Tensor("bool", new Uint8Array(length).fill(1), dims);
}

function audioOf(tensor: OrtTensor, frames: number): Float32Array {
  const data = tensor.data as Float32Array;
  const expect = frames * HOP;
  if (data.length === expect) return data;
  return data.subarray(0, expect);
}

async function synthesizePiece(spoken: string, speed: number, seed: number): Promise<{ pcm: Float32Array; wordStarts: number[] }> {
  const sessions = await (sessionPromise ?? Promise.reject(new Error("Ema yüklü değil")));
  const ort = await runtime();
  const encoded = encodePiece(spoken);
  if (!encoded.ids.length) return { pcm: new Float32Array(0), wordStarts: [] };
  const letters = encoded.ids.length;
  const textOut = await sessions.text.run({
    ids: i64(ort, encoded.ids, [1, letters]),
    mask: bools(ort, letters, [1, letters])
  });
  const dur = Array.from((textOut.dur.data as Float32Array).subarray(0, letters));
  const timeline = planTimeline(dur, encoded.cw, speed);
  if (!timeline.frames) return { pcm: new Float32Array(0), wordStarts: [] };
  const hiddenDims = textOut.hidden.dims;
  const width = hiddenDims[hiddenDims.length - 1] ?? 1;
  const hidden = (textOut.hidden.data as Float32Array).subarray(0, letters * width);
  const rand = mulberry32(seed);
  const noise = new Float32Array(STEPS * timeline.frames * LATENT);
  for (let index = 0; index < noise.length; index += 1) noise[index] = gaussian(rand);
  const soundOut = await sessions.sound.run({
    hidden: f32(ort, hidden, [1, letters, hidden.length / letters]),
    dur: f32(ort, timeline.scaled, [1, letters]),
    mask: bools(ort, letters, [1, letters]),
    cw: i64(ort, encoded.cw, [1, letters]),
    wstart: i64(ort, encoded.wstart, [1, letters]),
    fw: i64(ort, timeline.fw, [1, timeline.frames]),
    fp: f32(ort, timeline.fp, [1, timeline.frames]),
    fmask: bools(ort, timeline.frames, [1, timeline.frames]),
    noise: f32(ort, noise, [1, STEPS, timeline.frames, LATENT])
  });
  const latents = (soundOut.latents.data as Float32Array).subarray(0, timeline.frames * LATENT);
  const decoded = await sessions.decoder.run({
    latents: f32(ort, latents, [1, timeline.frames, LATENT])
  });
  const pcm = audioOf(decoded.audio, timeline.frames);
  const wordStarts = wordStartFrames(timeline.fw).map((frame) => frame / FPS);
  return { pcm: Float32Array.from(pcm), wordStarts };
}

async function synthesize(text: string, speed: number, seed: number): Promise<EmaClip> {
  await loadEma();
  return enqueue(async () => {
    const spoken = toSpoken(text);
    const pieces = chunk(spoken, speed);
    if (!pieces.length) {
      const pcm = new Float32Array(Math.round(SAMPLE_RATE * 0.2));
      return { pcm, sampleRate: SAMPLE_RATE, wordStarts: [], spoken, seconds: 0.2 };
    }
    const parts: Float32Array[] = [];
    const wordStarts: number[] = [];
    let origin = 0;
    for (const piece of pieces) {
      const clip = await synthesizePiece(piece.text, speed, seed);
      const count = clip.wordStarts.length;
      for (let index = 0; index < count; index += 1) wordStarts.push(origin + clip.wordStarts[index]);
      parts.push(clip.pcm);
      origin += clip.pcm.length / SAMPLE_RATE;
      if (piece.pause > 0) {
        const silence = new Float32Array(Math.round(piece.pause * SAMPLE_RATE));
        parts.push(silence);
        origin += piece.pause;
      }
    }
    const length = parts.reduce((total, part) => total + part.length, 0);
    const pcm = new Float32Array(Math.max(1, length));
    let offset = 0;
    for (const part of parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    return { pcm, sampleRate: SAMPLE_RATE, wordStarts, spoken, seconds: pcm.length / SAMPLE_RATE };
  });
}

export function emaSpeak(text: string, speed: number, seed = 0): Promise<EmaClip> {
  const key = `${seed}|${speed}|${text}`;
  const hit = clips.get(key);
  if (hit) return hit;
  const pending = synthesize(text, speed, seed).catch((err) => {
    clips.delete(key);
    throw err;
  });
  clips.set(key, pending);
  return pending;
}

export function resumeAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

export function resampleLinear(pcm: Float32Array, from: number, to: number): Float32Array {
  if (from === to || pcm.length === 0) return pcm;
  const length = Math.max(1, Math.round((pcm.length * to) / from));
  const out = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = (index * from) / to;
    const left = Math.floor(position);
    const right = Math.min(pcm.length - 1, left + 1);
    const mix = position - left;
    out[index] = pcm[left] * (1 - mix) + pcm[right] * mix;
  }
  return out;
}
