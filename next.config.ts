import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.5.17", "localhost", "127.0.0.1"],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
