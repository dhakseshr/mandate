// Swappable LLM provider. Set AI_PROVIDER=goedel|google in .env.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";

export function model() {
  const provider = env.ai.provider();
  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    return google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash");
  }
  const goedel = createOpenAICompatible({
    name: "goedel",
    baseURL: process.env.GOEDEL_BASE_URL ?? "https://api.goedelmachines.com/v1",
    apiKey: process.env.GOEDEL_API_KEY,
    supportsStructuredOutputs: true, // vLLM backend: guided JSON-schema decoding
  });
  return goedel(process.env.GOEDEL_MODEL ?? "deepseek/deepseek-v4.1-flash");
}

export const modelLabel = () =>
  env.ai.provider() === "google"
    ? `Google ${process.env.GOOGLE_MODEL ?? "gemini-2.5-flash"}`
    : `DeepSeek V4.1 Flash (Gödel Machines)`;
