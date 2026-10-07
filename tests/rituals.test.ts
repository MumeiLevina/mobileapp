import { DatabaseService } from "../apps/api/src/database/database.service";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";
import { RitualsController } from "../apps/api/src/modules/rituals/rituals.controller";

const clientId = "77777777-7777-4777-a777-777777777777";

test("morning ritual is owner-scoped, idempotent and awards once by entry", async () => {
  const entry = {
    id: "ritual-1",
    user_id: "owner",
    type: "morning" as const,
    desired_feeling: "peaceful" as const,
    small_intention: "Đi bộ một chút",
    reflection: "",
    client_id: clientId,
    created_at: new Date().toISOString(),
  };
  const db = {
    list: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([entry]),
    insert: jest.fn().mockResolvedValue(entry),
  };
  const garden = { award: jest.fn().mockResolvedValue(undefined) };
  const controller = new RitualsController(
    db as unknown as DatabaseService,
    garden as unknown as GardenService,
  );
  const body = {
    type: "morning",
    desired_feeling: "peaceful",
    small_intention: "Đi bộ một chút",
    reflection: "",
    client_id: clientId,
  };

  await controller.create("owner", body);
  await controller.create("owner", body);

  expect(db.list).toHaveBeenCalledWith("ritual_entries", "owner", {
    equals: { client_id: clientId },
    limit: 1,
  });
  expect(db.insert).toHaveBeenCalledTimes(1);
  expect(db.insert).toHaveBeenCalledWith("ritual_entries", "owner", body);
  expect(garden.award).toHaveBeenCalledWith("owner", "ritual:ritual-1");
});

test("morning ritual rejects completion without a chosen feeling", async () => {
  const controller = new RitualsController(
    { list: jest.fn() } as unknown as DatabaseService,
    { award: jest.fn() } as unknown as GardenService,
  );
  await expect(
    controller.create("owner", {
      type: "morning",
      desired_feeling: null,
      small_intention: "",
      reflection: "",
      client_id: clientId,
    }),
  ).rejects.toThrow();
});
