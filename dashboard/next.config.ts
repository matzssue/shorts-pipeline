import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages. The site lives under /<repo>/ there, so the base path comes from
 * the environment (empty locally).
 */
const basePath = process.env.DASHBOARD_BASE_PATH ?? "";

const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // workspace packages ship TypeScript sources
  transpilePackages: ["@shorts/schema", "@shorts/timeline"],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default config;
