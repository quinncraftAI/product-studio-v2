import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP: true, // Required for local dev with Next.js 16
  },
};

export default nextConfig;
