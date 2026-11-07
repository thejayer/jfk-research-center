import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  typedRoutes: false,
  webpack: (config, { isServer }) => {
    if (isServer) return config;

    const splitChunks = config.optimization?.splitChunks;
    if (!splitChunks || typeof splitChunks !== "object") return config;

    const cacheGroups =
      splitChunks.cacheGroups && typeof splitChunks.cacheGroups === "object"
        ? splitChunks.cacheGroups
        : {};

    splitChunks.cacheGroups = {
      ...cacheGroups,
      threeVendor: {
        test: /[\\/]node_modules[\\/](three|@react-three)([\\/]|$)/,
        name: "three-vendor",
        chunks: "async",
        priority: 30,
        reuseExistingChunk: true,
      },
      plaza1963: {
        test: /[\\/]components[\\/]dealey-plaza[\\/]plaza-1963\.ts$/,
        name: "plaza-1963",
        chunks: "async",
        priority: 25,
        reuseExistingChunk: true,
      },
    };

    return config;
  },
};

export default nextConfig;
