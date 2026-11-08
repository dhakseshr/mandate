import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Agent toolkit pulls in langchain/openai deps we don't bundle for the client.
  serverExternalPackages: ["@paypal/agent-toolkit"],
};

export default nextConfig;
