import type { NextConfig } from "next";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const workerSrc = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const workerDest = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
if (existsSync(workerSrc)) {
  mkdirSync(path.dirname(workerDest), { recursive: true });
  copyFileSync(workerSrc, workerDest);
}

const ortDir = path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const ortDest = path.join(process.cwd(), "public", "ort");
for (const name of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  const src = path.join(ortDir, name);
  if (!existsSync(src)) continue;
  mkdirSync(ortDest, { recursive: true });
  copyFileSync(src, path.join(ortDest, name));
}

const ocrDest = path.join(process.cwd(), "public", "ocr");
const coreDir = path.join(process.cwd(), "node_modules", "tesseract.js-core");
const ocrCopies: [string, string][] = [
  [path.join(process.cwd(), "node_modules", "tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [path.join(coreDir, "tesseract-core-lstm.wasm.js"), "tesseract-core-lstm.wasm.js"],
  [path.join(coreDir, "tesseract-core-lstm.wasm"), "tesseract-core-lstm.wasm"],
  [path.join(coreDir, "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [path.join(coreDir, "tesseract-core-simd-lstm.wasm"), "tesseract-core-simd-lstm.wasm"],
  [path.join(coreDir, "tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract-core-relaxedsimd-lstm.wasm.js"],
  [path.join(coreDir, "tesseract-core-relaxedsimd-lstm.wasm"), "tesseract-core-relaxedsimd-lstm.wasm"],
  [path.join(process.cwd(), "node_modules", "@tesseract.js-data", "tur", "4.0.0_best_int", "tur.traineddata.gz"), "tur.traineddata.gz"]
];
for (const [src, name] of ocrCopies) {
  if (!existsSync(src)) continue;
  mkdirSync(ocrDest, { recursive: true });
  copyFileSync(src, path.join(ocrDest, name));
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  async headers() {
    return [
      {
        source: "/pdf.worker.min.mjs",
        headers: [{ key: "Content-Type", value: "text/javascript" }]
      },
      {
        source: "/ort/ort-wasm-simd-threaded.mjs",
        headers: [{ key: "Content-Type", value: "text/javascript" }]
      },
      {
        source: "/ort/ort-wasm-simd-threaded.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }]
      },
      {
        source: "/ocr/:file.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }]
      }
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      encoding: false,
      "onnxruntime-node": false,
      "onnxruntime-web/wasm": path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist", "ort.wasm.min.mjs")
    };
    config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, path: false, crypto: false };
    return config;
  }
};

export default nextConfig;
