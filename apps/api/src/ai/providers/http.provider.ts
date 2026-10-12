import pino from "pino";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Config } from "../../config/env";
import {
  ProviderError,
  ProviderInvalidResponseError,
  ProviderIncompleteResponseError,
  ProviderOperation,
  ProviderRateLimitError,
  ProviderRefusalError,
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
  validation_failure?:
    | "envelope"
    | "empty_content"
    | "truncated"
    | "refusal"
    | "json_parse"
    | "schema_validation";
  invalid_field_paths?: string[];
  zod_issue_codes?: string[];
  finish_reason?: string | null;
  content_empty?: boolean;
  content_truncated?: boolean;
  attempt?: number;
};

export interface ProviderLogger {
  info(fields: ProviderLogFields): void;
  warn(fields: ProviderLogFields): void;
}

const defaultLogger: ProviderLogger = pino({ level: "info" });

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          content: z.string().max(12000).nullable().optional(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
});

type ChatResult = {
  content: string;
  finishReason: string | null;
};

type ValidationDiagnostics = Pick<
  ProviderLogFields,
  | "validation_failure"
  | "invalid_field_paths"
  | "zod_issue_codes"
  | "finish_reason"
  | "content_empty"
  | "content_truncated"
  | "attempt"
>;

const embeddingResponseSchema = z.object({
  data: z
    .array(z.object({ embedding: z.array(z.number().finite()).length(1536) }))
    .min(1),
});

export function toOpenAIStrictJsonSchema(
  schema: z.ZodTypeAny,
): Record<string, unknown> {
  const convertSchema = zodToJsonSchema as unknown as (
    input: unknown,
    options: { $refStrategy: "none"; target: "jsonSchema7" },
  ) => Record<string, unknown>;
  const convertedSchema = convertSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  });
  const { $schema: _schemaDialect, ...jsonSchema } = convertedSchema;
  return jsonSchema;
}

export class HttpLLMProvider implements LLMProvider {
  constructor(
    private readonly config: Config,
    private readonly logger: ProviderLogger = defaultLogger,
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
        signal: AbortSignal.timeout(timeoutMs),
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
    diagnostics: ValidationDiagnostics = {},
  ): void {
    this.logger.warn({
      provider: "openai_compatible",
      operation,
      status: "error",
      latency_ms: latencyMs,
      error_category: "invalid_response",
      ...diagnostics,
    });
  }

  private logTerminalResponse(
    operation: ProviderOperation,
    latencyMs: number,
    error: ProviderIncompleteResponseError | ProviderRefusalError,
    diagnostics: ValidationDiagnostics,
  ): void {
    this.logger.warn({
      provider: "openai_compatible",
      operation,
      status: "error",
      latency_ms: latencyMs,
      error_category: error.category,
      ...diagnostics,
    });
  }

  private async chat(
    messages: PromptMessage[],
    operation: "text_generation" | "structured_generation",
    timeoutMs: number,
    extraBody: Record<string, unknown> = {},
  ): Promise<ChatResult> {
    const startedAt = Date.now();
    const raw = await this.post(
      operation,
      "chat/completions",
      {
        model: this.config.LLM_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 700,
        ...extraBody,
      },
      timeoutMs,
    );

    const parsed = chatResponseSchema.safeParse(raw);
    if (!parsed.success) {
      this.logInvalidResponse(operation, Date.now() - startedAt, {
        validation_failure: "envelope",
        invalid_field_paths: parsed.error.issues.map((issue) =>
          issue.path.join("."),
        ),
        zod_issue_codes: parsed.error.issues.map((issue) => issue.code),
      });
      throw new ProviderInvalidResponseError(operation);
    }

    const choice = parsed.data.choices[0];
    const finishReason = choice.finish_reason ?? null;
    const content = choice.message.content ?? "";
    if (choice.message.refusal) {
      const error = new ProviderRefusalError(operation);
      this.logTerminalResponse(operation, Date.now() - startedAt, error, {
        validation_failure: "refusal",
        finish_reason: finishReason,
        content_empty: content.trim().length === 0,
        content_truncated: false,
      });
      throw error;
    }
    if (finishReason === "length" || finishReason === "content_filter") {
      const error = new ProviderIncompleteResponseError(operation);
      this.logTerminalResponse(operation, Date.now() - startedAt, error, {
        validation_failure: "truncated",
        finish_reason: finishReason,
        content_empty: content.trim().length === 0,
        content_truncated: true,
      });
      throw error;
    }
    if (content.trim().length === 0) {
      this.logInvalidResponse(operation, Date.now() - startedAt, {
        validation_failure: "empty_content",
        finish_reason: finishReason,
        content_empty: true,
        content_truncated: false,
      });
      throw new ProviderInvalidResponseError(operation);
    }
    return { content, finishReason };
  }

