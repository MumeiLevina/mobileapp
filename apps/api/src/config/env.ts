import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  MOCK_AI: z.enum(["true", "false"]).default("true"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:8081"),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_EMBEDDING_MODEL: z.string().optional(),
});
export function readConfig() {
  const config = schema.parse(process.env);
  if (config.NODE_ENV === "production" && config.MOCK_AI === "true")
    throw new Error("Production requires a real provider.");
  if (
    config.MOCK_AI === "false" &&
    (!config.LLM_BASE_URL ||
      !config.LLM_API_KEY ||
      !config.LLM_MODEL ||
      !config.LLM_EMBEDDING_MODEL)
  )
    throw new Error("Provider configuration is incomplete.");
  return config;
}
export type Config = ReturnType<typeof readConfig>;
