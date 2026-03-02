import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/firebase-messaging-sw.js", destination: "/api/sw/firebase-messaging-sw" },
    ];
  },
};

export default nextConfig;
