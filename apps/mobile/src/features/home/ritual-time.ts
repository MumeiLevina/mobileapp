export type HomeRitual = "morning" | "evening" | null;

export function ritualForLocalMinutes(minutes: number): HomeRitual {
  if (minutes >= 5 * 60 && minutes <= 11 * 60 + 30) return "morning";
  if (minutes >= 18 * 60 && minutes <= 23 * 60 + 59) return "evening";
  return null;
}

export function currentHomeRitual(now = new Date()) {
  return ritualForLocalMinutes(now.getHours() * 60 + now.getMinutes());
}
