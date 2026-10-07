export const EveningRitualAction = {
  write: "write",
  breathe: "breathe",
  quiet: "quiet",
  mood: "mood",
  finish: "finish",
} as const;

export type EveningRitualAction =
  (typeof EveningRitualAction)[keyof typeof EveningRitualAction];

export function eveningDestination(action: EveningRitualAction) {
  if (action === "write") return "/journal/new" as const;
  if (action === "breathe") return "/activity/breathing" as const;
  if (action === "quiet") return "/activity/rain" as const;
  if (action === "finish") return "/(tabs)" as const;
  return null;
}
