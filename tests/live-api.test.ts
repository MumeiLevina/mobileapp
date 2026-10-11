import "reflect-metadata";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { z } from "zod";
import {
  readLiveConfig,
  LiveConfig,
  turnCostMicros,
} from "../apps/api/src/modules/live/live.config";
import { PublicLiveRepository } from "../apps/api/src/modules/live/live.repository";
import { PublicLiveService } from "../apps/api/src/modules/live/live.service";
import { createPublicLiveApplication } from "../apps/api/src/modules/live/live.module";
import { PublicMockProvider } from "../apps/api/src/modules/live/live.pipeline";
import {
  LLMProvider,
  PromptMessage,
} from "../apps/api/src/ai/providers/provider";
import {
  MoriLiveBridge,
  simulatedTurn,
} from "../apps/live-desktop/src/bridge/client";
import { LiveSession, TurnResponse } from "@mori/live-protocol";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { MemoriesService } from "../apps/api/src/modules/memories/memories.service";
import { AIOrchestratorService } from "../apps/api/src/modules/ai/orchestrator.service";

class FakeProvider implements LLMProvider {
  classifyUnavailable = false;
  outputUnavailable = false;
  safe = true;
  generated = "Chào mọi người! Rất vui được trò chuyện cùng các bạn.";
  generateText = jest.fn(
    async (_messages: PromptMessage[]): Promise<string> => this.generated,
  );
  embed = jest.fn(async () => {
    throw new Error("Private memory must not be called");
  });
  structuredCalls = jest.fn();
  async generateStructured<T>(
    messages: PromptMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.structuredCalls(messages);
    if (messages[0].content.includes("safety classifier")) {
      if (this.classifyUnavailable)
        throw new Error("private diagnostic must not escape");
      return schema.parse({
        level: "normal",
        requiresEscalation: false,
        selfHarmRisk: false,
        violenceRisk: false,
      });
    }
    if (messages[0].content.includes("output safety reviewer")) {
      if (this.outputUnavailable) throw new Error("review unavailable");
      return schema.parse({ safe: this.safe });
    }
    return schema.parse({ emotion: "happy", intensity: 0.6 });
  }
}
let directory: string;
let config: LiveConfig;
let repository: PublicLiveRepository;
let provider: FakeProvider;
let service: PublicLiveService;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "mori-public-live-"));
  config = readLiveConfig({
    MORI_LIVE_MODE: "STAGING",
    MORI_LIVE_API_TOKEN: randomBytes(32).toString("hex"),
    MORI_LIVE_STORE_DIR: directory,
    MORI_LIVE_BUDGET_USD: "20",
    MORI_LIVE_INPUT_USD_PER_MILLION: "1",
    MORI_LIVE_OUTPUT_USD_PER_MILLION: "1",
    LLM_BASE_URL: "https://provider.invalid/v1",
    LLM_API_KEY: "server-secret-not-for-prompt",
    LLM_MODEL: "test-model",
  });
  repository = new PublicLiveRepository(directory);
  provider = new FakeProvider();
  service = new PublicLiveService(config, repository, () => provider);
});
afterEach(async () => {
  await service.onModuleDestroy();
  repository.close();
  rmSync(directory, { recursive: true, force: true });
});
async function session() {
  return (await service.handle(
    {
      version: 1,
      context: "PUBLIC_LIVE",
      type: "session.create",
      requestId: randomUUID(),
      eventId: randomUUID(),
    },
    config.MORI_LIVE_PRINCIPAL,
  )) as LiveSession;
}
async function turn(text = "Xin chào") {
  const current = await session();
  const request = simulatedTurn(current.sessionId, text);
  return {
    request,
    result: (await service.handle(
      request,
      config.MORI_LIVE_PRINCIPAL,
    )) as TurnResponse,
  };
}

