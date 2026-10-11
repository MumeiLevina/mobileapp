import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import {
  liveRequestSchema,
  sessionSchema,
  turnResponseSchema,
  LiveSession,
  TurnResponse,
} from "@mori/live-protocol";

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
type Turn = { fingerprint?: string; eventId?: string; response: TurnResponse };
type Session = { value: LiveSession; turns: Map<string, Turn> };

// This fixture has no provider, database, browser assets or upstream runtime access.
export function createMockBridge(options: {
  token: string;
  maxTurns?: number;
  sessionTtlMs?: number;
}) {
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(options.token)) {
    throw new Error(
      "A dedicated random bridge token of 32–256 characters is required",
    );
  }
  const tokenHash = createHash("sha256")
    .update(`Bearer ${options.token}`)
    .digest();
  const sessions = new Map<string, Session>();
  const creates = new Map<string, { requestId: string; sessionId: string }>();
  const maxTurns = options.maxTurns ?? 100;
  const ttl = options.sessionTtlMs ?? 30 * 60_000;
  let windowStart = Date.now();
  let requestCount = 0;

  function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    });
    res.end(JSON.stringify(body));
  }
  async function body(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const raw of req) {
      const chunk = Buffer.from(raw);
      size += chunk.length;
      if (size > 16_384) throw new RequestError(413, "INVALID_REQUEST");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new RequestError(400, "INVALID_REQUEST");
    }
  }
  const server = createServer(async (req, res) => {
    try {
      const expectedHost = `127.0.0.1:${req.socket.localPort}`;
      if (
        req.headers.host !== expectedHost ||
        req.headers.origin !== undefined ||
        (req.headers["sec-fetch-site"] &&
          req.headers["sec-fetch-site"] !== "none")
      ) {
        throw new RequestError(403, "FORBIDDEN");
      }
      const incomingHash = createHash("sha256")
        .update(req.headers.authorization ?? "")
        .digest();
      if (!timingSafeEqual(tokenHash, incomingHash))
        throw new RequestError(401, "UNAUTHORIZED");
      if (Date.now() - windowStart >= 60_000) {
        windowStart = Date.now();
        requestCount = 0;
      }
      if (++requestCount > 120) throw new RequestError(429, "QUOTA_EXCEEDED");
      if (req.method !== "POST" || req.url !== "/v1/live")
        throw new RequestError(404, "NOT_FOUND");
      if (
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
          req.headers["content-type"] ?? "",
        )
      ) {
        throw new RequestError(415, "INVALID_REQUEST");
      }
      const parsed = liveRequestSchema.safeParse(await body(req));
      if (!parsed.success) throw new RequestError(400, "INVALID_REQUEST");
      const input = parsed.data;
      for (const [id, session] of sessions) {
        if (Date.parse(session.value.expiresAt) <= Date.now())
          sessions.delete(id);
      }
      if (input.type === "session.create") {
        const previous = creates.get(input.eventId);
        if (previous) {
          const existing = sessions.get(previous.sessionId);
          if (!existing) throw new RequestError(404, "NOT_FOUND");
          send(res, 200, { ...existing.value, requestId: input.requestId });
          return;
        }
        if (sessions.size >= 8 || creates.size >= 128)
          throw new RequestError(429, "QUOTA_EXCEEDED");
        const value = sessionSchema.parse({
          ...input,
          type: "session.created",
          eventId: randomUUID(),
          sessionId: randomUUID(),
          mode: "MOCK",
          expiresAt: new Date(Date.now() + ttl).toISOString(),
        });
        sessions.set(value.sessionId, { value, turns: new Map() });
        creates.set(input.eventId, {
          requestId: input.requestId,
          sessionId: value.sessionId,
        });
        send(res, 201, value);
        return;
      }
      const session = sessions.get(input.sessionId);
      if (!session) throw new RequestError(404, "NOT_FOUND");
      const prior = session.turns.get(input.turnId);
      const responseBase = {
        version: 1,
        context: "PUBLIC_LIVE",
        type: "turn.response",
        requestId: input.requestId,
        eventId: randomUUID(),
        sessionId: input.sessionId,
        turnId: input.turnId,
        mode: "MOCK",
        emotion: "neutral",
        intensity: 0,
        animation: "idle",
        trainingEligibility: "prohibited",
      };
      if (!prior && session.turns.size >= maxTurns)
        throw new RequestError(429, "QUOTA_EXCEEDED");
      if (input.type === "turn.cancel") {
        const response =
          prior?.response.status === "cancelled"
            ? prior.response
            : turnResponseSchema.parse({
                ...responseBase,
                status: "cancelled",
                text: "",
              });
        session.turns.set(input.turnId, { ...prior, response });
        send(res, 200, { ...response, requestId: input.requestId });
        return;
      }
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ source: input.source, input: input.input }))
        .digest("hex");
      if (prior) {
        if (
          (prior.fingerprint && prior.fingerprint !== fingerprint) ||
          (prior.eventId && prior.eventId !== input.eventId)
        )
          throw new RequestError(409, "CONFLICT");
        send(res, 200, { ...prior.response, requestId: input.requestId });
        return;
      }
      if (
        [...session.turns.values()].some(
          (turn) => turn.eventId === input.eventId,
        )
      ) {
        throw new RequestError(409, "CONFLICT");
      }
      const response = turnResponseSchema.parse({
        ...responseBase,
        status: "approved",
        text: "Xin chào! Đây là phản hồi mô phỏng của Mori Live.",
        emotion: "happy",
        intensity: 0.5,
        animation: "smile_soft",
      });
      session.turns.set(input.turnId, {
        fingerprint,
        eventId: input.eventId,
        response,
      });
      send(res, 200, response);
    } catch (error) {
      const failure =
        error instanceof RequestError
          ? error
          : new RequestError(503, "UNAVAILABLE");
      // Never echo exception messages, request bodies or authorization headers.
      if (!res.headersSent)
        send(res, failure.status, {
          version: 1,
          type: "error",
          code: failure.code,
        });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.timeout = 5000;
  server.maxConnections = 16;
  return server;
}
