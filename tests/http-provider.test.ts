import { z } from "zod";
import {
  ProviderInvalidResponseError,
  ProviderRateLimitError,
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

function chatResponse(content: string): Response {
  return jsonResponse(200, { choices: [{ message: { content } }] });
}

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

  test("public turn cancellation aborts the underlying provider fetch", async () => {
    const abort = new AbortController();
    let transportSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_url, init) => {
      transportSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        transportSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        );
      });
    });
    const provider = new HttpLLMProvider(config(), logger, abort.signal);
    const pending = provider.generateText([
      { role: "user", content: privatePrompt },
    ]);
    abort.abort();
    await expect(pending).rejects.toBeInstanceOf(ProviderTimeoutError);
    expect(transportSignal?.aborted).toBe(true);
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
