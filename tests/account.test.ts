import { ServiceUnavailableException } from "@nestjs/common";
import { AccountExportService } from "../apps/api/src/modules/account/account-export.service";
import { AccountController } from "../apps/api/src/modules/account/account.controller";
import { DatabaseService } from "../apps/api/src/database/database.service";

describe("account data export", () => {
  test("exports only the authenticated user's user-facing fields and audits counts", async () => {
    const listAllForExport = jest.fn(
      async (table: string, user: string, _columns: string) => [
        { id: `${table}-1`, ownerSeenByRepository: user },
      ],
    );
    const db = {
      insert: jest.fn().mockResolvedValue({ id: "audit-id" }),
      update: jest.fn().mockResolvedValue({}),
      one: jest.fn(async (table: string, user: string) => {
        if (table === "profiles")
          return {
            user_id: user,
            display_name: "Bạn",
            locale: "vi",
            internal: "must not export",
          };
        if (table === "garden_states")
          return { user_id: user, growth_points: 3, internal: "hidden" };
        return { user_id: user, period: "off", timezone: "UTC" };
      }),
      listAllForExport,
    } as unknown as DatabaseService;

    const result = await new AccountExportService(db).create("owner");

    expect(result.schemaVersion).toBe(4);
    expect(result.data.profile).toEqual({
      display_name: "Bạn",
      locale: "vi",
    });
    expect(result.data.profile).not.toHaveProperty("user_id");
    expect(result.data.garden).toEqual({ growth_points: 3 });
    expect(
      listAllForExport.mock.calls.every((call) => call[1] === "owner"),
    ).toBe(true);
    const memoryCall = listAllForExport.mock.calls.find(
      (call) => call[0] === "memories",
    );
    const messageCall = listAllForExport.mock.calls.find(
      (call) => call[0] === "messages",
    );
    expect(memoryCall?.[2]).not.toMatch(/embedding|confidence|user_id/);
    expect(messageCall?.[2]).not.toMatch(/safety_level|user_id/);
    expect(db.update).toHaveBeenCalledWith(
      "data_export_audits",
      "owner",
      "audit-id",
      expect.objectContaining({
        status: "completed",
        record_counts: expect.objectContaining({
          memories: 1,
          messages: 1,
        }),
      }),
    );
  });

  test("marks export audit failed without returning a partial package", async () => {
    const db = {
      insert: jest.fn().mockResolvedValue({ id: "audit-id" }),
      update: jest.fn().mockResolvedValue({}),
      one: jest.fn().mockRejectedValue(new Error("database unavailable")),
      listAllForExport: jest.fn().mockResolvedValue([]),
    } as unknown as DatabaseService;
    await expect(new AccountExportService(db).create("owner")).rejects.toThrow(
      "database unavailable",
    );
    expect(db.update).toHaveBeenCalledWith(
      "data_export_audits",
      "owner",
      "audit-id",
      expect.objectContaining({ status: "failed" }),
    );
  });

  test("repository export pagination always scopes every page to the owner", async () => {
    const ownerFilters: string[] = [];
    let page = 0;
    const query = {
      select: () => query,
      eq: (_field: string, value: string) => {
        ownerFilters.push(value);
        return query;
      },
      order: () => query,
      range: async () => ({
        data:
          page++ === 0
            ? Array.from({ length: 500 }, (_, id) => ({ id }))
            : [{ id: 500 }],
        error: null,
      }),
    };
    const service = Object.create(DatabaseService.prototype) as DatabaseService;
    Object.defineProperty(service, "admin", {
      value: { from: jest.fn(() => query) },
    });

    const rows = await service.listAllForExport(
      "messages",
      "verified-owner",
      "id,content",
    );
    expect(rows).toHaveLength(501);
    expect(ownerFilters).toEqual(["verified-owner", "verified-owner"]);
  });
});

describe("account deletion", () => {
  test("deletes only the authenticated Supabase user", async () => {
    const deleteUser = jest.fn().mockResolvedValue({ error: null });
    const controller = new AccountController(
      {
        admin: { auth: { admin: { deleteUser } } },
      } as unknown as DatabaseService,
      {} as AccountExportService,
    );
    await expect(controller.remove("verified-owner")).resolves.toEqual({
      ok: true,
    });
    expect(deleteUser).toHaveBeenCalledWith("verified-owner");
  });

  test("returns a generic service failure when Supabase deletion fails", async () => {
    const deleteUser = jest.fn().mockResolvedValue({ error: new Error() });
    const controller = new AccountController(
      {
        admin: { auth: { admin: { deleteUser } } },
      } as unknown as DatabaseService,
      {} as AccountExportService,
    );
    await expect(controller.remove("verified-owner")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
