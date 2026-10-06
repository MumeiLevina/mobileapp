import { MemoriesService } from "../apps/api/src/modules/memories/memories.service";
import { LLMProvider } from "../apps/api/src/ai/providers/provider";
import { DatabaseService } from "../apps/api/src/database/database.service";

test("embedding failure never activates a pending memory", async () => {
  const db = {
    one: jest.fn().mockResolvedValue({
      id: "memory",
      content: "approved only after embedding",
      approved_by_user: false,
    }),
    update: jest.fn(),
  } as unknown as DatabaseService;
  const provider = {
    embed: jest.fn().mockRejectedValue(new Error("embedding unavailable")),
  } as unknown as LLMProvider;

  await expect(
    new MemoriesService(db, provider).approve("owner", "memory"),
  ).rejects.toThrow("embedding unavailable");
  expect(db.update).not.toHaveBeenCalled();
});

test("embedding failure prevents insertion of an approved memory", async () => {
  const db = { insert: jest.fn() } as unknown as DatabaseService;
  const provider = {
    embed: jest.fn().mockRejectedValue(new Error("embedding unavailable")),
  } as unknown as LLMProvider;

  await expect(
    new MemoriesService(db, provider).add("owner", {
      content: "synthetic preference",
      category: "preference",
    }),
  ).rejects.toThrow("embedding unavailable");
  expect(db.insert).not.toHaveBeenCalled();
});
