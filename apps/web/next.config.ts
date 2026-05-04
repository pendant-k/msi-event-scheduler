import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql", "postgres"],
  transpilePackages: ["@scheduler/config", "@scheduler/db", "@scheduler/domain", "@scheduler/ui"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        ({ request }: { request?: string }, callback: (error?: Error | null, result?: string) => void) => {
          if (
            request === "@libsql/client" ||
            request === "libsql" ||
            request === "postgres" ||
            request === "drizzle-orm/libsql" ||
            request === "drizzle-orm/postgres-js" ||
            request?.startsWith("@libsql/")
          ) {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        }
      );
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
