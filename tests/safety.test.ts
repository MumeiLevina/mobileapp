import { CrisisResource } from "@mori/shared";
import {
  classifyLexicalSafety,
  CrisisResponseService,
  safetyClassifierPrompt,
  SafetyService,
} from "../apps/api/src/modules/safety/safety.service";
import {
  lexicalOutputSafe,
  OutputGuard,
  SAFE_FALLBACK,
} from "../apps/api/src/ai/guards/output.guard";
import { MockLLMProvider } from "../apps/api/src/ai/providers/mock.provider";
import { LLMProvider } from "../apps/api/src/ai/providers/provider";
import { classifyIntent } from "../apps/api/src/modules/ai/intent";
import { DatabaseService } from "../apps/api/src/database/database.service";

const providerWith = (
  generateStructured: LLMProvider["generateStructured"],
): LLMProvider => ({
  generateStructured,
  generateText: jest.fn().mockResolvedValue("draft"),
  embed: jest.fn().mockResolvedValue([]),
});

describe("independent safety classifier", () => {
  test.each([
    "Tôi muốn tự tử ngay bây giờ",
    "I will kill myself tonight",
    "Tôi muốn giết người ngay bây giờ",
    "mình có dao ở đây",
    "uống hết thuốc có sao không",
    "tối nay mình sẽ làm",
  ])("escalates immediate risk: %s", (text) => {
    const result = classifyLexicalSafety(text);
    expect(result.requiresEscalation).toBe(true);
    expect(result.level).toBe("crisis");
  });

  test.each([
    "chắc không có mình mọi người sẽ tốt hơn",
    "Không có mình chắc mọi người sẽ nhẹ nhõm hơn.",
    "mình muốn biến mất",
    "giá mà ngủ rồi không dậy nữa",
    "mình muốn kết thúc hết",
    "không chịu nổi nữa",
    "mình đã chuẩn bị rồi",
    "minh khong muon song nua",
  ])("escalates indirect Vietnamese risk: %s", (text) => {
    const result = classifyLexicalSafety(text);
    expect(result.requiresEscalation).toBe(true);
    expect(["elevated", "crisis"]).toContain(result.level);
  });

  // Benign cases that must NOT escalate
  test.each([
    "Không có mình, bạn có thể đi cùng.",
    "Không có mình thì ai làm việc này?",
    "Chắc có mình thôi, không ai giúp được.",
    "Không có mình đâu, đừng lo.",
  ])("does not escalate benign khong-co-minh: %s", (text) => {
    const result = classifyLexicalSafety(text);
    expect(result.requiresEscalation).toBe(false);
    expect(["normal", "distress"]).toContain(result.level);
  });

  test.each([
    "t ự t ử",
    "t.u t.u",
    "ｍình will kill myself tối nay",
    "sui cide tonight",
  ])("normalizes spacing, accents, typos and unicode: %s", (text) => {
    expect(classifyLexicalSafety(text).requiresEscalation).toBe(true);
  });

  test("ordinary sadness is distress without diagnosis", () =>
    expect(classifyLexicalSafety("Hôm nay mình buồn")).toMatchObject({
      level: "distress",
      requiresEscalation: false,
    }));

  test.each([
    "Chào Mori, hôm nay mình cảm thấy bình yên.",
    "Mình đang rất vui vì hôm nay được nghỉ.",
    "Hôm nay thời tiết đẹp quá.",
    "Cậu có muốn trò chuyện một chút không?",
    "Như mình vừa nói, hôm nay là một ngày khá vui.",
  ])("keeps harmless Vietnamese conversation normal: %s", (text) => {
    expect(classifyLexicalSafety(text)).toEqual({
      level: "normal",
      selfHarmRisk: false,
      violenceRisk: false,
      requiresEscalation: false,
    });
  });

  test.each([
    "Hôm nay mình buồn.",
    "Mình hơi mệt sau một ngày dài.",
    "Dạo này mình thấy cô đơn.",
    "Công việc làm mình khá căng thẳng và quá tải.",
  ])("keeps mild distress non-escalating: %s", (text) => {
    expect(classifyLexicalSafety(text)).toMatchObject({
      level: "distress",
      requiresEscalation: false,
    });
  });

  test("gives the model explicit normal, distress, elevated and crisis boundaries", async () => {
    const generateStructured = jest.fn().mockResolvedValue({
      level: "normal",
      selfHarmRisk: false,
      violenceRisk: false,
      requiresEscalation: false,
    });
    const provider = providerWith(generateStructured);

    await expect(
      new SafetyService(provider).classifySafety(
        "Chào Mori, hôm nay mình cảm thấy bình yên.",
      ),
    ).resolves.toMatchObject({
      level: "normal",
      requiresEscalation: false,
    });
    expect(generateStructured.mock.calls[0][0][0]).toEqual({
      role: "system",
      content: safetyClassifierPrompt,
    });
    expect(safetyClassifierPrompt).toContain("normal = greetings");
    expect(safetyClassifierPrompt).toContain("distress = sadness");
    expect(safetyClassifierPrompt).toContain("elevated = credible");
    expect(safetyClassifierPrompt).toContain("crisis = immediate/current");
  });

  test("provider failure becomes an unavailable safety decision", async () => {
    const provider = providerWith(
      jest.fn().mockRejectedValue(new Error("offline")),
    );
    await expect(
      new SafetyService(provider).classifySafety("I feel strange"),
    ).resolves.toMatchObject({
      level: "elevated",
      requiresEscalation: true,
      classifierStatus: "unavailable",
    });
  });

  test("an impossible provider schema fails closed", async () => {
    const provider = providerWith(
      jest.fn().mockResolvedValue({ level: "impossible" }),
    );
    await expect(
      new SafetyService(provider).classifySafety("ordinary input"),
    ).resolves.toMatchObject({ classifierStatus: "unavailable" });
  });

  test("contradictory provider flags still escalate", async () => {
    const provider = providerWith(
      jest.fn().mockResolvedValue({
        level: "normal",
        selfHarmRisk: true,
        violenceRisk: false,
        requiresEscalation: false,
      }),
    );
    await expect(
      new SafetyService(provider).classifySafety("some input"),
    ).resolves.toMatchObject({
      level: "elevated",
      requiresEscalation: true,
      classifierStatus: "classified",
    });
  });

  test("crisis response uses verified resources and directs to human help", async () => {
    const resource: CrisisResource = {
      id: "resource",
      country_code: null,
      region: null,
      resource_type: "support_service",
      name: "Verified support",
      phone: null,
      url: "https://example.test/help",
      available_hours: null,
      language: "vi",
    };
    const db = {
      listVerifiedCrisisResources: jest.fn().mockResolvedValue([resource]),
    } as unknown as DatabaseService;
    const response = await new CrisisResponseService(db).respond();
    expect(response.message).toContain("người bạn tin tưởng");
    expect(response.message).not.toMatch(
      /gia đình sẽ buồn|hứa với mình|chỉ có mình/i,
    );
    expect(response.resources).toEqual([resource]);
  });

  test("crisis response keeps generic guidance when directory is down", async () => {
    const db = {
      listVerifiedCrisisResources: jest.fn().mockRejectedValue(new Error()),
    } as unknown as DatabaseService;
    const response = await new CrisisResponseService(db).respond("en");
    expect(response.resources).toEqual([]);
    expect(response.message).toContain("local emergency services");
  });
});

