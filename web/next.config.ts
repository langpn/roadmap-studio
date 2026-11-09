import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./.env*", "./test-results/**/*", "./playwright-report/**/*", "./.vitest/**/*"],
  },
  ...(process.env.ROADMAP_BUILD_DIR ? { distDir: process.env.ROADMAP_BUILD_DIR } : {}),
};

export default nextConfig;
