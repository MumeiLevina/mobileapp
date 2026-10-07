import { FirstAidController } from "../apps/api/src/modules/safety/first-aid.controller";
import { CrisisResponseService } from "../apps/api/src/modules/safety/safety.service";

test("First Aid danger delegates only to the deterministic crisis response", async () => {
  const crisis = {
    respond: jest.fn().mockResolvedValue({ message: "safe", resources: [] }),
  } as unknown as CrisisResponseService;
  const controller = new FirstAidController(crisis);

  await expect(controller.danger()).resolves.toEqual({
    message: "safe",
    resources: [],
  });
  expect(crisis.respond).toHaveBeenCalledWith("vi");
});
