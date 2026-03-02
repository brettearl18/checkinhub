import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CheckinHUB",
    short_name: "CheckinHUB",
    description: "Coach–client check-in and progress platform",
    start_url: "/client",
    display: "standalone",
    background_color: "#f8f7f5",
    theme_color: "#daa450",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    scope: "/",
  };
}
