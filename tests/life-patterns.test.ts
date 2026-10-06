import { LifePatternsService } from "../apps/api/src/modules/insights/life-patterns.service";
import { DatabaseService } from "../apps/api/src/database/database.service";
import { PATTERN_DISCLAIMER } from "../packages/shared/src";

function setup(rows: Record<string, unknown[]> = {}) {
  const db = {
    list: jest.fn(
      async (table: string, _user: string, _options?: unknown) =>
        rows[table] ?? [],
    ),
    one: jest.fn().mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" }),
  };
  return {
    db,
    service: new LifePatternsService(db as unknown as DatabaseService),
  };
}

test("does not generate a pattern from fewer than five relevant entries", async () => {
  const { service, db } = setup({
    mood_entries: Array.from({ length: 4 }, (_, index) => ({
      id: `mood-${index}`,
      mood: "good",
      tags: ["Work"],
      optional_note: "",
      created_at: `2026-10-0${index + 1}T12:00:00Z`,
    })),
  });
  const result = await service.list("owner");
  expect(result.patterns).toEqual([]);
  expect(result.message).toBe("There's not enough information yet.");
  expect(result.disclaimer).toBe(PATTERN_DISCLAIMER);
  expect(db.list.mock.calls.every((call) => call[1] === "owner")).toBe(true);
});

test("reports a recurring topic only after five supporting records", async () => {
  const { service } = setup({
    mood_entries: Array.from({ length: 5 }, (_, index) => ({
      id: `mood-${index}`,
      mood: "okay",
      tags: ["Work"],
      optional_note: "",
      created_at: `2026-10-0${index + 1}T12:00:00Z`,
    })),
  });
  const result = await service.list("owner");
  expect(result.patterns).toContainEqual(
    expect.objectContaining({
      type: "recurring_topic",
      evidenceCount: 5,
      observation: expect.stringContaining("Công việc"),
    }),
  );
  expect(result.patterns[0].sources[0]).not.toHaveProperty("text");
});

test("mood and activity association stays descriptive and requires five pairs", async () => {
  const sessions = Array.from({ length: 5 }, (_, index) => ({
    id: `session-${index}`,
    activity_id: "walk",
    completed_at: `2026-10-0${index + 1}T10:00:00Z`,
  }));
  const moods = Array.from({ length: 5 }, (_, index) => ({
    id: `mood-${index}`,
    mood: index < 3 ? "good" : "okay",
    tags: [],
    optional_note: "",
    created_at: `2026-10-0${index + 1}T12:00:00Z`,
  }));
  const { service } = setup({
    mood_entries: moods,
    self_care_sessions: sessions,
  });
  const result = await service.list("owner");
  const association = result.patterns.find(
    (pattern) => pattern.type === "mood_activity",
  );
  expect(association?.evidenceCount).toBe(5);
  expect(association?.observation).toContain("chỉ là thứ tự xuất hiện");
  expect(association?.observation.toLowerCase()).not.toMatch(
    /chữa|gây ra|chẩn đoán|cures|causes|diagnos/,
  );
});
