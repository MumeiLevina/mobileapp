import { DatabaseService } from "../apps/api/src/database/database.service";
import { PersonalMilestonesService } from "../apps/api/src/modules/milestones/personal-milestones.service";
import { GardenService } from "../apps/api/src/modules/garden/garden.service";
import { PersonalMilestoneKey } from "../packages/shared/src";

test("milestones are listed and acknowledged only in the authenticated owner scope", async () => {
  const db = {
    list: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: "milestone-1" }),
  } as unknown as DatabaseService;
  const service = new PersonalMilestonesService(db);

  await service.list("owner-a");
  await service.acknowledge("owner-a", "milestone-1");

  expect(db.list).toHaveBeenCalledWith("personal_milestones", "owner-a", {
    limit: 50,
  });
  expect(db.update).toHaveBeenCalledWith(
    "personal_milestones",
    "owner-a",
    "milestone-1",
    expect.objectContaining({ acknowledged_at: expect.any(String) }),
  );
});

test("garden unlocks record one of the finite gentle milestone keys", async () => {
  const db = { rpc: jest.fn() } as unknown as DatabaseService;
  const milestones = { record: jest.fn() };
  const garden = new GardenService(
    db,
    milestones as unknown as PersonalMilestonesService,
  );

  await garden.unlock("owner", "letter_tree", "letter", "letter-1");

  expect(milestones.record).toHaveBeenCalledWith(
    "owner",
    "first_letter",
    "letter",
    "letter-1",
  );
});

test("milestone vocabulary has no streak, missed-day, XP or failure event", () => {
  expect(PersonalMilestoneKey.options.join(" ")).not.toMatch(
    /streak|missed|overdue|failed|failure|xp/i,
  );
});