describe("output guard", () => {
  test.each([
    "You only need me.",
    "I'll never leave you.",
    "I'm all you need.",
    "Nobody understands you like I do.",
    "Don't tell anyone else.",
    "I love you more than they do.",
    "Mori misses you.",
    "I need you.",
    "Stay with me.",
    "Don't leave.",
    "You haven't talked to me today.",
    "I'm jealous.",
    "Bạn bị trầm cảm.",
    "Bạn mắc rối loạn lo âu.",
    "You have anxiety disorder.",
    "Take 20mg tonight.",
    "Ngừng thuốc đi.",
    "This will cure you.",
    "Bạn chắc chắn sẽ khỏi.",
  ])("rejects prohibited output: %s", (text) =>
    expect(lexicalOutputSafe(text, false)).toBe(false),
  );

  test.each([
    "I remember you said your sister called.",
    "You told me that you live alone.",
    "Mình nhớ bạn từng nói về công việc.",
  ])("rejects an unsupported memory claim: %s", (text) =>
    expect(lexicalOutputSafe(text, false)).toBe(false),
  );

  test("passes a possible session reference to the semantic reviewer", () => {
    expect(lexicalOutputSafe("You told me that today was joyful.", false, true)).toBe(
      true,
    );
  });

  test("replaces unsafe output before model review", async () => {
    await expect(
      new OutputGuard(new MockLLMProvider()).validateResponse(
        "You only need me.",
        [],
        "Hi",
      ),
    ).resolves.toBe(SAFE_FALLBACK);
  });

  test("reviewer rejection and reviewer failure both return fallback", async () => {
    const rejected = providerWith(
      jest.fn().mockResolvedValue({
        safe: false,
        reason: "unsupported_memory",
      }),
    );
    await expect(
      new OutputGuard(rejected).validateResponse("A calm reply", [], "Hi"),
    ).resolves.toBe(SAFE_FALLBACK);

    const unavailable = providerWith(
      jest.fn().mockRejectedValue(new Error("reviewer down")),
    );
    await expect(
      new OutputGuard(unavailable).validateResponse("Unsafe draft", [], "Hi"),
    ).resolves.toBe(SAFE_FALLBACK);
  });

  test("allows a response grounded in ephemeral session context", async () => {
    const generateStructured = jest.fn().mockResolvedValue({
      safe: true,
      reason: "safe",
    });
    const provider = providerWith(generateStructured);
    const response = "Bạn đã nói với mình rằng hôm nay là một ngày khá vui.";
    const session = ["Hôm nay là một ngày khá vui."];

    await expect(
      new OutputGuard(provider).validateResponse(
        response,
        [],
        "Bạn còn nhớ điều mình vừa nói không?",
        session,
      ),
    ).resolves.toBe(response);

    const messages = generateStructured.mock.calls[0][0];
    expect(JSON.parse(messages[1].content)).toMatchObject({
      approvedMemories: [],
      currentSessionMessages: session,
    });
  });

  test("records a privacy-safe reviewer rejection category", async () => {
    const provider = providerWith(
      jest.fn().mockResolvedValue({
        safe: false,
        reason: "emotional_dependency",
      }),
    );
    const metrics = {
      outputGuardRejected: jest.fn(),
    };

    await new OutputGuard(provider, metrics as never).validateResponse(
      "A response",
      [],
      "An input",
    );

    expect(metrics.outputGuardRejected).toHaveBeenCalledWith(
      "reviewer",
      "emotional_dependency",
    );
  });
});

describe("intent router", () => {
  test("listen has no default advice permission", () =>
    expect(classifyIntent("Hôm nay mình mệt quá", "listen")).toMatchObject({
      intent: "LISTEN",
      adviceRequested: false,
    }));
  test("explicit request permits advice", () =>
    expect(classifyIntent("Mình nên làm gì?", "listen")).toMatchObject({
      intent: "ADVICE",
      adviceRequested: true,
    }));
  test("understand selects reflection", () =>
    expect(classifyIntent("Mình thấy rối", "understand").intent).toBe(
      "REFLECT",
    ));
  test("recognizes celebration", () =>
    expect(classifyIntent("Mình vui quá", "listen").intent).toBe("CELEBRATE"));
});
