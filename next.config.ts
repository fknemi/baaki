import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  allowedDevOrigins: ["127.0.0.1", "10.21.32.244", "baaki.fknemi.dev", "assets.fknemi.dev", "https://baaki-s4eh.onrender.com/"],
};

export default nextConfig;
