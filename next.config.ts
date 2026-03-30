import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
