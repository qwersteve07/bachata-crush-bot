import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/instagram.md is read at request time, so ship it with the chat function.
  outputFileTracingIncludes: { "/api/chat": ["./data/**/*"] },
};

export default nextConfig;
