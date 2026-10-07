import {
  formatQuietTimer,
  nextQuietTimer,
  quietTimerOptions,
  soundscapes,
} from "../features/quiet/soundscapes";

test("quiet room uses curated metadata without unlicensed audio", () => {
  expect(soundscapes).toHaveLength(5);
  expect(soundscapes.every((item) => item.asset === null)).toBe(true);
  expect(soundscapes.map((item) => item.title)).toEqual([
    "Cửa sổ ngày mưa",
    "Rừng về đêm",
    "Góc lửa ấm",
    "Bờ nước yên",
    "Khu vườn dưới trăng",
  ]);
});

test("quiet timer supports no timer, 2, 5 and 10 minutes", () => {
  expect(quietTimerOptions).toEqual([0, 120, 300, 600]);
  expect(nextQuietTimer(1)).toBe(0);
  expect(nextQuietTimer(0)).toBe(0);
  expect(formatQuietTimer(120)).toBe("02:00");
});
