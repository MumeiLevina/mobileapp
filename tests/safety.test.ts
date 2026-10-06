import {
  classifyLexicalSafety,
  SafetyService,
  CrisisResponseService,
} from "../apps/api/src/modules/safety/safety.service";
import {
  lexicalOutputSafe,
  OutputGuard,
  SAFE_FALLBACK,
} from "../apps/api/src/ai/guards/output.guard";
import { MockLLMProvider } from "../apps/api/src/ai/providers/mock.provider";
import { LLMProvider } from "../apps/api/src/ai/providers/provider";
import { classifyIntent } from "../apps/api/src/modules/ai/intent";

describe("independent safety classifier", () => {
  test.each([
    "Tôi muốn tự tử ngay bây giờ",
    "I will kill myself tonight",
    "Tôi muốn giết người ngay bây giờ",
  ])("escalates immediate risk: %s", (text) => {
    const result = classifyLexicalSafety(text);
    expect(result.requiresEscalation).toBe(true);
    expect(result.level).toBe("crisis");
  });
  test("elevated risk never enters ordinary flow", () =>
    expect(classifyLexicalSafety("Mình không muốn sống nữa").level).toBe(
      "elevated",
    ));
  test("ordinary sadness is not a diagnosis or crisis", () =>
    expect(classifyLexicalSafety("Hôm nay mình buồn").level).toBe("distress"));
  test("provider failure is not silently interpreted as safe", async () => {
    const provider = {
      generateStructured: jest.fn().mockRejectedValue(new Error("offline")),
    } as unknown as LLMProvider;
    await expect(
      new SafetyService(provider).classifySafety("I feel strange"),
    ).rejects.toThrow("offline");
  });
  test("contradictory provider flags still escalate", async () => {
    const provider = {
      generateStructured: jest
        .fn()
        .mockResolvedValue({
          level: "normal",
          selfHarmRisk: true,
          violenceRisk: false,
          requiresEscalation: false,
        }),
    } as unknown as LLMProvider;
    expect(
      (await new SafetyService(provider).classifySafety("some input"))
        .requiresEscalation,
    ).toBe(true);
  });
  test("crisis response directs toward real human help", () => {
    const response = new CrisisResponseService().respond();
    expect(response).toContain("người bạn tin tưởng");
    expect(response).not.toMatch(/gia đình sẽ buồn|hứa với mình|chỉ có mình/i);
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
    "Bạn bị trầm cảm.",
    "You have anxiety disorder.",
    "Take 20mg tonight.",
  ])("rejects prohibited output: %s", (text) =>
    expect(lexicalOutputSafe(text, false)).toBe(false),
  );
  test("rejects fabricated memory", () =>
    expect(lexicalOutputSafe("I remember your sister.", false)).toBe(false));
  test("replaces unsafe output", async () =>
    expect(
      await new OutputGuard(new MockLLMProvider()).validateResponse(
        "You only need me.",
        [],
        "Hi",
      ),
    ).toBe(SAFE_FALLBACK));
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
