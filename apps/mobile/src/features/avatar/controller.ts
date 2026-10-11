import { AvatarState, EmotionalExpression } from "./protocol";

export type AvatarContext = {
  hasDraft: boolean;
  requestPending: boolean;
  responseJustArrived: boolean;
  crisis: boolean;
  failed: boolean;
};

const stateExpressions: Partial<Record<AvatarState, EmotionalExpression>> = {
  listening: "blushing",
  thinking: "sullen_face",
  speaking: "tiger_tooth",
  error: "cry",
};

export function resolveAvatarState(context: AvatarContext): AvatarState {
  if (context.crisis) return "resting";
  if (context.failed) return "error";
  if (context.requestPending) return "thinking";
  if (context.responseJustArrived) return "speaking";
  if (context.hasDraft) return "listening";
  return "idle";
}

export function expressionForState(
  state: AvatarState,
  reducedMotion: boolean,
  crisis: boolean,
): EmotionalExpression | null {
  if (crisis || reducedMotion || state === "idle" || state === "resting")
    return null;
  return stateExpressions[state] ?? null;
}

export function speakingDurationMs(
  text: string,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  return Math.min(6_000, Math.max(1_200, text.trim().length * 28));
}
