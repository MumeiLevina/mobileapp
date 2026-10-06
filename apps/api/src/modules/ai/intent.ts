import { ConversationMode, IntentResult } from "@mori/shared";
import { fold } from "../safety/safety.service";
export function classifyIntent(
  text: string,
  mode: ConversationMode,
): IntentResult {
  const t = fold(text).replace(/[^a-z0-9]+/g, " ");
  const declinesAdvice =
    /(khong.*loi khuyen|chi.*lang nghe|dung.*khuyen|no advice|just listen|do not want advice|don t want advice)/.test(
      t,
    );
  const adviceRequested =
    !declinesAdvice &&
    (mode === "think" ||
      /(nen lam gi|cho.*loi khuyen|what should|can you advise|need advice)/.test(
        t,
      ));
  const intent = /(nhat ky|journal)/.test(t)
    ? "JOURNAL"
    : /(bai tho|self.care|thu gian)/.test(t)
      ? "SELF_CARE"
      : /(vui qua|thanh cong|so happy|celebrate)/.test(t)
        ? "CELEBRATE"
        : adviceRequested
          ? "ADVICE"
          : mode === "understand"
            ? "REFLECT"
            : "LISTEN";
  return {
    intent,
    emotion: /(buon|sad)/.test(t)
      ? "sadness"
      : /(met|tired)/.test(t)
        ? "tiredness"
        : "unspecified",
    intensity: 0.5,
    adviceRequested,
    safetyLevel: "normal",
  };
}
