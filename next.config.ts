import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  cacheComponents: false,
  experimental: {
    serverActions: {
      // 帖子图片最多 4 张（浏览器端已压缩），请求体上限放宽到 12MB
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
