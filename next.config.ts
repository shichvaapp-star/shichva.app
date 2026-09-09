import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bengurion-herzliya.mashov.info",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
      },
      {
        protocol: "https",
        hostname: "www.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/kita2",
        destination: "/",
      },
      {
        source: "/kita2/admin",
        destination: "/admin",
      },
      {
        source: "/kita:id",
        destination: "/",
      },
      {
        source: "/kita:id/admin",
        destination: "/admin",
      },
    ];
  },
};

export default nextConfig;
