import {
  expressionForState,
  resolveAvatarState,
  speakingDurationMs,
} from "../features/avatar/controller";
import {
  parseRendererEvent,
  resolveEmotionalExpression,
} from "../features/avatar/protocol";

const base = {
  hasDraft: false,
  requestPending: false,
  responseJustArrived: false,
  crisis: false,
  failed: false,
};

describe("Snow Neko avatar controller", () => {
  test.each([
    [{ ...base }, "idle"],
    [{ ...base, hasDraft: true }, "listening"],
    [{ ...base, requestPending: true }, "thinking"],
    [{ ...base, responseJustArrived: true }, "speaking"],
    [{ ...base, failed: true }, "error"],
  ] as const)("maps chat context to %s", (context, expected) => {
    expect(resolveAvatarState(context)).toBe(expected);
  });

  test("crisis suppression takes priority over every animated state", () => {
    expect(
      resolveAvatarState({
        ...base,
        crisis: true,
        hasDraft: true,
        requestPending: true,
        responseJustArrived: true,
        failed: true,
      }),
    ).toBe("resting");
    expect(expressionForState("speaking", false, true)).toBeNull();
  });

  test("reduced motion suppresses expression animation", () => {
    expect(expressionForState("speaking", true, false)).toBeNull();
    expect(speakingDurationMs("a response", true)).toBe(0);
  });

  test("registered emotional expressions are used and unknown events fail closed", () => {
    expect(expressionForState("thinking", false, false)).toBe("sullen_face");
    expect(
      parseRendererEvent(
        '{"version":1,"type":"stateChanged","state":"invented"}',
      ),
    ).toBeNull();
    expect(parseRendererEvent("not-json")).toBeNull();
  });

  test("missing or appearance-only expressions fall back to neutral", () => {
    const available = new Set(["blushing", "hat"]);
    expect(resolveEmotionalExpression("blushing", available)).toBe("blushing");
    expect(resolveEmotionalExpression("love", available)).toBeNull();
    expect(resolveEmotionalExpression("hat", available)).toBeNull();
  });

  test("speaking cues are bounded", () => {
    expect(speakingDurationMs("ok", false)).toBe(1_200);
    expect(speakingDurationMs("x".repeat(1_000), false)).toBe(6_000);
  });
});
