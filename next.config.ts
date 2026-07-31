import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the local embedding model out of the bundle — it ships native ONNX
  // runtime binaries that must load from node_modules at runtime, not be
  // webpack/turbopack-bundled.
  // pdf-parse pulls in pdfjs-dist, which loads pdf.worker.mjs from a path
  // relative to its own file at runtime — bundling it rewrites that path and
  // breaks the lookup, so it must stay external too.
  serverExternalPackages: ["@huggingface/transformers", "pdf-parse"],
  experimental: {
    // When the app is reached through a tunnel or a deployed host the browser's
    // Origin is that domain, not localhost. Without these, Next.js rejects every
    // form submission — login, signup, sending an assessment — as a cross-origin
    // request. Wildcards cover cloudflared/ngrok tunnels and Render deploys so a
    // fresh URL works without editing this file.
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.trycloudflare.com",
        "*.ngrok-free.app",
        "*.ngrok.app",
        "*.ngrok.io",
        "*.onrender.com",
      ],
      // Default is 1MB, which a single CV can approach and a multi-CV batch
      // upload always blows past — this must cover many PDFs/DOCX at once.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
