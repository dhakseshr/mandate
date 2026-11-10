// @ts-check
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS config so production needs no TypeScript
const path = require("node:path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Agent toolkit pulls in langchain/openai deps we don't bundle for the client.
  serverExternalPackages: ["@paypal/agent-toolkit"],
};

module.exports = nextConfig;
