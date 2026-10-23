import { HealthController } from "../apps/api/src/modules/health/health.controller";
import { AuthGuard } from "../apps/api/src/common/auth.guard";
import { DatabaseService } from "../apps/api/src/database/database.service";

describe("health endpoint", () => {
  it("returns a minimal readiness response without environment details", () => {
    expect(new HealthController().health()).toEqual({ status: "ok" });
  });

  it("is explicitly public while other API routes stay authenticated", async () => {
    const controller = new HealthController();
    const guard = new AuthGuard({} as DatabaseService);
    const context = {
      getHandler: () => controller.health,
      getClass: () => HealthController,
      switchToHttp: () => {
        throw new Error("public health must not inspect authorization");
      },
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
