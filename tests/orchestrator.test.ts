import { AIOrchestratorService } from "../apps/api/src/modules/ai/orchestrator.service";
import { DatabaseService } from "../apps/api/src/database/database.service";
import {
  SafetyService,
  CrisisResponseService,
} from "../apps/api/src/modules/safety/safety.service";
import { MemoriesService } from "../apps/api/src/modules/memories/memories.service";
import { OutputGuard } from "../apps/api/src/ai/guards/output.guard";
import { MockLLMProvider } from "../apps/api/src/ai/providers/mock.provider";
import { SelfCareService } from "../apps/api/src/modules/selfcare/selfcare.service";
function setup() {
  const provider = new MockLLMProvider();
  const repository = {
    one: jest
      .fn()
      .mockResolvedValue({ companion_style: "gentle", locale: "vi" }),
    list: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    rpc: jest.fn().mockResolvedValue([{ id: "reply", role: "assistant" }]),
  };
  const memories = {
    retrieveMemories: jest.fn().mockResolvedValue([]),
    add: jest.fn(),
  };
  const selfCare = { suggestSelfCare: jest.fn() };
  return {
    provider,
    repository,
    memories,
    service: new AIOrchestratorService(
      repository as unknown as DatabaseService,
      new SafetyService(provider),
      new CrisisResponseService(),
      memories as unknown as MemoriesService,
      new OutputGuard(provider),
      provider,
      selfCare as unknown as SelfCareService,
    ),
  };
}
test("crisis bypasses companion, memory retrieval, self-care and candidate extraction", async () => {
  const { service, provider, memories, repository } = setup();
  const generate = jest.spyOn(provider, "generateText");
  const response = await service.processUserMessage(
    "user",
    "conversation",
    "Tôi muốn tự tử ngay bây giờ",
    "think",
    "client",
  );
  expect(response.safetyLevel).toBe("crisis");
  expect(generate).not.toHaveBeenCalled();
  expect(memories.retrieveMemories).not.toHaveBeenCalled();
  expect(memories.add).not.toHaveBeenCalled();
  expect(repository.insert).toHaveBeenCalledWith("safety_events", "user", {
    level: "crisis",
    requires_escalation: true,
  });
  expect(response.activity).toBeUndefined();
});
test("journal generation returns an unsaved draft and never inserts a journal", async () => {
  const { service, repository } = setup();
  expect(await service.journalDraft("user", "conversation")).toMatchObject({
    saved: false,
    source: "conversation",
  });
  expect(repository.insert).not.toHaveBeenCalled();
  expect(repository.rpc).not.toHaveBeenCalled();
});
test("conversation ownership is checked before processing any private input", async () => {
  const { service, repository, provider } = setup();
  repository.one.mockRejectedValueOnce(new Error("Not found"));
  const generate = jest.spyOn(provider, "generateText");
  await expect(
    service.processUserMessage(
      "other-user",
      "conversation",
      "Hello",
      "listen",
      "client",
    ),
  ).rejects.toThrow("Not found");
  expect(generate).not.toHaveBeenCalled();
});
