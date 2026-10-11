import { randomUUID } from "node:crypto";
import {
  liveRequestSchema,
  sessionSchema,
  turnResponseSchema,
  LiveRequest,
  LiveSession,
  TurnRequest,
  TurnResponse,
} from "@mori/live-protocol";

export class BridgeError extends Error {
  constructor(readonly status: number) {
    super(`Live bridge request failed (${status})`);
  }
}

export class MoriLiveBridge {
  private readonly endpoint: string;
  constructor(
    private readonly config: {
      url: string;
      token: string;
      timeoutMs?: number;
      expectedMode: "MOCK" | "STAGING" | "REAL";
    },
  ) {
    const url = new URL(config.url);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && url.hostname === "127.0.0.1"))
    ) {
      throw new Error(
        "Live bridge requires HTTPS or loopback HTTP, without URL credentials",
      );
    }
    if (url.pathname !== "/" && url.pathname !== "/v1/live")
      throw new Error("Invalid bridge path");
    this.endpoint = new URL("/v1/live", url).href;
  }
  private async post(
    input: LiveRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const request = liveRequestSchema.parse(input);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.any([
          AbortSignal.timeout(this.config.timeoutMs ?? 5000),
          ...(signal ? [signal] : []),
        ]),
      });
      if (!response.ok) throw new BridgeError(response.status);
      if (!response.headers.get("content-type")?.startsWith("application/json"))
        throw new BridgeError(502);
      const reader = response.body?.getReader();
      if (!reader) throw new BridgeError(502);
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 32_768) throw new BridgeError(502);
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (signal?.aborted) throw new BridgeError(499);
      if (error instanceof BridgeError) throw error;
      throw new BridgeError(503);
    }
  }
  async createSession(eventId = randomUUID()): Promise<LiveSession> {
    const requestId = randomUUID();
    const session = sessionSchema.parse(
      await this.post({
        version: 1,
        context: "PUBLIC_LIVE",
        type: "session.create",
        requestId,
        eventId,
      }),
    );
    if (
      session.mode !== this.config.expectedMode ||
      session.requestId !== requestId ||
      Date.parse(session.expiresAt) <= Date.now()
    )
      throw new BridgeError(502);
    return session;
  }
  async turn(input: TurnRequest, signal?: AbortSignal): Promise<TurnResponse> {
    const response = turnResponseSchema.parse(await this.post(input, signal));
    this.validateIdentity(response, input);
    return response;
  }
  async cancel(sessionId: string, turnId: string): Promise<TurnResponse> {
    const request = {
      version: 1 as const,
      context: "PUBLIC_LIVE" as const,
      type: "turn.cancel" as const,
      requestId: randomUUID(),
      eventId: randomUUID(),
      sessionId,
      turnId,
    };
    const response = turnResponseSchema.parse(await this.post(request));
    this.validateIdentity(response, request);
    if (response.status !== "cancelled") throw new BridgeError(502);
    return response;
  }
  private validateIdentity(
    response: TurnResponse,
    request: { sessionId: string; turnId: string; requestId: string },
  ) {
    if (
      response.mode !== this.config.expectedMode ||
      response.sessionId !== request.sessionId ||
      response.turnId !== request.turnId ||
      response.requestId !== request.requestId
    )
      throw new BridgeError(502);
  }
}

export function simulatedTurn(sessionId: string, text: string): TurnRequest {
  return liveRequestSchema.parse({
    version: 1,
    context: "PUBLIC_LIVE",
    type: "turn.request",
    requestId: randomUUID(),
    eventId: randomUUID(),
    turnId: randomUUID(),
    sessionId,
    source: "simulated",
    input: { type: "viewer_chat", text },
  }) as TurnRequest;
}
