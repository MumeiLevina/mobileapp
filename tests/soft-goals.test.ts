import { BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";
import { SoftGoalsService } from "../apps/api/src/modules/soft-goals/soft-goals.service";

const now = new Date("2026-10-07T12:00:00.000Z");
const clientId = "11111111-1111-4111-a111-111111111111";
const goal = (overrides: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-a222-222222222222",
  user_id: "owner",
  title: "Đi bộ 10 phút",
  note: "",
  status: "active" as const,
  source_type: "manual" as const,
  source_id: null,
  client_id: clientId,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  completed_at: null,
  archived_at: null,
  ...overrides,
});

describe("soft goals", () => {
  test("creates an owner-scoped active intention idempotently", async () => {
    const stored = goal();
    const db = {
      list: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      insert: jest.fn().mockResolvedValue(stored),
    } as unknown as DatabaseService;
    const service = new SoftGoalsService(db, {} as GardenService);
    const value = {
      title: stored.title,
      note: "",
      client_id: clientId,
      source_type: "manual" as const,
      source_id: null,
    };

    await expect(service.create("owner", value)).resolves.toEqual(stored);
    expect(db.insert).toHaveBeenCalledWith("soft_goals", "owner", {
      ...value,
      status: "active",
    });
  });

  test("gently enforces at most five active intentions", async () => {
    const db = {
      list: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(Array.from({ length: 5 }, () => goal())),
      insert: jest.fn(),
    } as unknown as DatabaseService;
    const service = new SoftGoalsService(db, {} as GardenService);

    await expect(
      service.create("owner", {
        title: "Uống một cốc nước",
        note: "",
        client_id: clientId,
        source_type: "manual",
        source_id: null,
      }),
    ).rejects.toThrow("Bạn đang giữ vài điều nhỏ rồi");
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("completion is idempotent and awards the same Garden key", async () => {
    const completed = goal({
      status: "completed",
      completed_at: now.toISOString(),
    });
    const db = {
      one: jest
        .fn()
        .mockResolvedValueOnce(goal())
        .mockResolvedValueOnce(completed),
      update: jest.fn().mockResolvedValue(completed),
    } as unknown as DatabaseService;
    const garden = {
      award: jest.fn(),
      unlock: jest.fn(),
    } as unknown as GardenService;
    const service = new SoftGoalsService(db, garden);

    await service.complete("owner", goal().id, now);
    await service.complete("owner", goal().id, now);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(garden.award).toHaveBeenCalledTimes(2);
    expect(garden.award).toHaveBeenCalledWith(
      "owner",
      `soft-goal:${goal().id}`,
    );
    expect(garden.unlock).toHaveBeenCalledWith(
      "owner",
      "path_stones",
      "soft_goal",
      goal().id,
    );
  });

  test("archives without a failure state or Garden penalty", async () => {
    const db = {
      one: jest.fn().mockResolvedValue(goal()),
      update: jest.fn().mockResolvedValue(goal({ status: "archived" })),
    } as unknown as DatabaseService;
    const garden = { award: jest.fn() } as unknown as GardenService;
    const service = new SoftGoalsService(db, garden);

    await service.archive("owner", goal().id, now);

    expect(db.update).toHaveBeenCalledWith(
      "soft_goals",
      "owner",
      goal().id,
      expect.objectContaining({ status: "archived", completed_at: null }),
    );
    expect(garden.award).not.toHaveBeenCalled();
  });

  test("cannot complete an archived intention", async () => {
    const db = {
      one: jest.fn().mockResolvedValue(goal({ status: "archived" })),
    } as unknown as DatabaseService;
    const service = new SoftGoalsService(db, {} as GardenService);

    await expect(
      service.complete("owner", goal().id, now),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
