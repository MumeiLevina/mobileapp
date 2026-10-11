import { createHash, randomUUID } from "node:crypto";
import {
  liveRequestSchema,
  LiveRequest,
  LiveSession,
  sessionSchema,
  TurnRequest,
  TurnResponse,
  turnResponseSchema,
} from "@mori/live-protocol";
import { LLMProvider, PromptMessage } from "../../ai/providers/provider";
import { SAFE_FALLBACK } from "../../ai/guards/output.guard";
import { LiveConfig, turnCostMicros } from "./live.config";
import {
  PublicLiveRepository,
  PublicLiveState,
  StoredTurn,
} from "./live.repository";
import { generatePublicTurn, PublicGeneration } from "./live.pipeline";

export class LiveFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
type Active = { abort: AbortController; promise: Promise<TurnResponse> };
export class PublicLiveService {
  private readonly active = new Map<string, Active>();
  constructor(
    private readonly config: LiveConfig,
    private readonly repository: PublicLiveRepository,
    private readonly makeProvider: (signal: AbortSignal) => LLMProvider,
  ) {}
  async handle(
    raw: unknown,
    principal: string,
  ): Promise<LiveSession | TurnResponse> {
    if (principal !== this.config.MORI_LIVE_PRINCIPAL)
      throw new LiveFailure(403, "FORBIDDEN");
    const parsed = liveRequestSchema.safeParse(raw);
    if (!parsed.success) throw new LiveFailure(400, "INVALID_REQUEST");
    const request = parsed.data;
    if (request.type === "session.create")
      return this.createSession(request, principal);
    const snapshot = this.repository.snapshot();
    const session = this.ownedSession(
      snapshot,
      request.sessionId,
      principal,
      request.type === "turn.cancel",
    );
    const key = `${request.sessionId}:${request.turnId}`;
    const prior = session.turns[request.turnId];
    if (request.type === "turn.cancel") {
      this.active.get(key)?.abort.abort();
      return this.repository.transaction((state) => {
        const current = this.ownedSession(
          state,
          request.sessionId,
          principal,
          true,
        );
        const old = current.turns[request.turnId];
        if (!old) this.ensureTurnCapacity(state, current.turns);
        if (old?.state === "cancelled")
          return { ...old.response, requestId: request.requestId };
        const response = this.response(request, "cancelled", "");
        current.turns[request.turnId] = {
          ...(old ?? this.record(response)),
          state: "cancelled",
          response,
        };
        return response;
      });
    }
    const normalized: TurnRequest = {
      ...request,
      input: {
        ...request.input,
        text: request.input.text.normalize("NFC").trim(),
      },
    };
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ source: normalized.source, input: normalized.input }),
      )
      .digest("hex");
    if (prior) {
      if (
        (prior.fingerprint && prior.fingerprint !== fingerprint) ||
        (prior.request && prior.request.eventId !== request.eventId)
      )
        throw new LiveFailure(409, "CONFLICT");
      const running = this.active.get(key);
      const response =
        running && prior.state === "pending"
          ? await running.promise
          : prior.response;
      return { ...response, requestId: request.requestId };
    }
    if (this.active.size) throw new LiveFailure(429, "QUOTA_EXCEEDED");
    if (
      Object.values(session.turns).some(
        (t) => t.request?.eventId === request.eventId,
      )
    )
      throw new LiveFailure(409, "CONFLICT");
    const reservedMicros = turnCostMicros(this.config);
    this.repository.transaction((state) => {
      const current = this.ownedSession(state, request.sessionId, principal);
      this.ensureTurnCapacity(state, current.turns);
      if (
        state.spentMicros + reservedMicros >
        Math.floor(this.config.MORI_LIVE_BUDGET_USD * 1_000_000)
      )
        throw new LiveFailure(429, "QUOTA_EXCEEDED");
      state.spentMicros += reservedMicros;
      const record = this.record(this.response(request, "cancelled", ""));
      current.turns[request.turnId] = {
        ...record,
        request: normalized,
        fingerprint,
        state: "pending",
        reservedMicros,
      };
    });
    const history: PromptMessage[] = Object.values(session.turns)
      .filter(
        (turn) =>
          turn.state === "complete" &&
          turn.response.status === "approved" &&
          turn.request,
      )
      .slice(-4)
      .flatMap((turn) => [
        {
          role: "user" as const,
          content: JSON.stringify({
            source: "public_viewer",
            text: turn.request!.input.text,
          }),
        },
        { role: "assistant" as const, content: turn.response.text },
      ]);
    const abort = new AbortController();
    const promise = this.execute(normalized, history, abort).finally(() =>
      this.active.delete(key),
    );
    this.active.set(key, { abort, promise });
    return promise;
  }
  private createSession(
    request: Extract<LiveRequest, { type: "session.create" }>,
    principal: string,
  ) {
    return this.repository.transaction((state) => {
      const existing = Object.values(state.sessions).find(
        (s) => s.owner === principal && s.createEventId === request.eventId,
      );
      if (existing) {
        if (Date.parse(existing.session.expiresAt) <= Date.now())
          throw new LiveFailure(404, "NOT_FOUND");
        if (existing.session.mode !== this.config.MORI_LIVE_MODE)
          throw new LiveFailure(409, "CONFLICT");
        return { ...existing.session, requestId: request.requestId };
      }
      if (Object.keys(state.sessions).length >= 64)
        throw new LiveFailure(429, "QUOTA_EXCEEDED");
      const session = sessionSchema.parse({
        ...request,
        type: "session.created",
        eventId: randomUUID(),
        sessionId: randomUUID(),
        mode: this.config.MORI_LIVE_MODE,
        expiresAt: new Date(
          Date.now() + this.config.MORI_LIVE_SESSION_MINUTES * 60000,
        ).toISOString(),
      });
      state.sessions[session.sessionId] = {
        owner: principal,
        createEventId: request.eventId,
        session,
        turns: {},
      };
      return session;
    });
  }
  private ownedSession(
    state: PublicLiveState,
    id: string,
    principal: string,
    allowExpired = false,
  ) {
    const record = state.sessions[id];
    if (
      !record ||
      record.owner !== principal ||
      (!allowExpired && Date.parse(record.session.expiresAt) <= Date.now())
    )
      throw new LiveFailure(404, "NOT_FOUND");
    if (record.session.mode !== this.config.MORI_LIVE_MODE)
      throw new LiveFailure(409, "CONFLICT");
    return record;
  }
  private ensureTurnCapacity(
    state: PublicLiveState,
    turns: Record<string, StoredTurn>,
  ) {
    const total = Object.values(state.sessions).reduce(
      (n, s) => n + Object.keys(s.turns).length,
      0,
    );
    if (
      Object.keys(turns).length >= this.config.MORI_LIVE_MAX_TURNS ||
      total >= 4096
    )
      throw new LiveFailure(429, "QUOTA_EXCEEDED");
  }
  private response(
    request: { requestId: string; sessionId: string; turnId: string },
    status: TurnResponse["status"],
    text: string,
  ): TurnResponse {
    return turnResponseSchema.parse({
      version: 1,
      context: "PUBLIC_LIVE",
      type: "turn.response",
      // Only explicitly selected identity fields can leave the server.
      requestId: request.requestId,
      sessionId: request.sessionId,
      turnId: request.turnId,
      eventId: randomUUID(),
      mode: this.config.MORI_LIVE_MODE,
      status,
      text,
      emotion: "neutral",
      intensity: 0,
      animation: "idle",
      trainingEligibility: "prohibited",
    });
  }
  private record(response: TurnResponse): StoredTurn {
    return {
      response,
      state: "cancelled",
      safety: "not_run",
      reservedMicros: 0,
      createdAt: new Date().toISOString(),
      personaVersion: this.config.MORI_LIVE_PERSONA,
      modelId:
        this.config.MORI_LIVE_MODE === "MOCK" ? "mock" : this.config.LLM_MODEL!,
    };
  }
  private async execute(
    request: TurnRequest,
    history: PromptMessage[],
    abort: AbortController,
  ): Promise<TurnResponse> {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, this.config.MORI_LIVE_TURN_TIMEOUT_MS);
    let onAbort: (() => void) | undefined;
    let generated: PublicGeneration;
    try {
      generated = await Promise.race([
        generatePublicTurn(
          this.config,
          this.makeProvider(abort.signal),
          request.input.text,
          history,
          abort.signal,
        ),
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(new Error("Live turn aborted"));
          abort.signal.addEventListener("abort", onAbort, { once: true });
          if (abort.signal.aborted) onAbort();
        }),
      ]);
    } catch {
      generated = {
        status: "fallback",
        text: SAFE_FALLBACK,
        emotion: "neutral",
        intensity: 0,
        safety: timedOut ? "timeout" : "provider_unavailable",
      };
    } finally {
      clearTimeout(timer);
      if (onAbort) abort.signal.removeEventListener("abort", onAbort);
    }
    return this.repository.transaction((state) => {
      const turn = state.sessions[request.sessionId].turns[request.turnId];
      if (turn.state === "cancelled")
        return { ...turn.response, requestId: request.requestId };
      if (abort.signal.aborted && !timedOut) {
        turn.state = "cancelled";
        turn.response = this.response(request, "cancelled", "");
      } else {
        turn.state = "complete";
        turn.safety = generated.safety;
        turn.response = turnResponseSchema.parse({
          ...this.response(request, generated.status, generated.text),
          emotion: generated.emotion,
          intensity: generated.intensity,
          animation: (
            {
              neutral: "idle",
              happy: "smile_soft",
              sad: "sad_soft",
              surprised: "surprise_soft",
              confused: "confused_soft",
            } as const
          )[generated.emotion],
        });
      }
      return turn.response;
    });
  }
  async onModuleDestroy() {
    for (const turn of this.active.values()) turn.abort.abort();
    await Promise.allSettled(
      [...this.active.values()].map((turn) => turn.promise),
    );
    this.repository.close();
  }
}
