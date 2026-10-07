import { DatabaseService } from "../apps/api/src/database/database.service";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";

test("sanctuary returns deterministic persisted areas and activates cottage without usage history", async () => {
  const db = {
    rpc: jest.fn().mockResolvedValue(undefined),
    one: jest.fn().mockResolvedValue({
      growth_points: 2,
      tree_level: 1,
      unlocked_items: ["plants"],
    }),
    list: jest.fn().mockResolvedValue([
      {
        id: "unlock-1",
        feature_key: "quiet_cottage",
        unlocked_at: "2026-10-07T00:00:00.000Z",
        source_type: "feature_activation",
        source_id: null,
      },
      {
        id: "unlock-2",
        feature_key: "letter_tree",
        unlocked_at: "2026-10-07T01:00:00.000Z",
        source_type: "letter",
        source_id: "letter-1",
      },
    ]),
  } as unknown as DatabaseService;
  const service = new GardenService(db);

  await expect(service.get("owner")).resolves.toMatchObject({
    growth_points: 2,
    sanctuary_areas: ["quiet_cottage", "letter_tree"],
  });
  expect(db.rpc).toHaveBeenCalledWith("unlock_garden_area", {
    p_user: "owner",
    p_feature: "quiet_cottage",
    p_source_type: "feature_activation",
    p_source_id: null,
  });
});

test("unlock requests contain no mood, inactivity, streak or penalty mutation", async () => {
  const db = { rpc: jest.fn() } as unknown as DatabaseService;
  const service = new GardenService(db);

  await service.unlock("owner", "path_stones", "soft_goal", "goal-1");

  expect(db.rpc).toHaveBeenCalledTimes(1);
  expect(db.rpc).toHaveBeenCalledWith("unlock_garden_area", {
    p_user: "owner",
    p_feature: "path_stones",
    p_source_type: "soft_goal",
    p_source_id: "goal-1",
  });
  expect(JSON.stringify((db.rpc as jest.Mock).mock.calls)).not.toMatch(
    /mood|sad|streak|missed|decay|remove/i,
  );
});
