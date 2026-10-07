import { BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";
import { LettersService } from "../apps/api/src/modules/letters/letters.service";

const now = new Date("2026-10-07T12:00:00.000Z");
const future = "2026-10-14T12:00:00.000Z";
const clientId = "88888888-8888-4888-a888-888888888888";

const letter = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-a111-111111111111",
  user_id: "owner",
  title: "Gửi mình của tương lai",
  content: "Một điều riêng tư",
  open_at: future,
  opened_at: null,
  deleted_at: null,
  client_id: clientId,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  ...overrides,
});

describe("future-self letters", () => {
  test("creates an idempotent private letter and awards one symbolic seed", async () => {
    const stored = letter();
    const db = {
      list: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([stored]),
      insert: jest.fn().mockResolvedValue(stored),
    } as unknown as DatabaseService;
    const garden = {
      award: jest.fn().mockResolvedValue(undefined),
      unlock: jest.fn().mockResolvedValue(undefined),
    } as unknown as GardenService;
    const service = new LettersService(db, garden);
    const value = {
      title: stored.title,
      content: stored.content,
      open_at: future,
      client_id: clientId,
    };

    await service.create("owner", value, now);
    await service.create("owner", value, now);

    expect(db.list).toHaveBeenCalledWith("letters", "owner", {
      active: true,
      equals: { client_id: clientId },
      limit: 1,
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(garden.award).toHaveBeenCalledWith(
      "owner",
      `letter-seed:${stored.id}`,
    );
    expect(garden.unlock).toHaveBeenCalledWith(
      "owner",
      "letter_tree",
      "letter",
      stored.id,
    );
  });

  test("vault metadata hides content and only marks letters ready on time", async () => {
    const db = {
      list: jest.fn().mockResolvedValue([
        letter(),
        letter({
          id: "22222222-2222-4222-a222-222222222222",
          open_at: "2026-10-07T11:59:00.000Z",
        }),
        letter({
          id: "33333333-3333-4333-a333-333333333333",
          opened_at: "2026-10-01T00:00:00.000Z",
        }),
      ]),
    } as unknown as DatabaseService;
    const service = new LettersService(db, {} as GardenService);

    const result = await service.list("owner", now);

    expect(result.map((item) => item.status)).toEqual([
      "upcoming",
      "ready",
      "opened",
    ]);
    expect(result.every((item) => !("content" in item))).toBe(true);
    expect(db.list).toHaveBeenCalledWith("letters", "owner", {
      active: true,
      limit: 100,
    });
  });

  test("allows owner-scoped edits only before the open date", async () => {
    const db = {
      one: jest.fn().mockResolvedValue(letter()),
      update: jest.fn().mockResolvedValue(letter({ title: "Tên mới" })),
    } as unknown as DatabaseService;
    const service = new LettersService(db, {} as GardenService);

    await service.update("owner", letter().id, { title: "Tên mới" }, now);

    expect(db.one).toHaveBeenCalledWith("letters", "owner", letter().id, true);
    expect(db.update).toHaveBeenCalledWith(
      "letters",
      "owner",
      letter().id,
      expect.objectContaining({ title: "Tên mới" }),
    );

    (db.one as jest.Mock).mockResolvedValueOnce(
      letter({ open_at: now.toISOString() }),
    );
    await expect(
      service.update("owner", letter().id, { title: "Quá muộn" }, now),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("opens only a ready letter and grows a flower without late penalty", async () => {
    const ready = letter({ open_at: "2026-10-01T00:00:00.000Z" });
    const opened = letter({
      open_at: ready.open_at,
      opened_at: now.toISOString(),
    });
    const db = {
      one: jest.fn().mockResolvedValue(ready),
      update: jest.fn().mockResolvedValue(opened),
    } as unknown as DatabaseService;
    const garden = {
      award: jest.fn().mockResolvedValue(undefined),
    } as unknown as GardenService;
    const service = new LettersService(db, garden);

    await expect(service.open("owner", ready.id, now)).resolves.toEqual(opened);
    expect(garden.award).toHaveBeenCalledWith(
      "owner",
      `letter-flower:${ready.id}`,
    );

    (db.one as jest.Mock).mockResolvedValueOnce(letter());
    await expect(service.open("owner", ready.id, now)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  test("soft deletes only through an owner-scoped repository update", async () => {
    const db = {
      update: jest
        .fn()
        .mockResolvedValue(letter({ deleted_at: now.toISOString() })),
    } as unknown as DatabaseService;
    const service = new LettersService(db, {} as GardenService);

    await service.delete("owner", letter().id, now);

    expect(db.update).toHaveBeenCalledWith("letters", "owner", letter().id, {
      deleted_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  });
});
