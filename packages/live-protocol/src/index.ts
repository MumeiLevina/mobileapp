import { z } from "zod";

export const executionContextSchema = z.enum([
  "PRIVATE_COMPANION",
  "PUBLIC_LIVE",
]);
export const liveModeSchema = z.enum(["MOCK", "STAGING", "REAL"]);
export const avatarStateSchema = z.enum([
  "IDLE",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "HAPPY",
  "SAD",
  "SURPRISED",
  "CONFUSED",
  "ERROR",
]);
const envelope = {
  version: z.literal(1),
  context: z.literal("PUBLIC_LIVE"),
  requestId: z.string().uuid(),
  eventId: z.string().uuid(),
};
export const sessionRequestSchema = z
  .object({
    ...envelope,
    type: z.literal("session.create"),
  })
  .strict();
export const sessionSchema = z
  .object({
    ...envelope,
    type: z.literal("session.created"),
    sessionId: z.string().uuid(),
    mode: liveModeSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();
export const turnRequestSchema = z
  .object({
    ...envelope,
    type: z.literal("turn.request"),
    sessionId: z.string().uuid(),
    turnId: z.string().uuid(),
    source: z.enum(["simulated", "operator", "youtube"]),
    input: z
      .object({
        type: z.literal("viewer_chat"),
        text: z.string().trim().min(1).max(2000),
      })
      .strict(),
  })
  .strict();
export const turnResponseSchema = z
  .object({
    ...envelope,
    type: z.literal("turn.response"),
    sessionId: z.string().uuid(),
    turnId: z.string().uuid(),
    mode: liveModeSchema,
    status: z.enum(["approved", "fallback", "cancelled"]),
    text: z.string().max(4000),
    emotion: z.enum(["neutral", "happy", "sad", "surprised", "confused"]),
    intensity: z.number().min(0).max(1),
    animation: z.enum([
      "idle",
      "smile_soft",
      "sad_soft",
      "surprise_soft",
      "confused_soft",
    ]),
    trainingEligibility: z.literal("prohibited"),
  })
  .strict()
  .superRefine((response, ctx) => {
    if ((response.status === "cancelled") !== (response.text.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid speech status",
      });
    }
  });
export const cancelRequestSchema = z
  .object({
    ...envelope,
    type: z.literal("turn.cancel"),
    sessionId: z.string().uuid(),
    turnId: z.string().uuid(),
  })
  .strict();
export const liveRequestSchema = z.discriminatedUnion("type", [
  sessionRequestSchema,
  turnRequestSchema,
  cancelRequestSchema,
]);
export const liveErrorSchema = z
  .object({
    version: z.literal(1),
    type: z.literal("error"),
    code: z.enum([
      "UNAUTHORIZED",
      "FORBIDDEN",
      "INVALID_REQUEST",
      "NOT_FOUND",
      "CONFLICT",
      "QUOTA_EXCEEDED",
      "UNAVAILABLE",
    ]),
  })
  .strict();
export type TurnRequest = z.infer<typeof turnRequestSchema>;
export type TurnResponse = z.infer<typeof turnResponseSchema>;
export type LiveRequest = z.infer<typeof liveRequestSchema>;
export type LiveSession = z.infer<typeof sessionSchema>;
