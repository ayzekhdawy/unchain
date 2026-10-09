import type { NextConfig } from "next";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const workerSrc = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const workerDest = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
if (existsSync(workerSrc)) {
  mkdirSync(path.dirname(workerDest), { recursive: true });
  copyFileSync(workerSrc, workerDest);
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
      }
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      encoding: false
    };
    return config;
  }
};

export default nextConfig;
