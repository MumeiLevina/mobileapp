import {
  gardenFromPoints,
  journalSchema,
  moodSchema,
} from "../packages/shared/src";
import { MemoriesService } from "../apps/api/src/modules/memories/memories.service";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { MockLLMProvider } from "../apps/api/src/ai/providers/mock.provider";
import { MoodsController } from "../apps/api/src/modules/moods/moods.controller";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";
const client_id = "77777777-7777-4777-a777-777777777777";
test("all moods, including low mood, have the same growth eligibility", () => {
  for (const mood of ["joyful", "good", "okay", "low", "overwhelmed"])
    expect(
      moodSchema.safeParse({ mood, intensity: 0.7, tags: [], client_id })
        .success,
    ).toBe(true);
  expect(gardenFromPoints(5).tree_level).toBe(2);
  expect(gardenFromPoints(25).unlocked_items).toContain("moon");
  expect(gardenFromPoints(12).sanctuary_areas).toEqual(["quiet_cottage"]);
  expect(gardenFromPoints(25).sanctuary_areas).toEqual([
    "quiet_cottage",
    "moon_hill",
  ]);
});
test("rejects invalid mood and private metadata injection", () => {
  expect(
    moodSchema.safeParse({
      mood: "depressed",
      intensity: 3,
      tags: [],
      client_id,
    }).success,
  ).toBe(false);
  expect(
    moodSchema.parse({
      mood: "low",
      intensity: 0.8,
      tags: [],
      client_id,
      user_id: "other",
    }),
  ).not.toHaveProperty("user_id");
});
test("journals need explicit valid save data", () => {
  expect(
    journalSchema.safeParse({
      title: "",
      content: "",
      source: "conversation",
      client_id,
    }).success,
  ).toBe(false);
});
test("memory candidate cannot enter retrieval before approval", async () => {
  const store: { approved_by_user: boolean; content: string; id: string }[] =
    [];
  const repository = {
    insert: jest.fn(
      async (_table: string, _user: string, value: Record<string, unknown>) => {
        const entry = { ...value, id: "memory" } as (typeof store)[number];
        store.push(entry);
        return entry;
      },
    ),
    one: jest.fn(async () => store[0]),
    update: jest.fn(
      async (
        _table: string,
        _user: string,
        _id: string,
        value: Record<string, unknown>,
      ) => Object.assign(store[0], value),
    ),
    rpc: jest.fn(async () => store.filter((m) => m.approved_by_user)),
  };
  const service = new MemoriesService(
    repository as unknown as DatabaseService,
    new MockLLMProvider(),
  );
  await service.add(
    "user",
    { content: "I like rain", category: "preference" },
    false,
  );
  expect(await service.retrieveMemories("user", "rain")).toHaveLength(0);
  await service.approve("user", "memory");
  expect(await service.retrieveMemories("user", "rain")).toHaveLength(1);
  expect(repository.rpc).toHaveBeenCalledWith(
    "match_memories",
    expect.objectContaining({ p_user: "user", match_count: 4 }),
  );
});
test("mood retries do not create multiple entries or use mood as a penalty", async () => {
  const value = { id: "mood", mood: "low", intensity: 1, tags: [], client_id };
  const repository = {
    list: jest.fn().mockResolvedValue([value]),
    insert: jest.fn(),
  };
  const garden = { award: jest.fn() };
  const controller = new MoodsController(
    repository as unknown as DatabaseService,
    garden as unknown as GardenService,
  );
  await controller.create("user", value);
  expect(repository.insert).not.toHaveBeenCalled();
  expect(garden.award).toHaveBeenCalledWith("user", "mood:mood");
});
