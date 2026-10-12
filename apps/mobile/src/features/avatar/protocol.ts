export const avatarStates = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "resting",
  "error",
] as const;

export type AvatarState = (typeof avatarStates)[number];

export const emotionalExpressions = [
  "angry",
  "blushing",
  "cry",
  "dizzy",
  "love",
  "star",
  "sullen_face",
  "tiger_tooth",
] as const;

export type EmotionalExpression = (typeof emotionalExpressions)[number];

export function resolveEmotionalExpression(
  requested: string | null,
  available: ReadonlySet<string>,
): EmotionalExpression | null {
  if (!requested || !available.has(requested)) return null;
  return emotionalExpressions.includes(requested as EmotionalExpression)
    ? (requested as EmotionalExpression)
    : null;
}

// Appearance/accessory switches are intentionally not used by conversational state.
export const appearanceExpressions = [
  "cat_ears",
  "down_ponytail",
  "ear_warm",
  "flying_head",
  "flying_head1",
  "forepart",
  "hat",
  "holding_neko",
  "leaning_forward",
  "left_hair",
  "left_ponytail",
  "long_hair",
  "microphone",
  "playing_games",
  "reduce",
  "reduce1",
  "right_hair",
  "right_ponytail",
  "short_hair",
  "sideburns",
  "small_neko",
  "styling1",
  "styling2",
  "styling3",
  "watermark",
] as const;

export type AvatarCommand =
  | {
      version: 1;
      type: "setState";
      state: AvatarState;
      reducedMotion: boolean;
      crisis: boolean;
    }
  | { version: 1; type: "playExpression"; expression: EmotionalExpression }
  | { version: 1; type: "setVisibility"; visible: boolean }
  | { version: 1; type: "pause"; paused: boolean };

export type RendererEvent =
  | {
      version: 1;
      type: "ready";
      loadMs: number;
      coreVersion: string;
      webgl: string;
    }
  | { version: 1; type: "error"; code: string; message: string }
  | { version: 1; type: "stateChanged"; state: AvatarState }
  | { version: 1; type: "metrics"; fps: number; heapBytes?: number };

export function isAvatarState(value: unknown): value is AvatarState {
  return (
    typeof value === "string" && avatarStates.includes(value as AvatarState)
  );
}

export function parseRendererEvent(value: string): RendererEvent | null {
  try {
    const event: unknown = JSON.parse(value);
    if (!event || typeof event !== "object") return null;
    const candidate = event as Record<string, unknown>;
    if (candidate.version !== 1 || typeof candidate.type !== "string")
      return null;
    if (candidate.type === "ready") {
      return typeof candidate.loadMs === "number" &&
        typeof candidate.coreVersion === "string" &&
        typeof candidate.webgl === "string"
        ? (event as RendererEvent)
        : null;
    }
    if (candidate.type === "error") {
      return typeof candidate.code === "string" &&
        typeof candidate.message === "string"
        ? (event as RendererEvent)
        : null;
    }
    if (candidate.type === "stateChanged") {
      return isAvatarState(candidate.state) ? (event as RendererEvent) : null;
    }
    if (candidate.type === "metrics") {
      return typeof candidate.fps === "number"
        ? (event as RendererEvent)
        : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeCommand(command: AvatarCommand): string {
  return JSON.stringify(command).replaceAll("<", "\\u003c");
}
