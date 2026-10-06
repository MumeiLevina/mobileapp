import { AskMoriService } from "../apps/api/src/modules/insights/ask-mori.service";
import { DatabaseService } from "../apps/api/src/database/database.service";
import {
  SafetyService,
  CrisisResponseService,
} from "../apps/api/src/modules/safety/safety.service";
import { OutputGuard } from "../apps/api/src/ai/guards/output.guard";
import { MockLLMProvider } from "../apps/api/src/ai/providers/mock.provider";

const profile = { locale: "vi", companion_style: "gentle" };

function setup(rows: Record<string, unknown[]> = {}) {
  const provider = new MockLLMProvider();
  const db = {
    one: jest.fn().mockResolvedValue(profile),
    list: jest.fn(async (table: string) => rows[table] ?? []),
    insert: jest.fn(),
    listVerifiedCrisisResources: jest.fn().mockResolvedValue([]),
  };
  return {
    db,
    provider,
    service: new AskMoriService(
      db as unknown as DatabaseService,
      new SafetyService(provider),
      new CrisisResponseService(db as unknown as DatabaseService),
      new OutputGuard(provider),
      provider,
    ),
  };
}

test("retrieves only approved active memories and returns bounded traceable sources", async () => {
  const { service, db } = setup({
    memories: [
      {
        id: "memory-1",
        content: "Walking helps me pause after work",
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
    journals: Array.from({ length: 20 }, (_, index) => ({
      id: `journal-${index}`,
      title: "Work and walking",
      content: "A short walk after work",
      created_at: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    })),
  });

  const result = await service.ask("owner", "What have I said about work?");

  expect(result.sources.length).toBeLessThanOrEqual(12);
  expect(result.sources[0]).not.toHaveProperty("text");
  expect(db.list).toHaveBeenCalledWith("memories", "owner", {
    active: true,
    equals: { approved_by_user: true },
    limit: 40,
  });
  expect(db.list).toHaveBeenCalledWith("journals", "owner", {
    active: true,
    limit: 40,
  });
  expect(result.answer).toContain("không phải bằng chứng về nguyên nhân");
});

test("crisis question bypasses personal-data retrieval and normal generation", async () => {
  const { service, db, provider } = setup();
  const generate = jest.spyOn(provider, "generateText");

  const result = await service.ask("owner", "Tôi muốn tự tử ngay bây giờ");

  expect(result.safetyLevel).toBe("crisis");
  expect(result.sources).toEqual([]);
  expect(db.list).not.toHaveBeenCalled();
  expect(db.insert).toHaveBeenCalledWith("safety_events", "owner", {
    level: "crisis",
    requires_escalation: true,
    classifier_status: "classified",
  });
  expect(generate).not.toHaveBeenCalled();
});

test("returns an honest empty state when no user data is available", async () => {
  const { service } = setup();
  const result = await service.ask("owner", "What helps me lately?");
  expect(result.sources).toEqual([]);
  expect(result.answer).toContain("chưa có đủ thông tin");
});
