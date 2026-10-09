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
