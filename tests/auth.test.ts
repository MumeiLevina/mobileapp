import { UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "../apps/api/src/common/auth.guard";
import { DatabaseService } from "../apps/api/src/database/database.service";

function context(authorization?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as never;
}

describe("Supabase Auth guard", () => {
  test("rejects a missing bearer token without an auth call", async () => {
    const getUser = jest.fn();
    const guard = new AuthGuard({
      admin: { auth: { getUser } },
    } as unknown as DatabaseService);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getUser).not.toHaveBeenCalled();
  });

  test("derives user ID only from the verified token", async () => {
    const request = {
      headers: { authorization: "Bearer signed-token" },
      body: { user_id: "attacker" },
    };
    const db = {
      admin: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "verified-user" } },
            error: null,
          }),
        },
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
    await expect(
      new AuthGuard(db as unknown as DatabaseService).canActivate(ctx),
    ).resolves.toBe(true);
    expect(request).toHaveProperty("userId", "verified-user");
    expect(request.body.user_id).toBe("attacker");
  });

  test("rejects expired or invalid tokens reported by Supabase", async () => {
    const db = {
      admin: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("expired"),
          }),
        },
      },
    };
    await expect(
      new AuthGuard(db as unknown as DatabaseService).canActivate(
        context("Bearer expired"),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("service-role repository ownership", () => {
  test("insert overwrites and update removes caller-controlled user_id", async () => {
    const calls: {
      insert?: Record<string, unknown>;
      update?: Record<string, unknown>;
    } = {};
    const terminal = {
      eq: () => terminal,
      select: () => terminal,
      single: async () => ({ data: {}, error: null }),
      maybeSingle: async () => ({ data: {}, error: null }),
    };
    const from = jest.fn(() => ({
      insert: (value: Record<string, unknown>) => {
        calls.insert = value;
        return terminal;
      },
      update: (value: Record<string, unknown>) => {
        calls.update = value;
        return terminal;
      },
    }));
    const service = Object.create(DatabaseService.prototype) as DatabaseService;
    Object.defineProperty(service, "admin", { value: { from } });
    await service.insert("journals", "owner", {
      user_id: "attacker",
      title: "safe",
    });
    await service.update("journals", "owner", "id", {
      user_id: "attacker",
      title: "safe",
    });
    expect(calls.insert?.user_id).toBe("owner");
    expect(calls.update).not.toHaveProperty("user_id");
  });
});
