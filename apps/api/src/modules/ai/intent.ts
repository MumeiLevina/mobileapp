import { ConversationMode, IntentResult } from "@mori/shared";
import { fold } from "../safety/safety.service";
export function classifyIntent(
  text: string,
  mode: ConversationMode,
): IntentResult {
  const t = fold(text);
  const adviceRequested =
    mode === "think" ||
    /(nen lam gi|cho.*loi khuyen|what should|advice)/.test(t);
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