  async generateText(messages: PromptMessage[]): Promise<string> {
    const result = await this.chat(
      messages,
      "text_generation",
      this.config.LLM_TEXT_TIMEOUT_MS,
    );
    return result.content;
  }

  async generateStructured<T>(
    messages: PromptMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const formatInstruction: PromptMessage = {
      role: "system",
      content: "Return only one valid JSON object. No markdown fences.",
    };

    const jsonSchema = toOpenAIStrictJsonSchema(schema);
    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "mori_structured_response",
        strict: true,
        schema: jsonSchema,
      },
    };

    let strictOutputSupported = true;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      const attemptMessages = [
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
      ];
      let result: ChatResult;
      try {
        result = await this.chat(
          attemptMessages,
          "structured_generation",
          this.config.LLM_CLASSIFICATION_TIMEOUT_MS,
          {
            response_format: strictOutputSupported
              ? responseFormat
              : { type: "json_object" },
          },
        );
      } catch (error) {
        if (
          strictOutputSupported &&
          !this.isOpenAIEndpoint() &&
          error instanceof ProviderUnavailableError &&
          [400, 404, 422].includes(error.httpStatus ?? 0)
        ) {
          strictOutputSupported = false;
          result = await this.chat(
            attemptMessages,
            "structured_generation",
            this.config.LLM_CLASSIFICATION_TIMEOUT_MS,
            { response_format: { type: "json_object" } },
          );
        } else {
          throw error;
        }
      }

      let json: unknown;
      try {
        json = JSON.parse(this.unwrapJsonFence(result.content)) as unknown;
      } catch {
        this.logInvalidResponse(
          "structured_generation",
          Date.now() - startedAt,
          {
            validation_failure: "json_parse",
            finish_reason: result.finishReason,
            content_empty: false,
            content_truncated: false,
            attempt: attempt + 1,
          },
        );
        continue;
      }

      const parsed = schema.safeParse(json);
      if (parsed.success) return parsed.data;
      this.logInvalidResponse(
        "structured_generation",
        Date.now() - startedAt,
        {
          validation_failure: "schema_validation",
          invalid_field_paths: parsed.error.issues.map((issue) =>
            issue.path.join("."),
          ),
          zod_issue_codes: parsed.error.issues.map((issue) => issue.code),
          finish_reason: result.finishReason,
          content_empty: false,
          content_truncated: false,
          attempt: attempt + 1,
        },
      );
    }

    throw new ProviderInvalidResponseError("structured_generation");
  }

  private unwrapJsonFence(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1] ?? trimmed;
  }

  private isOpenAIEndpoint(): boolean {
    try {
      return new URL(this.config.LLM_BASE_URL!).hostname === "api.openai.com";
    } catch {
      return false;
    }
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
      this.logInvalidResponse("embedding", Date.now() - startedAt, {
        validation_failure: "envelope",
        invalid_field_paths: parsed.error.issues.map((issue) =>
          issue.path.join("."),
        ),
        zod_issue_codes: parsed.error.issues.map((issue) => issue.code),
      });
      throw new ProviderInvalidResponseError("embedding");
    }
    return parsed.data.data[0].embedding;
  }
}
