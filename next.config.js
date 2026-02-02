/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@tailwindcss/postcss"],
  },
  // Completely disable Next.js built-in HTTP logging
  // We use our custom logger in /src/lib/logger/api-logger.ts for better formatting
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Suppress development server request logs
  staticPageGenerationTimeout: 120,
  // Suppress the output of certain messages
  output: "standalone",
};

module.exports = nextConfig;
