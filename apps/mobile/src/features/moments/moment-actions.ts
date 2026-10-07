export const MomentAction = {
  talk: "talk",
  write: "write",
  quiet: "quiet",
  breathe: "breathe",
  break: "break",
  reachOut: "reach-out",
} as const;

export type MomentAction = (typeof MomentAction)[keyof typeof MomentAction];

export function momentDestination(action: MomentAction) {
  const destinations = {
    talk: "/(tabs)/talk",
    write: "/journal/new",
    quiet: "/quiet-room",
    breathe: "/activity/breathing",
    break: "/moment/break",
    "reach-out": "/moment/reach-out",
  } as const;
  return destinations[action];
}