test("normal public turn runs safety, intent, provider and output review with empty memory", async () => {
  const { result } = await turn();
  expect(result).toMatchObject({
    status: "approved",
    mode: "STAGING",
    emotion: "happy",
    trainingEligibility: "prohibited",
  });
  expect(provider.structuredCalls).toHaveBeenCalledTimes(3);
  expect(provider.generateText).toHaveBeenCalledTimes(1);
  expect(provider.embed).not.toHaveBeenCalled();
  const text = JSON.stringify(provider.generateText.mock.calls);
  expect(text).toContain("PUBLIC_LIVE");
  expect(text).not.toContain(config.LLM_API_KEY);
  expect(repository.snapshot().spentMicros).toBe(turnCostMicros(config));
  expect(
    readFileSync(join(directory, "public-live.json"), "utf8"),
  ).not.toContain(config.LLM_API_KEY);
});
test("unavailable classifier fails closed before normal generation", async () => {
  provider.classifyUnavailable = true;
  const { result } = await turn();
  expect(result.status).toBe("fallback");
  expect(provider.generateText).not.toHaveBeenCalled();
  expect(result.text).not.toContain("private diagnostic");
});
test.each(["I want to kill myself tonight", "Mình muốn biến mất"])(
  "elevated/crisis bypasses normal generation: %s",
  async (text) => {
    const { result } = await turn(text);
    expect(result.status).toBe("fallback");
    expect(provider.generateText).not.toHaveBeenCalled();
    expect(result.text).toContain("Sự an toàn");
  },
);
test.each(["reject", "unavailable", "lexical"])(
  "output review %s never exposes unapproved output",
  async (failure) => {
    if (failure === "reject") provider.safe = false;
    if (failure === "unavailable") provider.outputUnavailable = true;
    if (failure === "lexical") provider.generated = "You only need me";
    const { result } = await turn();
    expect(result.status).toBe("fallback");
    expect(result.text).not.toBe(provider.generated);
  },
);
test("provider failure returns generic fallback without diagnostics", async () => {
  provider.generateText.mockRejectedValue(new Error("secret network payload"));
  const { result } = await turn();
  expect(result.status).toBe("fallback");
  expect(result.text).not.toContain("secret network payload");
});
test("public requests cannot select a private user, persona or memory", async () => {
  const current = await session();
  const request = simulatedTurn(current.sessionId, "read my private journal");
  for (const extra of [
    { userId: randomUUID() },
    { memory: ["private"] },
    { persona: "override" },
    { context: "PRIVATE_COMPANION" },
  ]) {
    await expect(
      service.handle({ ...request, ...extra }, config.MORI_LIVE_PRINCIPAL),
    ).rejects.toMatchObject({ status: 400 });
  }
  await expect(
    service.handle(request, "another-desktop"),
  ).rejects.toMatchObject({ status: 403 });
  expect(provider.generateText).not.toHaveBeenCalled();
});
test("context is bounded and cannot cross public sessions", async () => {
  const first = await session();
  for (let i = 0; i < 6; i++)
    await service.handle(
      simulatedTurn(first.sessionId, `public-message-${i}`),
      config.MORI_LIVE_PRINCIPAL,
    );
  const lastPrompt = provider.generateText.mock.calls.at(-1)![0];
  expect(lastPrompt).toHaveLength(10); // persona + 4 pairs + current input
  expect(JSON.stringify(lastPrompt)).not.toContain("public-message-0");
  await turn("separate-session");
  expect(JSON.stringify(provider.generateText.mock.calls.at(-1))).not.toContain(
    "public-message",
  );
});
test("persisted replay returns same event without another model call or reservation", async () => {
  const { request, result } = await turn();
  const spent = repository.snapshot().spentMicros;
  repository.close();
  repository = new PublicLiveRepository(directory);
  service = new PublicLiveService(config, repository, () => provider);
  const duplicate = (await service.handle(
    { ...request, requestId: randomUUID() },
    config.MORI_LIVE_PRINCIPAL,
  )) as TurnResponse;
  expect(duplicate.eventId).toBe(result.eventId);
  expect(provider.generateText).toHaveBeenCalledTimes(1);
  expect(repository.snapshot().spentMicros).toBe(spent);
  await expect(
    service.handle(
      { ...request, input: { ...request.input, text: "changed" } },
      config.MORI_LIVE_PRINCIPAL,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
test("budget reservation is atomic and persists across process restart", async () => {
  config.MORI_LIVE_BUDGET_USD = turnCostMicros(config) / 1_000_000;
  const { request } = await turn();
  repository.close();
  repository = new PublicLiveRepository(directory);
  service = new PublicLiveService(config, repository, () => provider);
  await expect(
    service.handle(
      simulatedTurn(request.sessionId, "second"),
      config.MORI_LIVE_PRINCIPAL,
    ),
  ).rejects.toMatchObject({ status: 429 });
  expect(provider.generateText).toHaveBeenCalledTimes(1);
});
test("duplicates join in-flight generation; other turns cannot overlap", async () => {
  let release!: (text: string) => void;
  provider.generateText.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const current = await session();
  const request = simulatedTurn(current.sessionId, "hello");
  const a = service.handle(request, config.MORI_LIVE_PRINCIPAL);
  const b = service.handle(
    { ...request, requestId: randomUUID() },
    config.MORI_LIVE_PRINCIPAL,
  );
  await expect(
    service.handle(
      simulatedTurn(current.sessionId, "other"),
      config.MORI_LIVE_PRINCIPAL,
    ),
  ).rejects.toMatchObject({ status: 429 });
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  release("Chào mọi người!");
  expect((await a).eventId).toBe((await b).eventId);
  expect(provider.generateText).toHaveBeenCalledTimes(1);
});
test("cancel stops in-flight output and late provider result cannot overwrite tombstone", async () => {
  let release!: (text: string) => void;
  provider.generateText.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const current = await session();
  const request = simulatedTurn(current.sessionId, "hello");
  const pending = service.handle(request, config.MORI_LIVE_PRINCIPAL);
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  const cancelled = (await service.handle(
    {
      version: 1,
      context: "PUBLIC_LIVE",
      type: "turn.cancel",
      requestId: randomUUID(),
      eventId: randomUUID(),
      sessionId: current.sessionId,
      turnId: request.turnId,
    },
    config.MORI_LIVE_PRINCIPAL,
  )) as TurnResponse;
  expect(cancelled.status).toBe("cancelled");
  release("never speak this late result");
  expect(await pending).toMatchObject({ status: "cancelled", text: "" });
  expect(
    await service.handle(request, config.MORI_LIVE_PRINCIPAL),
  ).toMatchObject({ status: "cancelled", text: "" });
});
test("end-to-end deadline returns fallback and does not wait for a hung provider", async () => {
  config.MORI_LIVE_TURN_TIMEOUT_MS = 25;
  provider.generateText.mockImplementation(() => new Promise(() => {}));
  const { result } = await turn();
  expect(result.status).toBe("fallback");
  expect(
    Object.values(Object.values(repository.snapshot().sessions)[0].turns)[0]
      .safety,
  ).toBe("timeout");
});
test("repository refuses concurrent writers and corrupt state; pending turns recover cancelled", async () => {
  expect(() => new PublicLiveRepository(directory)).toThrow();
  const { request } = await turn();
  repository.transaction((state) => {
    state.sessions[request.sessionId].turns[request.turnId].state = "pending";
  });
  repository.close();
  repository = new PublicLiveRepository(directory);
  service = new PublicLiveService(config, repository, () => provider);
  expect(
    await service.handle(request, config.MORI_LIVE_PRINCIPAL),
  ).toMatchObject({ status: "cancelled", text: "" });
  repository.close();
  writeFileSync(join(directory, "public-live.json"), "corrupt");
  expect(() => new PublicLiveRepository(directory)).toThrow(
    "Public store unavailable",
  );
});
test("HTTP bridge reaches Nest, rejects origins/credentials/private routes, and excludes private providers", async () => {
  repository.close();
  config.MORI_LIVE_MODE = "MOCK";
  const app = await createPublicLiveApplication(
    config,
    () => new PublicMockProvider(),
  );
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    const client = new MoriLiveBridge({
      url,
      token: config.MORI_LIVE_API_TOKEN,
      expectedMode: "MOCK",
    });
    const liveSession = await client.createSession();
    const result = await client.turn(
      simulatedTurn(liveSession.sessionId, "Xin chào Mori"),
    );
    expect(result.status).toBe("approved");
    for (const token of [
      DatabaseService,
      MemoriesService,
      AIOrchestratorService,
    ])
      expect(() => app.get(token)).toThrow();
    expect(
      (
        await fetch(`${url}/v1/live`, {
          method: "POST",
          headers: { Authorization: "Bearer private-mobile-jwt" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${url}/v1/live`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.MORI_LIVE_API_TOKEN}`,
            Origin: "https://evil.example",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${url}/memories`, {
          headers: { Authorization: `Bearer ${config.MORI_LIVE_API_TOKEN}` },
        })
      ).status,
    ).toBe(404);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(
        `${url}/v1/live`,
        { method: "POST", headers: { Host: "evil.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403);
    const malformed = await fetch(`${url}/v1/live`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.MORI_LIVE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '{"private_secret":',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.text()).not.toContain("private_secret");
  } finally {
    await app.close();
  }
});
test("live configuration rejects cloud mode without explicit provider prices or HTTPS", () => {
  expect(() =>
    readLiveConfig({
      MORI_LIVE_API_TOKEN: config.MORI_LIVE_API_TOKEN,
      MORI_LIVE_MODE: "REAL",
    }),
  ).toThrow();
  expect(() =>
    readLiveConfig({
      MORI_LIVE_API_TOKEN: config.MORI_LIVE_API_TOKEN,
      NODE_ENV: "production",
    }),
  ).toThrow();
});

test("blank optional template variables work in MOCK without private API config", () => {
  expect(
    readLiveConfig({
      MORI_LIVE_API_TOKEN: config.MORI_LIVE_API_TOKEN,
      LLM_BASE_URL: "",
      LLM_API_KEY: "",
      MORI_LIVE_INPUT_USD_PER_MILLION: "",
    }).MORI_LIVE_MODE,
  ).toBe("MOCK");
});

test("per-session quota, expired sessions and cancelled-before-start avoid provider calls", async () => {
  config.MORI_LIVE_MAX_TURNS = 1;
  const current = await session();
  const request = simulatedTurn(current.sessionId, "hello");
  await service.handle(
    {
      version: 1,
      context: "PUBLIC_LIVE",
      type: "turn.cancel",
      requestId: randomUUID(),
      eventId: randomUUID(),
      sessionId: current.sessionId,
      turnId: request.turnId,
    },
    config.MORI_LIVE_PRINCIPAL,
  );
  expect(
    await service.handle(request, config.MORI_LIVE_PRINCIPAL),
  ).toMatchObject({ status: "cancelled", text: "" });
  await expect(
    service.handle(
      simulatedTurn(current.sessionId, "other"),
      config.MORI_LIVE_PRINCIPAL,
    ),
  ).rejects.toMatchObject({ status: 429 });
  repository.transaction((state) => {
    state.sessions[current.sessionId].session.expiresAt = new Date(
      0,
    ).toISOString();
  });
  await expect(
    service.handle(request, config.MORI_LIVE_PRINCIPAL),
  ).rejects.toMatchObject({ status: 404 });
  expect(provider.generateText).not.toHaveBeenCalled();
});

test("HTTP request quota does not block cancellation and oversized bodies are rejected", async () => {
  repository.close();
  config.MORI_LIVE_MODE = "MOCK";
  config.MORI_LIVE_REQUESTS_PER_MINUTE = 2;
  const app = await createPublicLiveApplication(
    config,
    () => new PublicMockProvider(),
  );
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    const client = new MoriLiveBridge({
      url,
      token: config.MORI_LIVE_API_TOKEN,
      expectedMode: "MOCK",
    });
    const current = await client.createSession();
    const request = simulatedTurn(current.sessionId, "hello");
    await client.turn(request);
    await expect(client.createSession()).rejects.toMatchObject({ status: 429 });
    expect(
      (await client.cancel(current.sessionId, request.turnId)).status,
    ).toBe("cancelled");
    const large = await fetch(`${url}/v1/live`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.MORI_LIVE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "x".repeat(20000) }),
    });
    expect(large.status).toBe(413);
  } finally {
    await app.close();
  }
});
