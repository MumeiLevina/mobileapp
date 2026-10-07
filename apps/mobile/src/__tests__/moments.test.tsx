import {
  momentDestination,
  MomentAction,
} from "../features/moments/moment-actions";

test("Mori Moments maps every choice without an AI decision", () => {
  expect(momentDestination(MomentAction.talk)).toBe("/(tabs)/talk");
  expect(momentDestination(MomentAction.write)).toBe("/journal/new");
  expect(momentDestination(MomentAction.quiet)).toBe("/quiet-room");
  expect(momentDestination(MomentAction.breathe)).toBe("/activity/breathing");
  expect(momentDestination(MomentAction.break)).toBe("/moment/break");
  expect(momentDestination(MomentAction.reachOut)).toBe("/moment/reach-out");
});
