import { resolve } from "node:path";
import { z } from "zod";

const schema = z.object({
  MORI_LIVE_MODE: z.enum(["MOCK", "STAGING", "REAL"]).default("MOCK"),
  MORI_LIVE_API_PORT: z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(4319),
  MORI_LIVE_API_TOKEN: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
  MORI_LIVE_PRINCIPAL: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .default("desktop-1"),
  MORI_LIVE_STORE_DIR: z.string().min(1).default(".mori-live/public-api"),
  MORI_LIVE_SESSION_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .default(240),
  MORI_LIVE_MAX_TURNS: z.coerce.number().int().min(1).max(100).default(100),
  MORI_LIVE_REQUESTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(600)
    .default(90),
  MORI_LIVE_TURN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(120000)
    .default(45000),
  MORI_LIVE_BUDGET_USD: z.coerce.number().positive().max(1000).default(1),
  MORI_LIVE_INPUT_USD_PER_MILLION: z.coerce
    .number()
    .positive()
    .max(1000)
    .optional(),
  MORI_LIVE_OUTPUT_USD_PER_MILLION: z.coerce
    .number()
    .positive()
    .max(1000)
    .optional(),
  MORI_LIVE_PERSONA: z
    .enum(["mori-public-vi-v1", "mori-public-en-v1"])
    .default("mori-public-vi-v1"),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().min(1).max(200).optional(),
});
export function readLiveConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const c = schema.parse(
    Object.fromEntries(
      Object.entries(env).filter(([, value]) => value?.trim() !== ""),
    ),
  );
  if (c.MORI_LIVE_MODE !== "MOCK") {
    if (
      !c.LLM_API_KEY ||
      !c.LLM_MODEL ||
      !c.LLM_BASE_URL ||
      !c.MORI_LIVE_INPUT_USD_PER_MILLION ||
      !c.MORI_LIVE_OUTPUT_USD_PER_MILLION
    ) {
      throw new Error("Live provider configuration or pricing is incomplete");
    }
    const url = new URL(c.LLM_BASE_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "Live cloud provider requires an HTTPS URL without credentials or query",
      );
    }
  }
  if (env.NODE_ENV === "production" && c.MORI_LIVE_MODE === "MOCK")
    throw new Error("Production cannot use MOCK");
  return { ...c, MORI_LIVE_STORE_DIR: resolve(c.MORI_LIVE_STORE_DIR) };
}
export type LiveConfig = ReturnType<typeof readLiveConfig>;
export const LIVE_CONFIG = Symbol("LIVE_CONFIG");
export const MAX_PROMPT_BYTES = 48000;
export function turnCostMicros(config: LiveConfig) {
  if (config.MORI_LIVE_MODE === "MOCK") return 0;
  // Bytes overestimate input tokens for supported byte-tokenized compatible models.
  // 2 safety + 2 intent + 1 generation + 2 output review; include format overhead.
  return Math.ceil(
    7 *
      ((MAX_PROMPT_BYTES + 2048) * config.MORI_LIVE_INPUT_USD_PER_MILLION! +
        700 * config.MORI_LIVE_OUTPUT_USD_PER_MILLION!),
  );
}
