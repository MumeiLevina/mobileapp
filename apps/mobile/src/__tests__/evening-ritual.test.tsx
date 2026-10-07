import {
  eveningDestination,
  EveningRitualAction,
} from "../features/rituals/evening-actions";

test("evening ritual actions use deterministic non-AI destinations", () => {
  expect(eveningDestination(EveningRitualAction.write)).toBe("/journal/new");
  expect(eveningDestination(EveningRitualAction.breathe)).toBe(
    "/activity/breathing",
  );
  expect(eveningDestination(EveningRitualAction.quiet)).toBe("/activity/rain");
  expect(eveningDestination(EveningRitualAction.finish)).toBe("/(tabs)");
});

test("mood stays inside the ritual until the user finishes check-in", () => {
  expect(eveningDestination(EveningRitualAction.mood)).toBeNull();
});
