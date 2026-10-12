import pino from "pino";
import { z } from "zod";
import { Config } from "../../config/env";
import {
  ProviderError,
  ProviderInvalidResponseError,
  ProviderOperation,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "./errors";
import { LLMProvider, PromptMessage } from "./provider";

type ProviderLogFields = {
  provider: "openai_compatible";
  operation: ProviderOperation;
  status: "success" | "error";
  latency_ms: number;
  error_category?: ProviderError["category"];
};

export interface ProviderLogger {
  info(fields: ProviderLogFields): void;
  warn(fields: ProviderLogFields): void;
}

export type HttpProviderConfig = Pick<
  Config,
  | "NODE_ENV"
  | "LLM_BASE_URL"
  | "LLM_API_KEY"
  | "LLM_MODEL"
  | "LLM_EMBEDDING_MODEL"
  | "LLM_TEXT_TIMEOUT_MS"
  | "LLM_CLASSIFICATION_TIMEOUT_MS"
  | "LLM_EMBEDDING_TIMEOUT_MS"
>;

const defaultLogger: ProviderLogger = pino({ level: "info" });

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1).max(12000) }),
      }),
    )
    .min(1),
});

const embeddingResponseSchema = z.object({
  data: z
    .array(z.object({ embedding: z.array(z.number().finite()).length(1536) }))
    .min(1),
});

export class HttpLLMProvider implements LLMProvider {
  constructor(
    private readonly config: HttpProviderConfig,
    private readonly logger: ProviderLogger = defaultLogger,
    private readonly signal?: AbortSignal,
  ) {}

  private async post(
    operation: ProviderOperation,
    path: "chat/completions" | "embeddings",
    body: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    const startedAt = Date.now();
    let httpStatus: number | undefined;

    try {
      const base = this.config.LLM_BASE_URL!;
      if (!base.startsWith("https://") && this.config.NODE_ENV === "production")
        throw new ProviderUnavailableError(operation);

      const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.LLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: this.signal
          ? AbortSignal.any([this.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      });
      httpStatus = response.status;

      if (response.status === 429)
        throw new ProviderRateLimitError(operation, response.status);
      if (!response.ok)
        throw new ProviderUnavailableError(operation, response.status);

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new ProviderInvalidResponseError(operation);
      }

      this.logger.info({
        provider: "openai_compatible",
        operation,
        status: "success",
        latency_ms: Date.now() - startedAt,
      });
      return data;
    } catch (error) {
      const providerError = this.toProviderError(error, operation, httpStatus);
      this.logger.warn({
        provider: "openai_compatible",
        operation,
        status: "error",
        latency_ms: Date.now() - startedAt,
        error_category: providerError.category,
      });
      throw providerError;
    }
  }

  private toProviderError(
    error: unknown,
    operation: ProviderOperation,
    httpStatus?: number,
  ): ProviderError {
    if (error instanceof ProviderError) return error;
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? error.name
        : undefined;
    if (errorName === "AbortError" || errorName === "TimeoutError")
      return new ProviderTimeoutError(operation);
    return new ProviderUnavailableError(operation, httpStatus);
  }

  private logInvalidResponse(
    operation: ProviderOperation,
    latencyMs: number,
  ): void {
    this.logger.warn({
      provider: "openai_compatible",
      operation,
      status: "error",
      latency_ms: latencyMs,
      error_category: "invalid_response",
    });
  }

  private async chat(
    messages: PromptMessage[],
    operation: "text_generation" | "structured_generation",
    timeoutMs: number,
  ): Promise<string> {
    const startedAt = Date.now();
    const raw = await this.post(
      operation,
      "chat/completions",
      {
        model: this.config.LLM_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 700,
      },
      timeoutMs,
    );

    const parsed = chatResponseSchema.safeParse(raw);
    if (!parsed.success) {
      this.logInvalidResponse(operation, Date.now() - startedAt);
      throw new ProviderInvalidResponseError(operation);
    }
    return parsed.data.choices[0].message.content;
  }

  async generateText(messages: PromptMessage[]): Promise<string> {
    return this.chat(
      messages,
      "text_generation",
      this.config.LLM_TEXT_TIMEOUT_MS,
    );
  }

  async generateStructured<T>(
    messages: PromptMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const formatInstruction: PromptMessage = {
      role: "system",
      content: "Return only one valid JSON object. No markdown fences.",
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      const text = await this.chat(
        [
          ...messages,
          formatInstruction,
          ...(attempt === 0
            ? []
            : [
                {
                  role: "system" as const,
                  content:
                    "The previous response had an invalid format. Return valid JSON matching the requested shape.",
                },
              ]),
        ],
        "structured_generation",
        this.config.LLM_CLASSIFICATION_TIMEOUT_MS,
      );

      try {
        const json = JSON.parse(this.unwrapJsonFence(text)) as unknown;
        const parsed = schema.safeParse(json);
        if (parsed.success) return parsed.data;
      } catch {
        // A single retry is allowed only for a structured format failure.
      }
      this.logInvalidResponse("structured_generation", Date.now() - startedAt);
    }

    throw new ProviderInvalidResponseError("structured_generation");
  }

  private unwrapJsonFence(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1] ?? trimmed;
  }

  async embed(text: string): Promise<number[]> {
    const startedAt = Date.now();
    const raw = await this.post(
      "embedding",
      "embeddings",
      {
        model: this.config.LLM_EMBEDDING_MODEL,
        input: text,
        dimensions: 1536,
      },
      this.config.LLM_EMBEDDING_TIMEOUT_MS,
    );
    const parsed = embeddingResponseSchema.safeParse(raw);
    if (!parsed.success) {
      this.logInvalidResponse("embedding", Date.now() - startedAt);
      throw new ProviderInvalidResponseError("embedding");
    }
    return parsed.data.data[0].embedding;
  }
}
