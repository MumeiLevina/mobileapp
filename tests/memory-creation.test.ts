import { memoryCreateSchema, memorySchema } from "@mori/shared";
import { MemoriesController } from "../apps/api/src/modules/memories/memories.controller";
import { MemoriesService } from "../apps/api/src/modules/memories/memories.service";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { LLMProvider } from "../apps/api/src/ai/providers/provider";

const payload = {
  client_id: "12121212-1212-4212-a212-121212121212",
  content: "Synthetic quiet mornings",
  category: "preference" as const,
};

test("creation requires a UUID, strips ownership/approval injection and leaves edits compatible", () => {
  expect(
    memoryCreateSchema.safeParse({ ...payload, client_id: undefined }).success,
  ).toBe(false);
  expect(
    memoryCreateSchema.safeParse({ ...payload, client_id: "bad" }).success,
  ).toBe(false);
  expect(
    memoryCreateSchema.parse({
      ...payload,
      user_id: "other",
      approved_by_user: false,
    }),
  ).toEqual(payload);
  expect(memorySchema.parse(payload)).toEqual({
    content: payload.content,
    category: payload.category,
  });
});

test("controller creates with the authenticated owner and rejects missing identity before writing", () => {
  const createManual = jest.fn();
  const controller = new MemoriesController({
    createManual,
  } as unknown as MemoriesService);
  controller.create("verified-owner", { ...payload, user_id: "other" });
  expect(createManual).toHaveBeenCalledWith("verified-owner", payload);
  expect(() =>
    controller.create("verified-owner", {
      content: "words",
      category: "preference",
    }),
  ).toThrow();
  expect(createManual).toHaveBeenCalledTimes(1);
});

test("manual creation uses only the atomic RPC, and a retry keeps the owner and UUID", async () => {
  const rpc = jest.fn().mockResolvedValue({ id: "same-memory" });
  const insert = jest.fn();
  const embed = jest.fn().mockResolvedValue([1, 0]);
  const service = new MemoriesService(
    { rpc, insert } as unknown as DatabaseService,
    { embed } as unknown as LLMProvider,
  );
  await expect(service.createManual("owner", payload)).resolves.toEqual({
    id: "same-memory",
  });
  await service.createManual("owner", payload);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc).toHaveBeenCalledWith("create_manual_memory", {
    p_user: "owner",
    p_client_id: payload.client_id,
    p_content: payload.content,
    p_category: payload.category,
    p_embedding: [1, 0],
  });
  expect(insert).not.toHaveBeenCalled();
});

test("embedding failure never starts an approved creation transaction", async () => {
  const rpc = jest.fn();
  const service = new MemoriesService(
    { rpc } as unknown as DatabaseService,
    {
      embed: jest
        .fn()
        .mockRejectedValue(new Error("synthetic embedding failure")),
    } as unknown as LLMProvider,
  );
  await expect(service.createManual("owner", payload)).rejects.toThrow(
    "synthetic embedding failure",
  );
  expect(rpc).not.toHaveBeenCalled();
});
