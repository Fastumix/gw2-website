import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["render.guildwars2.com"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;