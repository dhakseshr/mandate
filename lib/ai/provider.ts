// Swappable LLM provider with resilience.
// AI_PROVIDER=vertex|goedel|google picks the primary. vertex = Gemini on Google Cloud Vertex AI, authenticated
// with Application Default Credentials (the Cloud Run service account) — no API key in the environment. If the primary is overloaded (429/503/"capacity"),
// we back off and retry, then fall back to the other provider if its key is configured.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { env } from "@/lib/env";

type Model = ReturnType<ReturnType<typeof createOpenAICompatible>>;

function goedel(): Model | null {
  const apiKey = process.env.GOEDEL_API_KEY?.trim();
  if (!apiKey) return null;
  const p = createOpenAICompatible({
    name: "goedel",
    baseURL: process.env.GOEDEL_BASE_URL?.trim() || "https://api.goedelmachines.com/v1",
    apiKey,
    supportsStructuredOutputs: true, // vLLM backend: guided JSON-schema decoding
  });
  return p(process.env.GOEDEL_MODEL?.trim() || "deepseek/deepseek-v4.1-flash");
}

function google(): Model | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) return null;
  return createGoogleGenerativeAI({ apiKey })(process.env.GOOGLE_MODEL?.trim() || "gemini-2.5-flash") as unknown as Model;
}

export const VERTEX_DEFAULT_MODEL = "gemini-3-flash-preview";

function vertex(): Model | null {
  const project = (process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT)?.trim();
  if (!project) return null;
  // Local dev only: GOOGLE_VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token). In Cloud Run, ADC is used.
  const token = process.env.GOOGLE_VERTEX_ACCESS_TOKEN?.trim();
  return createVertex({ project, location: process.env.GOOGLE_VERTEX_LOCATION?.trim() || "global", ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) })(
    process.env.VERTEX_MODEL?.trim() || VERTEX_DEFAULT_MODEL,
  ) as unknown as Model;
}

/** Overload / rate-limit / transient upstream errors worth retrying or failing over. */
export function isCapacityError(err: unknown): boolean {
  const e = err as { statusCode?: number; message?: string; cause?: unknown; lastError?: unknown; errors?: unknown[] };
  if (!e) return false;
  if ([408, 429, 500, 502, 503, 504, 529].includes(e.statusCode ?? 0)) return true;
  if (/capacity|overload|rate.?limit|temporarily|unavailable|timeout|ECONNRESET|fetch failed/i.test(e.message ?? "")) return true;
  return [e.cause, e.lastError, ...(e.errors ?? [])].some((x) => x && x !== err && isCapacityError(x));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKOFF_MS = [2000, 4000, 8000, 10000, 12000]; // ~36s total before failing over

/**
 * Wraps a primary model: retries capacity errors with backoff, then fails over to `fallback`.
 * Implemented at the model layer, so generateText's tool loop is unaware — no step is replayed.
 */
function resilient(primary: Model, fallback: Model | null): Model {
  async function call<T>(fn: (m: Model) => PromiseLike<T>): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= BACKOFF_MS.length; i++) {
      try {
        return await fn(primary);
      } catch (err) {
        lastErr = err;
        if (!isCapacityError(err)) throw err;
        if (fallback && i >= 1) break; // with a fallback available, don't make the user wait long
        if (i < BACKOFF_MS.length) {
          console.warn(`[ai] ${primary.provider} at capacity, retry ${i + 1} in ${BACKOFF_MS[i]}ms`);
          await sleep(BACKOFF_MS[i]);
        }
      }
    }
    if (fallback) {
      console.warn(`[ai] failing over ${primary.provider} -> ${fallback.provider}`);
      return fn(fallback);
    }
    throw lastErr;
  }
  return {
    specificationVersion: primary.specificationVersion,
    provider: primary.provider,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    doGenerate: (opts: Parameters<Model["doGenerate"]>[0]) => call((m) => m.doGenerate(opts)),
    doStream: (opts: Parameters<Model["doStream"]>[0]) => call((m) => m.doStream(opts)),
  } as Model;
}

export function model(): Model {
  const all = { vertex: vertex(), goedel: goedel(), google: google() };
  const want = env.ai.provider();
  const primary = all[want];
  const fallback = (Object.entries(all).find(([k, m]) => k !== want && m)?.[1] as Model | undefined) ?? null;
  if (!primary) {
    if (fallback) return resilient(fallback, null);
    throw new Error("No AI provider configured: set GOOGLE_VERTEX_PROJECT, GOEDEL_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
  }
  return resilient(primary, fallback);
}

export const modelLabel = () => {
  const p = env.ai.provider();
  if (p === "vertex") return `Google ${process.env.VERTEX_MODEL ?? VERTEX_DEFAULT_MODEL} (Vertex AI)`;
  if (p === "google") return `Google ${process.env.GOOGLE_MODEL ?? "gemini-2.5-flash"}`;
  return "DeepSeek V4.1 Flash (Gödel Machines)";
};
