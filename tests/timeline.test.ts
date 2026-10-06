import { TimelineService } from "../apps/api/src/modules/reflections/timeline.service";
import { DatabaseService } from "../apps/api/src/database/database.service";

const rows: Record<string, Record<string, unknown>[]> = {
  mood_entries: [
    {
      id: "mood",
      mood: "good",
      tags: ["Work"],
      optional_note: "A calmer afternoon",
      created_at: "2026-10-05T12:00:00Z",
    },
  ],
  journals: [
    {
      id: "journal",
      title: "A page",
      content: "Private entry",
      created_at: "2026-10-04T12:00:00Z",
    },
  ],
  conversations: [],
  self_care_sessions: [
    {
      id: "care",
      activity_id: "walk",
      completed_at: "2026-10-06T12:00:00Z",
    },
  ],
  life_map_items: [
    {
      id: "event",
      title: "Started a new role",
      description: "A meaningful day",
      created_at: "2026-10-03T12:00:00Z",
    },
  ],
  garden_unlocks: [],
};

function setup() {
  const db = {
    list: jest.fn(
      async (table: string, _user: string, _options?: unknown) =>
        rows[table] ?? [],
    ),
  };
  return {
    db,
    service: new TimelineService(db as unknown as DatabaseService),
  };
}

test("timeline reads only bounded owner-scoped active sources and sorts moments", async () => {
  const { db, service } = setup();
  const result = await service.list("owner", "all");
  expect(result.map((item) => item.type)).toEqual([
    "self_care",
    "mood",
    "journal",
    "important_event",
  ]);
  expect(db.list.mock.calls.every((call) => call[1] === "owner")).toBe(true);
  expect(db.list).toHaveBeenCalledWith("journals", "owner", {
    active: true,
    limit: 100,
  });
  expect(db.list).toHaveBeenCalledWith("life_map_items", "owner", {
    active: true,
    equals: { type: "important_events", approved_by_user: true },
    limit: 100,
  });
});

test("timeline filters do not turn personal history into an inferred feed", async () => {
  const { service } = setup();
  expect(
    (await service.list("owner", "mood")).map((item) => item.type),
  ).toEqual(["mood"]);
  expect(
    (await service.list("owner", "important_moment")).map((item) => item.type),
  ).toEqual(["important_event"]);
});
