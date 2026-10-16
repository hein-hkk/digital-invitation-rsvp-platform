import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-playwright" : ".next",
};

export default nextConfig;
