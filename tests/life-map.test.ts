import { BadRequestException } from "@nestjs/common";
import { LifeMapService } from "../apps/api/src/modules/life-map/life-map.service";
import { DatabaseService } from "../apps/api/src/database/database.service";

test("manual Life Map entries are explicitly user-approved", async () => {
  const db = { insert: jest.fn().mockResolvedValue({ id: "item" }) };
  const service = new LifeMapService(db as unknown as DatabaseService);
  await service.create("owner", {
    type: "values",
    title: "Kindness",
    description: "How I want to show up",
  });
  expect(db.insert).toHaveBeenCalledWith("life_map_items", "owner", {
    type: "values",
    title: "Kindness",
    description: "How I want to show up",
    source_type: null,
    source_id: null,
    approved_by_user: true,
  });
});

test("suggestions use only approved active owner memories and are not persisted", async () => {
  const db = {
    list: jest.fn(async (table: string) =>
      table === "memories"
        ? [
            {
              id: "memory-1",
              content: "My sister matters to me",
              category: "relationship",
              approved_by_user: true,
            },
          ]
        : [],
    ),
    insert: jest.fn(),
  };
  const service = new LifeMapService(db as unknown as DatabaseService);
  const suggestions = await service.suggestions("owner");
  expect(db.list).toHaveBeenCalledWith("memories", "owner", {
    active: true,
    equals: { approved_by_user: true },
    limit: 30,
  });
  expect(suggestions).toEqual([
    expect.objectContaining({
      type: "people",
      source_type: "memory",
      source_id: "memory-1",
    }),
  ]);
  expect(db.insert).not.toHaveBeenCalled();
});

test("accepting a suggestion verifies the approved source belongs to the user", async () => {
  const db = {
    one: jest.fn().mockResolvedValue({ approved_by_user: false }),
    insert: jest.fn(),
  };
  const service = new LifeMapService(db as unknown as DatabaseService);
  await expect(
    service.addSuggestion("owner", {
      type: "people",
      title: "Someone",
      description: "",
      source_type: "memory",
      source_id: "11111111-1111-4111-a111-111111111111",
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(db.one).toHaveBeenCalledWith(
    "memories",
    "owner",
    "11111111-1111-4111-a111-111111111111",
    true,
  );
  expect(db.insert).not.toHaveBeenCalled();
});
