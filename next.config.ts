import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // sharp / heic-convert are native/wasm Node packages used by photo processing.
  serverExternalPackages: ["sharp", "heic-convert", "libheif-js"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/firebase-messaging-sw.js", destination: "/api/sw/firebase-messaging-sw" },
    ];
  },
};

export default nextConfig;
