import { firstAidActions, groundingSteps } from "../features/first-aid/content";

test("First Aid routes remain deterministic and bypass normal AI selection", () => {
  expect(firstAidActions.map(({ id, route }) => [id, route])).toEqual([
    ["slow", "/activity/breathing"],
    ["ground", "/first-aid/grounding"],
    ["talk", "/(tabs)/talk"],
    ["quiet", "/quiet-room"],
    ["connect", "/first-aid/connection"],
    ["danger", "/first-aid/danger"],
  ]);
});

test("grounding content is curated and preserves the 5-4-3-2-1 order", () => {
  expect(groundingSteps).toEqual([
    "5 điều bạn có thể nhìn thấy",
    "4 điều bạn có thể cảm nhận",
    "3 điều bạn có thể nghe thấy",
    "2 điều bạn có thể ngửi thấy",
    "1 hơi thở chậm",
  ]);
});
