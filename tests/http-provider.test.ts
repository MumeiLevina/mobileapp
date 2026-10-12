import { z } from "zod";
import {
  ProviderIncompleteResponseError,
  ProviderInvalidResponseError,
  ProviderRateLimitError,
  ProviderRefusalError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../apps/api/src/ai/providers/errors";
import {
  HttpLLMProvider,
  ProviderLogger,
} from "../apps/api/src/ai/providers/http.provider";
import { Config } from "../apps/api/src/config/env";

const privatePrompt = "my private journal content";
const privateResponse = "private provider response";

function config(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: "test",
    PORT: 3001,
    MOCK_AI: "false",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    CORS_ORIGIN: "http://localhost:8081",
    LLM_BASE_URL: "http://provider.test/v1",
    LLM_API_KEY: "secret-key",
    LLM_MODEL: "chat-model",
    LLM_EMBEDDING_MODEL: "embedding-model",
    LLM_TEXT_TIMEOUT_MS: 31000,
    LLM_CLASSIFICATION_TIMEOUT_MS: 11000,
    LLM_EMBEDDING_TIMEOUT_MS: 12000,
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function chatResponse(
  content: string | null,
  finishReason: string | null = "stop",
  refusal: string | null = null,
): Response {
  return jsonResponse(200, {
    choices: [
      {
        finish_reason: finishReason,
        message: { content, refusal },
      },
    ],
  });
}

const intentSchema = z.object({
  intent: z.enum(["LISTEN", "REFLECT", "ADVICE", "CELEBRATE"]),
  emotion: z.string(),
  intensity: z.number().min(0).max(1),
  adviceRequested: z.boolean(),
});

const validIntent = {
  intent: "LISTEN",
  emotion: "calm",
  intensity: 0.4,
  adviceRequested: false,
};

describe("HttpLLMProvider", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let logger: ProviderLogger;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    logger = { info: jest.fn(), warn: jest.fn() };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("uses the text timeout and returns a valid completion", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(chatResponse("hello"));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateText([{ role: "user", content: privatePrompt }]),
    ).resolves.toBe("hello");
    expect(timeout).toHaveBeenCalledWith(31000);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai_compatible",
        operation: "text_generation",
        status: "success",
      }),
    );
    timeout.mockRestore();
  });

  test("accepts fenced JSON without retrying", async () => {
    fetchMock.mockResolvedValue(chatResponse('```json\n{"level":"safe"}\n```'));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        z.object({ level: z.literal("safe") }),
      ),
    ).resolves.toEqual({ level: "safe" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as Record<string, any>;
    expect(request.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(request.response_format.json_schema.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  test("accepts valid structured JSON", async () => {
    fetchMock.mockResolvedValue(chatResponse(JSON.stringify(validIntent)));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).resolves.toEqual(validIntent);
  });

  test.each([
    ["missing required fields", { intent: "LISTEN" }, "emotion", "invalid_type"],
    [
      "invalid intent enum",
      { ...validIntent, intent: "UNKNOWN" },
      "intent",
      "invalid_enum_value",
    ],
    [
      "wrong intensity type",
      { ...validIntent, intensity: "high" },
      "intensity",
      "invalid_type",
    ],
    [
      "out-of-range intensity",
      { ...validIntent, intensity: 2 },
      "intensity",
      "too_big",
    ],
  ])("rejects %s with field-level diagnostics", async (_, value, path, code) => {
    fetchMock.mockResolvedValue(chatResponse(JSON.stringify(value)));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validation_failure: "schema_validation",
        invalid_field_paths: expect.arrayContaining([path]),
        zod_issue_codes: expect.arrayContaining([code]),
      }),
    );
  });

  test("distinguishes malformed JSON from schema validation", async () => {
    fetchMock.mockResolvedValue(chatResponse("{not-json"));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validation_failure: "json_parse",
        content_empty: false,
        content_truncated: false,
      }),
    );
  });

  test("rejects an empty response with explicit diagnostics", async () => {
    fetchMock.mockResolvedValue(chatResponse(""));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validation_failure: "empty_content",
        finish_reason: "stop",
        content_empty: true,
      }),
    );
  });

  test("rejects truncated and refused responses without retrying", async () => {
    const provider = new HttpLLMProvider(config(), logger);
    fetchMock.mockResolvedValueOnce(chatResponse('{"intent":', "length"));
    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderIncompleteResponseError);

    fetchMock.mockResolvedValueOnce(chatResponse(null, "stop", "refused"));
    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderRefusalError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validation_failure: "truncated",
        finish_reason: "length",
        content_truncated: true,
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ validation_failure: "refusal" }),
    );
  });

  test("falls back to JSON mode for compatible providers without strict schemas", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(400, { error: "unsupported format" }))
      .mockResolvedValueOnce(chatResponse(JSON.stringify(validIntent)));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).resolves.toEqual(validIntent);
    const fallbackRequest = JSON.parse(
      String(fetchMock.mock.calls[1][1]?.body),
    ) as Record<string, any>;
    expect(fallbackRequest.response_format).toEqual({ type: "json_object" });
  });

  test("does not hide an OpenAI strict-schema rejection with a fallback", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid schema" }));
    const provider = new HttpLLMProvider(
      config({ LLM_BASE_URL: "https://api.openai.com/v1" }),
      logger,
    );

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        intentSchema,
      ),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries a structured format failure once with its own timeout", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    fetchMock
      .mockResolvedValueOnce(chatResponse("not-json"))
      .mockResolvedValueOnce(chatResponse('{"level":"safe"}'));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        z.object({ level: z.literal("safe") }),
      ),
    ).resolves.toEqual({ level: "safe" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenNthCalledWith(1, 11000);
    expect(timeout).toHaveBeenNthCalledWith(2, 11000);
    timeout.mockRestore();
  });

  test("stops after one structured retry", async () => {
    fetchMock.mockResolvedValue(chatResponse("still-not-json"));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        z.object({ level: z.literal("safe") }),
      ),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not retry a malformed provider envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [] }));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateStructured(
        [{ role: "user", content: privatePrompt }],
        z.object({ level: z.literal("safe") }),
      ),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("maps timeout, rate-limit and unavailable failures", async () => {
    const provider = new HttpLLMProvider(config(), logger);
    const request = () =>
      provider.generateText([{ role: "user", content: privatePrompt }]);

    fetchMock.mockRejectedValueOnce(
      new DOMException("request exceeded timeout", "TimeoutError"),
    );
    await expect(request()).rejects.toBeInstanceOf(ProviderTimeoutError);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: privateResponse }),
    );
    await expect(request()).rejects.toBeInstanceOf(ProviderRateLimitError);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: privateResponse }),
    );
    await expect(request()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  test("rejects malformed chat and embedding responses", async () => {
    const provider = new HttpLLMProvider(config(), logger);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { choices: [] }));
    await expect(
      provider.generateText([{ role: "user", content: privatePrompt }]),
    ).rejects.toBeInstanceOf(ProviderInvalidResponseError);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: [{ embedding: [0.1] }] }),
    );
    await expect(provider.embed(privatePrompt)).rejects.toBeInstanceOf(
      ProviderInvalidResponseError,
    );
  });

  test("never includes prompts, responses or credentials in logs", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: privateResponse }));
    const provider = new HttpLLMProvider(config(), logger);

    await expect(
      provider.generateText([{ role: "user", content: privatePrompt }]),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);

    const logs = JSON.stringify([
      ...jest.mocked(logger.info).mock.calls,
      ...jest.mocked(logger.warn).mock.calls,
    ]);
    expect(logs).not.toContain(privatePrompt);
    expect(logs).not.toContain(privateResponse);
    expect(logs).not.toContain("secret-key");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "text_generation",
        status: "error",
        error_category: "unavailable",
      }),
    );
  });
});
