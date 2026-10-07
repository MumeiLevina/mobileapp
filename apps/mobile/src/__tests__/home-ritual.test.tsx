import { ritualForLocalMinutes } from "../features/home/ritual-time";

test("home ritual follows deterministic local-time windows", () => {
  expect(ritualForLocalMinutes(4 * 60 + 59)).toBeNull();
  expect(ritualForLocalMinutes(5 * 60)).toBe("morning");
  expect(ritualForLocalMinutes(11 * 60 + 30)).toBe("morning");
  expect(ritualForLocalMinutes(11 * 60 + 31)).toBeNull();
  expect(ritualForLocalMinutes(18 * 60)).toBe("evening");
  expect(ritualForLocalMinutes(23 * 60 + 59)).toBe("evening");
});
