import { sha256Hex } from "./hesap";

export async function clipKey(text: string, speed: number) {
  const rate = Number(speed.toFixed(3)).toString();
  return sha256Hex(`${rate}\n${text}`);
}

export function encodeClip(clip: { pcm: Float32Array; sampleRate: number; wordStarts: number[]; seconds: number }) {
  const words = Math.min(clip.wordStarts.length, 4096);
  const buffer = new ArrayBuffer(16 + words * 4 + clip.pcm.length * 4);
  const view = new DataView(buffer);
  view.setUint8(0, 0x55);
  view.setUint8(1, 0x43);
  view.setUint8(2, 0x30);
  view.setUint8(3, 0x31);
  view.setUint32(4, Math.round(clip.sampleRate), true);
  view.setUint32(8, Math.max(0, Math.round(clip.seconds * 1000)), true);
  view.setUint32(12, words, true);
  let offset = 16;
  for (let index = 0; index < words; index += 1) {
    view.setFloat32(offset, clip.wordStarts[index], true);
    offset += 4;
  }
  for (let index = 0; index < clip.pcm.length; index += 1) {
    view.setFloat32(offset, clip.pcm[index], true);
    offset += 4;
  }
  return new Uint8Array(buffer);
}

export function decodeClip(bytes: Uint8Array) {
  if (bytes.length < 16) return null;
  if (bytes[0] !== 0x55 || bytes[1] !== 0x43 || bytes[2] !== 0x30 || bytes[3] !== 0x31) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(4, true);
  const seconds = view.getUint32(8, true) / 1000;
  const words = view.getUint32(12, true);
  if (!sampleRate || sampleRate > 192_000 || words > 4096) return null;
  const pcmStart = 16 + words * 4;
  if (bytes.length < pcmStart || (bytes.length - pcmStart) % 4 !== 0) return null;
  const wordStarts: number[] = [];
  let offset = 16;
  for (let index = 0; index < words; index += 1) {
    wordStarts.push(view.getFloat32(offset, true));
    offset += 4;
  }
  const pcm = new Float32Array((bytes.length - pcmStart) / 4);
  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = view.getFloat32(offset, true);
    offset += 4;
  }
  return { pcm, sampleRate, wordStarts, seconds };
}
