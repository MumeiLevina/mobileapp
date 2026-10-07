import { letterCreateSchema } from "@mori/shared";
import { newId } from "../../lib/id";

export type LetterDelay = "week" | "month" | "quarter" | "year" | "custom";

export type LetterDraft = {
  title: string;
  content: string;
  delay: LetterDelay;
  customDate: string;
  clientId: string;
};

export const createLetterDraft = (): LetterDraft => ({
  title: "",
  content: "",
  delay: "month",
  customDate: "",
  clientId: newId(),
});

export function readLetterDraft(value: string): LetterDraft {
  if (!value) return createLetterDraft();
  try {
    const parsed = JSON.parse(value) as Partial<LetterDraft>;
    if (
      typeof parsed.title === "string" &&
      typeof parsed.content === "string" &&
      ["week", "month", "quarter", "year", "custom"].includes(
        parsed.delay ?? "",
      ) &&
      typeof parsed.customDate === "string" &&
      typeof parsed.clientId === "string"
    ) {
      return parsed as LetterDraft;
    }
  } catch {
    // A corrupt local value starts a fresh draft without touching server data.
  }
  return createLetterDraft();
}

export function letterOpenDate(draft: LetterDraft, now = new Date()): Date {
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (draft.delay === "week") date.setDate(date.getDate() + 7);
  if (draft.delay === "month") date.setMonth(date.getMonth() + 1);
  if (draft.delay === "quarter") date.setMonth(date.getMonth() + 3);
  if (draft.delay === "year") date.setFullYear(date.getFullYear() + 1);
  if (draft.delay === "custom") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.customDate);
    if (!match) throw new Error("Hãy nhập ngày theo dạng YYYY-MM-DD.");
    const custom = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      9,
      0,
      0,
      0,
    );
    if (
      custom.getFullYear() !== Number(match[1]) ||
      custom.getMonth() !== Number(match[2]) - 1 ||
      custom.getDate() !== Number(match[3])
    )
      throw new Error("Ngày bạn chọn chưa hợp lệ.");
    date.setTime(custom.getTime());
  }
  if (date.getTime() <= now.getTime())
    throw new Error("Hãy chọn một ngày trong tương lai.");
  return date;
}

export function letterPayload(draft: LetterDraft, now = new Date()) {
  return letterCreateSchema.parse({
    title: draft.title,
    content: draft.content,
    open_at: letterOpenDate(draft, now).toISOString(),
    client_id: draft.clientId,
  });
}
