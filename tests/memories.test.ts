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

test("new memories carry source provenance and approval time", async () => {
  const insert = jest
    .fn()
    .mockResolvedValueOnce({ id: "memory" })
    .mockResolvedValueOnce({ id: "source" });
  const db = { insert, remove: jest.fn() } as unknown as DatabaseService;
  const provider = {
    embed: jest.fn().mockResolvedValue([0]),
  } as unknown as LLMProvider;
  await new MemoriesService(db, provider).add("owner", {
    content: "I prefer quiet mornings",
    category: "preference",
  });
  expect(insert).toHaveBeenNthCalledWith(
    1,
    "memories",
    "owner",
    expect.objectContaining({
      approved_by_user: true,
      approved_at: expect.any(String),
    }),
  );
  expect(insert).toHaveBeenNthCalledWith(2, "memory_sources", "owner", {
    memory_id: "memory",
    source_type: "manual",
    source_id: null,
    reason: "Được bạn trực tiếp thêm vào ký ức của Mori.",
  });
});
